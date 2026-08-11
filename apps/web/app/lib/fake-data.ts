// Wave 1 fake data. No database — everything below is hardcoded or derived at
// module load from hardcoded numbers. State that pages mutate (the register
// basket, the "simulate another player" button) lives in component state,
// seeded from here; refreshing the page throws it away, per the brief.
//
// Slots, capacities and prices are the real 2026 schedule from
// docs/DOMAIN-MODEL.md §1. Skills Training capacity is D12 in that doc —
// partially resolved 2026-08-11: Wednesday's Skills Training slot is
// skaters-only (goalie capacity 0, decided), Saturday's keeps both
// positions at 16 skaters / 4 goalies, which remains an invented
// placeholder, not a number Cas has confirmed. Skills Training goalie
// pricing is €600 (D3, revised 2026-08-11) — no longer the same rate as
// skater's €450.

export type Position = "skater" | "goalie";
export type SessionType = "scrimmage" | "skills_training";
export type AttendanceStatus = "attending" | "not_attending" | "unknown";

export interface Slot {
  id: string;
  weekday: number; // JS Date.getDay(): Sunday = 0
  weekdayLabel: string;
  startTime: { h: number; m: number };
  endTime: { h: number; m: number };
  label: string;
  levels: string[]; // slot_levels — advisory, empty for Skills Training
  sessionType: SessionType;
  capacity: Record<Position, number>;
  price: Record<Position, { seasonCents: number; extrasCents: number }>;
}

// Fixed "now" for this demo, matching the environment's current date. Every
// date computation below (next occurrence, release deadlines, past vs.
// upcoming) is anchored to this instead of `new Date()`, so the data reads
// the same regardless of when the dev server actually runs.
export const TODAY = new Date(2026, 7, 10); // 2026-08-10

const SEASON_START = new Date(2026, 2, 30); // 2026-03-30, the real first Tuesday
export const SEASON = {
  name: "2026 Summer Season",
  startDate: SEASON_START,
  endDate: new Date(2026, 7, 30),
  weekCount: 22,
};

// Home page's `seasonPhase` prop (design_handoff_season_dropins): "auto"
// compares TODAY against the season bounds above. TODAY (10 Aug 2026) sits
// inside the season, so this always resolves to "during" for this demo —
// the "before" branch still exists in the components below for whenever
// TODAY moves, not dead code kept only for symmetry.
export function seasonPhase(): "before" | "during" {
  return TODAY < SEASON_START ? "before" : "during";
}

const SCRIMMAGE_CAPACITY: Record<Position, number> = { skater: 20, goalie: 2 };
const SKILLS_CAPACITY: Record<Position, number> = { skater: 16, goalie: 4 };
// Wednesday Skills Training only — see D12: decided skaters-only, not a
// placeholder like the 16/4 above.
const SKILLS_CAPACITY_SKATERS_ONLY: Record<Position, number> = { skater: 16, goalie: 0 };

const SCRIMMAGE_PRICE: Record<Position, { seasonCents: number; extrasCents: number }> = {
  skater: { seasonCents: 30000, extrasCents: 1500 },
  goalie: { seasonCents: 15000, extrasCents: 0 },
};
// Goalie skills-training price is €600, not €450 — deliberately not the
// same rate as skater's, unlike regular scrimmage's clean half/full-price
// relationship. See D3.
const SKILLS_PRICE: Record<Position, { seasonCents: number; extrasCents: number }> = {
  skater: { seasonCents: 45000, extrasCents: 1500 },
  goalie: { seasonCents: 60000, extrasCents: 0 },
};

function slot(
  id: string,
  weekday: number,
  weekdayLabel: string,
  start: [number, number],
  end: [number, number],
  label: string,
  levels: string[],
  sessionType: SessionType,
  capacityOverride?: Record<Position, number>,
): Slot {
  return {
    id,
    weekday,
    weekdayLabel,
    startTime: { h: start[0], m: start[1] },
    endTime: { h: end[0], m: end[1] },
    label,
    levels,
    sessionType,
    capacity: capacityOverride ?? (sessionType === "scrimmage" ? SCRIMMAGE_CAPACITY : SKILLS_CAPACITY),
    price: sessionType === "scrimmage" ? SCRIMMAGE_PRICE : SKILLS_PRICE,
  };
}

