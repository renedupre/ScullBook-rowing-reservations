import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, boatsTable, launchesTable } from "@workspace/db";
import { CreateBoatBody, CreateBoatResponse, ListBoatsResponse, UpdateBoatBody, UpdateBoatParams, UpdateBoatResponse, DeleteBoatParams } from "@workspace/api-zod";
import { requireUser, requireAdmin } from "../lib/auth";
import { capacities } from "../lib/rowing";
const router = Router();
router.use("/boats", requireUser);
router.get("/boats", async (_req, res) => {
  res.json(ListBoatsResponse.parse(await db.select().from(boatsTable).orderBy(boatsTable.name)));
});
router.post("/boats", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateBoatBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim() || capacities[parsed.data.type] !== parsed.data.seats) {
    res.status(400).json({ error: "Choose a boat name and the correct capacity for its type (1, 2, 4, or 9)." }); return;
  }
  const [boat] = await db.insert(boatsTable).values({ ...parsed.data, name: parsed.data.name.trim() }).returning();
  res.status(201).json(CreateBoatResponse.parse(boat));
});
router.patch("/boats/:boatId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateBoatParams.safeParse(req.params);
  const parsed = UpdateBoatBody.safeParse(req.body);
  if (!params.success || !parsed.success || !parsed.data.name.trim() || capacities[parsed.data.type] !== parsed.data.seats) {
    res.status(400).json({ error: "Enter a valid boat name, type, and matching seat capacity." }); return;
  }
  // Lock the boat to serialize configuration changes with seat reservations.
  const result = await db.transaction(async (tx) => {
    const [old] = await tx.select().from(boatsTable).where(eq(boatsTable.id, params.data.boatId)).for("update");
    if (!old) return { status: 404, error: "Boat not found." };
    if (old.type !== parsed.data.type || old.seats !== parsed.data.seats) {
      const scheduled = await tx.select({ id: launchesTable.id }).from(launchesTable).where(eq(launchesTable.boatId, old.id));
      if (scheduled.length) return { status: 409, error: "Remove scheduled sessions before changing this boat's type." };
    }
    const [boat] = await tx.update(boatsTable).set({ ...parsed.data, name: parsed.data.name.trim() }).where(eq(boatsTable.id, old.id)).returning();
    return { boat };
  });
  if (result.error) { res.status(result.status!).json({ error: result.error }); return; }
  res.json(UpdateBoatResponse.parse(result.boat));
});
router.delete("/boats/:boatId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteBoatParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid boat ID." }); return; }
  const assigned = await db.select({ id: launchesTable.id }).from(launchesTable).where(eq(launchesTable.boatId, params.data.boatId));
  if (assigned.length) { res.status(409).json({ error: "This boat has scheduled sessions. Remove those sessions before deleting it." }); return; }
  const deleted = await db.delete(boatsTable).where(eq(boatsTable.id, params.data.boatId)).returning();
  if (!deleted.length) { res.status(404).json({ error: "Boat not found." }); return; }
  res.sendStatus(204);
});
export default router;
