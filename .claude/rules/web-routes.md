---
paths:
  - "apps/web/app/**/page.tsx"
  - "apps/web/app/**/layout.tsx"
  - "apps/web/app/api/**"
---

# apps/web/app — pages, layouts, route handlers

Derived from `docs/ARCHITECTURE.md` §4.1.

- **No domain logic in a page, layout or route handler, ever.** These files are thin
  callers: parse input, call a function in `packages/core`, render or serialise the
  result. If you're writing a conditional about capacity, money, state transitions or
  locking in a Server Component, a Client Component's event handler, or an `app/api/*`
  route handler, that logic belongs in `packages/core` instead.

- This is what keeps `apps/web` and the future native client (`apps/mobile`) from
  diverging, and what makes the concurrency rules in `.claude/rules/core.md` testable
  against a real database with no HTTP involved. A page or handler that reimplements even
  a small piece of that logic quietly creates a second, divergent copy.