// Schedule order: weekday then start time, exactly as DOMAIN-MODEL.md §1
// lists it. Never re-sorted by fill, level or anything else.
export const SLOTS: Slot[] = [
  slot("tue-2130", 2, "Tuesday", [21, 30], [22, 30], "5th/6th Division", ["5th", "6th"], "scrimmage"),
  slot(
    "wed-2015",
    3,
    "Wednesday",
    [20, 15],
    [21, 15],
    "Skills Training",
    [],
    "skills_training",
    SKILLS_CAPACITY_SKATERS_ONLY,
  ),
  slot("wed-2130", 3, "Wednesday", [21, 30], [22, 30], "Recreational", ["Recreational"], "scrimmage"),
  slot("thu-2015", 4, "Thursday", [20, 15], [21, 15], "3rd/4th Division", ["3rd", "4th"], "scrimmage"),
  slot("thu-2130", 4, "Thursday", [21, 30], [22, 30], "5th/6th Division", ["5th", "6th"], "scrimmage"),
  slot("fri-2015", 5, "Friday", [20, 15], [21, 15], "3rd/4th Division", ["3rd", "4th"], "scrimmage"),
  slot("fri-2130", 5, "Friday", [21, 30], [22, 30], "5th/6th Division", ["5th", "6th"], "scrimmage"),
  slot("sat-2015", 6, "Saturday", [20, 15], [21, 15], "Skills Training", [], "skills_training"),
  slot("sat-2130", 6, "Saturday", [21, 30], [22, 30], "Recreational", ["Recreational"], "scrimmage"),
  slot("sun-1900", 0, "Sunday", [19, 0], [20, 0], "2nd/3rd Division", ["2nd", "3rd"], "scrimmage"),
];

// Level-filter pill options for drop-ins/register, in the design's own
// order (ascending division, then Recreational, then Skills Training) —
// not schedule order. "Skills Training" is a session type, not a level
// (DOMAIN-MODEL.md §2 — a slot with zero slot_levels never raises a
// mismatch flag), but the filter row treats it as a same-shape pill
// anyway, so it's a pseudo-level for this one UI purpose only. Matching a
// slot: compare against `slot.label` directly (each of these is exactly
// one slot's label, short-form "Division" already dropped).
export const LEVEL_FILTERS = ["2nd/3rd", "3rd/4th", "5th/6th", "Recreational", "Skills Training"] as const;

export function slotMatchesLevelFilter(s: Slot, filter: string): boolean {
  return s.label === filter || s.label === `${filter} Division`;
}

export function slotById(id: string): Slot | undefined {
  return SLOTS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

// ~40 Dutch names. A handful double as goalies — the pool clubs actually draw
// from is small, which is the whole point of the goalie-shortage story.
// "Sanne van der Linden" (the My Schedule persona, below) is deliberately not
// in this pool — otherwise she'd also turn up as an anonymous roster line on
// some other hour, which would read as a data bug rather than a coincidence.
const SKATER_NAMES = [
  "Daan de Vries", "Sem Jansen", "Bram van den Berg", "Lars Bakker", "Thijs Visser",
  "Milan Meijer", "Niek de Boer", "Ruben Mulder", "Tim de Groot", "Joris Bos",
  "Stijn Vos", "Wouter Peters", "Jasper Hendriks", "Koen van Leeuwen", "Max Dekker",
  "Tom Brouwer", "Rick de Wit", "Pim Kok", "Femke Schouten", "Anne van der Meer",
  "Eva Kuipers", "Lisa Verhoeven", "Noa Wolters",
  "Fleur Hermans", "Julia Terpstra", "Sara Groen", "Maud Willemsen", "Roos Blom",
  "Britt van Vliet", "Suzanne de Haan", "Jan Prins", "Pieter Huisman",
  "Dirk Molenaar", "Gijs Timmermans", "Hugo van der Berg",
];

const GOALIE_NAMES = [
  "Sven Smit", "Iris Postma", "Willem Sanders", "Vera Groenewoud", "Bas van Dijk", "Marleen Kramer",
];

function namesFrom(pool: string[], offset: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pool[(offset + i) % pool.length]!);
  return out;
}

