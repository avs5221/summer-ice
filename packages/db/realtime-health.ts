// Health check for the live-fill Realtime broadcast
// (packages/db/migrations/0005_live_fill_broadcast.sql).
//
// realtime.send() swallows its own exceptions by design — it RAISEs a
// WARNING, not an exception, so a broken broadcast is otherwise invisible
// to the trigger, to Drizzle, and to anything calling it. This is that
// visibility.
//
// What this checks: whether TODAY's partition of realtime.messages exists.
// Per Supabase's own troubleshooting docs (searched, not assumed —
// "Realtime Architecture" and the WarnSendingBroadcastMessage
// troubleshooting guide): partitions are created only when a Realtime
// client connects (a live WebSocket both creates the day's partition and
// starts the consumer), or by a periodic janitor that only maintains
// partitions for projects with a recent connection. A low-traffic project
// — which this is — can genuinely have zero client connections for a
// stretch, at which point every broadcast silently fails with "no
// partition of relation messages found for row" until a client connects
// again. This is not hypothetical: this project's own partitions were
// empty the first time this was checked, before any real client had ever
// subscribed. Connecting one client (see the verification note below)
// created a 5-day rolling window (yesterday through +3 days) immediately.
//
// This check does NOT prove a broadcast will succeed — only that the
// structural precondition (today's partition existing) is met. Supabase's
// own docs note a second, rarer failure class: the insert failing for a
// different reason (a permissions or constraint issue) while partitions
// exist and clients are connected. The full proof — connect a real
// WebSocket client, trigger a change, confirm receipt — was performed
// manually this session and succeeded; it is not automated here because
// doing so needs `@supabase/supabase-js`, which is deliberately the only
// dependency used for exactly one thing in this codebase (the browser-side
// subscription, see docs/ARCHITECTURE.md §5) — adding it to packages/db for
// a health check would blur that boundary for marginal benefit. If a
// deeper, scheduled canary is ever wanted, it belongs in apps/web, as a
// route handler that itself subscribes and asserts receipt.
import { sql } from "drizzle-orm";
import type { Db } from "./client.ts";

export interface RealtimePartitionHealth {
  healthy: boolean;
  todayPartitionExists: boolean;
  existingPartitions: string[];
}

export async function checkRealtimeMessagesPartition(db: Db): Promise<RealtimePartitionHealth> {
  const rows = (await db.execute(sql`
    select child.relname as partition_name
    from pg_inherits
    join pg_class parent on pg_inherits.inhparent = parent.oid
    join pg_class child on pg_inherits.inhrelid = child.oid
    join pg_namespace nsp on parent.relnamespace = nsp.oid
    where parent.relname = 'messages' and nsp.nspname = 'realtime'
    order by child.relname
  `)) as unknown as { partition_name: string }[];

  const existingPartitions = rows.map((r) => r.partition_name);

  const now = new Date();
  const todaySuffix = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("_");
  const todayPartitionExists = existingPartitions.some((p) => p.endsWith(todaySuffix));

  return {
    healthy: todayPartitionExists,
    todayPartitionExists,
    existingPartitions,
  };
}
