---
paths:
  - "packages/core/**"
---

# packages/core

Derived from `docs/ARCHITECTURE.md` §4.1–4.3. These are concurrency and money invariants
that previous attempts at this system broke — not style preferences.

- **Every capacity or money function takes a transaction handle as its first argument.**
  Signature shape: `async function claimSpot(tx: Tx, input: ClaimInput): Promise<ClaimResult>`.
  A function that touches capacity or money without a leading `tx` parameter is wrong,
  full stop — it means the caller can't control atomicity, and atomicity is the entire
  point of this package.

- **Availability is always computed inline, never stored.** There is no `spots_remaining`
  column and there must never be one. Compute it at read time as
  `capacity − confirmed − held (hold_expires_at > now()) − offered (offer_expires_at > now())`.
  An abandoned hold stops consuming capacity the instant it lapses, whether or not a
  sweeper has run — correctness must never depend on a job firing.

- **Capacity mutations lock the capacity row `FOR UPDATE`** before mutating it, inside the
  same transaction as the mutation. No advisory locks, no application-level counting — the
  row lock is the only gate.

- **Multi-line operations lock in ascending `(slot_id, position)` order, without
  exception.** Two callers touching overlapping slot sets in a different order will
  deadlock under load. If you're locking more than one capacity row, sort first.
