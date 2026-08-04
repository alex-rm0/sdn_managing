import { Router, type IRouter } from "express";
import { db, pendingItemsTable, actionItemsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// All pending/action items tied to a specific meeting — either raised there
// or resolved there — regardless of status, so the ata can show the full
// history (including resolutions with their notes) for that meeting.
router.get("/meetings/:id/items", requireAdmin, async (req, res): Promise<void> => {
  const meetingId = Number(req.params.id);
  if (!Number.isInteger(meetingId)) { res.status(400).json({ error: "id inválido" }); return; }
  const pending = await db.select().from(pendingItemsTable)
    .where(or(eq(pendingItemsTable.originMeetingId, meetingId), eq(pendingItemsTable.resolvedInMeetingId, meetingId)));
  const actions = await db.select().from(actionItemsTable)
    .where(or(eq(actionItemsTable.originMeetingId, meetingId), eq(actionItemsTable.resolvedInMeetingId, meetingId)));
  res.json({ pending, actions });
});

// ── Pending items (transversal, no assignee) ──────────────────────────────────

router.get("/pending-items", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(pendingItemsTable).where(eq(pendingItemsTable.status, "pendente"));
  res.json(rows);
});

router.post("/meetings/:id/pending-items", requireAdmin, async (req, res): Promise<void> => {
  const originMeetingId = Number(req.params.id);
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!Number.isInteger(originMeetingId) || !text) { res.status(400).json({ error: "Dados inválidos" }); return; }
  const [item] = await db.insert(pendingItemsTable).values({ text, originMeetingId }).returning();
  res.status(201).json(item);
});

router.patch("/pending-items/:id/resolve", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "id inválido" }); return; }
  const resolvedNote = typeof req.body?.resolvedNote === "string" && req.body.resolvedNote.trim() ? req.body.resolvedNote.trim() : null;
  const resolvedInMeetingId = Number.isInteger(req.body?.resolvedInMeetingId) ? req.body.resolvedInMeetingId : null;
  const [item] = await db.update(pendingItemsTable)
    .set({ status: "resolvido", resolvedNote, resolvedInMeetingId, resolvedAt: new Date() })
    .where(eq(pendingItemsTable.id, id))
    .returning();
  if (!item) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json(item);
});

// ── Action items (transversal, assigned to a Direção member) ─────────────────

router.get("/action-items", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(actionItemsTable).where(eq(actionItemsTable.status, "pendente"));
  res.json(rows);
});

router.post("/meetings/:id/action-items", requireAdmin, async (req, res): Promise<void> => {
  const originMeetingId = Number(req.params.id);
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const assignedToName = typeof req.body?.assignedToName === "string" ? req.body.assignedToName.trim() : "";
  if (!Number.isInteger(originMeetingId) || !text || !assignedToName) { res.status(400).json({ error: "Dados inválidos" }); return; }
  const [item] = await db.insert(actionItemsTable).values({ text, assignedToName, originMeetingId }).returning();
  res.status(201).json(item);
});

router.patch("/action-items/:id/resolve", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "id inválido" }); return; }
  const resolvedNote = typeof req.body?.resolvedNote === "string" && req.body.resolvedNote.trim() ? req.body.resolvedNote.trim() : null;
  const resolvedInMeetingId = Number.isInteger(req.body?.resolvedInMeetingId) ? req.body.resolvedInMeetingId : null;
  const [item] = await db.update(actionItemsTable)
    .set({ status: "resolvido", resolvedNote, resolvedInMeetingId, resolvedAt: new Date() })
    .where(eq(actionItemsTable.id, id))
    .returning();
  if (!item) { res.status(404).json({ error: "Não encontrado" }); return; }
  res.json(item);
});

export default router;
