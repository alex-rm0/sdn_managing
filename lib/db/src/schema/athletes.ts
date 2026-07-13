import { pgTable, text, serial, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";

export const athletesTable = pgTable("athletes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  birthDate: date("birth_date", { mode: "string" }).notNull(),
  gender: text("gender", { enum: ["M", "F"] }).notNull(),
  email: text("email"),
  phone: text("phone"),
  memberNumber: text("member_number"),
  fprNumber: text("fpr_number"),
  affiliationDate: date("affiliation_date", { mode: "string" }).notNull(),
  status: text("status", { enum: ["ativo", "inativo", "suspenso"] }).notNull().default("ativo"),
  notes: text("notes"),
});

export const insertAthleteSchema = createInsertSchema(athletesTable).omit({ id: true });
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type Athlete = typeof athletesTable.$inferSelect;

export const athleteCategoryOverridesTable = pgTable("athlete_category_overrides", {
  id: serial("id").primaryKey(),
  athleteId: integer("athlete_id").notNull().references(() => athletesTable.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  categoryOverride: text("category_override").notNull(),
});

export const insertAthleteCategoryOverrideSchema = createInsertSchema(athleteCategoryOverridesTable).omit({ id: true });
export type InsertAthleteCategoryOverride = z.infer<typeof insertAthleteCategoryOverrideSchema>;
export type AthleteCategoryOverride = typeof athleteCategoryOverridesTable.$inferSelect;
