# Summer Ice — Domain Model

**Status:** draft for review
**Purpose:** the agreed shape of the platform, written down before any code or stack commitment. Everything here is derived from how the league actually operates today, plus the deliberate changes we've agreed to make.

This document is deliberately stack-agnostic except where concurrency requires naming Postgres primitives.

---

## 1. Ground truth

Facts about the league, as of the 2026 season. All of these are **data, not constants** — slot count, times, levels, capacities and prices change every year depending on what the rink offers.

| Fact | Value |
|---|---|
| Season | ~30 March – 30 August, 22 weeks |
| Weekly slots | 10 |
| Regular skate format | five-on-five, no-contact scrimmage |
| Regular skate capacity | 20 skaters, 2 goalies (two teams of 10 + 1 goalie each) |
| Healthy fill | 16+ skaters, 2 goalies |
| Skills training | split ice — skaters one half, goalies the other |
| Season price — skater | €300 per slot (regular), €450 (skills training) |
| Season price — goalie | €150 per slot (half price, regular), €450 (skills training, full price) |
| Extras price — skater | €15 per skate |
| Extras price — goalie | Free |
| Levels | 2nd, 3rd, 4th, 5th, 6th, Recreational — six individual divisions, not the compound slot labels |
| Registration opens | ~January |
| Public interest list | ~350 people, including many who have never skated in Leiden |
| Demand | exceeds supply; popular slots fill fast |

Note: €300 over 22 weeks is €13.64/skate, so a skater committing to a season gets a modest discount against the €15 extras rate. Goalie pricing is deliberately not cost-recovery — goalies are scarce and essential, and the pricing exists to recruit and retain them.

### The actual 2026 slots

The real schedule, as published. **Use this for seed data** — a plausible-but-invented schedule makes wrong UI look correct during review.

| Day | Time | Level | Type |
|---|---|---|---|
| Tuesday | 21:30–22:30 | 5th/6th Division | scrimmage |
| Wednesday | 20:15–21:15 | Skills Training | skills_training |
| Wednesday | 21:30–22:30 | Recreational | scrimmage |
| Thursday | 20:15–21:15 | 3rd/4th Division | scrimmage |
| Thursday | 21:30–22:30 | 5th/6th Division | scrimmage |
| Friday | 20:15–21:15 | 3rd/4th Division | scrimmage |
| Friday | 21:30–22:30 | 5th/6th Division | scrimmage |
| Saturday | 20:15–21:15 | Skills Training | skills_training |
| Saturday | 21:30–22:30 | Recreational | scrimmage |
| Sunday | 19:00–20:00 | 2nd/3rd Division | scrimmage |

Distribution: 3× 5th/6th, 2× 3rd/4th, 2× Skills Training, 2× Recreational, 1× 2nd/3rd.

Two shapes of hour: the 21:30–22:30 late slot and the 20:15–21:15 earlier one, with Sunday at 19:00 the outlier. Every slot is exactly one hour.

**None of this is stable year to year.** Slot count, days, times, levels and capacities all change with what the rink offers. It is all per-season data — no enums in code for levels, no hardcoded 20/2.

> **Open — Skills Training capacity.** Skills Training is split ice, skaters on one half and goalies on the other, so 20/2 does not apply. The actual skater and goalie capacities have never been established, and at €450 per person these are the most expensive slots sold. Needs Cas.

### Changes from current practice

| Today | New |
|---|---|
| Jotform with quota, website updated manually | One system; the number on the page and the claim transaction read the same rows |
| Extras claimed via WhatsApp "copy the list, add your name, repost" | Atomic claim, database-enforced |
| Naomi manually decrements slot counts from poll replies | Computed from attendance responses |
| Extras invoiced by Tikkie after the skate, tracked in Excel | Paid up front, recorded in the ledger |
| Anyone can add friends/partners to a list | Accounts only; family accounts for dependents |
| Public per-skate WhatsApp channels | Retired. WhatsApp survives only for announcements and DMs to Cas |
| Reserves notified 24h before | Dynamic — notify on the event, not on a fixed schedule |

---

## 2. People and accounts

### `people`

Every human in the system. One row per person whether or not they can log in.

- `id`
- `full_name`
- `email`, `phone` — nullable for dependents
- `is_adult_attested_at` — timestamp of the "I am 16 or over" confirmation, recorded at self-signup. Null for dependents, who are added by a guardian.
- `default_position` — `skater` | `goalie` | `both`
- `level_id` → `levels`, nullable — **self-reported** by the player
- `level_reviewed_at` — set when an admin has looked at and accepted the declared level; null means as-declared
- `guardian_id` → `people`, nullable — set for dependents
- `status` — `active` | `inactive`
- `created_at`

### `credentials`

Login methods, kept in a **separate table** so a dependent can be promoted to a full account by inserting a row — no data migration, no lost history.

- `person_id` → `people`
- `provider` — `password` | `google` | `apple` | `email_link`
- `provider_subject`, `password_hash` — as applicable

> **Why this matters:** any dependent may eventually want their own login, notification preferences and payment method — a spouse who decides to manage their own skates, or a child who has grown up. Either way they must keep their skate and payment history, so promotion is an insert, never a migration.

### Family accounts

Family accounts exist primarily for **convenience** — it is often easier to sign the whole household up in one go, and the league wants to keep encouraging that. Dependents are frequently adults; a spouse is the common case. Covering minors is a consequence of the design, not its purpose.

Rules:

