// Runnable health check — `pnpm db:health:realtime`. See realtime-health.ts
// for what this actually checks and why. Exits non-zero on failure, so this
// is safe to wire into a cron or a CI step once one exists, not just to run
// by hand.
import { dbDirect } from "./client.ts";
import { checkRealtimeMessagesPartition } from "./realtime-health.ts";

async function main(): Promise<void> {
  const db = dbDirect();
  const result = await checkRealtimeMessagesPartition(db);

  console.log(`[realtime-health] existing partitions: ${result.existingPartitions.join(", ") || "(none)"}`);
  console.log(`[realtime-health] today's partition present: ${result.todayPartitionExists}`);

  if (!result.healthy) {
    console.error(
      "\n[realtime-health] UNHEALTHY — today's realtime.messages partition is missing. " +
        "Every live-fill broadcast is silently failing right now (realtime.send() warns, " +
        "never throws). This resolves itself the moment any client connects to Realtime — " +
        "see packages/db/realtime-health.ts for the full explanation.",
    );
    process.exit(1);
  }

  console.log("\n[realtime-health] OK");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("[realtime-health] check itself failed:", err);
  process.exit(1);
});
