import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { timerCounterMachine, timerIntervals } from "./TimerCounter";

describe("timerCounterMachine — state restore from input.timerState", () => {
    // ── Default (no timerState) ──────────────────────────────────────────────

    it("starts in 'new' when no timerState is provided", () => {
        const actor = createActor(timerCounterMachine);
        actor.start();
        expect(actor.getSnapshot().matches("new")).toBe(true);
        actor.stop();
    });

    it("starts in 'new' when timerState is explicitly 'new'", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "new" },
        });
        actor.start();
        expect(actor.getSnapshot().matches("new")).toBe(true);
        actor.stop();
    });

    it("starts in 'new' for an unrecognised timerState value (graceful degradation)", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "bogus" },
        });
        actor.start();
        expect(actor.getSnapshot().matches("new")).toBe(true);
        actor.stop();
    });

    // ── Restore each non-default state from input ────────────────────────────

    it("starts in 'timerSet' when input.timerState is 'timerSet'", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "timerSet", remainingTimeInSeconds: 900 },
        });
        actor.start();
        expect(actor.getSnapshot().matches("timerSet")).toBe(true);
        actor.stop();
    });

    it("starts in 'running' when input.timerState is 'running'", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "running", remainingTimeInSeconds: 891 },
        });
        actor.start();
        expect(actor.getSnapshot().matches("running")).toBe(true);
        actor.stop();
    });

    it("starts in 'paused' when input.timerState is 'paused'", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "paused", remainingTimeInSeconds: 451 },
        });
        actor.start();
        expect(actor.getSnapshot().matches("paused")).toBe(true);
        actor.stop();
    });

    it("starts in 'finished' when input.timerState is 'finished'", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "finished", remainingTimeInSeconds: 0, currentCount: 3 },
        });
        actor.start();
        expect(actor.getSnapshot().matches("finished")).toBe(true);
        actor.stop();
    });

    // ── All context fields are preserved by the restore ──────────────────────

    it("preserves all context fields when restoring to 'paused'", () => {
        const actor = createActor(timerCounterMachine, {
            input: {
                timerState: "paused",
                timerLabel: "Deep Work",
                currentCount: 4,
                remainingTimeInSeconds: 751,
            },
        });
        actor.start();
        const snap = actor.getSnapshot();
        expect(snap.matches("paused")).toBe(true);
        expect(snap.context.timerLabel).toBe("Deep Work");
        expect(snap.context.currentCount).toBe(4);
        expect(snap.context.remainingTimeInSeconds).toBe(751);
        actor.stop();
    });

    it("preserves all context fields when restoring to 'running'", () => {
        const actor = createActor(timerCounterMachine, {
            input: {
                timerState: "running",
                timerLabel: "Focus",
                currentCount: 2,
                remainingTimeInSeconds: 1234,
            },
        });
        actor.start();
        const snap = actor.getSnapshot();
        expect(snap.matches("running")).toBe(true);
        expect(snap.context.timerLabel).toBe("Focus");
        expect(snap.context.currentCount).toBe(2);
        expect(snap.context.remainingTimeInSeconds).toBe(1234);
        actor.stop();
    });

    // ── _initialTimerState is cleared after the first always-transition ──────
    // The `always` guards read _initialTimerState. After the first transition
    // fires it is reset to "new", so transitions back to "new" do NOT
    // re-trigger the restore.
    //
    // Note: events like COUNTDOWN_TIMER_RESET use `syncTimerState` which calls
    // `sendParent`. In a standalone actor (no parent), XState v5 throws and
    // rolls back the whole transition. Those scenarios are covered by the
    // integration tests in timerListMachine.test.ts (where the child has a
    // parent). Here we use TIMER_STATE_SYNCED_FROM_REMOTE (pure assign, no
    // sendParent) to verify the _initialTimerState clearing logic.

    it("_initialTimerState is cleared to 'new' after every always-transition", () => {
        for (const state of ["running", "paused", "timerSet", "finished"] as const) {
            const actor = createActor(timerCounterMachine, {
                input: { timerState: state, remainingTimeInSeconds: 900, currentCount: 1 },
            });
            actor.start();
            // Confirm restore worked
            expect(actor.getSnapshot().matches(state)).toBe(true);
            // _initialTimerState must be cleared so the always guards don't fire again
            expect(actor.getSnapshot().context._initialTimerState).toBe("new");
            actor.stop();
        }
    });

    it("TIMER_STATE_SYNCED_FROM_REMOTE to 'new' from restored 'running' stays in 'new' — no re-trigger", () => {
        // If _initialTimerState weren't cleared, the 'new' state's always would
        // immediately re-transition back to 'running', making this assertion fail.
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "running", remainingTimeInSeconds: 891 },
        });
        actor.start();
        expect(actor.getSnapshot().matches("running")).toBe(true);

        actor.send({
            type: "TIMER_STATE_SYNCED_FROM_REMOTE",
            timerState: "new",
            timerLabel: "Work",
            currentCount: 0,
            remainingTimeInSeconds: 0,
        });

        expect(actor.getSnapshot().matches("new")).toBe(true);
        actor.stop();
    });

    it("TIMER_STATE_SYNCED_FROM_REMOTE to 'new' from restored 'paused' stays in 'new' — no re-trigger", () => {
        const actor = createActor(timerCounterMachine, {
            input: { timerState: "paused", remainingTimeInSeconds: 451 },
        });
        actor.start();
        expect(actor.getSnapshot().matches("paused")).toBe(true);

        actor.send({
            type: "TIMER_STATE_SYNCED_FROM_REMOTE",
            timerState: "new",
            timerLabel: "Break",
            currentCount: 0,
            remainingTimeInSeconds: 0,
        });

        expect(actor.getSnapshot().matches("new")).toBe(true);
        actor.stop();
    });
});
