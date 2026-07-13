import { Router, type IRouter } from "express";
import { db, athletesTable, crewsTable, trainingSessionsTable, resultsTable, racesTable, competitionsTable, financialMovementsTable, quotasTable, paymentsTable, fleetItemsTable } from "@workspace/db";
import { eq, and, inArray, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetDashboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const query = GetDashboardQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const [activeAthletes, totalCrewsResult, upcomingSessions, allFleet] = await Promise.all([
    db.select().from(athletesTable).where(eq(athletesTable.status, "ativo")),
    db.select().from(crewsTable),
    db.select().from(trainingSessionsTable).orderBy(trainingSessionsTable.date),
    db.select().from(fleetItemsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = upcomingSessions.filter(s => s.date >= today).slice(0, 5).map(s => ({
    ...s, attendanceCount: null, trainerName: null
  }));

  // Recent results
  const recentResults = await db.select().from(resultsTable).orderBy(resultsTable.id);
  const topResults = recentResults.slice(-5).map(r => ({
    id: r.id, raceId: r.raceId, raceName: null, competitionName: null, competitionDate: null,
    athleteId: r.athleteId, athleteName: null, crewId: r.crewId, crewName: null,
    position: r.position, time: r.time, points: r.points ? Number(r.points) : null, notes: r.notes,
  }));

  // Monthly financial
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const allMovements = await db.select().from(financialMovementsTable);
  const monthlyMovements = allMovements.filter(m => m.date >= monthStart);
  const monthlyRevenue = monthlyMovements.filter(m => m.type === "receita").reduce((sum, m) => sum + Number(m.amount), 0);
  const monthlyExpenses = monthlyMovements.filter(m => m.type === "despesa").reduce((sum, m) => sum + Number(m.amount), 0);

  // Overdue quotas
  const allQuotas = await db.select().from(quotasTable);
  const allPayments = await db.select().from(paymentsTable);
  let overdueCount = 0, overdueAmount = 0;
  for (const q of allQuotas) {
    const paid = allPayments.filter(p => p.quotaId === q.id).reduce((sum, p) => sum + Number(p.amount), 0);
    const due = Number(q.amountDue);
    if (paid < due && q.dueDate && new Date(q.dueDate) < new Date()) {
      overdueCount++;
      overdueAmount += due - paid;
    }
  }

  // Podiums this season
  const allResults = await db.select().from(resultsTable);
  const podiums = allResults.filter(r => r.position !== null && r.position <= 3).length;
  const victories = allResults.filter(r => r.position === 1).length;

  const fleetAvailable = allFleet.filter(f => f.status === "ativo").length;
  const fleetMaintenance = allFleet.filter(f => f.status === "manutencao" || f.status === "avariado").length;

  res.json({
    seasonId: query.data.seasonId ?? null,
    seasonName: null,
    activeAthletes: activeAthletes.length,
    totalCrews: totalCrewsResult.length,
    upcomingSessions: todaySessions,
    recentResults: topResults,
    monthlyBalance: monthlyRevenue - monthlyExpenses,
    monthlyRevenue,
    monthlyExpenses,
    overdueQuotasCount: overdueCount,
    overdueQuotasAmount: overdueAmount,
    totalPodiums: podiums,
    totalVictories: victories,
    fleetAvailableCount: fleetAvailable,
    fleetInMaintenanceCount: fleetMaintenance,
  });
});

export default router;
