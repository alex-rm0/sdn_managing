import { pgTable, serial, text, date, timestamp, jsonb } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