// One family account: a guardian and two admin-verified-or-not dependents.
// Not wired into a page yet (My Account is wave 2) but recorded here so the
// shape exists.
export const FAMILY_ACCOUNT = {
  guardian: "Anne van der Meer",
  dependents: [
    { name: "Luuk van der Meer", adminVerified: true },
    { name: "Noor van der Meer", adminVerified: false },
  ],
};

// ---------------------------------------------------------------------------
// Roster config — the single source of truth for fill numbers everywhere.
// Season-registered count for a (slot, position) is confirmed + unanswered +
// declined for its next session: everyone currently registered has an
// attendance row for the next date, answered or not.
// ---------------------------------------------------------------------------

interface StatusCounts {
  confirmed: number;
  unanswered: number;
  declined: number;
}

interface SlotRosterConfig {
  skater: StatusCounts;
  goalie: StatusCounts;
}

const ROSTER_CONFIG: Record<string, SlotRosterConfig> = {
  // Flagship example from the homepage brief: 18/20 skaters, 1/2 goalies —
  // and the one lone goalie hasn't even confirmed yet.
  "tue-2130": { skater: { confirmed: 11, unanswered: 7, declined: 0 }, goalie: { confirmed: 0, unanswered: 1, declined: 0 } },
  // Skaters-only slot (D12) — zero goalie capacity, so zero goalie counts;
  // a nonzero figure here would register more goalies than the slot can
  // hold, which seasonFill()/openSpots() would silently under-report.
  "wed-2015": { skater: { confirmed: 6, unanswered: 2, declined: 1 }, goalie: { confirmed: 0, unanswered: 0, declined: 0 } },
  // The problem session: two days out, mostly unanswered, one goalie.
  "wed-2130": { skater: { confirmed: 3, unanswered: 8, declined: 0 }, goalie: { confirmed: 0, unanswered: 1, declined: 0 } },
  // Full, with a waitlist.
  "thu-2015": { skater: { confirmed: 16, unanswered: 4, declined: 0 }, goalie: { confirmed: 2, unanswered: 0, declined: 0 } },
  "thu-2130": { skater: { confirmed: 14, unanswered: 5, declined: 0 }, goalie: { confirmed: 1, unanswered: 1, declined: 0 } },
  // Zero goalies at all — the real crisis, worse than any skater shortfall.
  "fri-2015": { skater: { confirmed: 9, unanswered: 5, declined: 0 }, goalie: { confirmed: 0, unanswered: 0, declined: 0 } },
  // Used by the "simulate another player takes Friday 21:30" button: one
  // skater spot left before it fills.
  "fri-2130": { skater: { confirmed: 12, unanswered: 7, declined: 0 }, goalie: { confirmed: 2, unanswered: 0, declined: 0 } },
  "sat-2015": { skater: { confirmed: 3, unanswered: 2, declined: 0 }, goalie: { confirmed: 1, unanswered: 0, declined: 0 } },
  "sat-2130": { skater: { confirmed: 7, unanswered: 4, declined: 1 }, goalie: { confirmed: 1, unanswered: 1, declined: 0 } },
  "sun-1900": { skater: { confirmed: 13, unanswered: 4, declined: 0 }, goalie: { confirmed: 2, unanswered: 0, declined: 0 } },
};

function registeredCount(counts: StatusCounts): number {
  return counts.confirmed + counts.unanswered + counts.declined;
}

export function seasonFill(slotId: string): Record<Position, number> {
  const cfg = ROSTER_CONFIG[slotId]!;
  return { skater: registeredCount(cfg.skater), goalie: registeredCount(cfg.goalie) };
}

