"use client";

// Register — restyled from the "Summer Ice Landing" Claude Design
// project's design_handoff_season_dropins bundle (Register.dc.html) into
// the same six-column week-grid language as /drop-ins (see
// register.module.css's own comment on why it's a page-scoped copy, not
// a shared component, despite the resemblance). The underlying model —
// fake-data-backed availability, real holds with a countdown, the
// "simulate another player" contention demo — is this repo's own wave-1
// logic, carried over and restyled rather than rebuilt, exactly as the
// previous pass of this page established.
//
// Real behaviour change from the previous version, not just a restyle:
// "I play as a Skater/Goalie/Both" is gone. The new design has no global
// role — every card always shows whichever role rows have capacity
// (skater, and goalie unless the slot is skaters-only), and you pick a
// role per night by clicking its row, one role per slot, replaceable.
// "I play" is now a pure filter (hides rows/cards with no room for that
// role), not a registration setting. Waitlisting also changes shape: the
// old basket could hold a "waitlisted" line for a full slot; the new
// model keeps reserves entirely separate from the payable basket — a
// boolean per full slot, contributing nothing to the total — matching
// Register.dc.html's own state (`picks` vs `reserves`) exactly.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type Position,
  type Slot,
  LEVEL_FILTERS,
  SLOTS,
  WAITLISTS,
  formatEuros,
  formatTime,
  seasonFill,
  slotMatchesLevelFilter,
} from "~/lib/fake-data";
import { SiteFooter } from "../site-footer";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import shared from "../page.module.css";
import styles from "./register.module.css";

const HOLD_MINUTES = 10;
const SIMULATED_SLOT_ID = "fri-2130";
const SIMULATED_POSITION: Position = "skater";

type RoleFilter = "any" | Position;

interface BasketLine {
  position: Position;
  priceCents: number;
  holdExpiresAt: number; // ms epoch
}

const WEEK_COLUMNS: { weekday: number; label: string }[] = [
  { weekday: 2, label: "Tue" },
  { weekday: 3, label: "Wed" },
  { weekday: 4, label: "Thu" },
  { weekday: 5, label: "Fri" },
  { weekday: 6, label: "Sat" },
  { weekday: 0, label: "Sun" },
];

