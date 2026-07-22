import { Router, type IRouter } from "express";
import { db, competitionsTable, racesTable, resultsTable, seasonsTable, athletesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateCompetitionBody, UpdateCompetitionBody, GetCompetitionParams, UpdateCompetitionParams, DeleteCompetitionParams, ListCompetitionsQueryParams,
  CreateRaceBody, UpdateRaceBody, GetRaceParams, UpdateRaceParams, DeleteRaceParams, ListRacesQueryParams,
  CreateResultBody, UpdateResultBody, GetResultParams, UpdateResultParams, DeleteResultParams, ListResultsQueryParams,
  GetSeasonResultsSummaryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Competitions ──────────────────────────────────────────────────────────────
router.get("/competitions", requireAuth, async (req, res): Promise<void> => {
  const query = ListCompetitionsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(competitionsTable).orderBy(competitionsTable.startDate);
  if (query.data.seasonId) rows = rows.filter(c => c.seasonId === Number(query.data.seasonId));
  const seasonIds = [...new Set(rows.map(c => c.seasonId))];
  let seasonMap: Record<number, string> = {};
  if (seasonIds.length > 0) {
    const seasons = await db.select().from(seasonsTable).where(inArray(seasonsTable.id, seasonIds));
    seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));
  }
  res.json(rows.reverse().map(c => ({ ...c, seasonName: seasonMap[c.seasonId] ?? null })));
});

router.post("/competitions", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCompetitionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [comp] = await db.insert(competitionsTable).values(parsed.data).returning();
  res.status(201).json({ ...comp, seasonName: null });
});

router.get("/competitions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCompetitionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [comp] = await db.select().from(competitionsTable).where(eq(competitionsTable.id, params.data.id));
  if (!comp) { res.status(404).json({ error: "Competição não encontrada" }); return; }
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, comp.seasonId));
  res.json({ ...comp, seasonName: season?.name ?? null });
});

router.patch("/competitions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCompetitionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCompetitionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [comp] = await db.update(competitionsTable).set(parsed.data).where(eq(competitionsTable.id, params.data.id)).returning();
  if (!comp) { res.status(404).json({ error: "Competição não encontrada" }); return; }
  res.json({ ...comp, seasonName: null });
});

router.delete("/competitions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCompetitionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(competitionsTable).where(eq(competitionsTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Races ─────────────────────────────────────────────────────────────────────
router.get("/races", requireAuth, async (req, res): Promise<void> => {
  const query = ListRacesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(racesTable).orderBy(racesTable.name);
  if (query.data.competitionId) rows = rows.filter(r => r.competitionId === Number(query.data.competitionId));
  if (query.data.category) rows = rows.filter(r => r.category === query.data.category);
  const compIds = [...new Set(rows.map(r => r.competitionId))];
  let compMap: Record<number, string> = {};
  if (compIds.length > 0) {
    const comps = await db.select().from(competitionsTable).where(inArray(competitionsTable.id, compIds));
    compMap = Object.fromEntries(comps.map(c => [c.id, c.name]));
  }
  res.json(rows.map(r => ({ ...r, competitionName: compMap[r.competitionId] ?? null })));
});

router.post("/races", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateRaceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [race] = await db.insert(racesTable).values(parsed.data).returning();
  res.status(201).json({ ...race, competitionName: null });
});

router.get("/races/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRaceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, params.data.id));
  if (!race) { res.status(404).json({ error: "Prova não encontrada" }); return; }
  const [comp] = await db.select().from(competitionsTable).where(eq(competitionsTable.id, race.competitionId));
  res.json({ ...race, competitionName: comp?.name ?? null });
});

router.patch("/races/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateRaceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateRaceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [race] = await db.update(racesTable).set(parsed.data).where(eq(racesTable.id, params.data.id)).returning();
  if (!race) { res.status(404).json({ error: "Prova não encontrada" }); return; }
  res.json({ ...race, competitionName: null });
});

