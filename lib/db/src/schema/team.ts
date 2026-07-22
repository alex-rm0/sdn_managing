import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<'direcao' | 'treinador' | 'funcionario'>(),
  position: text("position"),   // cargo (e.g. "Presidente")
  portfolio: text("portfolio"), // pelouro (e.g. "Desporto")
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
