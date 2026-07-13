import { pgTable, text, serial, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type", { enum: ["noticia", "contrato", "arquivo"] }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  category: text("category"),
  entity: text("entity"),
  contractStart: date("contract_start", { mode: "string" }),
  contractEnd: date("contract_end", { mode: "string" }),
  contractStatus: text("contract_status", { enum: ["ativo", "expirado"] }),
  notes: text("notes"),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
