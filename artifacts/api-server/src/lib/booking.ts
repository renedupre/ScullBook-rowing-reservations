import { and, eq } from "drizzle-orm";
import { db, usersTable, launchesTable, boatsTable, reservationsTable } from "@workspace/db";
import { today } from "./rowing";

// Both self-service and admin bookings use the same locks and eligibility rules.
export function bookSeat(input: { userId: number; launchId: number; position: number }, self = false) {
  return db.transaction(async (tx) => {
    const [rower] = await tx.select({ id: usersTable.id, role: usersTable.role }).from(usersTable)
      .where(eq(usersTable.id, input.userId)).for("update");
    if (!rower) return { status: 404, error: "That registered rower no longer exists." };
    if (rower.role !== "rower") return { status: 400, error: "Choose a registered rower account." };
    // Always lock the rower before the launch, including bookings made by admins,
    // so concurrent bookings on different boats cannot bypass the shift rule.
    const [launch] = await tx.select().from(launchesTable).where(eq(launchesTable.id, input.launchId)).for("update");
    if (!launch) return { status: 404, error: "Session not found." };
    if (launch.date < today()) return { status: 400, error: "This rowing date is in the past." };
    const [boat] = await tx.select().from(boatsTable).where(eq(boatsTable.id, launch.boatId)).for("share");
    if (!boat || input.position > boat.seats) return { status: 400, error: "That seat does not exist on this boat." };
    const conflict = await tx.select({ id: reservationsTable.id }).from(reservationsTable)
      .innerJoin(launchesTable, eq(reservationsTable.launchId, launchesTable.id))
      .where(and(eq(reservationsTable.userId, input.userId), eq(launchesTable.date, launch.date), eq(launchesTable.shift, launch.shift)));
    if (conflict.length) return { status: 409, error: `${self ? "You" : "This rower"} already ${self ? "have" : "has"} a boat booked for ${launch.shift === "08:00" ? "8am" : "1pm"} on this date. Cancel that seat before booking another boat in this shift.` };
    const occupied = await tx.select({ id: reservationsTable.id }).from(reservationsTable)
      .where(and(eq(reservationsTable.launchId, launch.id), eq(reservationsTable.position, input.position)));
    if (occupied.length) return { status: 409, error: "That seat was just booked. Please select another available seat." };
    const [reservation] = await tx.insert(reservationsTable).values(input).returning({ id: reservationsTable.id });
    return { id: reservation.id };
  });
}
