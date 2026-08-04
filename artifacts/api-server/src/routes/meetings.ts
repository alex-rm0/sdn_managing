import { Router, type IRouter } from "express";
import { db, meetingMinutesTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateMeetingBody,
  UpdateMeetingBody,
  GetMeetingParams,
  UpdateMeetingParams,
  DeleteMeetingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// In-memory "who's editing" presence — deliberately not persisted: it's ephemeral
// UI state (dies with the server, and that's fine), not data. Lets viewers see
// "X está a editar" without building real collaborative editing.
const PRESENCE_TTL_MS = 10_000;
const editingPresence = new Map<number, { userId: number; userName: string; since: number }>();

function getEditingBy(meetingId: number): string | null {
  const entry = editingPresence.get(meetingId);
  if (!entry) return null;
  if (Date.now() - entry.since > PRESENCE_TTL_MS) {
    editingPresence.delete(meetingId);
    return null;
  }
  return entry.userName;
}

// List all meeting minutes
router.get("/meetings", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(meetingMinutesTable)
    .orderBy(desc(meetingMinutesTable.date));
  res.json(rows.map(m => ({ ...m, editingBy: getEditingBy(m.id) })));
});

// Get single meeting
router.get("/meetings/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetMeetingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [meeting] = await db
    .select()
    .from(meetingMinutesTable)
    .where(eq(meetingMinutesTable.id, params.data.id));
  if (!meeting) { res.status(404).json({ error: "Ata não encontrada" }); return; }
  res.json({ ...meeting, editingBy: getEditingBy(meeting.id) });
});

// Create meeting
router.post("/meetings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [meeting] = await db.insert(meetingMinutesTable).values(parsed.data).returning();
  res.status(201).json(meeting);
});

// Update meeting
router.patch("/meetings/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [meeting] = await db
    .update(meetingMinutesTable)
    .set(parsed.data)
    .where(eq(meetingMinutesTable.id, params.data.id))
    .returning();
  if (!meeting) { res.status(404).json({ error: "Ata não encontrada" }); return; }
  res.json(meeting);
});

// Delete meeting
router.delete("/meetings/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(meetingMinutesTable).where(eq(meetingMinutesTable.id, params.data.id));
  editingPresence.delete(params.data.id);
  res.sendStatus(204);
});

// Editing-presence heartbeat — called every few seconds by whoever has the edit
// page open; lets other viewers see who's currently editing.
router.post("/meetings/:id/presence", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "id inválido" }); return; }
  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "Não autenticado" }); return; }
  editingPresence.set(id, { userId, userName: user.name, since: Date.now() });
  res.json({ editingBy: user.name });
});

// Stop-editing signal — best effort, sent when the edit page closes normally.
// If it never arrives (tab closed, crash), the entry just expires after PRESENCE_TTL_MS.
router.delete("/meetings/:id/presence", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "id inválido" }); return; }
  const entry = editingPresence.get(id);
  if (entry && entry.userId === req.session.userId) {
    editingPresence.delete(id);
  }
  res.sendStatus(204);
});

export default router;
