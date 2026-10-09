import { pgTable, serial, integer, date, unique } from "drizzle-orm/pg-core";
import { boatsTable } from "./boats";
import { createInsertSchema } from "drizzle-zod";
export const launchesTable = pgTable("launches", {
  id: serial("id").primaryKey(),
  boatId: integer("boat_id").notNull().references(() => boatsTable.id),
  date: date("date", { mode: "string" }).notNull(),
}, (table) => [unique("launch_boat_date_unique").on(table.boatId, table.date)]);
export const insertLaunchSchema = createInsertSchema(launchesTable).omit({ id: true });
