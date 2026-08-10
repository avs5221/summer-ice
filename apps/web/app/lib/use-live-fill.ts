"use client";

// Subscribes to the live fill broadcast for one slot and keeps its skater
// and goalie counts current with no refresh and no user interaction — see
// docs/DOMAIN-MODEL.md §9 ("live fill is a product feature") and
// packages/db/migrations/0005_live_fill_broadcast.sql, which is the
// trigger side of this: it broadcasts on `slot-fill:<slotId>` on the
// 'fill' event, as a PUBLIC channel, whenever a registration or a
// slot_capacities row changes.
//
// Callers must pass a referentially-stable `initialFill` (e.g. memoized, or
// sourced from a stable parent prop) — see this hook's own reset logic
// below, which relies on identity to distinguish "a genuinely new
// server-rendered value arrived" from "this component just re-rendered for
// an unrelated reason".
//
// IMPORTANT — this cannot be exercised against local Docker Postgres.
// realtime.send() only exists on a real Supabase project (see the
// migration's own comment); against packages/db/docker-compose.yml this
// hook will subscribe successfully — Supabase Realtime is a separate
// hosted service the browser connects to directly, not something local
// Postgres provides — but will simply never receive a message, because
// nothing local ever calls realtime.send(). It has not been exercised
// end-to-end anywhere in this codebase yet; that needs the real project.
//
// `initialFill` should come from a server-rendered fetch (a loader / Server
// Component reading the same aggregate directly from the database) so the
// page shows correct counts immediately, before the first broadcast — and
// again after a reconnect, callers should re-fetch and remount rather than
// assume continuity, per the same principle the old LISTEN/NOTIFY design
// documented. This hook only ever layers live updates on top of that.
//
// 2026-08-10: exercised end-to-end for the first time. Diagnosis (see
// docs/STATE.md and docs/DECISIONS.md for the full account) compared the
// deployed trigger's broadcast against this hook's subscription directly —
// topic string, event name and the private/public flag all matched exactly,
// and a standalone script using this same supabase-js client received a
// live broadcast after a real UPDATE. The mechanism was never actually
// broken; it had just never been watched. What WAS missing is what this
// hook logs to the console now — with no visibility into subscribe status
// or message arrival, "working but unobserved" and "silently broken" look
// identical from the browser.
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "./supabase-client";

export interface LiveFill {
  skater: { taken: number; capacity: number };
  goalie: { taken: number; capacity: number };
}

interface BroadcastPayload {
  slotId: string;
  skater: LiveFill["skater"];
  goalie: LiveFill["goalie"];
}

function isBroadcastPayload(value: unknown): value is BroadcastPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.slotId === "string" &&
    typeof record.skater === "object" &&
    record.skater !== null &&
    typeof record.goalie === "object" &&
    record.goalie !== null
  );
}

export function useLiveFill(slotId: string, initialFill: LiveFill): LiveFill {
  // `seen` tracks the last (slotId, initialFill) pair we've already reset
  // for — kept separate from `fill` itself. Comparing `fill` directly
  // against `initialFill` (as an earlier version of this hook did) means
  // that after the very first broadcast updates `fill`, `fill` and
  // `initialFill` permanently disagree — on a stable prop reference that
  // re-triggers the reset on every subsequent render, silently discarding
  // the live value; on a caller that passes a fresh object literal each
  // render (as this hook's own contract does not forbid) it's an infinite
  // "Too many re-renders" loop, since every render sees a new identity and
  // resets. Tracking what we've already reset for avoids both.
  const [seen, setSeen] = useState({ slotId, initialFill });
  const [fill, setFill] = useState(initialFill);

  // Reset synchronously during render when the slot (or a fresh
  // server-rendered value for it) changes, rather than in the effect below
  // — the React-endorsed way to adjust state in response to a prop change
  // without the extra render a setState-in-effect would cause. See
  // https://react.dev/learn/you-might-not-need-an-effect
  if (seen.slotId !== slotId || seen.initialFill !== initialFill) {
    setSeen({ slotId, initialFill });
    setFill(initialFill);
  }

  useEffect(() => {
    const topic = `slot-fill:${slotId}`;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(topic, { config: { private: false } })
      .on("broadcast", { event: "fill" }, ({ payload }: { payload: unknown }) => {
        // Deliberately unconditional, not NODE_ENV-gated: this is the one
        // piece of this app that fails *silently* by construction — a
        // topic/event mismatch produces no error anywhere, just a page that
        // never updates (see the 2026-08-10 session that had to diff
        // realtime.messages against this file by hand to find out whether
        // delivery was even reaching the browser). A console line costs
        // nothing for real users, who don't have devtools open, and is the
        // fastest way to answer "is a message arriving at all" from the
        // deployed site without a database console.
        console.debug(`[live-fill] message on ${topic}:`, payload);
        if (!isBroadcastPayload(payload) || payload.slotId !== slotId) {
          console.debug(`[live-fill] ignored — payload failed the shape/slotId check`, payload);
          return;
        }
        setFill({ skater: payload.skater, goalie: payload.goalie });
      })
      .subscribe((status, err) => {
        console.debug(`[live-fill] ${topic} subscription status:`, status, err ?? "");
      });

    // Leaked channels are the leading cause of hitting connection limits —
    // this cleanup is not optional. Every mount must pair with exactly one
    // removeChannel on unmount.
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slotId]);

  return fill;
}