- Dependents must be **admin-verified before they can be added to any session.** This is the anti-abuse gate — it prevents adding "Joe Bob Friend" to evade accounts-only claiming.
- The guardian is financially responsible for all dependent charges. Dependent charges post to the **guardian's** ledger.
- The guardian receives notifications for dependents.
- A dependent may leave at any time by creating their own account, which promotes them via `credentials` and carries their history across. This is their choice, not a system prompt.

> **The system stores no age data beyond the signup attestation.** The "I am 16 or over" confirmation guards against minors creating their own accounts, which is the only place age matters. Nothing else in the model branches on it: dependents are billed to their guardian and notified through their guardian whether they are 9 or 49.
>
> Age is self-reported either way, so a date of birth would buy no verification — only more personal data to hold and protect. And a dependent coming of age needs no system nudge; they can simply create their own account when they want one, or stay in the family account indefinitely.

### `sessions`

Long-lived, revocable credentials. One table serves both clients — a web cookie session and a native refresh token have the same shape and differ only in lifetime.

- `id`, `person_id` → `people`
- `client` — `web` | `native`
- `token_hash` — the hash, never the raw token. Unique; it is the lookup key.
- `expires_at`, `last_used_at`
- `revoked_at` — logout is a soft revoke, so the row survives as an audit trail
- `created_at`

Every lookup filters on `revoked_at is null AND expires_at > now()`.

Deliberately **not** stored: IP address, user agent, device name. Personal data with no identified use, and inconsistent with storing no age data beyond the signup attestation.

Short-lived native access tokens are stateless and never stored. Refresh-token rotation and reuse detection are out of scope for v1; nothing here precludes them.

### `levels`

Organisation-wide, not season-scoped. Ordered so levels can be compared.

- `id`, `name` (ijshockey.nl division naming), `rank` (integer)

### `roles`

- `person_id`, `role` — `admin` | `scheduler` | `coach` | `player`

| Role | Who | Can see | Cannot see |
|---|---|---|---|
| `admin` | Cas, Michael | everything | — |
| `scheduler` | Naomi | sessions, rosters **with names and contact details**, attendance, claims, waitlists, polls, notifications | anything financial — player balances, payments, coach rates and payables |
| `coach` | trainers, shooters | roster for sessions they are assigned to, own attendance, own rate and balance | everything else |
| `player` | everyone | self + dependents | everything else |

### `player_flags`

One passive mechanism covering every "someone should look at this" signal about a person. Nothing here blocks anything — flags are annotations that surface where admins are already working.

- `id`, `person_id`
- `flag_type` — `level_mismatch` | `no_history` | `admin_note`
- `source` — `admin` | `system`
- `created_by` → `people`, null when system-generated
- `reference_type`, `reference_id` — the registration or claim that prompted it, nullable
- `note`
- `status` — `open` | `resolved` | `dismissed`
- `created_at`, `resolved_at`

**Two ways a flag appears:**

- **Admin tags it.** Cas or Naomi recognises a mismatch — a 2nd division player sitting in Recreational — and tags them in one click from the roster or claim list. This is the primary route, because their knowledge of the player base is better than anything the system can infer.
- **System tags it.** Only where data supports it: a declared level inconsistent with the slot's intended levels, or an inconsistency against the player's own registration history from prior seasons.

Flags render inline on rosters, registration lists and claim lists — not in a separate queue anybody has to remember to visit. Resolving one is optional; an unresolved flag is just a note.

---

## 3. Season structure

### `seasons`

- `id`, `name`, `start_date`, `end_date`, `week_count`
- `registration_opens_at`
- `status` — `draft` | `registration_open` | `active` | `closed`

### `slots`

A recurring weekly hour. Ten of these in 2026.

- `id`, `season_id`
- `weekday`, `start_time`, `end_time`
- `label` — e.g. "5th/6th Division", "Skills Training"
- `session_type` — `scrimmage` | `skills_training`
- `is_public` — all slots are public today; retained as a cheap flag for future flexibility, defaults `true`
- `sort_order`

### `slot_levels`

Which levels a slot is **intended for**. Many-to-many, because "5th/6th Division" covers two.

- `slot_id`, `level_id`

This is advisory. It drives the label shown on the schedule and feeds the mismatch flag in §4. It does **not** gate selection — any player may register for any slot.

**Levels are individual divisions, never compound labels.** A slot labelled "5th/6th Division" links to two rows, `5th` and `6th`. This is the whole reason the relationship is many-to-many.

**A slot with zero `slot_levels` rows has no level expectation and never raises a mismatch flag.** Skills Training is the case: it is a beginners' format rather than a division, so `session_type` describes it and no level applies. "Skills" is deliberately not a level — no player self-reports it.

### `slot_capacities` — **the key table**

Capacity, ideal fill and pricing are keyed on **(slot, position)** as rows, never as columns on the slot.

- `slot_id`
- `position` — `skater` | `goalie`
- `capacity` — 20 / 2 for regular skates
- `ideal_capacity` — 16 / 2
- `season_price_cents` — 2026: regular 30000 / 15000, skills training 45000 / 45000
- `extras_price_cents` — 2026: regular 1500 / 0, skills training 1500 / 0

> **Why rows, not columns:** this handles regular skates (20 skaters + 2 goalies) and split-ice skills training (skaters one half, goalies the other) with the same structure, and survives whatever configuration the rink hands over next year. Attempt 2 treated position as a player attribute, which breaks the moment a goalie wants to skate out.
>
> It also absorbs goalie pricing with no schema change. Half-price season, full-price training and free extras are just different values in the goalie row — none of it needs a special case in code.

