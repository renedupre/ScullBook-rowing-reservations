import { Router } from "express";
import { and, eq, gte, or, ilike, asc, sql } from "drizzle-orm";
import { db, boatsTable, launchesTable, reservationsTable, usersTable, noticesTable } from "@workspace/db";
import { ListMyReservationsResponse, ReserveSeatBody, ReserveSeatResponse, CancelReservationParams, CancelReservationQueryParams, ListRosterQueryParams, ListRosterResponse, GetAdminSummaryResponse, SwapSeatsParams, SwapSeatsBody, SwapSeatsResponse } from "@workspace/api-zod";
import { requireUser, requireAdmin } from "../lib/auth";
import { launchList, reservationById, seatsForLaunch, seatLabel, today } from "../lib/rowing";
import { AdminReserveSeatBody, AdminReserveSeatResponse, SearchRowersQueryParams, SearchRowersResponse } from "@workspace/api-zod";
import { bookSeat } from "../lib/booking";
const router = Router();
router.use("/reservations", requireUser);
router.use("/admin", requireUser, requireAdmin);
router.get("/reservations", async (_req, res) => {
  const rows = await db.select({ reservation: reservationsTable, launch: launchesTable, boat: boatsTable }).from(reservationsTable)
    .innerJoin(launchesTable, eq(reservationsTable.launchId, launchesTable.id))
    .innerJoin(boatsTable, eq(launchesTable.boatId, boatsTable.id))
    .where(and(eq(reservationsTable.userId, res.locals.user.id), gte(launchesTable.date, today()))).orderBy(launchesTable.date, launchesTable.shift);
  res.json(ListMyReservationsResponse.parse(rows.map(({ reservation, launch, boat }) => ({
    id: reservation.id, launchId: launch.id, date: launch.date, shift: launch.shift, boat, position: reservation.position,
    seatLabel: seatLabel(boat.type, reservation.position, boat.seats),
  }))));
});
router.post("/reservations", async (req, res): Promise<void> => {
  const parsed = ReserveSeatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a valid session and seat." }); return; }
  if (res.locals.user.role !== "rower") { res.status(403).json({ error: "Only rower accounts can reserve seats." }); return; }
  const result = await bookSeat({ ...parsed.data, userId: res.locals.user.id }, true);
  if (result.error) { res.status(result.status!).json({ error: result.error }); return; }
  res.status(201).json(ReserveSeatResponse.parse(await reservationById(result.id!)));
});
router.get("/admin/rowers", async (req, res): Promise<void> => {
  const query = SearchRowersQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Enter a name of up to 100 characters." }); return; }
  const term = (query.data.q ?? "").trim().replace(/\s+/g, " ");
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const matches = term ? or(
    ilike(usersTable.firstName, pattern),
    ilike(usersTable.lastName, pattern),
    ilike(sql<string>`${usersTable.firstName} || ' ' || ${usersTable.lastName}`, pattern),
  ) : undefined;
  const rowers = await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(usersTable).where(and(eq(usersTable.role, "rower"), matches))
    .orderBy(asc(usersTable.lastName), asc(usersTable.firstName), asc(usersTable.id));
  res.json(SearchRowersResponse.parse(rowers));
});
router.post("/admin/reservations", async (req, res): Promise<void> => {
  const parsed = AdminReserveSeatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a valid seat and registered rower." }); return; }
  const result = await bookSeat(parsed.data);
  if (result.error) { res.status(result.status!).json({ error: result.error }); return; }
  res.status(201).json(AdminReserveSeatResponse.parse(await reservationById(result.id!)));
});
router.delete("/reservations/:reservationId", async (req, res): Promise<void> => {
  const params = CancelReservationParams.safeParse(req.params);
  const query = CancelReservationQueryParams.safeParse(req.query);
  if (!params.success || !query.success) { res.status(400).json({ error: "Invalid reservation ID or seat position." }); return; }
  const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, params.data.reservationId));
  if (!reservation) { res.status(404).json({ error: "Reservation not found." }); return; }
  const result = await db.transaction(async (tx) => {
    // Serialize cancellations with swaps and bookings for this launch.
    const [launch] = await tx.select().from(launchesTable).where(eq(launchesTable.id, reservation.launchId)).for("update");
    const [current] = await tx.select().from(reservationsTable).where(eq(reservationsTable.id, reservation.id)).for("update");
    if (!current) return { status: 404, error: "This reservation has already been cancelled." };
    if (current.userId !== res.locals.user.id && res.locals.user.role !== "admin") return { status: 403, error: "You can only cancel your own reservations." };
    if (query.data.expectedPosition !== undefined && current.position !== query.data.expectedPosition) return { status: 409, error: "This rower's seat has changed. Review the updated boat and select again." };
    await tx.delete(reservationsTable).where(eq(reservationsTable.id, current.id));
    if (res.locals.user.role === "admin") {
      const [boat] = await tx.select().from(boatsTable).where(eq(boatsTable.id, launch.boatId));
      await tx.insert(noticesTable).values({
        recipientId: current.userId, kind: "cancellation", boatName: boat.name,
        date: launch.date, shift: launch.shift, oldPosition: current.position,
        oldSeatLabel: seatLabel(boat.type, current.position, boat.seats),
      });
    }
    return { status: 204 };
  });
  if (result.error) { res.status(result.status).json({ error: result.error }); return; }
  res.sendStatus(204);
});
router.post("/admin/launches/:launchId/swap-seats", async (req, res): Promise<void> => {
  const params = SwapSeatsParams.safeParse(req.params);
  const body = SwapSeatsBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Select two valid occupied seats." }); return; }
  const input = body.data;
  if (input.firstReservationId === input.secondReservationId || input.firstPosition === input.secondPosition) {
    res.status(400).json({ error: "Choose two different rowers to swap." }); return;
  }
  const result = await db.transaction(async (tx) => {
    const [launch] = await tx.select().from(launchesTable).where(eq(launchesTable.id, params.data.launchId)).for("update");
    if (!launch) return { status: 404, error: "Session not found." };
    if (launch.date < today()) return { status: 400, error: "Seats on past outings cannot be swapped." };
    const rows = await tx.select().from(reservationsTable).where(eq(reservationsTable.launchId, launch.id)).for("update");
    const first = rows.find((r) => r.id === input.firstReservationId && r.position === input.firstPosition);
    const second = rows.find((r) => r.id === input.secondReservationId && r.position === input.secondPosition);
    if (!first || !second) return { status: 409, error: "The selected seats have changed. Review the updated boat and select two rowers again." };
    // Position 0 is a transaction-only staging position. The launch lock excludes
    // other writers, and MVCC hides it from readers. Preserve IDs/users/timestamps
    // while satisfying the immediate unique seat constraint at every update.
    await tx.update(reservationsTable).set({ position: 0 }).where(eq(reservationsTable.id, first.id));
    await tx.update(reservationsTable).set({ position: first.position }).where(eq(reservationsTable.id, second.id));
    await tx.update(reservationsTable).set({ position: second.position }).where(eq(reservationsTable.id, first.id));
    const [boat] = await tx.select().from(boatsTable).where(eq(boatsTable.id, launch.boatId));
    await tx.insert(noticesTable).values([first, second].map((rower, index) => {
      const newPosition = index === 0 ? second.position : first.position;
      return {
        recipientId: rower.userId, kind: "seat_swap", boatName: boat.name,
        date: launch.date, shift: launch.shift, oldPosition: rower.position,
        oldSeatLabel: seatLabel(boat.type, rower.position, boat.seats),
        newPosition, newSeatLabel: seatLabel(boat.type, newPosition, boat.seats),
      };
    }));
    return { status: 200 };
  });
  if (result.error) { res.status(result.status).json({ error: result.error }); return; }
  res.json(SwapSeatsResponse.parse(await seatsForLaunch(params.data.launchId, true)));
});
router.get("/admin/roster", async (req, res): Promise<void> => {
  const query = ListRosterQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid date filters." }); return; }
  const launches = await launchList(query.data.from, query.data.to);
  const roster = await Promise.all(launches.map(async (launch) => ({
    launchId: launch.id, date: launch.date, shift: launch.shift, boat: launch.boat, seats: await seatsForLaunch(launch.id, true),
  })));
  res.json(ListRosterResponse.parse(roster));
});
router.get("/admin/summary", async (_req, res) => {
  const launches = await launchList();
  const rowers = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "rower"));
  const boats = await db.select({ id: boatsTable.id }).from(boatsTable);
  res.json(GetAdminSummaryResponse.parse({
    rowerCount: rowers.length, boatCount: boats.length, upcomingLaunchCount: launches.length,
    // Overview date filtering/reset must operate on every upcoming outing,
    // not a preview capped at six records.
    reservationCount: launches.reduce((total, launch) => total + launch.bookedSeats, 0), nextLaunches: launches,
  }));
});
export default router;
