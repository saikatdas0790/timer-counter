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
  },
);

const spacetimedb = schema({ timer_counter });
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
    });
  },
);

export const update_timer_counter = spacetimedb.reducer(
  {
    id: t.u64(),
    label: t.string(),
    current_count: t.i32(),
    remaining_time_seconds: t.u32(),
  },
  (ctx, { id, label, current_count, remaining_time_seconds }) => {
    const timer = ctx.db.timer_counter.id.find(id);
    if (!timer) throw new SenderError("Timer not found");
    if (!timer.owner.isEqual(ctx.sender))
      throw new SenderError("Not authorized");
    ctx.db.timer_counter.id.update({
      ...timer,
      label,
      current_count,
      remaining_time_seconds,
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