### `ice_sessions`

The concrete dated instance. Generated from slot × season weeks.

- `id`, `slot_id`, `date`, `start_at`, `end_at`
- `status` — `scheduled` | `cancelled` | `superseded` | `completed`
- `superseded_by_id` → `ice_sessions`, nullable
- `cancellation_reason`, `cancelled_at`

### `ice_session_capacities`

Per-occurrence capacity, defaulted from `slot_capacities` but overridable — the rink sometimes gives a different sheet.

- `ice_session_id`, `position`, `capacity`

> **Reschedules are never an edited date.** A cancelled session keeps `status = cancelled`; a replacement is a **new** `ice_sessions` row, and the old row's `superseded_by_id` points at it. Editing a date in place destroys the history that attendance, claims and money hang off.

### `session_coaches`

Who is coaching a given session, in what capacity, at what rate.

- `ice_session_id`, `person_id`
- `coach_role` — `trainer` | `shooter`
- `rate_cents` — captured at assignment, never recalculated. Zero for unpaid.
- `attendance_status` — `unknown` | `confirmed` | `declined`
- `assigned_at`, `responded_at`

Coach attendance is self-confirmed and drives the fee in §8. Assignment is admin-only; a coach cannot add themselves.

---

## 4. Registration (season commitment)

One table covers the whole lifecycle including waitlisting. Carts are a grouping for payment, not a separate lifecycle.

### `registration_carts`

- `id`, `person_id`, `season_id`
- `status` — `open` | `awaiting_payment` | `paid` | `expired`
- `expires_at`
- `total_cents`

### `registrations`

- `id`, `cart_id` (nullable — admin-created registrations have none)
- `person_id`, `slot_id`, `position`
- `status` — see state machine below
- `price_cents` — captured at hold time, never recalculated
- `hold_expires_at`, `offer_expires_at`
- `waitlist_joined_at` — ordering key for the queue
- `created_at`

Level mismatches are recorded in `player_flags` (§2), not as a column here — one flag mechanism, not two.

### Registration state machine

```
                 ┌─────────────────────────────────────┐
                 │                                     │
(none) ──────> held ──────> confirmed ──────> withdrawn │
   │             │                                      │
   │             └──────> expired ─────────────────────┤
   │                                                    │
   └────────> waitlisted ──> offered ──> confirmed ─────┘
                    ▲            │
                    │            ├──> declined
                    └────────────┴──> offer_expired
                         (next in queue offered)
```

- **held** — capacity reserved, `hold_expires_at` set, awaiting payment
- **confirmed** — payment webhook received. This is a season place.
- **expired** — hold lapsed unpaid. Capacity freed by *computed* expiry (see §7).
- **waitlisted** — slot was full at cart time. Free, instant, ordered by `waitlist_joined_at`. Triggers alternative slot suggestions (below).
- **offered** — capacity opened; this person is first in line and has an exclusive window.
- **withdrawn** — player or admin. Credit issued per refund policy.

### The mixed cart

A cart may contain lines of different statuses and different positions. This is central to the rush experience.

Player selects Tuesday (skater), Friday (skater), Sunday (goalie):

- Tuesday has room → line becomes `held`, priced, payable
- Friday is full → line becomes `waitlisted`, free, queued
- Sunday has room → line becomes `held`, priced, payable

One payment covers the held lines. The waitlisted line costs nothing now and is charged if and when it's promoted. **The cart never hard-fails.**

### Alternative slot suggestions

Whenever a line lands on a waitlist, the player is pointed back at the schedule with live availability drawn out: *"Friday 21:30 is full — you're 3rd in line. Wednesday 21:30 has 4 skater spots."*

This is the counterpart to the live fill display. Scarcity creates urgency on popular hours; visible availability pushes that demand toward quiet ones. It serves Cas's fill-rate goal directly, and the space shown is always real — a slot appears as having room only when it does.

**Nothing is filtered or ranked.** This is an annotation on the full schedule, not a curated list. Every slot stays visible in ordinary schedule order — weekday then start time, exactly as the public page reads — with live per-position availability on each. Slots with room are simply emphasised.

Specifically, and deliberately:

- **No level filtering.** A slot intended for another level is still shown and still selectable. A mismatch produces an admin flag, never a hidden option.
- **No availability-based reordering.** Sorting by remaining capacity would quietly bury hours a player might want, and the ordering would shift under them as other people register.
- **No hiding of full slots.** A full slot shows as full, with the waitlist offered.

**Additive, not a replacement.** Taking another slot does not remove the waitlist entry. A player can be `confirmed` on Wednesday and `waitlisted` for Friday simultaneously, which is the correct default — they keep their place in the queue.

Where it appears:

- At cart time, inline beneath the waitlisted line
- On the player's schedule while any waitlist entry is outstanding
- Optionally as a periodic "still waiting? these have room" digest, governed by the existing notification preferences rather than a new category

### Multi-position UI

Mixed skater/goalie registration is an edge case and must not complicate the normal flow.

- Position is chosen **once** at the top of the flow, defaulted from `people.default_position`
- Each cart line carries a discreet per-line position override, visible but unobtrusive
- Players with `default_position = both` see the override promoted

### Waitlist promotion

When capacity opens on a slot:

1. Find the earliest `waitlisted` registration for that (slot, position)
2. Transition to `offered`, set `offer_expires_at`, notify
3. On accept → charge → `confirmed`
4. On decline or expiry → offer the next in line