// Waitlist — season-level, for the one slot that's genuinely full.
export const WAITLISTS: Record<string, { name: string; position: Position; queuePosition: number }[]> = {
  "thu-2015": [
    { name: "Rick de Wit", position: "skater", queuePosition: 1 },
    { name: "Pim Kok", position: "skater", queuePosition: 2 },
    { name: "Julia Terpstra", position: "skater", queuePosition: 3 },
  ],
};

// Extras claims — flavour for the roster page's "open spots, who claimed
// them" requirement. Full extras claiming is wave 3; this is static display
// data only.
export const EXTRAS_CLAIMS: { slotId: string; position: Position; name: string; note: string }[] = [
  { slotId: "sat-2130", position: "skater", name: "Anne van der Meer", note: "claimed after a late drop" },
];

// ---------------------------------------------------------------------------
// Date helpers — everything anchored to TODAY, never real-world `new Date()`.
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextOccurrence(weekday: number, from: Date = TODAY): Date {
  const diff = (weekday - from.getDay() + 7) % 7;
  return addDays(from, diff);
}

function combineDateTime(date: Date, time: { h: number; m: number }): Date {
  const d = new Date(date);
  d.setHours(time.h, time.m, 0, 0);
  return d;
}

export function seasonDates(weekday: number, count = SEASON.weekCount): Date[] {
  const first = nextOccurrence(weekday, SEASON_START);
  return Array.from({ length: count }, (_, i) => addDays(first, i * 7));
}

const RELEASE_HOURS_BEFORE = 48;

