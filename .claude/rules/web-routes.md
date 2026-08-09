---
paths:
  - "apps/web/app/routes/**"
---

# apps/web/app/routes

Derived from `docs/ARCHITECTURE.md` §4.1.

- **No domain logic in a route file, ever.** Routes (loaders, actions, resource routes)
  are thin callers: parse input, call a function in `packages/core`, render or serialise
  the result. If you're writing a conditional about capacity, money, state transitions or
  locking inside a route file, that logic belongs in `packages/core` instead.

- This is what keeps `apps/web` and the future native client (`apps/mobile`) from
  diverging, and what makes the concurrency rules in `.claude/rules/core.md` testable
  against a real database with no HTTP involved. A route file that reimplements even a
  small piece of that logic quietly creates a second, divergent copy.