Promotion is **never** a silent charge. Someone waitlisted in January may not want the slot in March. Notify, get acceptance, then charge. If the person has a stored payment mandate, acceptance can charge off-session in one tap.

Acceptance creates a **one-line `registration_carts` row** rather than charging the registration directly, so promotion reuses the same payment and webhook path as ordinary registration. One route, not two kept in step.

**Swap on acceptance.** If the player took an alternative slot while waiting, the offer presents two choices: accept and keep both, or accept and release the alternative. Releasing is an ordinary withdrawal — credit per refund policy, no special case. Without this the player has to accept, then separately hunt for the withdrawal, and will occasionally end up paying for two slots they didn't want.

### Level flagging (advisory, non-blocking)

Players **self-report** their level and may register for **any** slot. Nothing is gated, nothing is hidden, and nothing holds up payment.

If a declared level is inconsistent with the slot's intended levels, a `level_mismatch` flag is raised against the person (§2) and shown inline wherever admins see their name. Cas acts on it if and when he wants to, by offering a different slot or refunding. Players receive a "you're confirmed" email once he's happy.

**Revocation is human-only.** The one way a player loses a slot on level grounds is an admin removing them — Cas recognising a 2nd division player sitting in Recreational and acting on it. That removal is an ordinary `withdrawn` transition with a credit or refund per policy. There is no automatic rejection, no automatic downgrade, and no automatic reassignment.

Year one the flag is a manual note; Cas's own knowledge of the player base is the real filter, as it is today. From year two the system holds each player's history and can flag automatically by comparing the declared level against last season's registrations.

> Trade-off worth naming: because level is self-reported and selection is unrestricted, someone under-declaring to get into an easier hour will succeed until a human notices. That is the accepted cost of not gating registration, and it matches how the league already runs — the current site only warns that a submission "may be rejected," and in practice it never has been.

---

## 5. Attendance

Generated for each confirmed registration × each future `ice_session`.

### `attendances`

- `id`, `registration_id`, `ice_session_id`, `position`
- `status` — `unknown` | `attending` | `not_attending`
- `release_at` — the moment `unknown` resolves to out; defaulted from the season, overridable per session
- `released_at` — set when an unanswered row was resolved out, so late reinstatement and admin review can tell it apart from an explicit decline
- `responded_at`, `source` — `player` | `admin` | `guardian`

Three-state, must-confirm. A `not_attending` response frees capacity immediately, which becomes an extras spot and fires a notification. An `unknown` row frees capacity at `release_at` — see below.

### Unknown is out — **settled, D1**

`unknown` resolves to **not attending** at a release deadline. No response means the spot is released and becomes claimable by extras.

This inverts what attempt 2 specified and what an earlier draft of this document proposed. It works because the player is warned repeatedly and unambiguously beforehand, so a non-response is a genuine choice rather than an oversight. The reminder ladder is therefore not a nicety — it is the thing that makes the rule fair, and it must ship with the release behaviour, never after it.

#### The release deadline

`unknown` counts as **attending** until `release_at`, then counts as **out**.

Without a deadline, capacity would be wrong for weeks — you cannot free a spot three weeks early merely because nobody has answered yet. Default `release_at` is 48 hours before the session, configurable per season.

Availability for extras is therefore:

```
capacity
  − attending
  − unknown  WHERE now() < release_at
  − active claims and holds
```

The same computed-not-swept principle as §7: a spot becomes claimable the instant the deadline passes, whether or not a job has run.

#### The reminder ladder

Escalating, and personalised to the player's channel preferences and slot filters:

| When | Message |
|---|---|
| T−7 days | "Are you playing?" — first ask |
| T−3 days | Reminder, states the release deadline explicitly |
| T−48h | Final notice: *"No response by \[time\] releases your spot."* |

Two requirements that follow from making non-response consequential:

- **Digest, don't spam.** A player with four registrations gets **one** message covering all their upcoming skates, not four. Attempt 2's per-session mails would be unbearable at this cadence.
- **Confirmation reminders cannot be switched off.** Players choose the *channel*, but at least one must stay active. Allowing someone to silence the only warning that their spot is about to be released would be a trap.

#### Late reinstatement

If a player responds `attending` after `release_at` and the spot has **not** been claimed, they get it back. It costs nothing to allow and removes most of the sting. If it has been claimed, they are out — the claim wins, and the extra has paid.

#### Money

Consistent with existing policy: full-season players are not refunded for a missed skate, released or otherwise. They paid for a season, not for 22 individually-guaranteed appearances. An extra then pays for the freed spot, which is exactly the revenue-positive dynamic that makes generous early withdrawal worth encouraging.

### No check-in

The league runs on an honour system; nobody records who actually showed up. There is **no** attendance reconciliation, no "mark present" flow, and no no-show enforcement — payment up front makes that self-enforcing. What the system records is *declared intent*.

---

## 6. Extras (week-to-week)

### `extras_interest`

The public "keep me informed" list. Open to anyone, including people who have never skated in Leiden.

- `person_id`, `season_id`
- `positions` — which positions they'd claim
- `slot_ids` — which hours they want to hear about (nullable = all)

### `claims`

- `id`, `person_id`, `ice_session_id`, `position`
- `status` — `held` | `confirmed` | `withdrawn_in_time` | `withdrawn_late` | `completed`
- `price_cents`, `hold_expires_at`
- `created_at`

