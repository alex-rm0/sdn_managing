import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { seasonsTable } from "./seasons";
import { athletesTable } from "./athletes";

export const crewsTable = pgTable("crews", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  boatClass: text("boat_class", { enum: ["1x", "2x", "2-", "4x", "4-", "4+", "8+"] }).notNull(),
  category: text("category").notNull(),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
});

export const insertCrewSchema = createInsertSchema(crewsTable).omit({ id: true });
export type InsertCrew = z.infer<typeof insertCrewSchema>;
export type Crew = typeof crewsTable.$inferSelect;

export const crewAthletesTable = pgTable("crew_athletes", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").notNull().references(() => crewsTable.id, { onDelete: "cascade" }),
  athleteId: integer("athlete_id").notNull().references(() => athletesTable.id, { onDelete: "cascade" }),
});

export const insertCrewAthleteSchema = createInsertSchema(crewAthletesTable).omit({ id: true });
export type InsertCrewAthlete = z.infer<typeof insertCrewAthleteSchema>;
export type CrewAthlete = typeof crewAthletesTable.$inferSelect;
