import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  it("TIMER_COUNTER_LABEL_CHANGED (fired on blur) persists new label to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    actor.send({ type: "TIMER_COUNTER_STATE_CHANGED" }); // initial save

    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({
      type: "TIMER_COUNTER_LABEL_CHANGED",
      updatedLabel: "Deep Work",
    });

    const stored = JSON.parse(
      localStorage.getItem("timerCounterSavedState") ?? "[]",
    ) as Array<{ timerLabel: string }>;
    expect(stored[0].timerLabel).toBe("Deep Work");
    // child context should also reflect the change
    expect(timerRef.getSnapshot().context.timerLabel).toBe("Deep Work");
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
          timerStartedAtMs: 0n,
        },
        {
          id: 2n,
          label: "Another",
          currentCount: 0,
          remainingTimeSeconds: 900,
          timerStartedAtMs: 0n,
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
        { id: 3n, label: "Synced", currentCount: 1, remainingTimeSeconds: 0, timerStartedAtMs: 0n },
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
        timerStartedAtMs: 0n,
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
      timerStartedAtMs: 0n,
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
          timerStartedAtMs: 0n,
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
  // These verify that play/pause/reset events correctly persist remaining-time
  // to localStorage. With the wall-clock model:
  //   - play  → persists _remainingAtStart (frozen at play time) + timerStartedAtMs
  //   - pause → persists the wall-clock-derived frozen remaining; timerStartedAtMs = 0
  //   - reset → persists remainingTimeInSeconds = 0
  // SECONDS_ELAPSED no longer writes to localStorage — it only recomputes
  // remainingTimeInSeconds in the child actor context via Date.now() delta.

  afterEach(() => vi.useRealTimers());

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

  it("SECONDS_ELAPSED updates remainingTimeInSeconds in machine context (wall-clock based)", async () => {
    vi.useFakeTimers();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({ type: "TIMER_INTERVAL_SET", intervalValue: timerIntervals[0] }); // 900s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // start: timerStartedAtMs = t0

    vi.setSystemTime(t0 + 1_000); // advance 1 second
    timerRef.send({ type: "SECONDS_ELAPSED", seconds: 1 }); // recomputes: 900 - 1 = 899

    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(899);
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
    vi.useFakeTimers();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({ type: "TIMER_INTERVAL_SET", intervalValue: timerIntervals[1] }); // 1800s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // start: timerStartedAtMs = t0

    vi.setSystemTime(t0 + 2_000); // advance 2 seconds
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // pause: freezes at 1800 - 2 = 1798

    expect(getStoredTimers()[0].remainingTimeInSeconds).toBe(1798);
    actor.stop();
  });

  it("SECONDS_ELAPSED computes remaining from wall clock after large time gap", async () => {
    vi.useFakeTimers();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({ type: "TIMER_INTERVAL_SET", intervalValue: timerIntervals[1] }); // 1800s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // start

    vi.setSystemTime(t0 + 30_000); // advance 30 seconds
    timerRef.send({ type: "SECONDS_ELAPSED", seconds: 1 }); // wakeup tick: 1800 - 30 = 1770

    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(1770);
    actor.stop();
  });

  it("SECONDS_ELAPSED clamps to 0 if elapsed time exceeds remaining time", async () => {
    vi.useFakeTimers();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({ type: "TIMER_INTERVAL_SET", intervalValue: timerIntervals[0] }); // 900s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // start

    vi.setSystemTime(t0 + 10_000_000); // advance well past 900s
    timerRef.send({ type: "SECONDS_ELAPSED", seconds: 1 }); // max(0, 900 - 10000) = 0

    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(0);
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
    timerRef.send({ type: "SECONDS_ELAPSED", seconds: 1 }); // 899s
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
          timerStartedAtMs: 0n,
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
        timerStartedAtMs: 0n,
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
        { id: 21n, label: "Test", currentCount: 0, remainingTimeSeconds: 0, timerStartedAtMs: 0n },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: { id: 21n, label: "Test", currentCount: 7, remainingTimeSeconds: 0, timerStartedAtMs: 0n },
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
        { id: 22n, label: "Test", currentCount: 0, remainingTimeSeconds: 0, timerStartedAtMs: 0n },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 22n,
        label: "Test",
        currentCount: 0,
        remainingTimeSeconds: 1800,
        timerStartedAtMs: 0n,
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
        { id: 23n, label: "Old", currentCount: 1, remainingTimeSeconds: 100, timerStartedAtMs: 0n },
      ],
    });

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 23n,
        label: "Updated",
        currentCount: 5,
        remainingTimeSeconds: 900,
        timerStartedAtMs: 0n,
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
        timerStartedAtMs: 0n,
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
        { id: 24n, label: "Test", currentCount: 0, remainingTimeSeconds: 0, timerStartedAtMs: 0n },
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
        timerStartedAtMs: 0n,
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
      timerStartedAtMs: 0,
      timerState: "new",
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

  // ── State mirroring via TIMER_STATE_SYNCED_FROM_REMOTE ────────────────────
  // Verifies that a remote timerState value correctly transitions the child
  // actor into the matching XState state node so controls mirror Device A.

  it("TIMER_STATE_SYNCED_FROM_REMOTE mirrors 'timerSet' state", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    // starts in "new"
    expect(timerRef.getSnapshot().matches("new")).toBe(true);

    timerRef.send({
      type: "TIMER_STATE_SYNCED_FROM_REMOTE",
      timerState: "timerSet",
      timerLabel: "Test",
      currentCount: 0,
      remainingTimeInSeconds: 900,
      timerStartedAtMs: 0,
    });

    expect(timerRef.getSnapshot().matches("timerSet")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(900);
    actor.stop();
  });

  it("TIMER_STATE_SYNCED_FROM_REMOTE mirrors 'paused' state", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];

    timerRef.send({
      type: "TIMER_STATE_SYNCED_FROM_REMOTE",
      timerState: "paused",
      timerLabel: "Focus",
      currentCount: 2,
      remainingTimeInSeconds: 451,
      timerStartedAtMs: 0,
    });

    expect(timerRef.getSnapshot().matches("paused")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(451);
    expect(timerRef.getSnapshot().context.currentCount).toBe(2);
    actor.stop();
  });

  it("TIMER_STATE_SYNCED_FROM_REMOTE mirrors 'running' state", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];

    timerRef.send({
      type: "TIMER_STATE_SYNCED_FROM_REMOTE",
      timerState: "running",
      timerLabel: "Work",
      currentCount: 1,
      remainingTimeInSeconds: 891,
      timerStartedAtMs: 0,
    });

    expect(timerRef.getSnapshot().matches("running")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(891);
    actor.stop();
  });

  it("TIMER_STATE_SYNCED_FROM_REMOTE mirrors 'finished' state without re-incrementing counter", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];

    // STDB ships the already-incremented count (Device A incremented it)
    timerRef.send({
      type: "TIMER_STATE_SYNCED_FROM_REMOTE",
      timerState: "finished",
      timerLabel: "Done",
      currentCount: 3,
      remainingTimeInSeconds: 0,
      timerStartedAtMs: 0,
    });

    expect(timerRef.getSnapshot().matches("finished")).toBe(true);
    // count must equal the STDB value — NOT incremented again
    expect(timerRef.getSnapshot().context.currentCount).toBe(3);
    actor.stop();
  });

  it("TIMER_STATE_SYNCED_FROM_REMOTE mirrors 'new' state (default / unknown)", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    // move to timerSet first
    timerRef.send({
      type: "TIMER_INTERVAL_SET",
      intervalValue: timerIntervals[0],
    });
    expect(timerRef.getSnapshot().matches("timerSet")).toBe(true);

    timerRef.send({
      type: "TIMER_STATE_SYNCED_FROM_REMOTE",
      timerState: "new",
      timerLabel: "Reset",
      currentCount: 0,
      remainingTimeInSeconds: 0,
      timerStartedAtMs: 0,
    });

    expect(timerRef.getSnapshot().matches("new")).toBe(true);
    actor.stop();
  });

  it("STDB_TIMER_UPDATED mirrors the remote timerState into the child actor", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 30n,
          label: "Mirror",
          currentCount: 0,
          remainingTimeSeconds: 900,
          timerState: "timerSet",
          timerStartedAtMs: 0n,
        },
      ],
    });

    // Initial state should be timerSet (via always-transition from input)
    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().matches("timerSet"),
    ).toBe(true);

    // Remote update: Device A started the timer (now running)
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 30n,
        label: "Mirror",
        currentCount: 0,
        remainingTimeSeconds: 891,
        timerState: "running",
        timerStartedAtMs: 0n,
      },
    });

    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().matches("running"),
    ).toBe(true);
    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().context
        .remainingTimeInSeconds,
    ).toBe(891);
    actor.stop();
  });

  it("STDB_TIMER_UPDATED mirrors paused state after running", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 31n,
          label: "PauseTest",
          currentCount: 0,
          remainingTimeSeconds: 900,
          timerState: "running",
          timerStartedAtMs: 0n,
        },
      ],
    });

    // Initial state should be running (via always-transition from input — no wait needed)
    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().matches("running"),
    ).toBe(true);

    // Device A paused
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 31n,
        label: "PauseTest",
        currentCount: 0,
        remainingTimeSeconds: 751,
        timerState: "paused",
        timerStartedAtMs: 0n,
      },
    });

    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().matches("paused"),
    ).toBe(true);
    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().context
        .remainingTimeInSeconds,
    ).toBe(751);
    actor.stop();
  });

  // ── Remote update propagation — echo-loop prevention ─────────────────────
  // Documents the key invariant that SyncBridge's lastUploadedValues map
  // must enforce: STDB-originated events (STDB_TIMER_UPDATED,
  // STDB_SYNC_APPLIED) must NOT write to localStorage. If they did,
  // actorRef.subscribe would fire → uploadAll → grow pendingUpdates → silence
  // the next genuine remote update. These tests verify the machine layer
  // honours this requirement by using syncFromRemote (no localStorage write).

  it("two sequential STDB_TIMER_UPDATED events both reach the child actor", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 40n,
          label: "Original",
          currentCount: 0,
          remainingTimeSeconds: 0,
          timerStartedAtMs: 0n,
        },
      ],
    });

    // First remote update: label changed on Device A
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 40n,
        label: "First Update",
        currentCount: 0,
        remainingTimeSeconds: 0,
        timerStartedAtMs: 0n,
      },
    });
    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().context.timerLabel,
    ).toBe("First Update");

    // Second remote update: count changed on Device A
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 40n,
        label: "First Update",
        currentCount: 3,
        remainingTimeSeconds: 0,
        timerStartedAtMs: 0n,
      },
    });
    const ctx = actor.getSnapshot().context.timers[0].getSnapshot().context;
    expect(ctx.timerLabel).toBe("First Update");
    expect(ctx.currentCount).toBe(3);
    actor.stop();
  });

  it("two sequential STDB_TIMER_UPDATED events do NOT write to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 41n,
          label: "Original",
          currentCount: 0,
          remainingTimeSeconds: 0,
          timerStartedAtMs: 0n,
        },
      ],
    });

    // Capture localStorage right after initial sync
    const storedAfterSync = localStorage.getItem("timerCounterSavedState");

    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 41n,
        label: "Update 1",
        currentCount: 2,
        remainingTimeSeconds: 0,
        timerStartedAtMs: 0n,
      },
    });
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 41n,
        label: "Update 2",
        currentCount: 5,
        remainingTimeSeconds: 0,
        timerStartedAtMs: 0n,
      },
    });

    // Neither remote update must have written to localStorage —
    // writing would retrigger SyncBridge's actorRef.subscribe and produce
    // STDB echoes that could silence subsequent genuine remote updates.
    expect(localStorage.getItem("timerCounterSavedState")).toBe(
      storedAfterSync,
    );
    actor.stop();
  });

  it("STDB_TIMER_UPDATED with timerState transitions child state without writing localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 42n,
          label: "StateTest",
          currentCount: 0,
          remainingTimeSeconds: 900,
          timerState: "timerSet",
          timerStartedAtMs: 0n,
        },
      ],
    });

    const storedAfterSync = localStorage.getItem("timerCounterSavedState");

    // Device A started the timer
    actor.send({
      type: "STDB_TIMER_UPDATED",
      row: {
        id: 42n,
        label: "StateTest",
        currentCount: 0,
        remainingTimeSeconds: 891,
        timerState: "running",
        timerStartedAtMs: 0n,
      },
    });

    // Child must now be in the running state …
    expect(
      actor.getSnapshot().context.timers[0].getSnapshot().matches("running"),
    ).toBe(true);
    // … but localStorage must not change (no echo to STDB)
    expect(localStorage.getItem("timerCounterSavedState")).toBe(
      storedAfterSync,
    );
    actor.stop();
  });

  // ── Cross-device sync (mobile / new-device) ───────────────────────────────
  // The canonical sync regression: Device A has a running timer. Device B
  // (mobile, fresh session) opens the app. STDB_SYNC_APPLIED fires with the
  // STDB rows — the new actors must restore to Device A's state immediately.
  // Previously broken because newly spawned actors dropped post-spawn send().

  it("STDB_SYNC_APPLIED on fresh session restores 'running' state (cross-device sync)", async () => {
    const actor = await startReadyMachine([]); // no localStorage (fresh/new device)
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 50n,
          label: "Work",
          currentCount: 1,
          remainingTimeSeconds: 891,
          timerState: "running",
          timerStartedAtMs: 0n,
        },
      ],
    });
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("running")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(891);
    expect(timerRef.getSnapshot().context.currentCount).toBe(1);
    actor.stop();
  });

  it("STDB_SYNC_APPLIED on fresh session restores 'paused' state", async () => {
    const actor = await startReadyMachine([]);
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 51n,
          label: "Break",
          currentCount: 0,
          remainingTimeSeconds: 451,
          timerState: "paused",
          timerStartedAtMs: 0n,
        },
      ],
    });
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("paused")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(451);
    actor.stop();
  });

  it("STDB_SYNC_APPLIED on fresh session restores 'timerSet' state", async () => {
    const actor = await startReadyMachine([]);
    actor.send({
      type: "STDB_SYNC_APPLIED",
      rows: [
        {
          id: 52n,
          label: "Pomodoro",
          currentCount: 0,
          remainingTimeSeconds: 1800,
          timerState: "timerSet",
          timerStartedAtMs: 0n,
        },
      ],
    });
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("timerSet")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(1800);
    actor.stop();
  });

  it("STDB_TIMER_INSERTED restores 'running' state for a remote insert", async () => {
    const actor = await startReadyMachine([]);
    actor.send({
      type: "STDB_TIMER_INSERTED",
      row: {
        id: 53n,
        label: "Remote Running",
        currentCount: 2,
        remainingTimeSeconds: 735,
        timerState: "running",
        timerStartedAtMs: 0n,
      },
    });
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("running")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(735);
    expect(timerRef.getSnapshot().context.currentCount).toBe(2);
    actor.stop();
  });

  it("STDB_TIMER_INSERTED restores 'paused' state for a remote insert", async () => {
    const actor = await startReadyMachine([]);
    actor.send({
      type: "STDB_TIMER_INSERTED",
      row: {
        id: 54n,
        label: "Remote Paused",
        currentCount: 3,
        remainingTimeSeconds: 420,
        timerState: "paused",
        timerStartedAtMs: 0n,
      },
    });
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("paused")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(420);
    actor.stop();
  });

  // ── Auth redirect state restore ──────────────────────────────────────────
  // After an auth-redirect page reload, timerListMachine loads timers from
  // localStorage and passes timerState via input to the spawned child actor.
  // The child uses `always` transitions in "new" to restore immediately.
  // These tests verify the round-trip: run → save → reload → correct state.

  it("restores timerState: 'running' from localStorage on load", async () => {
    const saved = [
      {
        id: "run-1",
        timerLabel: "Work",
        currentCount: 1,
        remainingTimeInSeconds: 891,
        timerState: "running",
      },
    ];
    const actor = await startReadyMachine(saved);
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("running")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(891);
    actor.stop();
  });

  it("restores timerState: 'paused' from localStorage on load", async () => {
    const saved = [
      {
        id: "pause-1",
        timerLabel: "Break",
        currentCount: 0,
        remainingTimeInSeconds: 451,
        timerState: "paused",
      },
    ];
    const actor = await startReadyMachine(saved);
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("paused")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(451);
    actor.stop();
  });

  it("restores timerState: 'timerSet' from localStorage on load", async () => {
    const saved = [
      {
        id: "set-1",
        timerLabel: "Timer",
        currentCount: 0,
        remainingTimeInSeconds: 1800,
        timerState: "timerSet",
      },
    ];
    const actor = await startReadyMachine(saved);
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("timerSet")).toBe(true);
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(1800);
    actor.stop();
  });

  it("restores timerState: 'finished' from localStorage on load", async () => {
    const saved = [
      {
        id: "fin-1",
        timerLabel: "Done",
        currentCount: 5,
        remainingTimeInSeconds: 0,
        timerState: "finished",
      },
    ];
    const actor = await startReadyMachine(saved);
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().matches("finished")).toBe(true);
    expect(timerRef.getSnapshot().context.currentCount).toBe(5);
    actor.stop();
  });

  it("restores remainingTimeInSeconds from localStorage (not reset to 0)", async () => {
    // Regression: a previous bug hardcoded remainingTimeInSeconds: 0 in
    // loadStateFromLocalDB, discarding the saved value on every page load.
    const saved = [
      {
        id: "rem-1",
        timerLabel: "Focus",
        currentCount: 0,
        remainingTimeInSeconds: 1234,
        timerState: "paused",
      },
    ];
    const actor = await startReadyMachine(saved);
    const timerRef = actor.getSnapshot().context.timers[0];
    expect(timerRef.getSnapshot().context.remainingTimeInSeconds).toBe(1234);
    actor.stop();
  });

  it("TIMER_COUNTER_STATE_CHANGED persists timerState 'running' to localStorage", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({ type: "TIMER_INTERVAL_SET", intervalValue: timerIntervals[0] }); // 900s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // running
    // For running timers, localStorage stores _remainingAtStart (frozen at
    // play time = 900) + timerStartedAtMs. The ticking computed remaining
    // is NOT persisted — the wall-clock formula reconstructs it on the fly.

    const stored = JSON.parse(
      localStorage.getItem("timerCounterSavedState") ?? "[]",
    ) as Array<{ timerState: string; remainingTimeInSeconds: number; timerStartedAtMs: number }>;
    expect(stored[0].timerState).toBe("running");
    expect(stored[0].remainingTimeInSeconds).toBe(900); // _remainingAtStart = 900
    expect(stored[0].timerStartedAtMs).toBeGreaterThan(0);
    actor.stop();
  });

  it("TIMER_COUNTER_STATE_CHANGED persists timerState 'paused' to localStorage", async () => {
    vi.useFakeTimers();
    const t0 = 1_700_000_000_000;
    vi.setSystemTime(t0);

    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerRef = actor.getSnapshot().context.timers[0];
    timerRef.send({ type: "TIMER_INTERVAL_SET", intervalValue: timerIntervals[0] }); // 900s
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // running: timerStartedAtMs = t0

    vi.setSystemTime(t0 + 5_000); // advance 5 seconds
    timerRef.send({ type: "COUNTDOWN_TIMER_PLAY_PAUSED" }); // paused: frozen at 900 - 5 = 895

    const stored = JSON.parse(
      localStorage.getItem("timerCounterSavedState") ?? "[]",
    ) as Array<{ timerState: string; remainingTimeInSeconds: number }>;
    expect(stored[0].timerState).toBe("paused");
    expect(stored[0].remainingTimeInSeconds).toBe(895);
    actor.stop();
  });
});
