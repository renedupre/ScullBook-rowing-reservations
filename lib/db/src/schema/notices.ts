import { pgTable, serial, integer, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// Keep an outing/seat snapshot: a cancellation deletes the reservation, and
// later fleet edits must not change the meaning of an existing notice.
export const noticesTable = pgTable("booking_notices", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  boatName: text("boat_name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  shift: text("shift").notNull(),
  oldPosition: integer("old_position").notNull(),
  oldSeatLabel: text("old_seat_label").notNull(),
  newPosition: integer("new_position"),
  newSeatLabel: text("new_seat_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
}, (table) => [index("booking_notices_recipient_created_idx").on(table.recipientId, table.createdAt)]);

export const insertNoticeSchema = createInsertSchema(noticesTable).omit({ id: true, createdAt: true, readAt: true });
export type InsertNotice = z.infer<typeof insertNoticeSchema>;
export type NoticeRecord = typeof noticesTable.$inferSelect;