### Claim state machine

```
(none) ──> held ──> confirmed ──> completed
             │          │
             │          ├──> withdrawn_in_time   (credit issued)
             └──> expired
                        └──> withdrawn_late      (no credit unless spot refilled,
                                                  then credit issued)
```

The late-withdrawal cutoff is currently 2 hours before the session. Configurable per season.

`withdrawn_late` demonstrates why the ledger must be append-only: the charge stands, and *if* the spot is subsequently refilled, an offsetting credit is issued. A `paid` boolean cannot express a contingent charge.

### No gate on claiming — **settled, D2**

Anyone can hold an account, so an unknown person can claim a spot on any hour. There is **no** acknowledgement step, no queue and no approval — requiring Naomi to sign off on every newcomer's first claim would add standing administrative work for a rare problem.

Instead it's passive, using the same `player_flags` mechanism as everything else (§2):

- A claim by someone with no prior registration or completed claim raises a `no_history` flag, shown inline next to their name on the roster. Informational only.
- Naomi or Cas can tag anyone they recognise as playing outside their level, in one click from the roster.
- The system tags a mismatch on its own only where data supports it.

Resolution, when it's needed at all, is the same human act as everywhere else: an admin removes the claim, which credits or refunds per policy.

### Zero-price claims

A goalie extras claim is free, which means **no payment step at all**. No Mollie transaction, no hold-for-payment, no checkout, no `held` state. The claim transitions straight to `confirmed` inside the capacity transaction and the notification fires immediately.

No ledger entry is written either — the ledger records money, and there is none. The claim record itself is the history.

This is a genuine simplification: for the position where speed matters most, claiming is one tap with nothing in the way.

### Goalie claim spam protection — **settled, D10**

Goalie extras are free, nobody vets who holds an account, and there are only two goalie places per session — so the pay-up-front deterrent that covers skaters does not apply, and `withdrawn_late` is moot since no charge exists to stand.

Accepted position: the goalie pool is small and mostly known, so real problems get handled by a human as they arise. What ships in v1 is spam protection only:

- **Cap concurrent open goalie claims** at two per person. Someone holding claims on five sessions they haven't skated yet is the pattern worth blocking, and a cap is unambiguous.
- **Rate-limit claim attempts** per person, so nobody can script the endpoint.
- **Count late withdrawals** and raise a `player_flags` entry past a threshold, so repeat behaviour becomes visible without anybody policing it.

Nothing here needs no-show tracking, which stays out of scope.

### Preserved from the extras chat rules

The existing social rules were well designed and should be carried over as mechanics:

| Rule today | Implementation |
|---|---|
| First hour, own name only (+1 partner/child) | Claim window: for the first hour after a spot opens, one claim for self plus one for a verified dependent |
| After an hour, anyone with permission | Open claiming |
| Late drop / no-show still liable | `withdrawn_late`, charge stands unless refilled |
| "Any case not covered decided by Naomi or myself" | Every automated charge, release and claim is manually reversible with an attached note |

### No per-session waitlist

An earlier draft had a `session_waitlist` table — "this Friday is full, tell me if someone drops." It's redundant. That intent is already expressed by having the slot in your `notification_preferences` filter, and under transition-based notification everyone interested hears at the same moment anyway.

So claiming an extras spot is an open race, as it is today when the list is posted to the chat. The atomic claim transaction in §7 makes the race correct; nobody needs a queue.

The **season** waitlist (`registrations.status = waitlisted`) is different and stays. That's an ordered queue with real money attached, where arrival order genuinely earns priority.

---

## 7. Concurrency

The single most important section. The January rush is the highest-money, highest-scarcity, most-visible path in the system.

### The lock

Every capacity mutation happens inside one transaction, and serialises on the capacity row:

```sql
SELECT * FROM ice_session_capacities
 WHERE ice_session_id = $1 AND position = $2
   FOR UPDATE;
```

For season registration, the lock row is `slot_capacities (slot_id, position)`.

No advisory locks. No application-level counting. The row lock funnels every contender through the same gate.

### Deterministic lock ordering

Multi-line carts **must** acquire locks in ascending `(slot_id, position)` order. Two players selecting overlapping slot sets in different orders will otherwise deadlock under load. This is one line of code and miserable to diagnose in January if it's absent.

### Computed expiry, not swept expiry

Availability is always:

```
capacity
  − confirmed
  − held      WHERE hold_expires_at > now()
  − offered   WHERE offer_expires_at > now()
```

An abandoned hold stops consuming capacity **the instant it lapses**, whether or not a cleanup job has run. The sweeper is housekeeping; correctness never depends on it firing. Attempt 2's `cleanup-holds` cron was fragile precisely because it was load-bearing.

### Duplicate prevention in the database

```sql
CREATE UNIQUE INDEX ON registrations (person_id, slot_id, position)
  WHERE status IN ('held', 'offered', 'confirmed');
```

Application logic will eventually have a hole. An index won't.

### Hold window

10 minutes. An iDEAL round trip means leaving the browser for a bank app, possibly 2FA, possibly a fumbled login. Five minutes is not enough.

### Payment authority

The **Mollie webhook** confirms a registration or claim. Not the return URL — that's UX only, and users close tabs. Webhook handling is idempotent on Mollie payment ID, because Mollie retries.

### Load test before launch

Non-negotiable acceptance criterion: a script firing several hundred concurrent multi-line carts with overlapping slot sets at a 20-capacity slot, asserting exactly 20 winners, no oversell, no partial baskets, no deadlocks.

