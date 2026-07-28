import { Router, type IRouter } from "express";
import { db, financialMovementsTable, quotaPlansTable, quotasTable, paymentsTable, athletesTable, seasonsTable, categoryRulesTable } from "@workspace/db";
import { eq, and, inArray, gte, lte } from "drizzle-orm";

function computeCategory(birthDate: string, rules: Array<{ name: string; minAge: number; maxAge: number | null }>, refYear?: number): string | null {
  const year = refYear ?? new Date().getFullYear();
  const age = year - new Date(birthDate).getFullYear();
  for (const rule of rules) {
    if (age >= rule.minAge && (rule.maxAge == null || age <= rule.maxAge)) return rule.name;
  }
  return null;
}
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateFinancialMovementBody, UpdateFinancialMovementBody, GetFinancialMovementParams, UpdateFinancialMovementParams, DeleteFinancialMovementParams, ListFinancialMovementsQueryParams,
  CreateQuotaPlanBody, UpdateQuotaPlanBody, UpdateQuotaPlanParams, DeleteQuotaPlanParams, ListQuotaPlansQueryParams,
  GetQuotaParams, ListQuotasQueryParams,
  CreatePaymentBody, DeletePaymentParams, ListPaymentsQueryParams,
  GenerateQuotasBody, ListOverdueQuotasQueryParams, GetFinancialSummaryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function quotaStatus(amountDue: number, amountPaid: number, dueDate?: string | null): string {
  if (amountPaid >= amountDue) return "pago";
  if (amountPaid > 0) return "parcial";
  if (dueDate && new Date(dueDate) < new Date()) return "em_atraso";
  return "pendente";
}

// ── Financial Movements ───────────────────────────────────────────────────────
router.get("/financial-movements", requireAdmin, async (req, res): Promise<void> => {
  const query = ListFinancialMovementsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(financialMovementsTable).orderBy(financialMovementsTable.date);
  if (query.data.seasonId) rows = rows.filter(m => m.seasonId === Number(query.data.seasonId));
  if (query.data.type) rows = rows.filter(m => m.type === query.data.type);
  if (query.data.category) rows = rows.filter(m => m.category === query.data.category);
  if (query.data.dateFrom) rows = rows.filter(m => m.date >= query.data.dateFrom!);
  if (query.data.dateTo) rows = rows.filter(m => m.date <= query.data.dateTo!);

  const seasonIds = [...new Set(rows.filter(m => m.seasonId).map(m => m.seasonId as number))];
  let seasonMap: Record<number, string> = {};
  if (seasonIds.length > 0) {
    const seasons = await db.select().from(seasonsTable).where(inArray(seasonsTable.id, seasonIds));
    seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));
  }
  res.json(rows.reverse().map(m => ({ ...m, amount: Number(m.amount), seasonName: m.seasonId ? (seasonMap[m.seasonId] ?? null) : null })));
});

router.post("/financial-movements", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateFinancialMovementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [mv] = await db.insert(financialMovementsTable).values(parsed.data).returning();
  res.status(201).json({ ...mv, amount: Number(mv.amount), seasonName: null });
});

router.get("/financial-movements/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetFinancialMovementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [mv] = await db.select().from(financialMovementsTable).where(eq(financialMovementsTable.id, params.data.id));
  if (!mv) { res.status(404).json({ error: "Movimento não encontrado" }); return; }
  res.json({ ...mv, amount: Number(mv.amount), seasonName: null });
});

router.patch("/financial-movements/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateFinancialMovementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateFinancialMovementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [mv] = await db.update(financialMovementsTable).set(parsed.data).where(eq(financialMovementsTable.id, params.data.id)).returning();
  if (!mv) { res.status(404).json({ error: "Movimento não encontrado" }); return; }
  res.json({ ...mv, amount: Number(mv.amount), seasonName: null });
});

router.delete("/financial-movements/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteFinancialMovementParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(financialMovementsTable).where(eq(financialMovementsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/financial-summary", requireAdmin, async (req, res): Promise<void> => {
  const query = GetFinancialSummaryQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(financialMovementsTable);
  if (query.data.seasonId) rows = rows.filter(m => m.seasonId === Number(query.data.seasonId));

  const totalRevenue = rows.filter(m => m.type === "receita").reduce((sum, m) => sum + Number(m.amount), 0);
  const totalExpenses = rows.filter(m => m.type === "despesa").reduce((sum, m) => sum + Number(m.amount), 0);

  const byCatMap: Record<string, { category: string; type: string; total: number }> = {};
  for (const m of rows) {
    const key = `${m.category}-${m.type}`;
    if (!byCatMap[key]) byCatMap[key] = { category: m.category, type: m.type, total: 0 };
    byCatMap[key].total += Number(m.amount);
  }

  res.json({ totalRevenue, totalExpenses, balance: totalRevenue - totalExpenses, byCategory: Object.values(byCatMap) });
});

