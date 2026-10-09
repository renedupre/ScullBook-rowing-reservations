import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const boatsTable = pgTable("boats", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  seats: integer("seats").notNull(),
});
export const insertBoatSchema = createInsertSchema(boatsTable).omit({ id: true });
export type BoatRecord = typeof boatsTable.$inferSelect;
