import { Router, type IRouter } from "express";
import { db, crewsTable, crewAthletesTable, athletesTable, seasonsTable, categoryRulesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateCrewBody, UpdateCrewBody, GetCrewParams, UpdateCrewParams, DeleteCrewParams, ListCrewsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichCrew(crew: typeof crewsTable.$inferSelect) {
  const memberships = await db.select({ athleteId: crewAthletesTable.athleteId })
    .from(crewAthletesTable).where(eq(crewAthletesTable.crewId, crew.id));
  const athleteIds = memberships.map(m => m.athleteId);
  let athletes: any[] = [];
  if (athleteIds.length > 0) {
    athletes = await db.select().from(athletesTable).where(inArray(athletesTable.id, athleteIds));
  }
  const [season] = await db.select({ name: seasonsTable.name }).from(seasonsTable).where(eq(seasonsTable.id, crew.seasonId));
  return { ...crew, seasonName: season?.name ?? "", athleteIds, athletes: athletes.map(a => ({ ...a, category: null, categoryOverride: null })) };
}

router.get("/crews", requireAuth, async (req, res): Promise<void> => {
  const query = ListCrewsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(crewsTable).orderBy(crewsTable.name);
  if (query.data.seasonId) rows = rows.filter(c => c.seasonId === Number(query.data.seasonId));
  if (query.data.category) rows = rows.filter(c => c.category === query.data.category);
  const result = await Promise.all(rows.map(enrichCrew));
  res.json(result);
});

router.post("/crews", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCrewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { athleteIds, ...crewData } = parsed.data;
  const [crew] = await db.insert(crewsTable).values(crewData).returning();
  if (athleteIds && athleteIds.length > 0) {
    await db.insert(crewAthletesTable).values(athleteIds.map(id => ({ crewId: crew.id, athleteId: id })));
  }
  res.status(201).json(await enrichCrew(crew));
});

router.get("/crews/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCrewParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [crew] = await db.select().from(crewsTable).where(eq(crewsTable.id, params.data.id));
  if (!crew) { res.status(404).json({ error: "Tripulação não encontrada" }); return; }
  res.json(await enrichCrew(crew));
});

router.patch("/crews/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCrewParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCrewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { athleteIds, ...crewData } = parsed.data;
  const [crew] = await db.update(crewsTable).set(crewData).where(eq(crewsTable.id, params.data.id)).returning();
  if (!crew) { res.status(404).json({ error: "Tripulação não encontrada" }); return; }
  if (athleteIds !== undefined) {
    await db.delete(crewAthletesTable).where(eq(crewAthletesTable.crewId, crew.id));
    if (athleteIds.length > 0) {
      await db.insert(crewAthletesTable).values(athleteIds.map(id => ({ crewId: crew.id, athleteId: id })));
    }
  }
  res.json(await enrichCrew(crew));
});

router.delete("/crews/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCrewParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(crewsTable).where(eq(crewsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
