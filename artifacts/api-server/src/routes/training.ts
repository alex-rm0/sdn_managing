import { Router, type IRouter } from "express";
import { db, trainingSchedulesTable, trainingSessionsTable, attendanceRecordsTable, athletesTable, usersTable, seasonsTable } from "@workspace/db";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateTrainingScheduleBody, UpdateTrainingScheduleBody, UpdateTrainingScheduleParams, DeleteTrainingScheduleParams, ListTrainingSchedulesQueryParams,
  CreateTrainingSessionBody, UpdateTrainingSessionBody, GetTrainingSessionParams, UpdateTrainingSessionParams, DeleteTrainingSessionParams, ListTrainingSessionsQueryParams,
  GetSessionAttendanceParams, SaveSessionAttendanceParams, SaveSessionAttendanceBody,
  GetAthleteAttendanceSummaryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Training Schedules ───────────────────────────────────────────────────────
router.get("/training-schedules", requireAuth, async (req, res): Promise<void> => {
  const query = ListTrainingSchedulesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(trainingSchedulesTable).orderBy(trainingSchedulesTable.groupCategory);
  if (query.data.seasonId) rows = rows.filter(s => s.seasonId === Number(query.data.seasonId));
  res.json(rows);
});

router.post("/training-schedules", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateTrainingScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [sched] = await db.insert(trainingSchedulesTable).values({ ...parsed.data, daysOfWeek: parsed.data.daysOfWeek ?? [], trainerIds: parsed.data.trainerIds ?? [] }).returning();
  res.status(201).json(sched);
});

router.patch("/training-schedules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateTrainingScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTrainingScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [sched] = await db.update(trainingSchedulesTable).set(parsed.data).where(eq(trainingSchedulesTable.id, params.data.id)).returning();
  if (!sched) { res.status(404).json({ error: "Horário não encontrado" }); return; }
  res.json(sched);
});

router.delete("/training-schedules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteTrainingScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(trainingSchedulesTable).where(eq(trainingSchedulesTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Training Sessions ────────────────────────────────────────────────────────
router.get("/training-sessions/today", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const userRole = req.session.userRole!;
  const today = new Date().toISOString().split("T")[0];

  let sessions = await db.select().from(trainingSessionsTable).where(eq(trainingSessionsTable.date, today));

  // Trainers only see their own sessions
  if (userRole === "trainer") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (user) {
      const categories = user.assignedCategories ?? [];
      sessions = sessions.filter(s => categories.includes(s.groupCategory));
    }
  }

  const result = await Promise.all(sessions.map(async session => {
    // Get athletes in this group category
    const allAthletes = await db.select().from(athletesTable).where(eq(athletesTable.status, "ativo"));
    const schedules = await db.select().from(trainingSchedulesTable).where(eq(trainingSchedulesTable.groupCategory, session.groupCategory));
    const athletes = allAthletes;

    const existingAttendance = await db.select({
      id: attendanceRecordsTable.id,
      sessionId: attendanceRecordsTable.sessionId,
      athleteId: attendanceRecordsTable.athleteId,
      status: attendanceRecordsTable.status,
      observation: attendanceRecordsTable.observation,
    }).from(attendanceRecordsTable).where(eq(attendanceRecordsTable.sessionId, session.id));

    const attendanceWithNames = existingAttendance.map(a => {
      const athlete = athletes.find(at => at.id === a.athleteId);
      return { ...a, athleteName: athlete?.name ?? "" };
    });

    return { ...session, athletes: athletes.map(a => ({ ...a, category: null, categoryOverride: null })), existingAttendance: attendanceWithNames };
  }));

  res.json(result);
});

router.get("/training-sessions", requireAuth, async (req, res): Promise<void> => {
  const query = ListTrainingSessionsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(trainingSessionsTable).orderBy(trainingSessionsTable.date);

  if (query.data.seasonId) rows = rows.filter(s => s.seasonId === Number(query.data.seasonId));
  if (query.data.groupCategory) rows = rows.filter(s => s.groupCategory === query.data.groupCategory);
  if (query.data.trainerId) rows = rows.filter(s => s.trainerId === Number(query.data.trainerId));
  if (query.data.dateFrom) rows = rows.filter(s => s.date >= query.data.dateFrom!);
  if (query.data.dateTo) rows = rows.filter(s => s.date <= query.data.dateTo!);

  const result = await Promise.all(rows.map(async s => {
    const count = await db.select().from(attendanceRecordsTable).where(and(eq(attendanceRecordsTable.sessionId, s.id), eq(attendanceRecordsTable.status, "presente")));
    const trainer = s.trainerId ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, s.trainerId)))[0] : null;
    return { ...s, attendanceCount: count.length, trainerName: trainer?.name ?? null };
  }));

  res.json(result.reverse());
});