// ── Quota Plans ───────────────────────────────────────────────────────────────
router.get("/quota-plans", requireAdmin, async (req, res): Promise<void> => {
  const query = ListQuotaPlansQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(quotaPlansTable).orderBy(quotaPlansTable.category);
  if (query.data.seasonId) rows = rows.filter(p => p.seasonId === Number(query.data.seasonId));
  const seasonIds = [...new Set(rows.map(p => p.seasonId))];
  let seasonMap: Record<number, string> = {};
  if (seasonIds.length > 0) {
    const seasons = await db.select().from(seasonsTable).where(inArray(seasonsTable.id, seasonIds));
    seasonMap = Object.fromEntries(seasons.map(s => [s.id, s.name]));
  }
  res.json(rows.map(p => ({ ...p, amount: Number(p.amount), seasonName: seasonMap[p.seasonId] ?? null })));
});

router.post("/quota-plans", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateQuotaPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [plan] = await db.insert(quotaPlansTable).values(parsed.data).returning();
  res.status(201).json({ ...plan, amount: Number(plan.amount), seasonName: null });
});

router.patch("/quota-plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateQuotaPlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQuotaPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [plan] = await db.update(quotaPlansTable).set(parsed.data).where(eq(quotaPlansTable.id, params.data.id)).returning();
  if (!plan) { res.status(404).json({ error: "Plano não encontrado" }); return; }
  res.json({ ...plan, amount: Number(plan.amount), seasonName: null });
});

router.delete("/quota-plans/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteQuotaPlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(quotaPlansTable).where(eq(quotaPlansTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Quotas ────────────────────────────────────────────────────────────────────

type CategoryRule = { name: string; minAge: number; maxAge: number | null };

async function enrichQuota(
  quota: typeof quotasTable.$inferSelect,
  categoryRules: CategoryRule[],
  athleteCache: Map<number, { name: string; birthDate: string }>,
  seasonCache: Map<number, string>,
) {
  const athlete = athleteCache.get(quota.athleteId);
  const athleteName = athlete?.name ?? null;
  const athleteCategory = athlete?.birthDate
    ? computeCategory(athlete.birthDate, categoryRules)
    : null;
  const seasonName = seasonCache.get(quota.seasonId) ?? null;
  const pmts = await db.select().from(paymentsTable).where(eq(paymentsTable.quotaId, quota.id));
  const amountDue = Number(quota.amountDue);
  const amountPaid = pmts.reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    id: quota.id,
    athleteId: quota.athleteId,
    athleteName,
    seasonId: quota.seasonId,
    seasonName,
    period: quota.period,
    category: athleteCategory ?? quota.category,
    amountDue,
    amountPaid,
    amountOwed: amountDue - amountPaid,
    status: quotaStatus(amountDue, amountPaid, quota.dueDate),
    dueDate: quota.dueDate,
    payments: pmts.map(p => ({ ...p, amount: Number(p.amount) })),
  };
}

async function loadCaches(athleteIds: number[], seasonIds: number[]) {
  const [rules, athletes, seasons] = await Promise.all([
    db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge),
    athleteIds.length ? db.select({ id: athletesTable.id, name: athletesTable.name, birthDate: athletesTable.birthDate }).from(athletesTable) : Promise.resolve([]),
    seasonIds.length ? db.select().from(seasonsTable) : Promise.resolve([]),
  ]);
  const athleteCache = new Map(athletes.map(a => [a.id, { name: a.name, birthDate: String(a.birthDate) }]));
  const seasonCache = new Map(seasons.map(s => [s.id, s.name]));
  return { rules, athleteCache, seasonCache };
}

router.get("/quotas", requireAdmin, async (req, res): Promise<void> => {
  const query = ListQuotasQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(quotasTable);
  if (query.data.seasonId) rows = rows.filter(q => q.seasonId === Number(query.data.seasonId));
  if (query.data.athleteId) rows = rows.filter(q => q.athleteId === Number(query.data.athleteId));
  const { rules, athleteCache, seasonCache } = await loadCaches(rows.map(r => r.athleteId), rows.map(r => r.seasonId));
  const enriched = await Promise.all(rows.map(r => enrichQuota(r, rules, athleteCache, seasonCache)));
  if (query.data.status) { res.json(enriched.filter(q => q.status === query.data.status)); return; }
  res.json(enriched);
});

router.get("/quotas/generate", requireAdmin, async (_req, res): Promise<void> => {
  res.status(405).json({ error: "Use POST" });
});

