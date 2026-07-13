import { Router, type IRouter } from "express";
import { db, seasonsTable, categoryRulesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateSeasonBody, UpdateSeasonBody, GetSeasonParams, UpdateSeasonParams, DeleteSeasonParams,
  CreateCategoryRuleBody, UpdateCategoryRuleBody, UpdateCategoryRuleParams, DeleteCategoryRuleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/seasons", requireAuth, async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(seasonsTable.startDate);
  res.json(seasons.reverse());
});

router.post("/seasons", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateSeasonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [season] = await db.insert(seasonsTable).values(parsed.data).returning();
  res.status(201).json(season);
});

router.get("/seasons/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, params.data.id));
  if (!season) { res.status(404).json({ error: "Época não encontrada" }); return; }
  res.json(season);
});

router.patch("/seasons/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateSeasonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [season] = await db.update(seasonsTable).set(parsed.data).where(eq(seasonsTable.id, params.data.id)).returning();
  if (!season) { res.status(404).json({ error: "Época não encontrada" }); return; }
  res.json(season);
});

router.delete("/seasons/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(seasonsTable).where(eq(seasonsTable.id, params.data.id));
  res.sendStatus(204);
});

// Category Rules
router.get("/category-rules", requireAuth, async (_req, res): Promise<void> => {
  const rules = await db.select().from(categoryRulesTable).orderBy(categoryRulesTable.minAge);
  res.json(rules);
});

router.post("/category-rules", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [rule] = await db.insert(categoryRulesTable).values(parsed.data).returning();
  res.status(201).json(rule);
});

router.patch("/category-rules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCategoryRuleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCategoryRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [rule] = await db.update(categoryRulesTable).set(parsed.data).where(eq(categoryRulesTable.id, params.data.id)).returning();
  if (!rule) { res.status(404).json({ error: "Regra não encontrada" }); return; }
  res.json(rule);
});

router.delete("/category-rules/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCategoryRuleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(categoryRulesTable).where(eq(categoryRulesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