---

## 8. Money

### `ledger_entries` — append-only

Never updated. Never deleted. Corrections are new offsetting entries.

- `id`, `person_id`
- `entry_type` — `charge` | `credit` | `payment` | `refund` | `fee` | `payout` | `adjustment`
- `amount_cents` — signed
- `description`
- `reference_type`, `reference_id` — registration, claim, cancellation, coach assignment
- `reversal_of_id` → `ledger_entries`, nullable
- `note`, `created_by`, `occurred_at`

Balance is `SUM(amount_cents)` per person. Everything Cas needs — accounting export, who owes what, refunds after a cancellation, payment plans, dispensation — falls out of this. A payment plan is one charge and three credits, with no special-casing.

Dependent charges post to the **guardian's** ledger.

**Sign convention, and why payables need no second table.** Positive means the person owes the league; negative means the league owes the person. A player's `charge` is positive, their `payment` negative. A coach's `fee` is negative, the `payout` settling it positive. So a balance reads the same way for everyone: positive is owed to the league, negative is owed by it.

That means receivables and payables live in one append-only stream with one balance query, and the accounting export is a single chronological ledger with both sides in it — which is what Cas asked for.

### `payments`

- `mollie_payment_id` (unique), `person_id`, `amount_cents`
- `status`, `method`, `mandate_id`
- `cart_id` → `registration_carts`, nullable
- `claim_id` → `claims`, nullable
- `created_at`, `paid_at`, `webhook_received_at`

**What a payment can be for.** Exactly three cases, with a CHECK enforcing that *at most one* of `cart_id` and `claim_id` is set:

| `cart_id` | `claim_id` | Meaning |
|---|---|---|
| set | null | A registration cart, or an accepted waitlist offer |
| null | set | An extras claim |
| null | null | Settling an outstanding balance — a payment-plan instalment or dispensation catch-up |
| set | set | Impossible |

These are real foreign keys, not a polymorphic pair. Payments are where money enters the system, and the webhook must be able to determine what it is confirming **from the database alone** — never by parsing Mollie metadata. Metadata should still be set as a cross-check, but an external system must never be load-bearing for reconciliation.

`ledger_entries` is polymorphic because it legitimately references many kinds of thing. `payments` is not, because it references two.

**Waitlist promotion creates a one-line cart** rather than charging a bare registration. That keeps one payment path, one webhook handler and one place where totals are computed, instead of a second parallel route that has to be kept in step.

### `mandates`

- `person_id`, `mollie_mandate_id`, `status`, `method`

A first iDEAL payment can establish a SEPA Direct Debit mandate, after which later charges — waitlist promotions, extras claims — happen off-session with no redirect. **Phase two.** The model is pay-up-front with a checkout; the mandate is an optimisation on top.

Caveats when we get there: SEPA DD requires Mollie approval (~3 business days), is reversible by the payer for 5 working days (unlike iDEAL, which is final), and has a €1,000 default limit.

### Refund policy — agreed

**Credit by default, immediate cash-back as a fallback on request or at season end.** Transaction fees (~€0.25) are noise against a €15–450 charge. Because it's a ledger, this is a policy switch rather than a rebuild.

### Cancelled sessions

If the rink offers no replacement → refund/credit per above.
If the rink offers times → a poll (see §10), and the replacement session inherits the registrations.

### Coach payables — **settled, D4: in scope**

Coaches are `paid` or `free` — shooters are typically free, trainers paid. Both flow through the same mechanism; a free coach simply has a rate of zero and generates no ledger entries.

**Rate is captured on the assignment, not on the person.** A coach may be paid for running a skills session and unpaid for shooting at the next one, and rates change between seasons. `session_coaches.rate_cents` (§3) is set when they're assigned and never recalculated, exactly as `price_cents` works for registrations.

**A fee posts when the session completes**, for every assigned coach with a non-zero rate who confirmed their attendance. Coaches confirm their own attendance — that's the one place attendance is recorded rather than presumed, since money depends on it, and unlike players there is no honour-system problem because a coach not turning up is immediately obvious.

**Settlement is manual and recorded, not automated.** Cas pays coaches however he pays them today — bank transfer, cash, whatever — and enters a `payout` against them, which nets their balance to zero. The system tracks what is owed and what has been settled; it does not move money outward. Mollie payouts to third parties are a materially different integration and buy nothing here.

**Two things this puts on Cas rather than the platform.** Whether a coach invoices him, and how coach payments are treated for tax, are his and his accountant's business. What the platform owes him is an export where the payable side is clearly separable from the receivable side, which the `entry_type` distinction gives for free.

**Naomi does not see payables**, per D5 — her financial exclusion covers both sides of the ledger, not just player balances.

---

## 9. Fill health and live data

### Two-dimensional and asymmetric

Fill is computed **per position against different thresholds**. A single percentage is useless — it's why the old "X/20" dashboard didn't serve Cas.

- Skaters: 16/20 is healthy
- Goalies: 1/2 is a crisis

A goalie deficit is weighted far more heavily than a proportional shortfall implies. "A skate is much rougher with 1 goalie than 12 players."

### Player-facing live data

Live fill is a **product feature**, not an engineering nicety. Scarcity drives excitement and attendance.

- Players see **numbers, not names**: "18/20 skaters · 1/2 goalies"
- Holds count as taken, because they are. When a slot is full only because of holds, say so and offer the waitlist in the same breath.
- Aggregate integers per (session, position) — far simpler than per-user state sync

