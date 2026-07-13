import { Router, type IRouter } from "express";
import { db, documentsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import {
  CreateDocumentBody, UpdateDocumentBody, GetDocumentParams, UpdateDocumentParams, DeleteDocumentParams, ListDocumentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/documents", requireAdmin, async (req, res): Promise<void> => {
  const query = ListDocumentsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let rows = await db.select().from(documentsTable).orderBy(documentsTable.date);
  if (query.data.type) rows = rows.filter(d => d.type === query.data.type);
  if (query.data.search) {
    const q = query.data.search.toLowerCase();
    rows = rows.filter(d => d.title.toLowerCase().includes(q) || (d.content?.toLowerCase().includes(q)));
  }
  res.json(rows.reverse());
});

router.post("/documents", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [doc] = await db.insert(documentsTable).values(parsed.data).returning();
  res.status(201).json(doc);
});

router.get("/documents/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, params.data.id));
  if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
  res.json(doc);
});

router.patch("/documents/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [doc] = await db.update(documentsTable).set(parsed.data).where(eq(documentsTable.id, params.data.id)).returning();
  if (!doc) { res.status(404).json({ error: "Documento não encontrado" }); return; }
  res.json(doc);
});

router.delete("/documents/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(documentsTable).where(eq(documentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