router.post("/training-sessions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTrainingSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [session] = await db.insert(trainingSessionsTable).values(parsed.data).returning();
  res.status(201).json({ ...session, attendanceCount: 0, trainerName: null });
});

router.get("/training-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTrainingSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [session] = await db.select().from(trainingSessionsTable).where(eq(trainingSessionsTable.id, params.data.id));
  if (!session) { res.status(404).json({ error: "Treino não encontrado" }); return; }
  const count = await db.select().from(attendanceRecordsTable).where(and(eq(attendanceRecordsTable.sessionId, session.id), eq(attendanceRecordsTable.status, "presente")));
  res.json({ ...session, attendanceCount: count.length, trainerName: null });
});

router.patch("/training-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTrainingSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTrainingSessionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [session] = await db.update(trainingSessionsTable).set(parsed.data).where(eq(trainingSessionsTable.id, params.data.id)).returning();
  if (!session) { res.status(404).json({ error: "Treino não encontrado" }); return; }
  res.json({ ...session, attendanceCount: 0, trainerName: null });
});

router.delete("/training-sessions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteTrainingSessionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Attendance ────────────────────────────────────────────────────────────────
router.get("/training-sessions/:id/attendance", requireAuth, async (req, res): Promise<void> => {
  const params = GetSessionAttendanceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const records = await db.select().from(attendanceRecordsTable).where(eq(attendanceRecordsTable.sessionId, params.data.id));
  const athleteIds = records.map(r => r.athleteId);
  let athleteMap: Record<number, string> = {};
  if (athleteIds.length > 0) {
    const athletes = await db.select({ id: athletesTable.id, name: athletesTable.name }).from(athletesTable).where(inArray(athletesTable.id, athleteIds));
    athleteMap = Object.fromEntries(athletes.map(a => [a.id, a.name]));
  }
  res.json(records.map(r => ({ ...r, athleteName: athleteMap[r.athleteId] ?? "" })));
});

router.put("/training-sessions/:id/attendance", requireAuth, async (req, res): Promise<void> => {
  const params = SaveSessionAttendanceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = SaveSessionAttendanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.delete(attendanceRecordsTable).where(eq(attendanceRecordsTable.sessionId, params.data.id));

  if (parsed.data.records.length > 0) {
    await db.insert(attendanceRecordsTable).values(
      parsed.data.records.map(r => ({ sessionId: params.data.id, athleteId: r.athleteId, status: r.status, observation: r.observation ?? null }))
    );
  }

  const records = await db.select().from(attendanceRecordsTable).where(eq(attendanceRecordsTable.sessionId, params.data.id));
  const athleteIds = records.map(r => r.athleteId);
  let athleteMap: Record<number, string> = {};
  if (athleteIds.length > 0) {
    const athletes = await db.select({ id: athletesTable.id, name: athletesTable.name }).from(athletesTable).where(inArray(athletesTable.id, athleteIds));
    athleteMap = Object.fromEntries(athletes.map(a => [a.id, a.name]));
  }
  res.json(records.map(r => ({ ...r, athleteName: athleteMap[r.athleteId] ?? "" })));
});

router.get("/athletes/:id/attendance-summary", requireAuth, async (req, res): Promise<void> => {
  const params = GetAthleteAttendanceSummaryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [athlete] = await db.select().from(athletesTable).where(eq(athletesTable.id, params.data.id));
  if (!athlete) { res.status(404).json({ error: "Atleta não encontrado" }); return; }

  const records = await db.select({
    status: attendanceRecordsTable.status,
    sessionId: attendanceRecordsTable.sessionId,
  }).from(attendanceRecordsTable).where(eq(attendanceRecordsTable.athleteId, params.data.id));

  const present = records.filter(r => r.status === "presente").length;
  const absent = records.filter(r => r.status === "ausente").length;
  const absentJ = records.filter(r => r.status === "ausente_justificado").length;
  const total = records.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  // Get session types
  const sessionIds = [...new Set(records.map(r => r.sessionId))];
  let byType: Record<string, number> = {};
  if (sessionIds.length > 0) {
    const sessions = await db.select({ id: trainingSessionsTable.id, trainingType: trainingSessionsTable.trainingType })
      .from(trainingSessionsTable).where(inArray(trainingSessionsTable.id, sessionIds));
    for (const s of sessions) {
      const presentInSession = records.filter(r => r.sessionId === s.id && r.status === "presente").length;
      if (presentInSession > 0) {
        byType[s.trainingType] = (byType[s.trainingType] ?? 0) + 1;
      }
    }
  }

  res.json({ athleteId: athlete.id, athleteName: athlete.name, totalSessions: total, present, absent, absentJustified: absentJ, attendanceRate: rate, byType });
});

export default router;
