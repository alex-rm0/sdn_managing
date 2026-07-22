import { pgTable, text, serial, integer, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { athletesTable } from "./athletes";
import { crewsTable } from "./crews";

export const competitionsTable = pgTable("competitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  organizer: text("organizer"),
});

export const insertCompetitionSchema = createInsertSchema(competitionsTable).omit({ id: true });
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;
export type Competition = typeof competitionsTable.$inferSelect;

export const racesTable = pgTable("races", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  competitionId: integer("competition_id").notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  modality: text("modality"),
  distance: text("distance"),
  category: text("category"),
});

export const insertRaceSchema = createInsertSchema(racesTable).omit({ id: true });
export type InsertRace = z.infer<typeof insertRaceSchema>;
export type Race = typeof racesTable.$inferSelect;

export const resultsTable = pgTable("results", {
  id: serial("id").primaryKey(),
  raceId: integer("race_id").notNull().references(() => racesTable.id, { onDelete: "cascade" }),
  athleteId: integer("athlete_id").references(() => athletesTable.id, { onDelete: "set null" }),
  crewId: integer("crew_id").references(() => crewsTable.id, { onDelete: "set null" }),
  athleteNames: text("athlete_names"),
  boatClass: text("boat_class"),
  escalao: text("escalao"),
  position: integer("position"),
  time: text("time"),
  points: numeric("points", { precision: 10, scale: 2 }),
  notes: text("notes"),
});

export const insertResultSchema = createInsertSchema(resultsTable).omit({ id: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof resultsTable.$inferSelect;
