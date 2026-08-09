---
paths:
  - "packages/db/**"
---

# packages/db

Derived from `docs/ARCHITECTURE.md` §5 and §4.8.

- **Never edit an applied migration.** Migrations are generated from schema-as-code,
  committed, and applied on deploy. Once a migration has been applied — anywhere,
  including staging — treat it as immutable. A schema change is always a *new* migration,
  never an edit to an old file.

- **`ledger_entries` is append-only.** Never `UPDATE` or `DELETE` a ledger row, in a
  migration, a seed script, or anywhere else. Corrections are new, offsetting entries.
  Balance is always `SUM(amount_cents)` per person — there is no other source of truth for
  what someone owes or is owed.
