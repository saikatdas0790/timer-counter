import { describe, it, expect, beforeEach } from "vitest";
import { createActor, waitFor } from "xstate";
import { timerListMachine } from "./timerListMachine";

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

  it("TIMER_COUNTER_DELETE_RECEIVED also removes stdbIdMap entry", async () => {
    const actor = await startReadyMachine();
    actor.send({ type: "NEW_TIMER_COUNTER_CREATED" });
    const timerId = actor.getSnapshot().context.timers[0].id;
    // Manually link a stdb id
    actor.send({ type: "STDB_ID_LINKED", actorId: timerId, stdbId: 42n });
    expect(actor.getSnapshot().context.stdbIdMap[timerId]).toBe(42n);
    actor.send({ type: "TIMER_COUNTER_DELETE_RECEIVED", timerId });
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
});