router.post("/quotas/generate", requireAdmin, async (req, res): Promise<void> => {
  const parsed = GenerateQuotasBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { seasonId, quotaPlanId, period } = parsed.data;
  const [plan] = await db.select().from(quotaPlansTable).where(eq(quotaPlansTable.id, quotaPlanId));
  if (!plan) { res.status(404).json({ error: "Plano não encontrado" }); return; }

  let athletes = await db.select().from(athletesTable).where(eq(athletesTable.status, "ativo"));

  // Avoid duplicates: skip athletes that already have a quota for this season+period
  if (period) {
    const existing = await db.select({ athleteId: quotasTable.athleteId })
      .from(quotasTable)
      .where(and(eq(quotasTable.seasonId, seasonId), eq(quotasTable.period, period)));
    const existingIds = new Set(existing.map(q => q.athleteId));
    athletes = athletes.filter(a => !existingIds.has(a.id));
  }

  const quotaValues: Array<typeof quotasTable.$inferInsert> = athletes.map(a => ({
    athleteId: a.id,
    seasonId,
    period: period ?? null,
    category: plan.category,
    amountDue: plan.amount,
    dueDate: null,
  }));

  if (quotaValues.length > 0) {
    await db.insert(quotasTable).values(quotaValues);
  }

  const created = await db.select().from(quotasTable).where(eq(quotasTable.seasonId, seasonId));
  const { rules: cr, athleteCache: ac, seasonCache: sc } = await loadCaches(created.map(r => r.athleteId), created.map(r => r.seasonId));
  const enriched = await Promise.all(created.map(r => enrichQuota(r, cr, ac, sc)));
  res.json(enriched);
});

router.get("/quotas/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetQuotaParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [quota] = await db.select().from(quotasTable).where(eq(quotasTable.id, params.data.id));
  if (!quota) { res.status(404).json({ error: "Quota não encontrada" }); return; }
  const { rules, athleteCache, seasonCache } = await loadCaches([quota.athleteId], [quota.seasonId]);
  res.json(await enrichQuota(quota, rules, athleteCache, seasonCache));
});

router.get("/quotas-overdue", requireAdmin, async (req, res): Promise<void> => {
  const query = ListOverdueQuotasQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(quotasTable);
  if (query.data.seasonId) rows = rows.filter(q => q.seasonId === Number(query.data.seasonId));

  const { rules, athleteCache, seasonCache } = await loadCaches(rows.map(r => r.athleteId), rows.map(r => r.seasonId));
  const enriched = await Promise.all(rows.map(r => enrichQuota(r, rules, athleteCache, seasonCache)));
  const overdue = enriched.filter(q => q.status === "em_atraso" || q.status === "pendente" || q.status === "parcial");

  const athleteMap: Record<number, typeof enriched[0] & { quotas: any[] }> = {};
  for (const q of overdue) {
    if (!athleteMap[q.athleteId]) {
      athleteMap[q.athleteId] = {
        ...q,
        totalDue: 0, totalPaid: 0, totalOwed: 0, overdueCount: 0, quotas: [],
      };
    }
    athleteMap[q.athleteId].totalDue += q.amountDue;
    athleteMap[q.athleteId].totalPaid += q.amountPaid;
    athleteMap[q.athleteId].totalOwed += q.amountOwed;
    if (q.status === "em_atraso") athleteMap[q.athleteId].overdueCount++;
    athleteMap[q.athleteId].quotas.push(q);
  }

  res.json(Object.values(athleteMap));
});

// ── Payments ─────────────────────────────────────────────────────────────────
router.get("/payments", requireAdmin, async (req, res): Promise<void> => {
  const query = ListPaymentsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(paymentsTable).orderBy(paymentsTable.date);
  if (query.data.quotaId) rows = rows.filter(p => p.quotaId === Number(query.data.quotaId));
  if (query.data.athleteId) {
    const quotas = await db.select({ id: quotasTable.id }).from(quotasTable).where(eq(quotasTable.athleteId, Number(query.data.athleteId)));
    const qIds = quotas.map(q => q.id);
    rows = qIds.length > 0 ? rows.filter(p => qIds.includes(p.quotaId)) : [];
  }
  if (query.data.seasonId) {
    const quotas = await db.select({ id: quotasTable.id }).from(quotasTable).where(eq(quotasTable.seasonId, Number(query.data.seasonId)));
    const qIds = quotas.map(q => q.id);
    rows = qIds.length > 0 ? rows.filter(p => qIds.includes(p.quotaId)) : [];
  }
  res.json(rows.reverse().map(p => ({ ...p, amount: Number(p.amount) })));
});

router.post("/payments", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [payment] = await db.insert(paymentsTable).values(parsed.data).returning();

  // Auto-generate financial movement for the quota payment
  const [quota] = await db.select().from(quotasTable).where(eq(quotasTable.id, parsed.data.quotaId));
  if (quota) {
    await db.insert(financialMovementsTable).values({
      type: "receita",
      category: "quotas",
      amount: String(parsed.data.amount),
      date: parsed.data.date,
      description: `Pagamento de quota - atleta ${quota.athleteId}`,
      seasonId: quota.seasonId,
      relatedQuotaId: payment.id,
    });
  }

  res.status(201).json({ ...payment, amount: Number(payment.amount) });
});

router.delete("/payments/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeletePaymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
