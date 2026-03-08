import { describe, it, expect, beforeEach } from "vitest";
import { createActor, waitFor } from "xstate";
import { timerListMachine } from "./timerListMachine";
import { timerIntervals } from "@/components/molecule/timer/timer-counter/TimerCounter";

async function startReadyMachine(savedTimers: unknown[] = []) {
  localStorage.setItem("timerCounterSavedState", JSON.stringify(savedTimers));
  const actor = createActor(timerListMachine);
  actor.start();
  await waitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
  return actor;
}

describe("timerListMachine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts in loadingStateFromLocalDB", () => {
    const actor = createActor(timerListMachine);
    expect(actor.getSnapshot().matches("loadingStateFromLocalDB")).toBe(true);
    actor.start();
    actor.stop();
  });

  it("transitions to ready after loading empty localStorage", async () => {
    const actor = await startReadyMachine([]);
    expect(actor.getSnapshot().matches("ready")).toBe(true);
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    actor.stop();
  });

  it("restores timers from localStorage on load", async () => {
    const saved = [
      {
        id: "saved-1",
        timerLabel: "Work",
        currentCount: 3,
        remainingTimeInSeconds: 0,
      },
    ];
    const actor = await startReadyMachine(saved);
    expect(actor.getSnapshot().context.timers).toHaveLength(1);
    expect(actor.getSnapshot().context.timers[0].id).toBe("saved-1");
    actor.stop();
  });

  // ── Local CRUD ────────────────────────────────────────────────────────────

  it("adds a timer on NEW_TIMER_COUNTER_CREATED", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    expect(actor.getSnapshot().context.timers).toHaveLength(1);
    actor.stop();
  });

  it("removes a timer on TIMER_COUNTER_DELETE_RECEIVED", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerId = actor.getSnapshot().context.timers[0].id;
    actor.send({ type: "TIMER_COUNTER_DELETE_RECEIVED", timerId });
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    actor.stop();
  });

  it("TIMER_COUNTER_DELETE_RECEIVED preserves stdbIdMap entry so SyncBridge can call deleteTimerCounter", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerId = actor.getSnapshot().context.timers[0].id;
    actor.send({ type: "STDB_ID_LINKED", actorId: timerId, stdbId: 42n });
    expect(actor.getSnapshot().context.stdbIdMap[timerId]).toBe(42n);
    actor.send({ type: "TIMER_COUNTER_DELETE_RECEIVED", timerId });
    // Timer is removed from the list …
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    // … but stdbIdMap entry MUST remain so SyncBridge can still read the
    // stdbId and call deleteTimerCounter on SpacetimeDB.
    expect(actor.getSnapshot().context.stdbIdMap[timerId]).toBe(42n);
    actor.stop();
  });

  it("STDB_TIMER_DELETED clears stdbIdMap entry after STDB confirms the delete", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerId = actor.getSnapshot().context.timers[0].id;
    actor.send({ type: "STDB_ID_LINKED", actorId: timerId, stdbId: 42n });
    // Delete locally (stdbIdMap kept intact, see above)
    actor.send({ type: "TIMER_COUNTER_DELETE_RECEIVED", timerId });
    expect(actor.getSnapshot().context.stdbIdMap[timerId]).toBe(42n);
    // STDB confirms the delete — now the map entry should be cleared
    actor.send({ type: "STDB_TIMER_DELETED", stdbId: 42n });
    expect(actor.getSnapshot().context.stdbIdMap[timerId]).toBeUndefined();
    actor.stop();
  });

  it("TIMER_COUNTER_STATE_CHANGED persists timers to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    actor.send({ type: "TIMER_COUNTER_STATE_CHANGED" });
    const stored = JSON.parse(
      localStorage.getItem("timerCounterSavedState") ?? "[]",
    );
    expect(stored).toHaveLength(1);
    actor.stop();
  });

  // ── STDB_ID_LINKED ────────────────────────────────────────────────────────

  it("links a stdb id to a local actor", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const actorId = actor.getSnapshot().context.timers[0].id;
    actor.send({ type: "STDB_ID_LINKED", actorId, stdbId: 7n });
    expect(actor.getSnapshot().context.stdbIdMap[actorId]).toBe(7n);
    actor.stop();
  });

  // ── STDB_SYNC_APPLIED ─────────────────────────────────────────────────────

  it("replaces all timers with STDB rows on STDB_SYNC_APPLIED", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    expect(actor.getSnapshot().context.timers).toHaveLength(1);

    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 1n,
          label: "Remote Timer",
          currentCount: 5,
          remainingTimeSeconds: 0,
        },
        {
          id: 2n,
          label: "Another",
          currentCount: 0,
          remainingTimeSeconds: 900,
        },
      ],
    });

    const snap = actor.getSnapshot();
    expect(snap.context.timers).toHaveLength(2);
    expect(snap.context.timers[0].id).toBe("stdb-1");
    expect(snap.context.timers[1].id).toBe("stdb-2");
    expect(snap.context.stdbIdMap["stdb-1"]).toBe(1n);
    expect(snap.context.stdbIdMap["stdb-2"]).toBe(2n);
    actor.stop();
  });

  it("STDB_SYNC_APPLIED with empty rows clears all timers", async () => {
    const saved = [
      {
        id: "old-1",
        timerLabel: "Old",
        currentCount: 0,
        remainingTimeInSeconds: 0,
      },
    ];
    const actor = await startReadyMachine(saved);
    expect(actor.getSnapshot().context.timers).toHaveLength(1);

    actor.send({ type: "STDB_SYNC_APPLIED", rows: [] });
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    expect(actor.getSnapshot().context.stdbIdMap).toEqual({});
    actor.stop();
  });

  it("STDB_SYNC_APPLIED persists replacement state to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        { id: 3n, label: "Synced", currentCount: 1, remainingTimeSeconds: 0 },
      ],
    });
    const stored = JSON.parse(
      localStorage.getItem("timerCounterSavedState") ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("stdb-3");
    expect(stored[0].timerLabel).toBe("Synced");
    actor.stop();
  });

  // ── STDB_TIMER_INSERTED ───────────────────────────────────────────────────

  it("adds a remote timer on STDB_TIMER_INSERTED", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_TIMER_INSERTED",
      row: {
        id: 4n,
        label: "Remote",
        currentCount: 2,
        remainingTimeSeconds: 0,
      },
    });
    const snap = actor.getSnapshot();
    expect(snap.context.timers).toHaveLength(1);
    expect(snap.context.timers[0].id).toBe("stdb-4");
    expect(snap.context.stdbIdMap["stdb-4"]).toBe(4n);
    actor.stop();
  });

  it("STDB_TIMER_INSERTED is idempotent for same stdb id", async () => {
    const actor = await startReadyMachine();
    const row = {
      id: 5n,
      label: "Dup",
      currentCount: 0,
      remainingTimeSeconds: 0,
    };
    actor.send({ type: "STDB_TIMER_INSERTED", row });
    actor.send({ type: "STDB_TIMER_INSERTED", row });
    expect(actor.getSnapshot().context.timers).toHaveLength(1);
    actor.stop();
  });

  // ── STDB_TIMER_DELETED ────────────────────────────────────────────────────

  it("removes a remote timer on STDB_TIMER_DELETED", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 6n,
          label: "To Delete",
          currentCount: 0,
          remainingTimeSeconds: 0,
        },
      ],
    });
    expect(actor.getSnapshot().context.timers).toHaveLength(1);

    actor.send({ type: "STDB_TIMER_DELETED", stdbId: 6n });
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    expect(actor.getSnapshot().context.stdbIdMap["stdb-6"]).toBeUndefined();
    actor.stop();
  });

  it("STDB_TIMER_DELETED is a no-op for unknown stdb id", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "STDB_TIMER_DELETED", stdbId: 999n });
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    actor.stop();
  });

  it("STDB_TIMER_DELETED works for locally-created timers linked via STDB_ID_LINKED", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const actorId = actor.getSnapshot().context.timers[0].id;
    actor.send({ type: "STDB_ID_LINKED", actorId, stdbId: 10n });

    actor.send({ type: "STDB_TIMER_DELETED", stdbId: 10n });
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    expect(actor.getSnapshot().context.stdbIdMap[actorId]).toBeUndefined();
    actor.stop();
  });

  // ── Time remaining sync ───────────────────────────────────────────────────
  // Each of these verifies that a time-changing event on a child timer causes
  // the parent to persist updated remainingTimeInSeconds to localStorage,
  // which is also what triggers SyncBridge to call updateTimerCounter on STDB.

  function getStoredTimers() {
    return JSON.parse(
      localStorage.getItem("timerCounterSavedState") ?? "[]",
    ) as Array<{ id: string; remainingTimeInSeconds: number }>;
  }

  it("TIMER_INTERVAL_SET syncs remaining time to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    actor.send({ type: "TIMER_COUNTER_STATE_CHANGED" }); // initial save
    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(0);

    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[0],
    }); // 15 min = 900s

    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(900);
    actor.stop();
  });

  it("ONE_SECOND_ELAPSED syncs remaining time to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[0],
    }); // 900s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // start running
    timerRef.send({ type: "ONE_SECOND_ELAPSED" }); // tick once → 899s

    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(899);
    actor.stop();
  });

  it("COUNTDOWN_TIMER_RESET syncs remaining time (0) to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[0],
    }); // 900s
    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(900);

    timerRef.send({ type: "COUNTDOWN_TIMER_RESET" }); // → 0s

    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(0);
    actor.stop();
  });

  it("COUNTDOWN_TIMER_PLAY_PAUSED (running→paused) syncs remaining time to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[1],
    }); // 30 min = 1800s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // start
    timerRef.send({ type: "ONE_SECOND_ELAPSED" }); // 1799s
    timerRef.send({ type: "ONE_SECOND_ELAPSED" }); // 1798s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // pause — should snapshot 1798s

    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(1798);
    actor.stop();
  });

  it("TIMER_INTERVAL_SET syncs updated time when interval is changed mid-session", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[0],
    }); // 900s
    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(900);

    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[2],
    }); // 1H = 3600s
    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(3600);
    actor.stop();
  });

  it("COUNTDOWN_TIMER_RESET from paused state syncs 0 to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[0],
    }); // 900s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // running
    timerRef.send({ type: "ONE_SECOND_ELAPSED" }); // 899s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // paused at 899s
    timerRef.send({ type: "COUNTDOWN_TIMER_RESET" }); // → 0s

    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(0);
    actor.stop();
  });

  // ── STDB_TIMER_UPDATED ────────────────────────────────────────────────────
  // Verifies that a remote update from SpacetimeDB reaches the child actor
  // and updates its context, WITHOUT echoing the change back to STDB
  // (i.e., without writing to localStorage via syncTimerState).

  it("STDB_TIMER_UPDATED updates the child actor label", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 20n,
          label: "Old Label",
          currentCount: 0,
          remainingTimeSeconds: 0,
        },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 20n,
        label: "New Label",
        currentCount: 0,
        remainingTimeSeconds: 0,
      },
    });

    const ctx = actor.getSnapshot().context.timers[0].getSnapshot().context;
    expect(ctx.timerLabel).toBe("New Label");
    actor.stop();
  });

  it("STDB_TIMER_UPDATED updates the child actor currentCount", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        { id: 21n, label: "Test", currentCount: 0, remainingTimeSeconds: 0 },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: { id: 21n, label: "Test", currentCount: 7, remainingTimeSeconds: 0 },
    });

    const ctx = actor.getSnapshot().context.timers[0].getSnapshot().context;
    expect(ctx.currentCount).toBe(7);
    actor.stop();
  });

  it("STDB_TIMER_UPDATED updates the child actor remainingTimeInSeconds", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        { id: 22n, label: "Test", currentCount: 0, remainingTimeSeconds: 0 },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 22n,
        label: "Test",
        currentCount: 0,
        remainingTimeSeconds: 1800,
      },
    });

    const ctx = actor.getSnapshot().context.timers[0].getSnapshot().context;
    expect(ctx.remainingTimeInSeconds).toBe(1800);
    actor.stop();
  });

  it("STDB_TIMER_UPDATED updates all three fields simultaneously", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        { id: 23n, label: "Old", currentCount: 1, remainingTimeSeconds: 100 },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 23n,
        label: "Updated",
        currentCount: 5,
        remainingTimeSeconds: 900,
      },
    });

    const ctx = actor.getSnapshot().context.timers[0].getSnapshot().context;
    expect(ctx.timerLabel).toBe("Updated");
    expect(ctx.currentCount).toBe(5);
    expect(ctx.remainingTimeInSeconds).toBe(900);
    actor.stop();
  });

  it("STDB_TIMER_UPDATED is a no-op for unknown stdb id", async () => {
    const actor = await startReadyMachine();
    // Should not throw for an id not in stdbIdMap
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 9999n,
        label: "Ghost",
        currentCount: 0,
        remainingTimeSeconds: 0,
      },
    });
    expect(actor.getSnapshot().context.timers).toHaveLength(0);
    actor.stop();
  });

  it("STDB_TIMER_UPDATED does NOT write to localStorage (no echo to STDB)", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        { id: 24n, label: "Test", currentCount: 0, remainingTimeSeconds: 0 },
      ],
    });
    // Capture the localStorage state right after STDB_SYNC_APPLIED
    const storedBefore = localStorage.getItem("timerCounterSavedState");

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 24n,
        label: "Remote Update",
        currentCount: 3,
        remainingTimeSeconds: 500,
      },
    });

    // localStorage must not have been rewritten by the remote update —
    // syncFromRemote intentionally skips syncTimerState to prevent echoing
    // the same values back to STDB.
    expect(localStorage.getItem("timerCounterSavedState")).toBe(storedBefore);
    actor.stop();
  });

  it("TIMER_STATE_SYNCED_FROM_REMOTE sent directly to child does not write localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    actor.send({ type: "TIMER_COUNTER_STATE_CHANGED" }); // initial save
    const storedBefore = localStorage.getItem("timerCounterSavedState");

    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_STATE_SYNCED_FROM_REMOTE",
      timerLabel: "Remote Label",
      currentCount: 9,
      remainingTimeInSeconds: 300,
    });

    // Child context updated …
    const ctx = timerRef.getSnapshot().context;
    expect(ctx.timerLabel).toBe("Remote Label");
    expect(ctx.currentCount).toBe(9);
    expect(ctx.remainingTimeInSeconds).toBe(300);
    // … but localStorage not touched (no syncTimerState call)
    expect(localStorage.getItem("timerCounterSavedState")).toBe(storedBefore);
    actor.stop();
  });
});
