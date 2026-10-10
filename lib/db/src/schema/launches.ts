import { pgTable, serial, integer, date, text, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { boatsTable } from "./boats";
import { createInsertSchema } from "drizzle-zod";
export const launchesTable = pgTable("launches", {
  id: serial("id").primaryKey(),
  boatId: integer("boat_id").notNull().references(() => boatsTable.id),
  date: date("date", { mode: "string" }).notNull(),
  shift: text("shift").notNull().default("08:00"),
}, (table) => [
  unique("launch_boat_date_shift_unique").on(table.boatId, table.date, table.shift),
  check("launch_shift_valid", sql`${table.shift} IN ('08:00', '13:00')`),
]);
export const insertLaunchSchema = createInsertSchema(launchesTable).omit({ id: true });