**Display and notification deliberately count differently.** The number on the page includes pending holds, or a player races for a spot already sitting in someone else's checkout. The `spot_open` transition in §11 excludes them, so an abandoned hold doesn't re-announce a spot that never moved. Same rows, two derived values, two different jobs — worth knowing before someone "fixes" the inconsistency.

Shown to a goalie, "1/2 goalies" tells the one person who can solve the problem that they're needed.

### Admin fill view

Admins need one dimension players don't: how much of the current headcount is **actually confirmed** versus still unanswered and heading for release.

Per (session, position), Cas and Naomi see attending, unknown-still-counting, released, and claimed. Before `release_at`, a session reading 18/20 might be 11 confirmed and 7 unanswered — a very different picture, and the one that tells him whether to expect a wave of extras spots to fill in the next 48 hours.

### Roster visibility

Players can see who else is on a session, in a reduced form — first name plus surname initial. Naomi sees full names. This needs reconciling against her PII boundary (**decision D5**).

---

## 10. Cancellations, reschedules and polls

Polls are **v1**, not a horizon item, because "if the rink offers times, it results in a poll" makes them part of the core cancellation flow.

### `polls`

- `id`, `ice_session_id` (the cancelled session), `question`
- `status` — `open` | `closed`
- `closes_at`

### `poll_options`

- `poll_id`, `proposed_start_at`, `proposed_end_at`

### `poll_votes`

- `poll_id`, `poll_option_id`, `person_id`, `response` — `yes` | `no` | `maybe`

### Flow

1. Rink withdraws the ice → session `status = cancelled`
2. If replacement times offered → poll created against those options, affected registrants notified
3. Poll closes → Cas picks the winning option
4. New `ice_sessions` row created; old row's `superseded_by_id` points at it
5. Attendance rows generated for the new session; claims on the cancelled session credited
6. If no replacement → credit or refund per policy

---

## 11. Notifications

### Principles

- **Event-driven, not schedule-driven.** Notify when a session gains space, not 24 hours before the skate.
- **Severity by position.** An unfilled goalie place escalates past slot filters; a skater place does not.
- **Withdrawal windows are generous; the confirmation window is not.** Players can pull out weeks ahead, but an unanswered session releases at 48h — so the reminder ladder starts a week out rather than a day out, unlike the current 24h reserve list.
- **Player-controlled.** Channel, frequency, and which slots they care about — with the confirmation reminder as the one exception, since a spot depends on it.
- **Digest by player, not by session.** Someone registered for four slots gets one message about all of them.
- Visibility reduces load — players who can see fill rates need fewer pushes.

### `notification_preferences`

- `person_id`, `channel` — `email` | `push`
- `category` — `spot_open` | `confirmation_request` | `session_change` | `poll` | `announcement` | `payment`
- `enabled`
- `slot_ids` — filter (nullable = all)

**`confirmation_request` cannot be fully disabled.** Because non-response releases a spot (§5), players choose the channel but at least one must remain active. Every other category is freely optional.

### `spot_open` fires on a transition, not per spot

The unit of notification is a **change in a session's availability state**, not a released spot.

A session is either *full* or *has space*. When it crosses from full to has-space, everyone with that slot in their filter and that position gets **one** notification. Nothing further fires while it still has space — those people have already been told.

| Event | Notification |
|---|---|
| Full session, three players decline at once | One |
| Full session, one player declines | One |
| Has-space session, another player declines | None — already announced |
| Space claimed back to full, then someone declines | One (new transition) |

This is self-limiting by construction. The number of notifications per session equals the number of times it refills and reopens, which in practice is once or twice — not the number of spots that move.

**Holds do not count toward full.** The transition is judged on **committed** occupancy only — attending players plus confirmed claims. Pending claim holds are ignored.

This is what stops the same spot re-announcing. A player declines, the notification goes out, the session is has-space. Someone takes a 10-minute hold and abandons it: the notification state never changed, so nothing re-fires. When they actually pay, it becomes full, and a later genuine decline is a real transition that does fire.

Judging it on holds instead would produce a notification every time somebody opened a checkout and wandered off. A time-based cooldown would suppress those too, but would equally suppress a genuinely new spot opening later the same evening — which works against filling the ice, so it isn't the right tool.

Residual case, accepted: a player who declines, re-confirms, then declines again within the hour produces two notifications. Both are accurate. If it ever grates, `notification_log` supports a per-recipient dedupe — don't tell the same person about the same session twice within an hour — which never suppresses a genuine spot for someone who hasn't heard yet.

Goalie spots can't flap at all, since free claims have no hold state and go straight to confirmed.

**Goalie escalation.** One exception to the slot filter: a goalie spot still open at 48 hours widens to every goalie on the interest list regardless of their slot preferences. Two goalie places per session, and a session with one goalie is much rougher than one twelve skaters short — this is the one ping worth forcing.

**Long-tail nudge.** A transition model says nothing when a session sits at 19/20 for a week, because it never went back to full. So a weekly opt-out digest — "skates with space this week" — covers the slow leak without adding event pings. Fill is Cas's goal; this is the cheap way to serve it.

### Volume and cost

Rough season-month estimate, ~200 season players and ~350 on the interest list:

| Stream | Per month |
|---|---|
| Confirmation digests (weekly + 48h nudge) | ~1,700 |
| `spot_open` transitions, slot-filtered | ~2,600 |
| Weekly "space this week" digest | ~600 |
| Transactional — receipts, confirmations, polls, announcements | ~500 |
| **Total** | **~5,400** |

