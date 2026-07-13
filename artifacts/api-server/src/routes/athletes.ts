import { Router, type IRouter } from "express";
import { db, athletesTable, athleteCategoryOverridesTable, categoryRulesTable, crewsTable, crewAthletesTable, seasonsTable, resultsTable, racesTable, competitionsTable, quotasTable, paymentsTable } from "@workspace/db";
import { eq, and, ilike, or, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateAthleteBody, UpdateAthleteBody, GetAthleteParams, UpdateAthleteParams, DeleteAthleteParams,
  OverrideAthleteCategoryBody, OverrideAthleteCategoryParams, ListAthletesQueryParams,
} from "@workspace/api-zod";

function computeCategory(birthDate: string, categoryRules: Array<{ name: string; minAge: number; maxAge: number | null }>, refYear?: number): string | null {
  const year = refYear ?? new Date().getFullYear();
  const age = year - new Date(birthDate).getFullYear();
  for (const rule of categoryRules) {
    if (age >= rule.minAge && (rule.maxAge == null || age <= rule.maxAge)) {
      return rule.name;
    }
  }
  return null;
}

const router: IRouter = Router();

router.get("/athletes", requireAuth, async (req, res): Promise<void> => {
  const query = ListAthletesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const { status, search, seasonId } = query.data;

  const categoryRules = await db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge);

  let athletes = await db.select().from(athletesTable).orderBy(athletesTable.name);

  if (status) athletes = athletes.filter(a => a.status === status);
  if (search) {
    const q = search.toLowerCase();
    athletes = athletes.filter(a => a.name.toLowerCase().includes(q) || (a.memberNumber?.toLowerCase().includes(q)) || (a.fprNumber?.toLowerCase().includes(q)));
  }

  const year = seasonId ? undefined : new Date().getFullYear();
  let refYear = year;
  if (seasonId) {
    const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, Number(seasonId)));
    if (season) refYear = new Date(season.endDate).getFullYear();
  }

  // Fetch overrides if seasonId provided
  let overrides: Array<{ athleteId: number; categoryOverride: string }> = [];
  if (seasonId) {
    overrides = await db.select({ athleteId: athleteCategoryOverridesTable.athleteId, categoryOverride: athleteCategoryOverridesTable.categoryOverride })
      .from(athleteCategoryOverridesTable).where(eq(athleteCategoryOverridesTable.seasonId, Number(seasonId)));
  }

  const result = athletes.map(a => {
    const override = overrides.find(o => o.athleteId === a.id);
    const category = override?.categoryOverride ?? computeCategory(a.birthDate, categoryRules, refYear);
    return { ...a, category, categoryOverride: override?.categoryOverride ?? null };
  });

  res.json(result);
});

router.post("/athletes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAthleteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [athlete] = await db.insert(athletesTable).values(parsed.data).returning();
  const categoryRules = await db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge);
  const category = computeCategory(athlete.birthDate, categoryRules);
  res.status(201).json({ ...athlete, category, categoryOverride: null });
});

router.get("/athletes/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetAthleteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [athlete] = await db.select().from(athletesTable).where(eq(athletesTable.id, params.data.id));
  if (!athlete) { res.status(404).json({ error: "Atleta não encontrado" }); return; }

  const categoryRules = await db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge);
  const category = computeCategory(athlete.birthDate, categoryRules);

  // Crew history
  const crewMemberships = await db.select({
    crewId: crewAthletesTable.crewId,
  }).from(crewAthletesTable).where(eq(crewAthletesTable.athleteId, athlete.id));

  const crewIds = crewMemberships.map(m => m.crewId);
  let crewHistory: any[] = [];
  if (crewIds.length > 0) {
    const crews = await db.select().from(crewsTable).where(inArray(crewsTable.id, crewIds));
    const seasonIds = [...new Set(crews.map(c => c.seasonId))];
    const seasons = await db.select().from(seasonsTable).where(inArray(seasonsTable.id, seasonIds));
    crewHistory = crews.map(c => ({
      crewId: c.id,
      crewName: c.name,
      boatClass: c.boatClass,
      seasonId: c.seasonId,
      seasonName: seasons.find(s => s.id === c.seasonId)?.name ?? "",
    }));
  }

  // Results
  const results = await db.select({
    id: resultsTable.id,
    raceId: resultsTable.raceId,
    athleteId: resultsTable.athleteId,
    crewId: resultsTable.crewId,
    position: resultsTable.position,
    time: resultsTable.time,
    points: resultsTable.points,
    notes: resultsTable.notes,
  }).from(resultsTable).where(eq(resultsTable.athleteId, athlete.id));

  // Quota summary
  const athleteQuotas = await db.select().from(quotasTable).where(eq(quotasTable.athleteId, athlete.id));
  const quotaIds = athleteQuotas.map(q => q.id);
  let athletePayments: any[] = [];
  if (quotaIds.length > 0) {
    athletePayments = await db.select().from(paymentsTable).where(inArray(paymentsTable.quotaId, quotaIds));
  }

  const totalDue = athleteQuotas.reduce((sum, q) => sum + Number(q.amountDue), 0);
  const totalPaid = athletePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const quotaSummary = {
    athleteId: athlete.id,
    athleteName: athlete.name,
    totalDue,
    totalPaid,
    totalOwed: totalDue - totalPaid,
    overdueCount: 0,
    quotas: [],
  };

  res.json({ ...athlete, category, categoryOverride: null, crewHistory, resultHistory: results, quotaSummary });
});

router.patch("/athletes/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAthleteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAthleteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [athlete] = await db.update(athletesTable).set(parsed.data).where(eq(athletesTable.id, params.data.id)).returning();
  if (!athlete) { res.status(404).json({ error: "Atleta não encontrado" }); return; }
  const categoryRules = await db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge);
  const category = computeCategory(athlete.birthDate, categoryRules);
  res.json({ ...athlete, category, categoryOverride: null });
});

router.delete("/athletes/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteAthleteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(athletesTable).where(eq(athletesTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/athletes/:id/category-override", requireAdmin, async (req, res): Promise<void> => {
  const params = OverrideAthleteCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = OverrideAthleteCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { seasonId, categoryOverride } = parsed.data;

  if (categoryOverride === null || categoryOverride === undefined) {
    await db.delete(athleteCategoryOverridesTable).where(
      and(eq(athleteCategoryOverridesTable.athleteId, params.data.id), eq(athleteCategoryOverridesTable.seasonId, seasonId))
    );
  } else {
    const existing = await db.select().from(athleteCategoryOverridesTable).where(
      and(eq(athleteCategoryOverridesTable.athleteId, params.data.id), eq(athleteCategoryOverridesTable.seasonId, seasonId))
    );
    if (existing.length > 0) {
      await db.update(athleteCategoryOverridesTable).set({ categoryOverride }).where(
        and(eq(athleteCategoryOverridesTable.athleteId, params.data.id), eq(athleteCategoryOverridesTable.seasonId, seasonId))
      );
    } else {
      await db.insert(athleteCategoryOverridesTable).values({ athleteId: params.data.id, seasonId, categoryOverride });
    }
  }

  const [athlete] = await db.select().from(athletesTable).where(eq(athletesTable.id, params.data.id));
  if (!athlete) { res.status(404).json({ error: "Atleta não encontrado" }); return; }
  const categoryRules = await db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge);
  const category = computeCategory(athlete.birthDate, categoryRules);
  res.json({ ...athlete, category, categoryOverride: categoryOverride ?? null });
});

export default router;
