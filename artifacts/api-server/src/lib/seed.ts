import { db, usersTable, boatsTable, launchesTable, reservationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { today } from "./rowing";
import { logger } from "./logger";

// Only initialize a completely new application. Never reset existing accounts or data.
export async function seedInitialData() {
  const [admin] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.login, "admin"));
  if (admin) return;
  const adminHash = await hashPassword("Happy$1234");
  const rowerHash = await hashPassword("Rowing$1234");
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(usersTable).values({
      login: "admin", firstName: "Club", lastName: "Administrator", role: "admin", passwordHash: adminHash,
    }).onConflictDoNothing().returning();
    if (!inserted.length) return;
    const rowers = await tx.insert(usersTable).values([
      { login: "rower@scullbook.example", firstName: "Alex", lastName: "Morgan", role: "rower", passwordHash: rowerHash },
      { login: "jordan@scullbook.example", firstName: "Jordan", lastName: "Reed", role: "rower", passwordHash: rowerHash },
      { login: "sam@scullbook.example", firstName: "Sam", lastName: "Taylor", role: "rower", passwordHash: rowerHash },
    ]).returning();
    const boats = await tx.insert(boatsTable).values([
      { name: "Solstice", type: "Single Scull", seats: 1 },
      { name: "Tandem", type: "Double Scull", seats: 2 },
      { name: "Blue Heron", type: "Quadruple Scull", seats: 4 },
      { name: "North Star", type: "Octuple Scull", seats: 9 },
    ]).returning();
    const dateFor = (offset: number) => {
      const date = new Date(`${today()}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const launches = await tx.insert(launchesTable).values([
      ...boats.map((boat) => ({ boatId: boat.id, date: dateFor(1) })),
      { boatId: boats[2].id, date: dateFor(3) },
      { boatId: boats[3].id, date: dateFor(7) },
    ]).returning();
    await tx.insert(reservationsTable).values([
      { launchId: launches[0].id, userId: rowers[1].id, position: 1 },
      { launchId: launches[2].id, userId: rowers[0].id, position: 1 },
      { launchId: launches[3].id, userId: rowers[1].id, position: 1 },
      { launchId: launches[3].id, userId: rowers[2].id, position: 2 },
    ]);
  });
  logger.info("Initialized ScullBook sample data");
}
