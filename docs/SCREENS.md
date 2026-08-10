# Summer Ice — Screens

Every page in the system. Who it's for, what it shows, what you can do on it.

Derived from `DOMAIN-MODEL.md`. Where the model doesn't specify something, it's marked **open**.

---

## Public — no login

### 1. Homepage
Season dates, what the league is, prices. The ten hours with live fill per position. Register button.
The only page a stranger sees, and the one cacheable page in the system — fill counts stream, the rest caches.

### 2. Sign in / sign up
Email and password, Google, Apple. Signup attests 16 or over.

### 3. One-tap confirm landing
Where an email link lands. **No login.** Signed single-purpose token, one action, then a confirmation.
"You're playing Sunday 19:00" or "Thanks, we've released your spot."

---

## Player

### 4. Register
The January flow, and the highest-stakes page.
Choose position once, per-line override available. Pick hours. Basket may mix held lines (payable, ten-minute countdown) with waitlisted lines (free, queue position shown). Never hard-fails. One iDEAL payment for the held lines.

### 5. My schedule
**22 dated sessions per registration, not an abstract slot.** Each date shows your answer: playing, not playing, or no reply yet — with the release deadline visible on anything unanswered.
Confirm or decline any date. Withdraw from a whole registration.

### 6. Extras
Sessions with space you can claim, filtered to the hours you care about. Skater claims cost €15 and are paid on claim; goalie claims are free and confirm instantly.
Withdraw a claim, with the cutoff and its consequence stated plainly.

### 7. My account
Name, contact, self-reported level. Dependents (add, and see which are admin-verified). Notification preferences — channel, and which hours you want to hear about. Confirmation reminders can't be switched off entirely.

### 8. My payments
Ledger for this person: charges, credits, payments, current balance. Receipts.

---

## Admin — Cas

### 9. Overview
His first priority, checked several times a day.
All ten hours, next session each, fill per position. **A goalie shortage must look worse than a skater shortage.** Confirmed versus unanswered separated — 18/20 before the deadline might be 11 confirmed and 7 silent, and that difference is the point of the page. What needs attention, and why.

### 10. Session roster
One session in detail. **Mobile-first — this is Naomi's page, used at the rink on a phone.**
Registered players and their answers, skaters and goalies separated. Open spots and who claimed them. Manual override on anything, with a note. Cancel the session.

### 11. Players
List, search. Level, flags, family relationships, registration history. Verify a dependent. Tag a level mismatch.

### 12. Money
The full ledger. Balances, who owes what. Issue a credit or refund. Export for the accountant.

### 13. Season setup
Create a season. Add hours with day, time, level, type. Capacity and both prices **per position**. Generate the 22 dated sessions. Open registration.

### 14. Settings
The knobs Cas turns without a deploy: attendance release deadline (default 48h), extras late-drop cutoff (default 2h), registration hold window (default 10 min), reminder ladder timings.

### 15. Announcements
Compose, choose audience, send.

### 16. Coaches
Assign trainers and shooters to sessions, with a rate. Their confirmed attendance. What's owed and what's been settled.

---

## Naomi — scheduler

Same pages as Cas for 9, 10, 11, 15. **No access at all** to 12, 14, 16 — the financial exclusion covers coach rates as well as player balances.

## Coach

### 17. My sessions
Sessions they're assigned to, the roster for each, and confirm their own attendance.

---

## Build order

The point of the first slice is something walkable, with fake data, that can be clicked and argued with.

| Wave | Screens | Why |
|---|---|---|
| **1** | 1, 4, 5, 9, 10 | The complete loop: arrive → register → see your dates → confirm. Plus what Cas sees. Walkable end to end. |
| 2 | 2, 3, 7, 8 | Real accounts, real email, real money view |
| 3 | 6, 11, 15 | Extras and day-to-day admin |
| 4 | 12, 13, 14, 16, 17 | Season setup, money, coaches |

Wave 1 is fake data throughout. No database, no login, no payments — a Register button that jumps straight to the confirmed state.

---

## Open questions these screens raise

| | Open |
|---|---|
| 4 | Account before picking hours, or at checkout? Checkout is probably better. |
| 4 | Where is level captured — signup, or registration? |
| 4 | Can a goalie register themselves, or still contact Cas as the current site says? |
| 4 | What does a player see when a hold expires unpaid? |
| 5 | Can a player withdraw from a single date, or only the whole registration? |
| 6 | Refilled late-drop credit: automatic, with admin override. Settled. |
| 9 | What counts as "needs attention"? Thresholds not specified. |
| 10 | Roster visibility to players: first name plus surname initial. |
