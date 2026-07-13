import { pgTable, text, serial, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  active: boolean("active").notNull().default(false),
});

export const insertSeasonSchema = createInsertSchema(seasonsTable).omit({ id: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasonsTable.$inferSelect;

export const categoryRulesTable = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  minAge: integer("min_age").notNull(),
  maxAge: integer("max_age"),
  description: text("description"),
});

export const insertCategoryRuleSchema = createInsertSchema(categoryRulesTable).omit({ id: true });
export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;
export type CategoryRule = typeof categoryRulesTable.$inferSelect;
