"use client";

// Restyled from the "Summer Ice Landing" Claude Design project's
// Register.dc.html — see docs/DECISIONS.md for the full account. The
// underlying model (fake-data-backed availability, holds with a real
// countdown, waitlisting with a queue position, the "simulate another
// player" contention demo) is this repo's own wave-1 logic, carried over
// and restyled rather than rebuilt — the design's own JS used a static
// seed array with no live depletion, which would have thrown away the one
// thing this page exists to demonstrate.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type Position,
  type Slot,
  SLOTS,
  WAITLISTS,
  formatEuros,
  formatTime,
  seasonFill,
} from "~/lib/fake-data";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import shared from "../page.module.css";
import styles from "./register.module.css";

const HOLD_MINUTES = 10;
const SIMULATED_SLOT_ID = "fri-2130";
const SIMULATED_POSITION: Position = "skater";

type Play = Position | "both";

interface BasketLine {
  position: Position;
  kind: "held" | "waitlisted";
  holdExpiresAt: number | null; // ms epoch; null for waitlisted lines
  priceCents: number;
}

function extraKey(slotId: string, position: Position): string {
  return `${slotId}:${position}`;
}

export function RegisterClient() {
  const [play, setPlay] = useState<Play>("skater");
  const [perSlotRole, setPerSlotRole] = useState<Record<string, Position>>({});
  const [basket, setBasket] = useState<Record<string, BasketLine>>({});
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

  // Lapsed holds fall out of the basket here, derived at render time
  // rather than by mutating state on every tick — re-adding after expiry
  // is just clicking "Add" again, so there's nothing to preserve.
  const liveBasket = useMemo(() => {
    const next: Record<string, BasketLine> = {};
    for (const [slotId, line] of Object.entries(basket)) {
      if (line.kind !== "held" || paid || (line.holdExpiresAt !== null && line.holdExpiresAt > now)) {
        next[slotId] = line;
      }
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
    const mine = line && line.kind === "held" && line.position === position ? 1 : 0;
    return takenByOthers(slotId, position) + mine;
  }

  function available(slot: Slot, position: Position): number {
    return Math.max(0, slot.capacity[position] - taken(slot.id, position));
  }

  function roomForOthers(slot: Slot, position: Position): number {
    return Math.max(0, slot.capacity[position] - takenByOthers(slot.id, position));
  }

  function roleFor(slot: Slot): Position {
    if (play !== "both") return play;
    const override = perSlotRole[slot.id];
    if (override) return override;
    return available(slot, "skater") > 0 ? "skater" : "goalie";
  }

  function setRole(slotId: string, position: Position) {
    setPerSlotRole((o) => ({ ...o, [slotId]: position }));
  }

  function addToBasket(slot: Slot, position: Position) {
    const room = available(slot, position);
    const line: BasketLine =
      room > 0
        ? {
            position,
            kind: "held",
            // react-hooks/purity flags any Date.now() call textually inside
            // a component's source, even here where it only ever runs
            // inside this onClick-triggered function — never during render.
            // eslint-disable-next-line react-hooks/purity
            holdExpiresAt: Date.now() + HOLD_MINUTES * 60 * 1000,
            priceCents: slot.price[position].seasonCents,
          }
        : { position, kind: "waitlisted", holdExpiresAt: null, priceCents: 0 };
    setBasket((b) => ({ ...b, [slot.id]: line }));
  }

  function removeFromBasket(slotId: string) {
    setBasket((b) => {
      const next = { ...b };
      delete next[slotId];
      return next;
    });
  }

  function simulateOtherPlayer() {
    const slot = SLOTS.find((s) => s.id === SIMULATED_SLOT_ID)!;
    if (roomForOthers(slot, SIMULATED_POSITION) <= 0) return;
    const k = extraKey(SIMULATED_SLOT_ID, SIMULATED_POSITION);
    setSimulatedExtra((extra) => ({ ...extra, [k]: (extra[k] ?? 0) + 1 }));
  }

  function waitlistQueuePosition(slotId: string, position: Position): number {
    return (WAITLISTS[slotId]?.filter((w) => w.position === position).length ?? 0) + 1;
  }

  const heldLines = Object.entries(liveBasket).filter(([, l]) => l.kind === "held");
  const waitlistedLines = Object.entries(liveBasket).filter(([, l]) => l.kind === "waitlisted");
  const staleSlotIds = heldLines
    .filter(([slotId, line]) => roomForOthers(SLOTS.find((s) => s.id === slotId)!, line.position) <= 0)
    .map(([slotId]) => slotId);
  const total = heldLines.reduce((sum, [, l]) => sum + l.priceCents, 0);
  const canContinue = heldLines.length > 0 && staleSlotIds.length === 0;

  const simulatedSlot = SLOTS.find((s) => s.id === SIMULATED_SLOT_ID)!;
  const simulatedRoom = roomForOthers(simulatedSlot, SIMULATED_POSITION);

  const summaryLine =
    staleSlotIds.length > 0
      ? staleSlotIds.length === 1
        ? "One slot needs fixing before you continue"
        : `${staleSlotIds.length} slots need fixing before you continue`
      : heldLines.length > 0
        ? heldLines
            .map(([slotId]) => {
              const slot = SLOTS.find((s) => s.id === slotId)!;
              return `${slot.weekdayLabel} ${formatTime(slot.startTime)}`;
            })
            .join(" · ")
        : "Add the nights you want to skate";

  return (
    <div className={shared.page}>
      <SiteNav active="register" />

      <div className={styles.headerBand}>
        <div className={styles.headerBandInner}>
          <div className={shared.eyebrow}>2026 season</div>
          <h1 className={styles.pageTitle}>Register</h1>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.sectionHead}>
          <div className={shared.eyebrow}>The weekly slots</div>
          <h2 className={styles.sectionTitle}>Add the nights you want to play.</h2>
        </div>

        <div className={styles.roleRow}>
          <span className={styles.roleLabel}>I play as a</span>
          <div className={styles.rolePills}>
            {(["skater", "goalie", "both"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPlay(option)}
                className={play === option ? styles.rolePillActive : styles.rolePill}
              >
                {option === "skater" ? "Skater" : option === "goalie" ? "Goalie" : "Both"}
              </button>
            ))}
          </div>
          <span className={styles.roleNote}>
            {play === "both"
              ? "Pick the position on each slot you add."
              : `Availability and prices below are for ${play === "goalie" ? "goalies" : "skaters"}.`}
          </span>
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

        <div className={styles.scheduleCard}>
          <div className={styles.scheduleHead}>
            <span className={styles.scheduleHeadCell}>Day / Start</span>
            <span className={styles.scheduleHeadCell}>Level</span>
            <span className={styles.scheduleHeadCell}>Availability</span>
            <span className={`${styles.scheduleHeadCell} ${styles.right}`}>Season</span>
            <span className={`${styles.scheduleHeadCell} ${styles.right}`}>Action</span>
          </div>

          {SLOTS.map((slot) => {
            const line = liveBasket[slot.id];
            const skLeft = available(slot, "skater");
            const glLeft = available(slot, "goalie");
            const allFull = skLeft === 0 && glLeft === 0;
            const waiting = WAITLISTS[slot.id]?.length ?? 0;

            if (line) {
              const isStale = staleSlotIds.includes(slot.id);
              const role = line.position;

              if (isStale) {
                return (
                  <div key={slot.id} className={styles.rowStale}>
                    <div>
                      <div className={styles.dayLabelStale}>{slot.weekdayLabel.slice(0, 3)}</div>
                      <div className={styles.timeValue}>{formatTime(slot.startTime)}</div>
                    </div>
                    <div className={styles.levelName}>{slot.label}</div>
                    <div className={styles.staleNote}>
                      {role === "goalie" ? "No goalie spots left" : "No skater spots left"}
                    </div>
                    <div className={styles.cellPriceMuted}>—</div>
                    <div className={styles.cellAction}>
                      <button type="button" onClick={() => removeFromBasket(slot.id)} className={styles.removeBtnDestructive}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              }

              const showPicker = play === "both" && line.kind === "held";
              return (
                <div key={slot.id} className={styles.rowChosen}>
                  <div>
                    <div className={styles.dayLabelActive}>{slot.weekdayLabel.slice(0, 3)}</div>
                    <div className={styles.timeValue}>{formatTime(slot.startTime)}</div>
                  </div>
                  <div>
                    <div className={styles.levelName}>{slot.label}</div>
                    {showPicker && (
                      <div className={styles.roleChipRow}>
                        {role === "skater" ? (
                          <span className={styles.roleChipActive}>Skater</span>
                        ) : skLeft > 0 ? (
                          <button type="button" onClick={() => setRole(slot.id, "skater")} className={styles.roleChip}>
                            Skater
                          </button>
                        ) : null}
                        {role === "goalie" ? (
                          <span className={styles.roleChipActive}>Goalie</span>
                        ) : glLeft > 0 ? (
                          <button type="button" onClick={() => setRole(slot.id, "goalie")} className={styles.roleChip}>
                            Goalie
                          </button>
                        ) : (
                          <span className={styles.roleChipDisabled}>Goalie · full</span>
                        )}
                      </div>
                    )}
                  </div>
                  {line.kind === "held" ? (
                    <div className={styles.addedRow}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.6 6.7 5.1 9.2 10.4 3.8" />
                      </svg>
                      <span>Added as {role}</span>
                    </div>
                  ) : (
                    <div className={styles.addedRowWaitlisted}>
                      #{waitlistQueuePosition(slot.id, role)} in line
                    </div>
                  )}
                  <div className={styles.cellPrice}>
                    {line.kind === "held" ? formatEuros(slot.price[role].seasonCents) : "Free"}
                  </div>
                  <div className={styles.cellAction}>
                    {!paid && (
                      <button type="button" onClick={() => removeFromBasket(slot.id)} className={styles.removeBtn}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            if (allFull) {
              return (
                <div key={slot.id} className={styles.rowBlocked}>
                  <div style={{ opacity: 0.44 }}>
                    <div className={styles.dayLabel}>{slot.weekdayLabel.slice(0, 3)}</div>
                    <div className={styles.timeValue}>{formatTime(slot.startTime)}</div>
                  </div>
                  <div className={styles.levelName} style={{ opacity: 0.44 }}>
                    {slot.label}
                  </div>
                  <div>
                    <span className={styles.blockedBadge}>{waiting > 0 ? `Full · ${waiting} waiting` : "Full"}</span>
                  </div>
                  <div className={styles.cellPriceMuted}>{formatEuros(slot.price[roleFor(slot)].seasonCents)}</div>
                  <div className={styles.cellAction}>
                    <button type="button" onClick={() => addToBasket(slot, roleFor(slot))} className={styles.waitlistBtn}>
                      Waitlist →
                    </button>
                  </div>
                </div>
              );
            }

            const role = roleFor(slot);
            const mine = available(slot, role);
            if (mine <= 0) {
              // The role I'm currently set to play has no room, but the
              // slot as a whole isn't full (the other position does).
              return (
                <div key={slot.id} className={styles.rowBlocked}>
                  <div style={{ opacity: 0.5 }}>
                    <div className={styles.dayLabel}>{slot.weekdayLabel.slice(0, 3)}</div>
                    <div className={styles.timeValue}>{formatTime(slot.startTime)}</div>
                  </div>
                  <div className={styles.levelName} style={{ opacity: 0.5 }}>
                    {slot.label}
                  </div>
                  <div>
                    <span className={styles.blockedBadge}>Full</span>
                  </div>
                  <div className={styles.cellPriceMuted}>{formatEuros(slot.price[role].seasonCents)}</div>
                  <div className={styles.cellAction}>
                    <button type="button" onClick={() => addToBasket(slot, role)} className={styles.waitlistBtn}>
                      Waitlist →
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={slot.id} className={styles.row}>
                <div>
                  <div className={styles.dayLabel}>{slot.weekdayLabel.slice(0, 3)}</div>
                  <div className={styles.timeValue}>{formatTime(slot.startTime)}</div>
                </div>
                <div className={styles.levelName}>{slot.label}</div>
                <div className={styles.cellAvailability}>
                  <span
                    className={styles.availabilityDot}
                    style={{ background: mine <= 3 ? "var(--sun)" : "var(--green)" }}
                  />
                  <span className={styles.availabilityText}>
                    {play === "both"
                      ? `${skLeft} skater · ${glLeft} goalie`
                      : `${mine} spot${mine === 1 ? "" : "s"} left`}
                  </span>
                </div>
                <div className={styles.cellPrice}>{formatEuros(slot.price[role].seasonCents)}</div>
                <div className={styles.cellAction}>
                  <button type="button" onClick={() => addToBasket(slot, role)} className={styles.addBtn}>
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className={styles.footnote}>
          Prices are per slot, for the whole season. Payment is by iDEAL or Wero — we never ask for card details.
        </p>

        {paid && (
          <div className={styles.confirmedBanner}>
            <p className={styles.confirmedTitle}>You&rsquo;re confirmed.</p>
            <p className={styles.confirmedLine}>
              Confirmed:{" "}
              {heldLines.length === 0
                ? "nothing"
                : heldLines
                    .map(([slotId, l]) => {
                      const slot = SLOTS.find((s) => s.id === slotId)!;
                      return `${slot.weekdayLabel} ${formatTime(slot.startTime)} (${l.position})`;
                    })
                    .join(", ")}
              .
            </p>
            {waitlistedLines.length > 0 && (
              <p className={styles.confirmedLine}>
                Still waitlisted:{" "}
                {waitlistedLines
                  .map(([slotId, l]) => {
                    const slot = SLOTS.find((s) => s.id === slotId)!;
                    return `${slot.weekdayLabel} ${formatTime(slot.startTime)} (${l.position}, #${waitlistQueuePosition(slotId, l.position)})`;
                  })
                  .join(", ")}
                .
              </p>
            )}
          </div>
        )}
      </div>

      {!paid && (
        <div className={styles.stickyBar}>
          <div className={styles.stickyInner}>
            <div style={{ minWidth: 0 }}>
              <div className={styles.stickyTotals}>
                <span className={styles.stickyTotal}>{formatEuros(total)}</span>
                <span className={styles.stickyCount}>
                  {heldLines.length === 1 ? "1 slot" : `${heldLines.length} slots`}
                </span>
              </div>
              <div className={styles.stickySummary}>{summaryLine}</div>
            </div>
            <div className={styles.stickyRight}>
              <span className={styles.holdNote}>Held for {HOLD_MINUTES} minutes while you pay</span>
              {canContinue ? (
                <button type="button" onClick={() => setPaid(true)} className={styles.continueBtn}>
                  Hold &amp; continue →
                </button>
              ) : (
                <button type="button" disabled className={styles.continueBtnDisabled}>
                  Continue →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {paid && (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 28px 40px" }}>
          <Link href="/" className={shared.btnPrimary}>
            Back to home
          </Link>
        </div>
      )}

      {/* Clears the fixed checkout bar below while it's showing (confirmed
          by an actual click test — the bar intercepts pointer events at
          the default position); once paid, the bar is gone and the
          toggle drops back to the same spot every other page uses. */}
      <ThemeToggle offsetBottom={paid ? undefined : 100} />
    </div>
  );
}
