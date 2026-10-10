import { db, boatsTable, launchesTable, reservationsTable, usersTable } from "@workspace/db";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export const capacities: Record<string, number> = { "Single Scull": 1, "Double Scull": 2, "Quadruple Scull": 4, "Octuple Scull": 9 };
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const seatLabel = (type: string, position: number, seats: number) =>
  type === "Octuple Scull" && position === 1 ? "Coxswain" :
  (type === "Octuple Scull" && position === 2) || (seats > 1 && position === 1) ? "Stroke (Stoker)" :
  position === seats && seats > 1 ? "Bow" : `Seat ${position}`;
export async function launchList(from = today(), to?: string) {
  const rows = await db.select({ launch: launchesTable, boat: boatsTable }).from(launchesTable)
    .innerJoin(boatsTable, eq(launchesTable.boatId, boatsTable.id))
    .where(and(gte(launchesTable.date, from), to ? lte(launchesTable.date, to) : undefined))
    .orderBy(asc(launchesTable.date), asc(launchesTable.shift), asc(boatsTable.name));
  const bookings = await db.select({ launchId: reservationsTable.launchId }).from(reservationsTable);
  const counts = new Map<number, number>();
  bookings.forEach((booking) => counts.set(booking.launchId, (counts.get(booking.launchId) ?? 0) + 1));
  return rows.map(({ launch, boat }) => {
    const bookedSeats = counts.get(launch.id) ?? 0;
    return { id: launch.id, date: launch.date, shift: launch.shift, boat, bookedSeats, availableSeats: boat.seats - bookedSeats, full: bookedSeats >= boat.seats };
  });
}
export async function launchById(id: number) {
  const [record] = await db.select({ launch: launchesTable, boat: boatsTable }).from(launchesTable)
    .innerJoin(boatsTable, eq(launchesTable.boatId, boatsTable.id)).where(eq(launchesTable.id, id));
  return record;
}
export async function seatsForLaunch(id: number, includeReservationIds = false) {
  const record = await launchById(id);
  if (!record) return null;
  const booked = await db.select({ reservationId: reservationsTable.id, position: reservationsTable.position, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(reservationsTable).innerJoin(usersTable, eq(reservationsTable.userId, usersTable.id)).where(eq(reservationsTable.launchId, id));
  return Array.from({ length: record.boat.seats }, (_, index) => {
    const position = index + 1;
    const occupant = booked.find((row) => row.position === position);
    return { position, label: seatLabel(record.boat.type, position, record.boat.seats), occupied: !!occupant,
      rowerName: occupant ? `${occupant.firstName} ${occupant.lastName}` : null,
      ...(includeReservationIds ? { reservationId: occupant?.reservationId ?? null } : {}) };
  });
}
export async function reservationById(id: number) {
  const [record] = await db.select({ reservation: reservationsTable, launch: launchesTable, boat: boatsTable })
    .from(reservationsTable).innerJoin(launchesTable, eq(reservationsTable.launchId, launchesTable.id))
    .innerJoin(boatsTable, eq(launchesTable.boatId, boatsTable.id)).where(eq(reservationsTable.id, id));
  if (!record) return null;
  return { id: record.reservation.id, launchId: record.launch.id, date: record.launch.date, shift: record.launch.shift, boat: record.boat,
    position: record.reservation.position, seatLabel: seatLabel(record.boat.type, record.reservation.position, record.boat.seats) };
}
