import { Router } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, boatsTable, launchesTable, reservationsTable, usersTable } from "@workspace/db";
import { ListMyReservationsResponse, ReserveSeatBody, ReserveSeatResponse, CancelReservationParams, ListRosterQueryParams, ListRosterResponse, GetAdminSummaryResponse } from "@workspace/api-zod";
import { requireUser, requireAdmin } from "../lib/auth";
import { launchList, reservationById, seatsForLaunch, seatLabel, today } from "../lib/rowing";
const router = Router();
router.use("/reservations", requireUser);
router.use("/admin", requireUser, requireAdmin);
router.get("/reservations", async (_req, res) => {
  const rows = await db.select({ reservation: reservationsTable, launch: launchesTable, boat: boatsTable }).from(reservationsTable)
    .innerJoin(launchesTable, eq(reservationsTable.launchId, launchesTable.id))
    .innerJoin(boatsTable, eq(launchesTable.boatId, boatsTable.id))
    .where(and(eq(reservationsTable.userId, res.locals.user.id), gte(launchesTable.date, today()))).orderBy(launchesTable.date);
  res.json(ListMyReservationsResponse.parse(rows.map(({ reservation, launch, boat }) => ({
    id: reservation.id, launchId: launch.id, date: launch.date, boat, position: reservation.position,
    seatLabel: seatLabel(boat.type, reservation.position, boat.seats),
  }))));
});
router.post("/reservations", async (req, res): Promise<void> => {
  const parsed = ReserveSeatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a valid session and seat." }); return; }
  if (res.locals.user.role !== "rower") { res.status(403).json({ error: "Only rower accounts can reserve seats." }); return; }
  const result = await db.transaction(async (tx) => {
    const [launch] = await tx.select().from(launchesTable).where(eq(launchesTable.id, parsed.data.launchId)).for("update");
    if (!launch) return { status: 404, error: "Session not found." };
    if (launch.date < today()) return { status: 400, error: "This rowing date is in the past." };
    const [boat] = await tx.select().from(boatsTable).where(eq(boatsTable.id, launch.boatId)).for("share");
    if (parsed.data.position > boat.seats) return { status: 400, error: "That seat does not exist on this boat." };
    const existing = await tx.select().from(reservationsTable).where(eq(reservationsTable.launchId, launch.id));
    if (existing.some((r) => r.userId === res.locals.user.id)) return { status: 409, error: "You already have a seat on this boat for this date." };
    if (existing.some((r) => r.position === parsed.data.position)) return { status: 409, error: "That seat was just booked. Please select another available seat." };
    const [reservation] = await tx.insert(reservationsTable).values({ ...parsed.data, userId: res.locals.user.id }).returning();
    return { id: reservation.id };
  });
  if (result.error) { res.status(result.status!).json({ error: result.error }); return; }
  res.status(201).json(ReserveSeatResponse.parse(await reservationById(result.id!)));
});
router.delete("/reservations/:reservationId", async (req, res): Promise<void> => {
  const params = CancelReservationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid reservation ID." }); return; }
  const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, params.data.reservationId));
  if (!reservation) { res.status(404).json({ error: "Reservation not found." }); return; }
  if (reservation.userId !== res.locals.user.id && res.locals.user.role !== "admin") { res.status(403).json({ error: "You can only cancel your own reservations." }); return; }
  await db.delete(reservationsTable).where(eq(reservationsTable.id, reservation.id));
  res.sendStatus(204);
});
router.get("/admin/roster", async (req, res): Promise<void> => {
  const query = ListRosterQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid date filters." }); return; }
  const launches = await launchList(query.data.from, query.data.to);
  const roster = await Promise.all(launches.map(async (launch) => ({
    launchId: launch.id, date: launch.date, boat: launch.boat, seats: await seatsForLaunch(launch.id),
  })));
  res.json(ListRosterResponse.parse(roster));
});
router.get("/admin/summary", async (_req, res) => {
  const launches = await launchList();
  const rowers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "rower"));
  const boats = await db.select({ id: boatsTable.id }).from(boatsTable);
  res.json(GetAdminSummaryResponse.parse({
    rowerCount: rowers.length, boatCount: boats.length, upcomingLaunchCount: launches.length,
    reservationCount: launches.reduce((total, launch) => total + launch.bookedSeats, 0), nextLaunches: launches.slice(0, 6),
  }));
});
export default router;
