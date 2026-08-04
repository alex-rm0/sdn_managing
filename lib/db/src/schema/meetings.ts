import { pgTable, serial, text, date, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface MeetingAgendaItem {
  text: string;
  pending: boolean;
}

export interface MeetingSection {
  title: string;
  items: string[];
}

export const meetingMinutesTable = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  attendees: text("attendees").notNull().default(""),
  agendaItems: jsonb("agenda_items")
    .$type<MeetingAgendaItem[]>()
    .notNull()
    .default([]),
  sections: jsonb("sections")
    .$type<MeetingSection[]>()
    .notNull()
    .default([]),
  notes: text("notes"),
  status: text("status").notNull().default("finalizada").$type<'preparacao' | 'a_decorrer' | 'finalizada'>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transversal — carries forward across every meeting until resolved. Deliberately
// separate from a single meeting's agendaItems (which are per-meeting only).
export const pendingItemsTable = pgTable("pending_items", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  originMeetingId: integer("origin_meeting_id").notNull().references(() => meetingMinutesTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pendente", "resolvido"] }).notNull().default("pendente"),
  resolvedNote: text("resolved_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedInMeetingId: integer("resolved_in_meeting_id").references(() => meetingMinutesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPendingItemSchema = createInsertSchema(pendingItemsTable).omit({ id: true, createdAt: true });
export type InsertPendingItem = z.infer<typeof insertPendingItemSchema>;
export type PendingItem = typeof pendingItemsTable.$inferSelect;

// Distinct from pending items: a task assigned to a specific Direção member,
// raised during a meeting, tracked until resolved — same lifecycle shape as
// pending items but a genuinely different concept (has an owner).
export const actionItemsTable = pgTable("action_items", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  assignedToName: text("assigned_to_name").notNull(),
  originMeetingId: integer("origin_meeting_id").notNull().references(() => meetingMinutesTable.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pendente", "resolvido"] }).notNull().default("pendente"),
  resolvedNote: text("resolved_note"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedInMeetingId: integer("resolved_in_meeting_id").references(() => meetingMinutesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActionItemSchema = createInsertSchema(actionItemsTable).omit({ id: true, createdAt: true });
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItemsTable.$inferSelect;
