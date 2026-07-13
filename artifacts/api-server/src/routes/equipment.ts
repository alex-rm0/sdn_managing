import { Router, type IRouter } from "express";
import { db, equipmentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateEquipmentBody, UpdateEquipmentBody, GetEquipmentParams, UpdateEquipmentParams, DeleteEquipmentParams, ListEquipmentQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/equipment", requireAuth, async (req, res): Promise<void> => {
  const query = ListEquipmentQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(equipmentTable).orderBy(equipmentTable.name);
  if (query.data.category) rows = rows.filter(e => e.category === query.data.category);
  if (query.data.status) rows = rows.filter(e => e.status === query.data.status);
  res.json(rows);
});

router.post("/equipment", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEquipmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(equipmentTable).values(parsed.data).returning();
  res.status(201).json(item);
});

router.get("/equipment/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetEquipmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [item] = await db.select().from(equipmentTable).where(eq(equipmentTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Equipamento não encontrado" }); return; }
  res.json(item);
});

router.patch("/equipment/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateEquipmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateEquipmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(equipmentTable).set(parsed.data).where(eq(equipmentTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "Equipamento não encontrado" }); return; }
  res.json(item);
});

router.delete("/equipment/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteEquipmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(equipmentTable).where(eq(equipmentTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
