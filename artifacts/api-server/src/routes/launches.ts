import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, boatsTable, launchesTable, reservationsTable } from "@workspace/db";
import { ListLaunchesQueryParams, ListLaunchesResponse, CreateLaunchBody, CreateLaunchResponse, DeleteLaunchParams, GetLaunchSeatsParams, GetLaunchSeatsResponse } from "@workspace/api-zod";
import { requireUser, requireAdmin } from "../lib/auth";
import { launchList, seatsForLaunch, today } from "../lib/rowing";
const router = Router();
router.use("/launches", requireUser);
router.get("/launches", async (req, res): Promise<void> => {
  const query = ListLaunchesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid date filter." }); return; }
  res.json(ListLaunchesResponse.parse(await launchList(query.data.from)));
});
router.post("/launches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateLaunchBody.safeParse(req.body);
  if (!parsed.success || parsed.data.date < today()) { res.status(400).json({ error: "Choose today or a future date, a boat, and an 8am or 1pm shift." }); return; }
  const [boat] = await db.select().from(boatsTable).where(eq(boatsTable.id, parsed.data.boatId));
  if (!boat) { res.status(404).json({ error: "Boat not found." }); return; }
  const shifts = [...new Set(parsed.data.shifts)];
  const launches = await db.insert(launchesTable).values(shifts.map((shift) => ({
    date: parsed.data.date, boatId: boat.id, shift,
  }))).returning();
  res.status(201).json(CreateLaunchResponse.parse(launches.map((launch) => ({
    id: launch.id, date: launch.date, shift: launch.shift, boat, bookedSeats: 0, availableSeats: boat.seats, full: false,
  }))));
});
router.delete("/launches/:launchId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteLaunchParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid session ID." }); return; }
  const result = await db.transaction(async (tx) => {
    const [launch] = await tx.select().from(launchesTable).where(eq(launchesTable.id, params.data.launchId)).for("update");
    if (!launch) return "not-found";
    const occupied = await tx.select({ id: reservationsTable.id }).from(reservationsTable).where(eq(reservationsTable.launchId, launch.id));
    if (occupied.length) return "booked";
    await tx.delete(launchesTable).where(eq(launchesTable.id, launch.id));
    return "deleted";
  });
  if (result === "not-found") { res.status(404).json({ error: "Session not found." }); return; }
  if (result === "booked") { res.status(409).json({ error: "This session has reservations. Ask the registered rowers to cancel before removing it." }); return; }
  res.sendStatus(204);
});
router.get("/launches/:launchId/seats", async (req, res): Promise<void> => {
  const params = GetLaunchSeatsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid session ID." }); return; }
  const seats = await seatsForLaunch(params.data.launchId);
  if (!seats) { res.status(404).json({ error: "Session not found." }); return; }
  res.json(GetLaunchSeatsResponse.parse(seats));
});
export default router;
