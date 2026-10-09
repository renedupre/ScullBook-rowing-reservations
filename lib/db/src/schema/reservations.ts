import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { launchesTable } from "./launches";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  launchId: integer("launch_id").notNull().references(() => launchesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("reservation_seat_unique").on(table.launchId, table.position),
  unique("reservation_rower_launch_unique").on(table.launchId, table.userId),
]);
export const insertReservationSchema = createInsertSchema(reservationsTable).omit({ id: true, createdAt: true });
