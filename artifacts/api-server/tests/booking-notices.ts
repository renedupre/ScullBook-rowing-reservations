import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, boatsTable, launchesTable, reservationsTable, usersTable, sessionsTable, noticesTable } from "@workspace/db";

// Run against the development workflows:
// pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/tests/booking-notices.ts
// Only disposable fixture accounts/boats are changed; no existing club data.
const prefix = `notice-test-${Date.now()}-${randomBytes(4).toString("hex")}`;
const userIds: number[] = [];
let boatId: number | undefined;
let launchId: number | undefined;
const base = "http://localhost:80/api";

async function request(path: string, token?: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { Cookie: `scullbook_session=${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data };
}

try {
  const accounts = await db.insert(usersTable).values(["admin", "rower", "rower", "rower"].map((role, i) => ({
    login: `${prefix}-${i}@example.test`, firstName: "Notice", lastName: `Fixture${i}`, role, passwordHash: "unusable-test-hash",
  }))).returning();
  userIds.push(...accounts.map((u) => u.id));
  const tokens = accounts.map(() => randomBytes(32).toString("hex"));
  await db.insert(sessionsTable).values(accounts.map((u, i) => ({
    userId: u.id, tokenHash: createHash("sha256").update(tokens[i]).digest("hex"), expiresAt: new Date(Date.now() + 900000),
  })));
  const [boat] = await db.insert(boatsTable).values({ name: prefix, type: "Octuple Scull", seats: 9 }).returning();
  boatId = boat.id;
  const [launch] = await db.insert(launchesTable).values({ boatId, date: "2099-10-12", shift: "13:00" }).returning();
  launchId = launch.id;
  const [first, second, third] = await db.insert(reservationsTable).values([1, 2, 3].map((position) => ({
    launchId: launch.id, userId: accounts[position].id, position,
  }))).returning();
  const list = async (index: number) => (await request("/notices", tokens[index])).data;
  const swap = (firstPosition: number, secondPosition: number) => request(`/admin/launches/${launch.id}/swap-seats`, tokens[0], "POST", {
    firstReservationId: first.id, firstPosition, secondReservationId: second.id, secondPosition,
  });

  assert.equal((await request("/notices")).status, 401);
  assert.equal((await request("/notices/1/read", undefined, "PATCH")).status, 401);
  assert.equal((await swap(2, 1)).status, 409);
  assert.deepEqual(await list(1), []);
  assert.equal((await request(`/reservations/${first.id}?expectedPosition=2`, tokens[0], "DELETE")).status, 409);
  assert.deepEqual(await list(1), []);
  assert.equal((await request(`/reservations/${first.id}`, tokens[3], "DELETE")).status, 403);
  assert.deepEqual(await list(1), []);
  assert.equal((await request(`/admin/launches/${launch.id}/swap-seats`, tokens[1], "POST", {
    firstReservationId: first.id, firstPosition: 1, secondReservationId: second.id, secondPosition: 2,
  })).status, 403);

  assert.equal((await swap(1, 2)).status, 200);
  const a = (await list(1))[0];
  const b = (await list(2))[0];
  for (const notice of [a, b]) {
    assert.equal(notice.kind, "seat_swap");
    assert.equal(notice.boatName, prefix);
    assert.equal(notice.date, "2099-10-12");
    assert.equal(notice.shift, "13:00");
    assert.equal(notice.readAt, null);
    assert.ok(notice.createdAt);
    assert.equal("recipientId" in notice, false);
  }
  assert.equal(a.oldPosition, 1);
  assert.equal(a.newPosition, 2);
  assert.match(a.oldSeatLabel, /coxswain/i);
  assert.match(a.newSeatLabel, /stroke/i);
  assert.equal(b.oldPosition, 2);
  assert.equal(b.newPosition, 1);
  assert.deepEqual(await list(3), []);
  assert.deepEqual(await list(0), []);
  assert.equal((await request(`/notices/${a.id}/read`, tokens[2], "PATCH")).status, 404);
  assert.equal((await list(1))[0].readAt, null);
  assert.equal((await request("/notices/invalid/read", tokens[1], "PATCH")).status, 400);
  const read = await request(`/notices/${a.id}/read`, tokens[1], "PATCH");
  assert.equal(read.status, 200);
  assert.ok(read.data.readAt);
  assert.equal((await request(`/notices/${a.id}/read`, tokens[1], "PATCH")).data.readAt, read.data.readAt);
  assert.equal((await list(1))[0].readAt, read.data.readAt);

  // A stale retry of a completed swap sends no duplicate notices.
  assert.equal((await swap(1, 2)).status, 409);
  assert.equal((await list(1)).length, 1);
  assert.equal((await list(2)).length, 1);
  assert.equal((await request(`/reservations/${first.id}?expectedPosition=2`, tokens[0], "DELETE")).status, 204);
  const cancellation = (await list(1))[0];
  assert.equal(cancellation.kind, "cancellation");
  assert.equal(cancellation.oldPosition, 2);
  assert.match(cancellation.oldSeatLabel, /stroke/i);
  assert.equal(cancellation.newPosition, null);
  assert.equal(cancellation.newSeatLabel, null);
  assert.equal(cancellation.boatName, prefix);
  assert.equal(cancellation.date, "2099-10-12");
  assert.equal(cancellation.shift, "13:00");
  assert.equal(cancellation.readAt, null);
  assert.equal((await request(`/reservations/${first.id}`, tokens[0], "DELETE")).status, 404);
  assert.equal((await list(1)).length, 2);

  // A rower's own cancellation sends no admin-change notice.
  assert.equal((await request(`/reservations/${third.id}`, tokens[3], "DELETE")).status, 204);
  assert.deepEqual(await list(3), []);
  assert.equal((await list(2)).length, 1);
  const [unchanged] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, second.id));
  assert.equal(unchanged.userId, accounts[2].id);
  assert.equal(unchanged.position, 1);

  // Notices survive removal of the now-unbooked outing and boat.
  await db.delete(reservationsTable).where(eq(reservationsTable.launchId, launch.id));
  await db.delete(launchesTable).where(eq(launchesTable.id, launch.id));
  await db.delete(boatsTable).where(eq(boatsTable.id, boat.id));
  assert.equal((await list(1)).length, 2);
  assert.equal((await list(1))[0].boatName, prefix);
  assert.equal((await list(1))[1].readAt, read.data.readAt);
  console.info("Booking notice integration checks passed: recipients, failures, seat snapshots, read persistence, and deletion survival.");
} finally {
  if (launchId) {
    await db.delete(reservationsTable).where(eq(reservationsTable.launchId, launchId));
    await db.delete(launchesTable).where(eq(launchesTable.id, launchId));
  }
  if (boatId) await db.delete(boatsTable).where(eq(boatsTable.id, boatId));
  if (userIds.length) {
    await db.delete(noticesTable).where(inArray(noticesTable.recipientId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  await pool.end();
}