Inside Postmark's 10,000/month at $15, and it falls further as players move to push.

Two things this depends on:

- **Push is load-bearing, not cosmetic.** Push costs nothing and absorbs most `spot_open` traffic, so every player on the app directly lowers the email bill. That's a stronger argument for the native app than convenience.
- **Any provider with a daily cap is unusable.** January registration will push a couple of thousand messages through in a few days, so a 300/day free tier would break on day one.

### `notification_log`

- `person_id`, `category`, `channel`, `reference_type`, `reference_id`, `sent_at`

Needed for deduplication and rate limiting. Nobody should get six emails because six skaters declined in a row.

### `push_tokens`

- `person_id`, `platform`, `token`, `last_seen_at`

### Channels

Email and native push. **WhatsApp is retired** as a platform channel — it survives only as Cas's own announcement broadcast and DMs, outside the system.

Unsubscribe must be honoured for every category. Note that the legal basis differs between populations: season players are on contract performance, whereas the public interest list is consent-based, so their preferences are not optional.

---

## 12. Surfaces

| Surface | Who | Notes |
|---|---|---|
| Player web | players, guardians | registration, schedule, claims, profile, preferences, payment history |
| Player app | players, guardians | same, plus native push. Firm requirement. Ships Feb–Mar, aimed at the season, not signup |
| Admin — roster | Cas, Naomi | **mobile-first.** Heavy roster work happens on a phone at the rink |
| Admin — finance & season setup | Cas, Michael | desktop. Ledger, exports, slot configuration, pricing |
| Coach | trainers, shooters | roster for own sessions, own attendance confirmation |
| Email | all | one-tap confirm/decline via signed single-purpose tokens, no login required |

Server exposes a JSON API; web and native are two clients of it. Shared TypeScript core: domain types, validation schemas, API client. Components are largely not shared — consistency comes from shared tokens and shared logic.

---

## 13. Sequencing

Registration opens in January; the season starts in late March. Nobody needs the app in January — season registration is a once-a-year event done on whatever browser is to hand. Push only starts mattering when extras claiming goes live, in March.

| Phase | Contents | Target |
|---|---|---|
| 1 | Accounts, family accounts, season/slot config, registration + cart + holds + waitlist, ledger, payments | November soft launch, web only |
| 2 | Admin roster (mobile), attendance, notifications, live fill | November soft launch |
| 3 | Extras claiming, session waitlists, polls, cancellations | Before March |
| 4 | Native app with push | Feb–Mar |

Registration is built **first and hardened**, because it carries the most money and gets its real-world trial in January, months before anything else is stressed.

---

## 14. Decisions

### Settled

| # | Decision | Outcome |
|---|---|---|
| D1 | Resolution of unanswered attendance | **Unknown is out.** Resolves to not-attending at `release_at`, default 48h. Mandatory escalating reminder ladder, digested per player. Late reinstatement if the spot is unclaimed. See §5. |
| D2 | Vetting of unknown claimers | **No gate.** Passive `player_flags` only — admins tag who they recognise, system auto-tags where data supports it. See §2, §6. |
| D3 | Goalie pricing | **Half price for the season** (€150 regular), **full price for skills training** (€450), **free as extras**. Absorbed by `slot_capacities` rows, no special-casing. See §3. |
| D4 | Coach payables in the ledger | **In scope.** One append-only stream for both sides via signed amounts; `fee` and `payout` entry types; rate captured on the assignment. Settlement recorded, not automated. See §8. |
| D5 | Naomi's PII boundary | **Contact details yes** — she needs to reach people. Exclusion is purely financial, covering coach payables as well as player balances. See §2. |
| D6 | Roster visibility format | First name + surname initial as the default, configurable. Flexible pending feedback. |
| D7 | Size of the public interest list | **~350 people.** Makes push load-bearing. ~5,400 emails/month projected, inside Postmark's 10,000. See §11. |
| D8 | Late-withdrawal cutoff for extras | 2h default, configurable per season. Flexible pending feedback. |
| D9 | Auto-flag heuristic | Declared level vs. slot intent in year one; richer comparison against prior seasons from year two. |
| D10 | Goalie flaking exposure | **Spam protection only.** Cap of two concurrent open claims, rate limiting, late-withdrawal flags. Real problems handled by a human. See §6. |
| D11 | `spot_open` notification unit | **Per availability transition, not per spot.** One notification when a session goes full → has-space, slot-filtered, judged on committed occupancy with pending holds excluded. Per-session waitlist dropped as redundant. See §6, §11. |

### Open

| # | Decision | Needs |
|---|---|---|
| D12 | Skills Training capacity — split ice, so 20/2 does not apply. Skater and goalie capacities unknown, and at €450/head these are the highest-value slots sold. See §1. | Cas |

---

## 15. Explicitly out of scope

- Attendance check-in / no-show tracking — honour system, and payment up front makes it moot
- Approval queues anywhere in registration — nothing gates payment
- Level-based restriction of slot selection — self-reported, unrestricted, flagged not gated
- Filtering, ranking or hiding of slots from players — the schedule is always shown in full
- Automatic revocation of a registration for any reason — removal is a human act
- Any acknowledgement, vetting or approval step before a claim — flags are passive
- Per-session waitlist queues for extras — claiming is an open race after one notification
- Realtime per-user state sync — aggregate fill counts only
- WhatsApp integration
