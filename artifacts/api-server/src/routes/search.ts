import { Router, type IRouter } from "express";
import {
  db, athletesTable, competitionsTable, resultsTable, documentsTable, trainingSessionsTable,
} from "@workspace/db";
import { ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { GetSearchQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

interface SearchResultItem {
  id: string;
  type: "athlete" | "competition" | "result" | "document" | "session";
  title: string;
  subtitle: string | null;
  href: string;
}

const LIMIT_PER_TYPE = 5;

router.get("/search", requireAuth, async (req, res): Promise<void> => {
  const query = GetSearchQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const q = (query.data.q ?? "").trim();
  if (q.length < 2) {
    res.json({ items: [] });
    return;
  }
  const like = `%${q}%`;

  const [athletes, competitions, results, documents, sessions] = await Promise.all([
    db.select().from(athletesTable).where(
      or(ilike(athletesTable.name, like), ilike(athletesTable.memberNumber, like), ilike(athletesTable.fprNumber, like), ilike(athletesTable.email, like))
    ).limit(LIMIT_PER_TYPE),
    db.select().from(competitionsTable).where(
      or(ilike(competitionsTable.name, like), ilike(competitionsTable.location, like))
    ).limit(LIMIT_PER_TYPE),
    db.select().from(resultsTable).where(
      or(ilike(resultsTable.athleteNames, like), ilike(resultsTable.boatClass, like), ilike(resultsTable.escalao, like))
    ).limit(LIMIT_PER_TYPE),
    db.select().from(documentsTable).where(
      or(ilike(documentsTable.title, like), ilike(documentsTable.entity, like))
    ).limit(LIMIT_PER_TYPE),
    db.select().from(trainingSessionsTable).where(
      ilike(trainingSessionsTable.groupCategory, like)
    ).limit(LIMIT_PER_TYPE),
  ]);

  const items: SearchResultItem[] = [
    ...athletes.map((a): SearchResultItem => ({
      id: `athlete-${a.id}`, type: "athlete", title: a.name,
      subtitle: a.memberNumber ?? null,
      href: `/atletas/${a.id}`,
    })),
    ...competitions.map((c): SearchResultItem => ({
      id: `competition-${c.id}`, type: "competition", title: c.name,
      subtitle: [c.location, c.startDate].filter(Boolean).join(" · ") || null,
      href: "/competicoes",
    })),
    ...results.map((r): SearchResultItem => ({
      id: `result-${r.id}`, type: "result", title: r.athleteNames ?? r.boatClass ?? "Resultado",
      subtitle: [r.boatClass, r.escalao, r.position ? `${r.position}º lugar` : null].filter(Boolean).join(" · ") || null,
      href: "/resultados",
    })),
    ...documents.map((d): SearchResultItem => ({
      id: `document-${d.id}`, type: "document", title: d.title,
      subtitle: [d.entity, d.date].filter(Boolean).join(" · ") || null,
      href: "/documentos",
    })),
    ...sessions.map((s): SearchResultItem => ({
      id: `session-${s.id}`, type: "session", title: `${s.groupCategory} · ${s.trainingType}`,
      subtitle: [s.date, `${s.startTime}–${s.endTime}`].filter(Boolean).join(" · ") || null,
      href: "/treinos",
    })),
  ];

  res.json({ items });
});

export default router;
