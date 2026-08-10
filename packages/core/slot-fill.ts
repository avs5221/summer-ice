// Player-facing live fill — docs/DOMAIN-MODEL.md §9 ("Player-facing live
// data"). Aggregate integers per (slot, position); holds and offers count
// as taken, because they are. This is deliberately NOT the count the
// `spot_open` notification transition uses — see §9's own note on why
// display and notification count differently on purpose. Don't reuse this
// for that.
//
// Availability is computed inline here, never read from a stored count —
// docs/ARCHITECTURE.md §4.2 / .claude/rules/core.md. "Taken" is simply
// capacity minus that computed availability: confirmed, plus held rows
// whose hold hasn't expired, plus offered rows whose offer hasn't expired.
//
// This must produce the exact same numbers as the trigger in
// packages/db/migrations/0005_live_fill_broadcast.sql, which computes the
// identical formula for the Realtime broadcast. If the two ever diverge,
// a page's first paint and the number after its first live update will
// visibly disagree — keep them in lockstep if either changes.
import { sql } from "drizzle-orm";
import type { Tx } from "@summerice/db";

export interface SlotFillPosition {
  capacity: number;
  taken: number;
}

export interface NextSessionSummary {
  id: string;
  startAt: Date;
}

export interface SlotFill {
  slotId: string;
  weekday: number; // ISO: 1 = Monday .. 7 = Sunday, per slots.weekday
  weekdayLabel: string;
  startTime: string; // "HH:MM:SS", as Postgres returns a `time` column
  endTime: string;
  label: string;
  sessionType: string;
  skater: SlotFillPosition;
  goalie: SlotFillPosition;
  /** The next scheduled, not-yet-started ice_session for this slot — null
   *  if none exists (nothing seeded that far out, or the slot has no more
   *  sessions left in the season). */
  nextSession: NextSessionSummary | null;
}

const WEEKDAY_LABELS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface SlotFillRow {
  slot_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  label: string;
  session_type: string;
  skater_capacity: number;
  goalie_capacity: number;
  skater_taken: number;
  goalie_taken: number;
  next_session_id: string | null;
  next_session_start_at: string | null;
}

/**
 * For every slot, its live season-registration fill per position and its
 * next upcoming ice_session. Returned in `slots.sort_order`, which is
 * itself schedule order (weekday then start time, per DOMAIN-MODEL §1 and
 * packages/db/seed.ts) — never re-sorted by fill.
 */
export async function getSlotFillOverview(tx: Tx): Promise<SlotFill[]> {
  const rows = (await tx.execute(sql`
    select
      s.id as slot_id,
      s.weekday,
      s.start_time,
      s.end_time,
      s.label,
      s.session_type,
      sc_skater.capacity as skater_capacity,
      sc_goalie.capacity as goalie_capacity,
      coalesce(fill.skater_taken, 0) as skater_taken,
      coalesce(fill.goalie_taken, 0) as goalie_taken,
      next_session.id as next_session_id,
      next_session.start_at as next_session_start_at
    from slots s
    join slot_capacities sc_skater
      on sc_skater.slot_id = s.id and sc_skater.position = 'skater'
    join slot_capacities sc_goalie
      on sc_goalie.slot_id = s.id and sc_goalie.position = 'goalie'
    left join lateral (
      select
        count(*) filter (where r.position = 'skater')::int as skater_taken,
        count(*) filter (where r.position = 'goalie')::int as goalie_taken
      from registrations r
      where r.slot_id = s.id
        and (
          r.status = 'confirmed'
          or (r.status = 'held' and r.hold_expires_at > now())
          or (r.status = 'offered' and r.offer_expires_at > now())
        )
    ) fill on true
    left join lateral (
      select ice.id, ice.start_at
      from ice_sessions ice
      where ice.slot_id = s.id
        and ice.status = 'scheduled'
        and ice.start_at > now()
      order by ice.start_at asc
      limit 1
    ) next_session on true
    order by s.sort_order
  `)) as unknown as SlotFillRow[];

  return rows.map((row) => ({
    slotId: row.slot_id,
    weekday: row.weekday,
    weekdayLabel: WEEKDAY_LABELS[row.weekday] ?? "",
    startTime: row.start_time,
    endTime: row.end_time,
    label: row.label,
    sessionType: row.session_type,
    skater: { capacity: row.skater_capacity, taken: row.skater_taken },
    goalie: { capacity: row.goalie_capacity, taken: row.goalie_taken },
    nextSession: row.next_session_id
      ? { id: row.next_session_id, startAt: new Date(row.next_session_start_at!) }
      : null,
  }));
}
