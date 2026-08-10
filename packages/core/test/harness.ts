// Integration-test harness — real local Postgres, no mocks (ARCHITECTURE
// §12: "the behaviour under test *is* the database's"). Every test body
// runs inside one transaction and rolls it back at the end, so tests never
// need their own cleanup and never see each other's data — standard
// drizzle pattern: tx.rollback() throws TransactionRollbackError, which
// aborts the transaction; we catch exactly that one error type and let any
// other propagate as a real test failure.
//
// One connection per test-file process — `node --test` runs each file in
// its own subprocess by default, so this module-scope singleton is one
// per file, not shared globally. Closed in an `after` hook: postgres-js
// keeps its socket open indefinitely otherwise, and node --test does not
// force-exit, so an un-closed connection here means the test file finishes
// but the process just hangs rather than reporting a result.
import { after } from "node:test";
import { TransactionRollbackError } from "drizzle-orm";
import { dbDirect } from "@summerice/db";
import type { Tx } from "@summerice/db";

export const testDb = dbDirect();

after(async () => {
  await testDb.$client.end();
});

/** Indexed array access, narrowed away from `T | undefined` with a real
 *  check — for pulling a specific line/row out of a result in a test,
 *  where "it's not there" should fail the test loudly, not type-error. */
export function at<T>(arr: readonly T[], index: number): T {
  const item = arr[index];
  if (item === undefined) throw new Error(`at(): no element at index ${index} (length ${arr.length})`);
  return item;
}

export async function withRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await testDb.transaction(async (tx) => {
      await fn(tx);
      tx.rollback();
    });
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err;
  }
}
