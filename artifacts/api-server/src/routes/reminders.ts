import { Router, type IRouter } from "express";
import {
  db, quotasTable, paymentsTable, athletesTable, meetingMinutesTable,
  fleetItemsTable, documentsTable, competitionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

interface ReminderItem {
  id: string;
  category: "quota" | "meeting" | "fleet" | "contract" | "competition";
  severity: "danger" | "info" | "neutral";
  title: string;
  description: string | null;
  date: string | null;
  href: string;
}

router.get("/reminders", requireAuth, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];
  const items: ReminderItem[] = [];

  // Overdue quotas — one item per athlete with an unpaid, past-due quota.
  const [allQuotas, allPayments, allAthletes] = await Promise.all([
    db.select().from(quotasTable),
    db.select().from(paymentsTable),
    db.select().from(athletesTable),
  ]);
  const athleteNameById = new Map(allAthletes.map(a => [a.id, a.name]));
  for (const q of allQuotas) {
    if (!q.dueDate || q.dueDate >= today) continue;
    const paid = allPayments.filter(p => p.quotaId === q.id).reduce((sum, p) => sum + Number(p.amount), 0);
    const due = Number(q.amountDue);
    if (paid >= due) continue;
    items.push({
      id: `quota-${q.id}`,
      category: "quota",
      severity: "danger",
      title: `Quota em atraso — ${athleteNameById.get(q.athleteId) ?? "Atleta"}`,
      description: `${(due - paid).toFixed(2)} € em falta${q.period ? ` · ${q.period}` : ""}`,
      date: q.dueDate,
      href: "/quotas",
    });
  }

  // Meetings not yet finalized.
  const allMeetings = await db.select().from(meetingMinutesTable);
  for (const m of allMeetings) {
    if (m.status === "finalizada") continue;
    items.push({
      id: `meeting-${m.id}`,
      category: "meeting",
      severity: "info",
      title: m.status === "a_decorrer" ? "Reunião a decorrer" : "Reunião em preparação",
      description: new Date(m.date).toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" }),
      date: m.date,
      href: "/reunioes",
    });
  }

  // Fleet items needing attention.
  const allFleet = await db.select().from(fleetItemsTable);
  for (const f of allFleet) {
    if (f.status !== "manutencao" && f.status !== "avariado") continue;
    items.push({
      id: `fleet-${f.id}`,
      category: "fleet",
      severity: f.status === "avariado" ? "danger" : "neutral",
      title: `${f.identifier} — ${f.status === "avariado" ? "avariado" : "em manutenção"}`,
      description: f.breakdownDescription ?? null,
      date: null,
      href: "/inventario",
    });
  }

  // Contracts expired or expiring within 30 days.
  const allDocs = await db.select().from(documentsTable);
  for (const d of allDocs) {
    if (d.type !== "contrato" || !d.contractEnd) continue;
    if (d.contractEnd > in30Days) continue;
    const expired = d.contractEnd < today;
    items.push({
      id: `contract-${d.id}`,
      category: "contract",
      severity: expired ? "danger" : "info",
      title: `${d.title} — contrato ${expired ? "expirado" : "a expirar"}`,
      description: d.entity ?? null,
      date: d.contractEnd,
      href: "/documentos",
    });
  }

  // Competitions coming up within 30 days.
  const allCompetitions = await db.select().from(competitionsTable);
  for (const c of allCompetitions) {
    if (c.startDate < today || c.startDate > in30Days) continue;
    items.push({
      id: `competition-${c.id}`,
      category: "competition",
      severity: "neutral",
      title: c.name,
      description: c.location ?? null,
      date: c.startDate,
      href: "/competicoes",
    });
  }

  items.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  res.json({ items });
});

export default router;
