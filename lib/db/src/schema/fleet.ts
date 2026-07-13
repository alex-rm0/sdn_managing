import { pgTable, text, serial, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fleetItemsTable = pgTable("fleet_items", {
  id: serial("id").primaryKey(),
  identifier: text("identifier").notNull(),
  brand: text("brand"),
  year: integer("year"),
  type: text("type", { enum: ["barco_remo", "barco_motor", "bicicleta", "atrelado", "carrinha"] }).notNull(),
  subtype: text("subtype"),
  status: text("status", { enum: ["ativo", "manutencao", "avariado", "fora_servico"] }).notNull().default("ativo"),
  breakdownDescription: text("breakdown_description"),
  repairMaterials: text("repair_materials"),
});

export const insertFleetItemSchema = createInsertSchema(fleetItemsTable).omit({ id: true });
export type InsertFleetItem = z.infer<typeof insertFleetItemSchema>;
export type FleetItem = typeof fleetItemsTable.$inferSelect;

export const fleetValuationsTable = pgTable("fleet_valuations", {
  id: serial("id").primaryKey(),
  fleetItemId: integer("fleet_item_id").notNull().references(() => fleetItemsTable.id, { onDelete: "cascade" }),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  notes: text("notes"),
});

export const insertFleetValuationSchema = createInsertSchema(fleetValuationsTable).omit({ id: true });
export type InsertFleetValuation = z.infer<typeof insertFleetValuationSchema>;
export type FleetValuation = typeof fleetValuationsTable.$inferSelect;
