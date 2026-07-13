import { pgTable, text, serial, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { athletesTable } from "./athletes";

export const financialMovementsTable = pgTable("financial_movements", {
  id: serial("id").primaryKey(),
  type: text("type", { enum: ["receita", "despesa"] }).notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  documentUrl: text("document_url"),
  seasonId: integer("season_id").references(() => seasonsTable.id, { onDelete: "set null" }),
  relatedQuotaId: integer("related_quota_id"),
});

export const insertFinancialMovementSchema = createInsertSchema(financialMovementsTable).omit({ id: true });
export type InsertFinancialMovement = z.infer<typeof insertFinancialMovementSchema>;
export type FinancialMovement = typeof financialMovementsTable.$inferSelect;

export const quotaPlansTable = pgTable("quota_plans", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  periodicity: text("periodicity", { enum: ["anual", "mensal", "trimestral"] }).notNull().default("anual"),
  dueDay: integer("due_day"),
});

export const insertQuotaPlanSchema = createInsertSchema(quotaPlansTable).omit({ id: true });
export type InsertQuotaPlan = z.infer<typeof insertQuotaPlanSchema>;
export type QuotaPlan = typeof quotaPlansTable.$inferSelect;

export const quotasTable = pgTable("quotas", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").notNull().references(() => athletesTable.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  period: text("period"),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
});

export const insertQuotaSchema = createInsertSchema(quotasTable).omit({ id: true });
export type InsertQuota = z.infer<typeof insertQuotaSchema>;
export type Quota = typeof quotasTable.$inferSelect;

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  quotaId: integer("quota_id").notNull().references(() => quotasTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  method: text("method", { enum: ["numerario", "transferencia", "mbway", "outro"] }),
  notes: text("notes"),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