export function releaseAt(sessionStart: Date): Date {
  return new Date(sessionStart.getTime() - RELEASE_HOURS_BEFORE * 60 * 60 * 1000);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// "11–16 August" — drop-ins' week-header range, natural case (matching
// every other eyebrow in the app, which relies on CSS text-transform:
// uppercase rather than a pre-uppercased string). Both dates always fall
// in the same month for this schedule (six consecutive days), so there's
// no cross-month case to handle.
export function formatDateRange(start: Date, end: Date): string {
  const month = end.toLocaleDateString("en-GB", { month: "long" });
  return `${start.getDate()}–${end.getDate()} ${month}`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(time: { h: number; m: number }): string {
  return `${String(time.h).padStart(2, "0")}:${String(time.m).padStart(2, "0")}`;
}

export function formatEuros(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

// ---------------------------------------------------------------------------
// Next-session rosters, for the admin overview and roster pages.
// ---------------------------------------------------------------------------

export interface RosterEntry {
  name: string;
  status: AttendanceStatus;
}

export interface NextSession {
  slotId: string;
  date: Date;
  startAt: Date;
  releaseAt: Date;
  skaters: RosterEntry[];
  goalies: RosterEntry[];
}

function buildRoster(pool: string[], counts: StatusCounts, offset: number): RosterEntry[] {
  const names = namesFrom(pool, offset, registeredCount(counts));
  const entries: RosterEntry[] = [];
  let i = 0;
  for (let c = 0; c < counts.confirmed; c++, i++) entries.push({ name: names[i]!, status: "attending" });
  for (let c = 0; c < counts.declined; c++, i++) entries.push({ name: names[i]!, status: "not_attending" });
  for (let c = 0; c < counts.unanswered; c++, i++) entries.push({ name: names[i]!, status: "unknown" });
  return entries;
}

const NEXT_SESSIONS: Record<string, NextSession> = Object.fromEntries(
  SLOTS.map((s, index) => {
    const cfg = ROSTER_CONFIG[s.id]!;
    const date = nextOccurrence(s.weekday);
    const startAt = combineDateTime(date, s.startTime);
    const session: NextSession = {
      slotId: s.id,
      date,
      startAt,
      releaseAt: releaseAt(startAt),
      skaters: buildRoster(SKATER_NAMES, cfg.skater, index * 4),
      goalies: buildRoster(GOALIE_NAMES, cfg.goalie, index),
    };
    return [s.id, session];
  }),
);

export function nextSessionFor(slotId: string): NextSession | undefined {
  return NEXT_SESSIONS[slotId];
}

// This week's total open spots across every slot — used by both the home
// page's in-season drop-in CTA card and /drop-ins' own header count. This
// is session-level (decline-freed spots, extras claims subtracted), not
// the season-level useLiveFill number the pre-season list uses — see
// page.module.css's week-calendar comment for why those are genuinely
// different figures.
export function weekOpenSpotsTotals(): Record<Position, number> {
  return SLOTS.reduce(
    (totals, s) => {
      const detail = sessionDetail(s.id)!;
      return { skater: totals.skater + detail.openSpots.skater, goalie: totals.goalie + detail.openSpots.goalie };
    },
    { skater: 0, goalie: 0 },
  );
}

function countStatus(entries: RosterEntry[], status: AttendanceStatus): number {
  return entries.filter((e) => e.status === status).length;
}

export function statusCounts(entries: RosterEntry[]): StatusCounts {
  return {
    confirmed: countStatus(entries, "attending"),
    unanswered: countStatus(entries, "unknown"),
    declined: countStatus(entries, "not_attending"),
  };
}

export interface SessionDetail {
  slot: Slot;
  session: NextSession;
  openSpots: Record<Position, number>;
  claims: { position: Position; name: string; note: string }[];
}

export function sessionDetail(slotId: string): SessionDetail | undefined {
  const slotDef = slotById(slotId);
  const session = nextSessionFor(slotId);
  if (!slotDef || !session) return undefined;

  const fill = seasonFill(slotId);
  const freedByDecline = {
    skater: countStatus(session.skaters, "not_attending"),
    goalie: countStatus(session.goalies, "not_attending"),
  };
  const openSpots: Record<Position, number> = {
    skater: Math.max(0, slotDef.capacity.skater - fill.skater) + freedByDecline.skater,
    goalie: Math.max(0, slotDef.capacity.goalie - fill.goalie) + freedByDecline.goalie,
  };
  const claims = EXTRAS_CLAIMS.filter((c) => c.slotId === slotId);
  for (const claim of claims) {
    openSpots[claim.position] = Math.max(0, openSpots[claim.position] - 1);
  }

  return { slot: slotDef, session, openSpots, claims };
}

// ---------------------------------------------------------------------------
// Current player — "My schedule" page. One person, two registrations, mixed
// positions, so the page shows more than one abstract slot repeated.
// ---------------------------------------------------------------------------

export interface DatedAttendance {
  date: Date;
  startAt: Date;
  status: AttendanceStatus;
  releaseAt: Date;
}

export interface PlayerRegistration {
  slotId: string;
  position: Position;
  dates: DatedAttendance[];
}

function buildPlayerDates(s: Slot): DatedAttendance[] {
  return seasonDates(s.weekday).map((date, i) => {
    const startAt = combineDateTime(date, s.startTime);
    const deadline = releaseAt(startAt);
    let status: AttendanceStatus;
    if (startAt < TODAY) {
      // Past session — already resolved. A couple of declines for variety.
      status = i % 7 === 3 ? "not_attending" : "attending";
    } else if (deadline <= TODAY) {
      // Deadline has already passed for a session that hasn't happened yet:
      // in the real system that only happens if the player answered before
      // it lapsed, so treat as confirmed rather than contradict the rule.
      status = "attending";
    } else {
      status = "unknown";
    }
    return { date, startAt, status, releaseAt: deadline };
  });
}

export const CURRENT_PLAYER_NAME = "Sanne van der Linden";

export const CURRENT_PLAYER_REGISTRATIONS: PlayerRegistration[] = [
  { slotId: "tue-2130", position: "skater", dates: buildPlayerDates(slotById("tue-2130")!) },
  { slotId: "sun-1900", position: "goalie", dates: buildPlayerDates(slotById("sun-1900")!) },
];
