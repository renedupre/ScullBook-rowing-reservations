import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq } from "drizzle-orm";
import { db, pool, launchesTable, reservationsTable, noticesTable } from "@workspace/db";

type Request = (path: string, token?: string, method?: string, body?: unknown) => Promise<{ status: number; data: any }>;
type Fixture = {
  boatId: number;
  boatName: string;
  userIds: number[];
  tokens: string[];
  request: Request;
};

// Hold a fixture outing until every HTTP writer is actually waiting for its
// lock. Promise.all alone can pass even if requests execute sequentially.
async function simultaneous<T>(launchId: number, actions: (() => Promise<T>)[]) {
  const gate = await pool.connect();
  let pending: Promise<PromiseSettledResult<T>[]> | undefined;
  let locked = false;
  try {
    await gate.query("BEGIN");
    locked = true;
    await gate.query("SELECT id FROM launches WHERE id = $1 FOR UPDATE", [launchId]);
    const { rows: [{ pid }] } = await gate.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    pending = Promise.allSettled(actions.map((action) => action()));
    const deadline = Date.now() + 8000;
    while (true) {
      // Include waiters behind other waiters, not only direct blockers.
      const { rows: [{ count }] } = await pool.query<{ count: number }>(`
        WITH RECURSIVE blocked(pid) AS (
          SELECT $1::integer
          UNION
          SELECT a.pid FROM pg_stat_activity a
          JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT count(*)::integer AS count FROM blocked WHERE pid <> $1
      `, [pid]);
      if (count >= actions.length) break;
      assert.ok(Date.now() < deadline, `Expected ${actions.length} concurrent requests waiting on fixture outing ${launchId}; saw ${count}`);
      await delay(25);
    }
    await gate.query("COMMIT");
    locked = false;
    const results = await pending;
    return results.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
  } finally {
    // Release blocked requests even if the overlap assertion fails. Wait for
    // them before fixture cleanup so no late writer can escape the test.
    try {
      if (locked) await gate.query("ROLLBACK");
      if (pending) await pending;
    } finally {
      gate.release();
    }
  }
}

