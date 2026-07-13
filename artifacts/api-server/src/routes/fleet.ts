import { Router, type IRouter } from "express";
import { db, fleetItemsTable, fleetValuationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateFleetItemBody, UpdateFleetItemBody, GetFleetItemParams, UpdateFleetItemParams, DeleteFleetItemParams,
  AddFleetValuationBody, AddFleetValuationParams, ListFleetQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichFleet(item: typeof fleetItemsTable.$inferSelect) {
  const valuations = await db.select().from(fleetValuationsTable)
    .where(eq(fleetValuationsTable.fleetItemId, item.id)).orderBy(desc(fleetValuationsTable.date));
  const latest = valuations[0];
  return {
    ...item,
    currentValue: latest ? Number(latest.value) : null,
    currentValueDate: latest?.date ?? null,
    valuations: valuations.map(v => ({ ...v, value: Number(v.value) })),
  };
}

router.get("/fleet", requireAuth, async (req, res): Promise<void> => {
  const query = ListFleetQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(fleetItemsTable).orderBy(fleetItemsTable.identifier);
  if (query.data.type) rows = rows.filter(i => i.type === query.data.type);
  if (query.data.status) rows = rows.filter(i => i.status === query.data.status);
  const result = await Promise.all(rows.map(enrichFleet));
  res.json(result);
});

router.post("/fleet", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateFleetItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(fleetItemsTable).values(parsed.data).returning();
  res.status(201).json(await enrichFleet(item));
});

router.get("/fleet/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetFleetItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [item] = await db.select().from(fleetItemsTable).where(eq(fleetItemsTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Embarcação não encontrada" }); return; }
  res.json(await enrichFleet(item));
});

router.patch("/fleet/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateFleetItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateFleetItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(fleetItemsTable).set(parsed.data).where(eq(fleetItemsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "Embarcação não encontrada" }); return; }
  res.json(await enrichFleet(item));
});

router.delete("/fleet/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteFleetItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(fleetItemsTable).where(eq(fleetItemsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/fleet/:id/valuations", requireAdmin, async (req, res): Promise<void> => {
  const params = AddFleetValuationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AddFleetValuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [val] = await db.insert(fleetValuationsTable).values({ ...parsed.data, fleetItemId: params.data.id }).returning();
  res.status(201).json({ ...val, value: Number(val.value) });
});

export default router;
