import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { date } from "drizzle-orm/pg-core";
import { seasonsTable } from "./seasons";
import { usersTable } from "./users";
import { athletesTable } from "./athletes";

export const trainingSchedulesTable = pgTable("training_schedules", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  groupCategory: text("group_category").notNull(),
  daysOfWeek: integer("days_of_week").array().notNull().default([]),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  trainingType: text("training_type", { enum: ["agua", "ginasio", "ergometro", "outro"] }).notNull().default("agua"),
  trainerIds: integer("trainer_ids").array().notNull().default([]),
  notes: text("notes"),
});

export const insertTrainingScheduleSchema = createInsertSchema(trainingSchedulesTable).omit({ id: true });
export type InsertTrainingSchedule = z.infer<typeof insertTrainingScheduleSchema>;
export type TrainingSchedule = typeof trainingSchedulesTable.$inferSelect;

export const trainingSessionsTable = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  groupCategory: text("group_category").notNull(),
  trainingType: text("training_type", { enum: ["agua", "ginasio", "ergometro", "prova", "estagio", "outro"] }).notNull().default("agua"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  trainerId: integer("trainer_id").references(() => usersTable.id, { onDelete: "set null" }),
  seasonId: integer("season_id").references(() => seasonsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessionsTable).omit({ id: true });
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;
export type TrainingSession = typeof trainingSessionsTable.$inferSelect;

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => trainingSessionsTable.id, { onDelete: "cascade" }),
  athleteId: integer("athlete_id").notNull().references(() => athletesTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["presente", "ausente", "ausente_justificado"] }).notNull().default("presente"),
  observation: text("observation"),
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecordsTable).omit({ id: true });
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
