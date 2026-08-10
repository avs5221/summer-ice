"use client";

// Subscribes to the live fill broadcast for one slot and keeps its skater
// and goalie counts current with no refresh and no user interaction — see
// docs/DOMAIN-MODEL.md §9 ("live fill is a product feature") and
// packages/db/migrations/0004_live_fill_broadcast.sql, which is the
// trigger side of this: it broadcasts on `slot-fill:<slotId>` on the
// 'fill' event, as a PUBLIC channel, whenever a registration or a
// slot_capacities row changes.
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
  const [state, setState] = useState(() => ({ slotId, fill: initialFill }));

  // Reset synchronously during render when the slot (or a fresh
  // server-rendered value for it) changes, rather than in the effect below
  // — the React-endorsed way to adjust state in response to a prop change
  // without the extra render a setState-in-effect would cause. See
  // https://react.dev/learn/you-might-not-need-an-effect
  if (state.slotId !== slotId || state.fill !== initialFill) {
    setState({ slotId, fill: initialFill });
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`slot-fill:${slotId}`, { config: { private: false } })
      .on("broadcast", { event: "fill" }, ({ payload }: { payload: unknown }) => {
        if (!isBroadcastPayload(payload) || payload.slotId !== slotId) return;
        setState((s) => ({ ...s, fill: { skater: payload.skater, goalie: payload.goalie } }));
      })
      .subscribe();

    // Leaked channels are the leading cause of hitting connection limits —
    // this cleanup is not optional. Every mount must pair with exactly one
    // removeChannel on unmount.
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slotId]);

  return state.fill;
}