function extraKey(slotId: string, position: Position): string {
  return `${slotId}:${position}`;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function waitlistQueuePosition(slotId: string, position: Position): number {
  return (WAITLISTS[slotId]?.filter((w) => w.position === position).length ?? 0) + 1;
}

export function RegisterClient() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("any");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [basket, setBasket] = useState<Record<string, BasketLine>>({});
  const [reserves, setReserves] = useState<Record<string, boolean>>({});
  const [simulatedExtra, setSimulatedExtra] = useState<Record<string, number>>({});
  const [paid, setPaid] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // A held line is only real while its countdown is running — tick once a
  // second so expiry frees capacity the moment it lapses, with no sweep
  // step, same as the real system (DOMAIN-MODEL §4's release_at).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const liveBasket = useMemo(() => {
    const next: Record<string, BasketLine> = {};
    for (const [slotId, line] of Object.entries(basket)) {
      if (paid || line.holdExpiresAt > now) next[slotId] = line;
    }
    return next;
  }, [basket, paid, now]);

  // Demand from everyone *except* this session's own basket line for
  // (slotId, position) — the real season roster plus the "simulate
  // another player" demo. Kept separate from `available` below because a
  // held line needs to ask two different questions: "how many spots are
  // left" (counts my own hold as taken) vs. "would I still get this spot
  // if I gave it up right now" (must not count my own hold, or every held
  // line would trivially look stale).
  function takenByOthers(slotId: string, position: Position): number {
    return seasonFill(slotId)[position] + (simulatedExtra[extraKey(slotId, position)] ?? 0);
  }

  function taken(slotId: string, position: Position): number {
    const line = liveBasket[slotId];
    const mine = line && line.position === position ? 1 : 0;
    return takenByOthers(slotId, position) + mine;
  }

  function available(slot: Slot, position: Position): number {
    return Math.max(0, slot.capacity[position] - taken(slot.id, position));
  }

  function roomForOthers(slot: Slot, position: Position): number {
    return Math.max(0, slot.capacity[position] - takenByOthers(slot.id, position));
  }

  function togglePick(slot: Slot, position: Position) {
    setBasket((b) => {
      const existing = b[slot.id];
      if (existing && existing.position === position) {
        const next = { ...b };
        delete next[slot.id];
        return next;
      }
      return {
        ...b,
        [slot.id]: {
          position,
          priceCents: slot.price[position].seasonCents,
          holdExpiresAt: Date.now() + HOLD_MINUTES * 60 * 1000,
        },
      };
    });
  }

  function removeFromBasket(slotId: string) {
    setBasket((b) => {
      const next = { ...b };
      delete next[slotId];
      return next;
    });
  }

  function toggleReserves(slotId: string) {
    setReserves((r) => ({ ...r, [slotId]: !r[slotId] }));
  }

  function simulateOtherPlayer() {
    const slot = SLOTS.find((s) => s.id === SIMULATED_SLOT_ID)!;
    if (roomForOthers(slot, SIMULATED_POSITION) <= 0) return;
    const k = extraKey(SIMULATED_SLOT_ID, SIMULATED_POSITION);
    setSimulatedExtra((extra) => ({ ...extra, [k]: (extra[k] ?? 0) + 1 }));
  }

  function matchesFilters(slot: Slot): boolean {
    if (levelFilter && !slotMatchesLevelFilter(slot, levelFilter)) return false;
    if (roleFilter === "skater" && available(slot, "skater") <= 0) return false;
    if (roleFilter === "goalie" && (slot.capacity.goalie === 0 || available(slot, "goalie") <= 0)) return false;
    return true;
  }

  const heldEntries = Object.entries(liveBasket);
  const total = heldEntries.reduce((sum, [, l]) => sum + l.priceCents, 0);
  const staleSlotIds = heldEntries
    .filter(([slotId, line]) => roomForOthers(SLOTS.find((s) => s.id === slotId)!, line.position) <= 0)
    .map(([slotId]) => slotId);
  const canContinue = heldEntries.length > 0 && staleSlotIds.length === 0;

  const simulatedSlot = SLOTS.find((s) => s.id === SIMULATED_SLOT_ID)!;
  const simulatedRoom = roomForOthers(simulatedSlot, SIMULATED_POSITION);

  const openSkaters = SLOTS.reduce((sum, s) => sum + available(s, "skater"), 0);
  const openGoalies = SLOTS.reduce((sum, s) => sum + (s.capacity.goalie > 0 ? available(s, "goalie") : 0), 0);

  const filtersActive = roleFilter !== "any" || levelFilter !== null;

  function pickShortLabel(slotId: string, position: Position): string {
    const slot = SLOTS.find((s) => s.id === slotId)!;
    return `${slot.weekdayLabel.slice(0, 3)} ${formatTime(slot.startTime)}${position === "goalie" ? " (goalie)" : ""}`;
  }

  const pickSummary = heldEntries.length === 0 ? "Tap a night to add it for the season" : heldEntries.map(([slotId, l]) => pickShortLabel(slotId, l.position)).join(" · ");
  const pickCount = heldEntries.length === 0 ? "Nothing selected yet" : `${pluralize(heldEntries.length, "night")} selected`;

  return (
    <div className={shared.page}>
      <SiteNav active="register" />

      <div className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <div className={styles.headerEyebrow}>2026 season · 30 Mar – 30 Aug</div>
            <h1 className={styles.headerTitle}>Take a night for the season</h1>
          </div>
          <div className={styles.headerCounts}>
            <div className={styles.headerCountsNum}>
              {openSkaters} skater · {openGoalies} goalie
            </div>
            <div className={styles.headerCountsLabel}>Season spots left</div>
          </div>
        </div>
      </div>

      <div className={styles.main}>
        <p className={styles.blurb}>
          Ten nights run every week all summer. Take as many as you like — the spot is yours every week until 30
          August, and you pay once. <strong>€300 a night for skaters, €150 for goalies.</strong> Skills training
          is priced on its own: €450 skaters, €600 goalies — and Wednesday skills is skaters only.
        </p>

        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>I play</span>
          <div className={styles.roleGroup}>
            {(["any", "skater", "goalie"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={roleFilter === r ? styles.rolePillBtnActive : styles.rolePillBtnInactive}
              >
                {r === "any" ? "Any" : r === "skater" ? "Skater" : "Goalie"}
              </button>
            ))}
          </div>
          <div className={styles.levelGroup}>
            {LEVEL_FILTERS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevelFilter((prev) => (prev === level ? null : level))}
                className={levelFilter === level ? styles.levelPillBtnActive : styles.levelPillBtnInactive}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.demo}>
          <p className={styles.demoText}>
            Demo: simulate contention on Friday 21:30 (skaters, {simulatedRoom} spot{simulatedRoom === 1 ? "" : "s"}{" "}
            left).
          </p>
          <button type="button" onClick={simulateOtherPlayer} disabled={simulatedRoom <= 0} className={styles.demoBtn}>
            {simulatedRoom <= 0 ? "Friday 21:30 skaters is now full" : "Simulate another player takes Friday 21:30"}
          </button>
        </div>

        <div className={styles.calendarScroll}>
          <div className={styles.calendarPanel}>
            {WEEK_COLUMNS.map((col) => {
              const daySlots = SLOTS.filter((s) => s.weekday === col.weekday);
              const visible = daySlots.filter(matchesFilters);

              return (
                <div key={col.weekday} className={styles.dayCol}>
                  <div className={styles.dayColHead}>
                    <span className={styles.dayColLabel}>{col.label}</span>
                    <span className={styles.dayColSub}>{visible.length === 1 ? "1 night" : `${visible.length} nights`}</span>
                  </div>

                  {visible.length === 0 ? (
                    <div className={styles.dayEmpty}>
                      <span className={styles.dayEmptyText}>{filtersActive ? "Nothing matching" : "No ice"}</span>
                    </div>
                  ) : (
                    visible.map((slot) => {
                      const line = liveBasket[slot.id];
                      const stale = line !== undefined && staleSlotIds.includes(slot.id);

                      if (stale) {
                        return (
                          <div key={slot.id} id={slot.id} className={styles.sessionCardFull} style={{ borderColor: "var(--destructive)" }}>
                            <div className={styles.sessionTimeFull} style={{ opacity: 1 }}>
                              {formatTime(slot.startTime)}
                            </div>
                            <div className={styles.sessionLevelFull} style={{ opacity: 1 }}>
                              {slot.label}
                            </div>
                            <div className={styles.fullFooter}>
                              <span className={styles.fullLabel}>No {line!.position} spots left</span>
                              <button type="button" onClick={() => removeFromBasket(slot.id)} className={styles.reservesBtn}>
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const skLeft = available(slot, "skater");
                      const glLeft = slot.capacity.goalie > 0 ? available(slot, "goalie") : 0;
                      const hasRoom = Boolean(line) || skLeft > 0 || glLeft > 0;

                      if (!hasRoom) {
                        const onReserves = reserves[slot.id] ?? false;
                        const position = waitlistQueuePosition(slot.id, "skater");
                        return (
                          <div key={slot.id} id={slot.id} className={styles.sessionCardFull}>
                            <div className={styles.sessionTimeFull}>{formatTime(slot.startTime)}</div>
                            <div className={styles.sessionLevelFull}>{slot.label}</div>
                            <div className={styles.fullFooter}>
                              <span className={styles.fullLabel}>Full</span>
                              <button
                                type="button"
                                onClick={() => toggleReserves(slot.id)}
                                className={onReserves ? styles.reservesBtnActive : styles.reservesBtn}
                              >
                                {onReserves ? `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} on the reserves ✓` : "Join the reserves"}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const roleRow = (role: Position, left: number) => {
                        const isPicked = line?.position === role;
                        const label = role === "skater" ? "Skater" : "Goalie";
                        const priceCents = slot.price[role].seasonCents;
                        if (!isPicked && left <= 0) {
                          return (
                            <div key={role} className={styles.roleRowBlocked}>
                              <span>{label}</span>
                              <span className={styles.roleRowBlockedNote}>full</span>
                            </div>
                          );
                        }
                        const cls = isPicked ? styles.roleRowSelected : left >= 3 ? styles.roleRowGreen : styles.roleRowAmber;
                        return (
                          <button key={role} type="button" onClick={() => togglePick(slot, role)} className={cls}>
                            <span className={styles.roleRowLabelStack}>
                              <span className={styles.roleRowLabel}>{label}</span>
                              <span className={styles.roleRowNote}>{isPicked ? "Added ✓" : `${left} left`}</span>
                            </span>
                            <span className={styles.roleRowPrice}>{formatEuros(priceCents)}</span>
                          </button>
                        );
                      };

                      return (
                        <div key={slot.id} id={slot.id} className={line ? styles.sessionCardChosen : styles.sessionCard}>
                          <div className={styles.sessionTime}>{formatTime(slot.startTime)}</div>
                          <div className={styles.sessionLevel}>{slot.label}</div>
                          {slot.capacity.goalie === 0 && <div className={styles.skatersOnly}>Skaters only</div>}
                          <div className={styles.roleRowGroup}>
                            {roleRow("skater", skLeft)}
                            {slot.capacity.goalie > 0 && roleRow("goalie", glLeft)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {paid ? (
          <div className={styles.confirmedBanner}>
            <p className={styles.confirmedTitle}>You&rsquo;re confirmed.</p>
            <p className={styles.confirmedLine}>
              Confirmed: {heldEntries.length === 0 ? "nothing" : heldEntries.map(([slotId, l]) => pickShortLabel(slotId, l.position)).join(", ")}.
            </p>
          </div>
        ) : (
          <div className={styles.stickyBar}>
            <div className={styles.stickyInfo}>
              <div className={styles.stickyCount}>{pickCount}</div>
              <div className={styles.stickySummary}>{pickSummary}</div>
            </div>
            {heldEntries.length > 0 && (
              <button type="button" onClick={() => setBasket({})} className={styles.stickyClear}>
                Clear
              </button>
            )}
            <div className={styles.stickyRight}>
              <span className={styles.holdNote}>Held {HOLD_MINUTES} min while you pay</span>
              <div className={styles.stickyTotalWrap}>
                <div className={styles.stickyTotal} style={{ color: heldEntries.length === 0 ? "var(--muted-foreground)" : "var(--foreground)" }}>
                  {heldEntries.length === 0 ? "—" : formatEuros(total)}
                </div>
                <div className={styles.stickyTotalLabel}>Season total</div>
              </div>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setPaid(true)}
                className={canContinue ? styles.continueBtnActive : styles.continueBtnDisabled}
              >
                Hold &amp; continue →
              </button>
            </div>
          </div>
        )}

        <p className={styles.footnote}>
          Payment is iDEAL or Wero — we never ask for card details. Can&rsquo;t commit to a whole summer?{" "}
          <Link href="/drop-ins">Drop in on an open night →</Link>
        </p>

        {paid && (
          <div>
            <Link href="/" className={shared.btnPrimary}>
              Back to home
            </Link>
          </div>
        )}
      </div>

      {/* Gains a real footer here for the first time — the previous
          version of this page had none at all; Register.dc.html's own
          markup includes the standard Schedule/Contact/Privacy one every
          other page already has, closing what reads like a gap rather
          than a deliberate omission. */}
      <ThemeToggle />
      <SiteFooter />
    </div>
  );
}
