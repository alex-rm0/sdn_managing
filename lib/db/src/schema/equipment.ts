import { pgTable, text, serial, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const equipmentTable = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  totalQuantity: integer("total_quantity").notNull().default(1),
  availableQuantity: integer("available_quantity").notNull().default(1),
  status: text("status").notNull().default("bom"),
  assignedTo: text("assigned_to"),
  acquisitionDate: date("acquisition_date", { mode: "string" }),
  notes: text("notes"),
});

export const insertEquipmentSchema = createInsertSchema(equipmentTable).omit({ id: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipmentTable.$inferSelect;
