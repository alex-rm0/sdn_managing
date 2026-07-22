import { Router, type IRouter } from "express";
import { db, meetingMinutesTable } from "@workspace/db";
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

// List all meeting minutes
router.get("/meetings", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(meetingMinutesTable)
    .orderBy(desc(meetingMinutesTable.date));
  res.json(rows);
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
  res.json(meeting);
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
  res.sendStatus(204);
});

export default router;
