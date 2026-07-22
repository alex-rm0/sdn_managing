import { Router, type IRouter } from "express";
import { db, teamMembersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  CreateTeamMemberBody, UpdateTeamMemberBody,
  UpdateTeamMemberParams, DeleteTeamMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/team-members", requireAdmin, async (req, res): Promise<void> => {
  let rows = await db.select().from(teamMembersTable)
    .orderBy(asc(teamMembersTable.sortOrder), asc(teamMembersTable.name));
  const { role } = req.query;
  if (role && typeof role === "string") rows = rows.filter(m => m.role === role);
  res.json(rows);
});

router.post("/team-members", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [member] = await db.insert(teamMembersTable).values(parsed.data).returning();
  res.status(201).json(member);
});

router.patch("/team-members/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateTeamMemberParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [member] = await db.update(teamMembersTable).set(parsed.data)
    .where(eq(teamMembersTable.id, params.data.id)).returning();
  if (!member) { res.status(404).json({ error: "Membro não encontrado" }); return; }
  res.json(member);
});

router.delete("/team-members/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteTeamMemberParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
