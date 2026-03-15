// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────
import { schema, t, table, SenderError } from "spacetimedb/server";

const timer_counter = table(
  { name: "timer_counter", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity(),
    label: t.string(),
    current_count: t.i32(),
    remaining_time_seconds: t.u32(),
    timer_state: t.string(),
    // UTC epoch milliseconds when the timer was last started (0 = not running).
    // Clients compute remaining = max(0, remaining_time_seconds - round((now_ms - timer_started_at_ms) / 1000)).
    timer_started_at_ms: t.u64().default(0n),
  },
);

// Auth event log — written by the client on every significant auth state
// change. Readable via `spacetime sql timer-counter-6b3bt "SELECT * FROM
// auth_log ORDER BY id DESC LIMIT 100"`.
const auth_log = table(
  { name: "auth_log", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    owner: t.identity(),
    // ISO-8601 timestamp recorded on the client (e.g. "2026-03-09T12:34:56.789Z")
    client_ts: t.string(),
    // Short event name, e.g. "USER_LOADED", "SILENT_RENEW_ERROR", "TOKEN_EXPIRING"
    event: t.string(),
    // Additional detail (error message, token expiry, navigator state, etc.)
    detail: t.string(),
  },
);

const spacetimedb = schema({ timer_counter, auth_log });
export default spacetimedb;

export const create_timer_counter = spacetimedb.reducer(
  { label: t.string() },
  (ctx, { label }) => {
    ctx.db.timer_counter.insert({
      id: 0n,
      owner: ctx.sender,
      label,
      current_count: 0,
      remaining_time_seconds: 0,
      timer_state: "new",
      timer_started_at_ms: 0n,
    });
  },
);

export const update_timer_counter = spacetimedb.reducer(
  {
    id: t.u64(),
    label: t.string(),
    current_count: t.i32(),
    remaining_time_seconds: t.u32(),
    timer_state: t.string(),
    timer_started_at_ms: t.u64(),
  },
  (ctx, { id, label, current_count, remaining_time_seconds, timer_state, timer_started_at_ms }) => {
    const timer = ctx.db.timer_counter.id.find(id);
    if (!timer) throw new SenderError("Timer not found");
    if (!timer.owner.isEqual(ctx.sender))
      throw new SenderError("Not authorized");
    ctx.db.timer_counter.id.update({
      ...timer,
      label,
      current_count,
      remaining_time_seconds,
      timer_state,
      timer_started_at_ms,
    });
  },
);

export const delete_timer_counter = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const timer = ctx.db.timer_counter.id.find(id);
    if (!timer) throw new SenderError("Timer not found");
    if (!timer.owner.isEqual(ctx.sender))
      throw new SenderError("Not authorized");
    ctx.db.timer_counter.id.delete(id);
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTH LOGGING REDUCER
// Called from the client to record auth lifecycle events for debugging.
// Anyone who can authenticate can write their own log entries (owner = sender).
// ─────────────────────────────────────────────────────────────────────────────
export const insert_auth_log = spacetimedb.reducer(
  { client_ts: t.string(), event: t.string(), detail: t.string() },
  (ctx, { client_ts, event, detail }) => {
    ctx.db.auth_log.insert({
      id: 0n,
      owner: ctx.sender,
      client_ts,
      event,
      detail,
    });
  },
);
