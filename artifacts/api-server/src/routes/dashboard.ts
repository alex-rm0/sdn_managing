import { Router, type IRouter } from "express";
import {
  db, athletesTable, trainingSessionsTable, attendanceRecordsTable, resultsTable, racesTable,
  competitionsTable, financialMovementsTable, quotasTable, paymentsTable, fleetItemsTable,
  meetingMinutesTable, seasonsTable, usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetDashboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const query = GetDashboardQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const [activeAthletes, allResultsCount, allSessions, allFleet, allUsers, allSeasons] = await Promise.all([
    db.select().from(athletesTable).where(eq(athletesTable.status, "ativo")),
    db.select().from(resultsTable),
    db.select().from(trainingSessionsTable).orderBy(trainingSessionsTable.date),
    db.select().from(fleetItemsTable),
    db.select().from(usersTable),
    db.select().from(seasonsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const trainerNameById = new Map(allUsers.map(u => [u.id, u.name]));

  const todaySessionsRaw = allSessions.filter(s => s.date >= today).slice(0, 5);
  const allAttendance = await db.select().from(attendanceRecordsTable);
  const todaySessions = todaySessionsRaw.map(s => ({
    ...s,
    trainerName: s.trainerId ? trainerNameById.get(s.trainerId) ?? null : null,
    attendanceCount: allAttendance.filter(a => a.sessionId === s.id).length,
  }));

  // Recent results
  const recentResults = await db.select().from(resultsTable).orderBy(resultsTable.id);
  const topResults = recentResults.slice(-5).map(r => ({
    id: r.id, raceId: r.raceId, raceName: null, competitionName: null, competitionDate: null,
    athleteNames: r.athleteNames ?? null, boatClass: r.boatClass ?? null, escalao: r.escalao ?? null,
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

  // Next upcoming competition
  const allCompetitions = await db.select().from(competitionsTable);
  const upcomingCompetitions = allCompetitions
    .filter(c => c.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const nextCompetitionRow = upcomingCompetitions[0] ?? null;
  let nextCompetitionRacesCount = 0;
  if (nextCompetitionRow) {
    const allRaces = await db.select().from(racesTable).where(eq(racesTable.competitionId, nextCompetitionRow.id));
    nextCompetitionRacesCount = allRaces.length;
  }
  const activeSeason = allSeasons.find(s => s.active) ?? null;

  // Alerts — only surfacing what's backed by real data (no fabricated stats)
  const alerts: Array<{ severity: "danger" | "info" | "neutral"; title: string; linkLabel: string; href: string }> = [];
  if (overdueCount > 0) {
    alerts.push({
      severity: "danger",
      title: `${overdueCount} ${overdueCount === 1 ? "atleta" : "atletas"} com quotas em atraso`,
      linkLabel: "Ver quotas",
      href: "/quotas",
    });
  }
  const upcomingMeeting = (await db.select().from(meetingMinutesTable))
    .filter(m => m.status !== "finalizada" && m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (upcomingMeeting) {
    const meetingDate = new Date(upcomingMeeting.date).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
    alerts.push({
      severity: "info",
      title: `Reunião de direção · ${meetingDate}`,
      linkLabel: "Abrir agenda",
      href: "/reunioes",
    });
  }
  if (fleetMaintenance > 0) {
    alerts.push({
      severity: "neutral",
      title: `${fleetMaintenance} ${fleetMaintenance === 1 ? "item" : "itens"} de frota/equipamento em manutenção`,
      linkLabel: "Ver inventário",
      href: "/inventario",
    });
  }

  res.json({
    seasonId: query.data.seasonId ?? activeSeason?.id ?? null,
    seasonName: activeSeason?.name ?? null,
    activeAthletes: activeAthletes.length,
    totalResults: allResultsCount.length,
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
    fleetTotalCount: allFleet.length,
    nextCompetition: nextCompetitionRow,
    nextCompetitionRacesCount,
    alerts,
  });
});

export default router;