// Real PostgreSQL insert failure; no production route or test-only server
// switch. The trigger rejects only this run's disposable recipient. DDL is
// transactional, uniquely named, and removed even when an assertion fails.
async function withNoticeFailure(recipientId: number, action: () => Promise<void>) {
  assert.ok(Number.isSafeInteger(recipientId) && recipientId > 0);
  const name = `notice_test_failure_${randomBytes(8).toString("hex")}`;
  const ddl = async (statements: string[]) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");
      for (const statement of statements) await client.query(statement);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  await ddl([
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.recipient_id = ${recipientId} THEN
          RAISE EXCEPTION 'Controlled fixture notice insert failure';
        END IF;
        RETURN NEW;
      END $$`,
    `CREATE TRIGGER ${name} BEFORE INSERT ON booking_notices
      FOR EACH ROW EXECUTE FUNCTION ${name}()`,
  ]);
  try {
    await action();
  } finally {
    await ddl([
      `DROP TRIGGER IF EXISTS ${name} ON booking_notices`,
      `DROP FUNCTION IF EXISTS ${name}()`,
    ]);
  }
}

export async function checkConcurrentBookingNotices(fixture: Fixture) {
  const { boatId, boatName, userIds, tokens, request } = fixture;
  for (const [index, scenario] of [
    "duplicate cancellations", "duplicate swaps", "cancellation versus swap",
    "cancellation insert failure", "swap insert failure", "different cancellations",
  ].entries()) {
    const date = `2099-10-${String(13 + index).padStart(2, "0")}`;
    const [launch] = await db.insert(launchesTable).values({ boatId, date, shift: "13:00" }).returning();
    try {
      const baseline = await db.insert(reservationsTable).values([1, 2, 3].map((position) => ({
        launchId: launch.id, userId: userIds[position], position,
      }))).returning();
      const [first, second] = baseline;
      const bookings = () => db.select().from(reservationsTable)
        .where(eq(reservationsTable.launchId, launch.id)).orderBy(reservationsTable.id);
      const original = [...baseline].sort((a, b) => a.id - b.id);
      const cancel = () => request(`/reservations/${first.id}?expectedPosition=1`, tokens[0], "DELETE");
      const swap = (reverse = false) => request(`/admin/launches/${launch.id}/swap-seats`, tokens[0], "POST", {
        firstReservationId: reverse ? second.id : first.id,
        firstPosition: reverse ? 2 : 1,
        secondReservationId: reverse ? first.id : second.id,
        secondPosition: reverse ? 1 : 2,
      });
      type Delivery = { recipientId: number; kind: string; oldPosition: number; newPosition: number | null };
      const swapped: Delivery[] = [
        { recipientId: first.userId, kind: "seat_swap", oldPosition: 1, newPosition: 2 },
        { recipientId: second.userId, kind: "seat_swap", oldPosition: 2, newPosition: 1 },
      ];
      const cancelled: Delivery[] = [
        { recipientId: first.userId, kind: "cancellation", oldPosition: 1, newPosition: null },
      ];
      const expectDeliveries = async (expected: Delivery[]) => {
        const notices = await db.select().from(noticesTable)
          .where(and(eq(noticesTable.boatName, boatName), eq(noticesTable.date, date)));
        const order = (a: Delivery, b: Delivery) => a.recipientId - b.recipientId;
        assert.deepEqual(notices.map(({ recipientId, kind, oldPosition, newPosition }) => ({
          recipientId, kind, oldPosition, newPosition,
        })).sort(order), [...expected].sort(order), `${scenario}: exact committed deliveries`);
        // Verify the inbox as well as persistence, including unaffected rowers
        // and the admin. Match by date, not list order or timestamp ties.
        for (const [i, recipientId] of userIds.entries()) {
          const response = await request("/notices", tokens[i]);
          assert.equal(response.status, 200);
          const inbox = response.data.filter((notice: any) => notice.boatName === boatName && notice.date === date);
          const own = notices.filter((notice) => notice.recipientId === recipientId);
          assert.deepEqual(inbox.map((notice: any) => notice.id).sort((a: number, b: number) => a - b),
            own.map((notice) => notice.id).sort((a, b) => a - b));
          for (const notice of inbox) {
            assert.equal("recipientId" in notice, false);
            assert.equal(notice.shift, "13:00");
            assert.equal(notice.readAt, null);
            assert.ok(notice.createdAt);
            assert.match(notice.oldSeatLabel, notice.oldPosition === 1 ? /coxswain/i : /stroke/i);
            if (notice.newPosition === null) assert.equal(notice.newSeatLabel, null);
            else assert.match(notice.newSeatLabel, notice.newPosition === 1 ? /coxswain/i : /stroke/i);
          }
        }
      };
      const expectCancelled = async () => {
        assert.deepEqual(await bookings(), original.filter((row) => row.id !== first.id));
        await expectDeliveries(cancelled);
      };
      const expectSwapped = async () => {
        assert.deepEqual(await bookings(), original.map((row) => ({
          ...row, position: row.id === first.id ? 2 : row.id === second.id ? 1 : row.position,
        })));
        await expectDeliveries(swapped);
      };

      if (index === 0) {
        const results = await simultaneous(launch.id, [cancel, cancel]);
        assert.deepEqual(results.map((r) => r.status).sort(), [204, 404]);
        await expectCancelled();
        assert.equal((await cancel()).status, 404);
        await expectCancelled();
      } else if (index === 1) {
        // Reversed input order must not bypass serialization or deadlock.
        const results = await simultaneous(launch.id, [() => swap(), () => swap(true)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        await expectSwapped();
        assert.equal((await swap()).status, 409);
        await expectSwapped();
      } else if (index === 2) {
        const [cancellation, seatSwap] = await simultaneous(launch.id, [cancel, () => swap()]);
        if (cancellation.status === 204) {
          assert.equal(seatSwap.status, 409);
          await expectCancelled();
          assert.equal((await cancel()).status, 404);
        } else {
          assert.equal(cancellation.status, 409);
          assert.equal(seatSwap.status, 200);
          await expectSwapped();
          assert.equal((await cancel()).status, 409);
        }
        assert.equal((await swap()).status, 409);
        await expectDeliveries(cancellation.status === 204 ? cancelled : swapped);
      } else if (index === 3 || index === 4) {
        const action = index === 3 ? cancel : () => swap();
        // For a swap reject its SECOND recipient: even the earlier attempted
        // notice and all three seat updates must disappear on rollback.
        await withNoticeFailure(index === 3 ? first.userId : second.userId, async () => {
          const results = await simultaneous(launch.id, [action, action]);
          assert.deepEqual(results.map((r) => r.status), [500, 500]);
          for (const result of results) assert.equal(result.data.error, "Something went wrong. Please try again.");
          assert.deepEqual(await bookings(), original, `${scenario}: booking rollback including IDs and timestamps`);
          await expectDeliveries([]);
        });
        // Retry both failed requests after removing the fault: exactly one
        // booking change and one delivery per affected rower may commit.
        const results = await simultaneous(launch.id, [action, action]);
        assert.deepEqual(results.map((r) => r.status).sort(), index === 3 ? [204, 404] : [200, 409]);
        if (index === 3) await expectCancelled();
        else await expectSwapped();
        assert.equal((await action()).status, index === 3 ? 404 : 409);
        if (index === 3) await expectCancelled();
        else await expectSwapped();
      } else {
        const cancelSecond = () => request(`/reservations/${second.id}?expectedPosition=2`, tokens[0], "DELETE");
        const results = await simultaneous(launch.id, [cancel, cancelSecond]);
        assert.deepEqual(results.map((r) => r.status), [204, 204]);
        const expected = [
          ...cancelled,
          { recipientId: second.userId, kind: "cancellation", oldPosition: 2, newPosition: null },
        ];
        assert.deepEqual(await bookings(), original.filter((row) => row.id !== first.id && row.id !== second.id));
        await expectDeliveries(expected);
        assert.equal((await cancel()).status, 404);
        assert.equal((await cancelSecond()).status, 404);
        await expectDeliveries(expected);
      }
      console.info(`Booking notice checks passed: ${scenario}.`);
    } finally {
      await db.delete(reservationsTable).where(eq(reservationsTable.launchId, launch.id));
      await db.delete(launchesTable).where(eq(launchesTable.id, launch.id));
    }
  }
}
