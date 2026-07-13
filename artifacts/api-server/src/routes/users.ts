import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  CreateUserBody, UpdateUserBody, GetUserParams, UpdateUserParams, DeleteUserParams
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    active: usersTable.active,
    assignedCategories: usersTable.assignedCategories,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.name);
  res.json(users);
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    ...rest,
    passwordHash,
    assignedCategories: rest.assignedCategories ?? [],
  }).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    active: usersTable.active,
    assignedCategories: usersTable.assignedCategories,
    createdAt: usersTable.createdAt,
  });
  res.status(201).json(user);
});

router.get("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [user] = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
    role: usersTable.role, active: usersTable.active, assignedCategories: usersTable.assignedCategories,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "Utilizador não encontrado" }); return; }
  res.json(user);
});

router.patch("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { password, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, params.data.id))
    .returning({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      role: usersTable.role, active: usersTable.active, assignedCategories: usersTable.assignedCategories,
      createdAt: usersTable.createdAt,
    });
  if (!user) { res.status(404).json({ error: "Utilizador não encontrado" }); return; }
  res.json(user);
});

router.delete("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