router.delete("/races/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteRaceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(racesTable).where(eq(racesTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Results ───────────────────────────────────────────────────────────────────
async function enrichResult(result: typeof resultsTable.$inferSelect) {
  const [race] = await db.select().from(racesTable).where(eq(racesTable.id, result.raceId));
  const [comp] = race ? await db.select().from(competitionsTable).where(eq(competitionsTable.id, race.competitionId)) : [];
  return {
    id: result.id,
    raceId: result.raceId,
    raceName: race?.name ?? null,
    competitionName: comp?.name ?? null,
    competitionDate: comp?.startDate ?? null,
    athleteNames: result.athleteNames ?? null,
    boatClass: result.boatClass ?? null,
    escalao: result.escalao ?? null,
    position: result.position,
    time: result.time,
    points: result.points ? Number(result.points) : null,
    notes: result.notes,
  };
}

router.get("/results", requireAuth, async (req, res): Promise<void> => {
  const query = ListResultsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(resultsTable);
  if (query.data.athleteId) rows = rows.filter(r => r.athleteId === Number(query.data.athleteId));
  if (query.data.raceId) rows = rows.filter(r => r.raceId === Number(query.data.raceId));
  if (query.data.competitionId) {
    const races = await db.select({ id: racesTable.id }).from(racesTable).where(eq(racesTable.competitionId, Number(query.data.competitionId)));
    const raceIds = races.map(r => r.id);
    if (raceIds.length > 0) rows = rows.filter(r => raceIds.includes(r.raceId));
    else rows = [];
  }
  if (query.data.seasonId) {
    const comps = await db.select({ id: competitionsTable.id }).from(competitionsTable).where(eq(competitionsTable.seasonId, Number(query.data.seasonId)));
    const compIds = comps.map(c => c.id);
    if (compIds.length > 0) {
      const races = await db.select({ id: racesTable.id }).from(racesTable).where(inArray(racesTable.competitionId, compIds));
      const raceIds = races.map(r => r.id);
      if (raceIds.length > 0) rows = rows.filter(r => raceIds.includes(r.raceId));
      else rows = [];
    } else rows = [];
  }
  const result = await Promise.all(rows.map(enrichResult));
  res.json(result);
});

router.post("/results", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateResultBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [result] = await db.insert(resultsTable).values(parsed.data).returning();
  res.status(201).json(await enrichResult(result));
});

router.get("/results/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetResultParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [result] = await db.select().from(resultsTable).where(eq(resultsTable.id, params.data.id));
  if (!result) { res.status(404).json({ error: "Resultado não encontrado" }); return; }
  res.json(await enrichResult(result));
});

router.patch("/results/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateResultParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateResultBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [result] = await db.update(resultsTable).set(parsed.data).where(eq(resultsTable.id, params.data.id)).returning();
  if (!result) { res.status(404).json({ error: "Resultado não encontrado" }); return; }
  res.json(await enrichResult(result));
});

router.delete("/results/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteResultParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(resultsTable).where(eq(resultsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/results/season-summary", requireAuth, async (req, res): Promise<void> => {
  const query = GetSeasonResultsSummaryQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const seasonId = Number(query.data.seasonId);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId));
  if (!season) { res.status(404).json({ error: "Época não encontrada" }); return; }

  const comps = await db.select().from(competitionsTable).where(eq(competitionsTable.seasonId, seasonId));
  const compIds = comps.map(c => c.id);
  let races: any[] = [];
  let results: any[] = [];
  if (compIds.length > 0) {
    races = await db.select().from(racesTable).where(inArray(racesTable.competitionId, compIds));
    const raceIds = races.map(r => r.id);
    if (raceIds.length > 0) {
      results = await db.select().from(resultsTable).where(inArray(resultsTable.raceId, raceIds));
    }
  }

  const podiums = results.filter(r => r.position !== null && r.position <= 3).length;
  const victories = results.filter(r => r.position === 1).length;

  const enriched = await Promise.all(results.filter(r => r.position !== null && r.position <= 3).slice(0, 5).map(enrichResult));

  res.json({
    seasonId,
    seasonName: season.name,
    totalCompetitions: comps.length,
    totalRaces: races.length,
    totalResults: results.length,
    podiums,
    victories,
    topResults: enriched,
  });
});

export default router;
