"use client";

// Drop-ins — restyled from the "Summer Ice Landing" Claude Design
// project's design_handoff_season_dropins bundle (Drop-ins.dc.html). New
// route, but the underlying data is this repo's existing fake-data
// session model (sessionDetail(), same one the roster/admin pages already
// use), not a new mechanism — see docs/DOMAIN-MODEL.md §9.
//
// This page's counts are session-level (this week's open spots, decline-
// freed spots included) rather than the season-level useLiveFill the
// landing page's pre-season list uses — those are genuinely different
// numbers, and only season fill has a live broadcast wired up yet
// (extras claiming / attendance is phase 3, still unbuilt — see
// docs/DOMAIN-MODEL.md §13). Selecting, checking out and "paying" are
// therefore local component state with no backend call, the same
// no-backend-yet treatment register-client.tsx already established for
// its own basket/hold flow.
import Link from "next/link";
import { useState } from "react";
import {
  type Position,
  LEVEL_FILTERS,
  SLOTS,
  TODAY,
  formatDateRange,
  formatEuros,
  formatTime,
  sessionDetail,
  slotMatchesLevelFilter,
  weekOpenSpotsTotals,
} from "~/lib/fake-data";
import { GoogleSignInButton } from "../google-signin-button";
import { SiteFooter } from "../site-footer";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import shared from "../page.module.css";
import styles from "./drop-ins.module.css";

type RoleFilter = "any" | Position;

interface Pick {
  role: Position;
  priceCents: number;
}

const WEEK_COLUMNS: { weekday: number; label: string }[] = [
  { weekday: 2, label: "Tue" },
  { weekday: 3, label: "Wed" },
  { weekday: 4, label: "Thu" },
  { weekday: 5, label: "Fri" },
  { weekday: 6, label: "Sat" },
  { weekday: 0, label: "Sun" },
];

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function DropInsClient() {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("any");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState<Record<string, boolean>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paid, setPaid] = useState(false);

  const allDetails = SLOTS.map((slot) => ({ slot, detail: sessionDetail(slot.id)! }));
  const weekTotals = weekOpenSpotsTotals();
  const dates = allDetails.map(({ detail }) => detail.session.date);
  const weekStart = dates.reduce((a, b) => (b < a ? b : a));
  const weekEnd = dates.reduce((a, b) => (b > a ? b : a));

  function togglePick(slotId: string, role: Position, priceCents: number) {
    setPicks((prev) => {
      const existing = prev[slotId];
      if (existing && existing.role === role) {
        const next = { ...prev };
        delete next[slotId];
        return next;
      }
      // One role per ice hour: picking the other role on an already-picked
      // slot replaces it, it doesn't add a second line.
      return { ...prev, [slotId]: { role, priceCents } };
    });
  }

  function toggleWaitlist(slotId: string) {
    setWaitlisted((prev) => ({ ...prev, [slotId]: !prev[slotId] }));
  }

  function matchesFilters(slotId: string): boolean {
    const { slot, detail } = allDetails.find((d) => d.slot.id === slotId)!;
    if (levelFilter && !slotMatchesLevelFilter(slot, levelFilter)) return false;
    if (roleFilter === "skater" && detail.openSpots.skater === 0) return false;
    if (roleFilter === "goalie" && detail.openSpots.goalie === 0) return false;
    return true;
  }

  const pickEntries = Object.entries(picks);
  const total = pickEntries.reduce((sum, [, p]) => sum + p.priceCents, 0);
  const filtersActive = roleFilter !== "any" || levelFilter !== null;

  function pickShortLabel(slotId: string): string {
    const { slot } = allDetails.find((d) => d.slot.id === slotId)!;
    return `${slot.weekdayLabel.slice(0, 3)} ${formatTime(slot.startTime)}`;
  }

  const pickSummary = pickEntries.length === 0 ? "Tap a spot above to add it" : pickEntries.map(([slotId]) => pickShortLabel(slotId)).join(" · ");
  const pickCount = pickEntries.length === 0 ? "Nothing selected yet" : `${pluralize(pickEntries.length, "spot")} selected`;
  const checkoutCtaLabel = total === 0 && pickEntries.length > 0 ? "Confirm →" : "Claim & pay →";

  function completeCheckout() {
    setPaid(true);
    setCheckoutOpen(false);
  }

  return (
    <>
      <div className={shared.page}>
        <SiteNav />

        <div className={styles.header}>
          <div className={styles.headerInner}>
            <div>
              <div className={styles.headerEyebrowRow}>
                <span className={styles.headerDot} />
                <span className={styles.headerEyebrow}>Open now · {formatDateRange(weekStart, weekEnd)}</span>
              </div>
              <h1 className={styles.headerTitle}>Spots open this week</h1>
            </div>
            <div className={styles.headerCounts}>
              <div className={styles.headerCountsNum}>
                {weekTotals.skater} skater · {weekTotals.goalie} goalie
              </div>
              <div className={styles.headerCountsLabel}>Spots left · €15, goalies free</div>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <p className={styles.blurb}>
            These are spots that players with a season night couldn&rsquo;t make this week. Take as many as you
            like — one night or all six — and pay for the lot in one go. <strong>€15 a night for skaters, free
            for goalies.</strong>
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

          <div className={styles.calendarScroll}>
            <div className={styles.calendarPanel}>
              {WEEK_COLUMNS.map((col) => {
                const daySlots = allDetails.filter(({ slot }) => slot.weekday === col.weekday);
                const isToday = daySlots.some(({ detail }) => isSameDay(detail.session.date, TODAY));
                const date = daySlots[0]?.detail.session.date;
                const visible = daySlots.filter(({ slot }) => matchesFilters(slot.id));

                return (
                  <div key={col.weekday} className={styles.dayCol}>
                    <div className={isToday ? styles.dayColHeadToday : styles.dayColHead}>
                      <span className={styles.dayColLabel}>{col.label}</span>
                      {date && (
                        <span className={styles.dayColDate}>
                          {date.getDate()} {date.toLocaleDateString("en-GB", { month: "short" })}
                        </span>
                      )}
                      {isToday && <span className={styles.todayPill}>Today</span>}
                    </div>

                    {visible.length === 0 ? (
                      <div className={styles.dayEmpty}>
                        <span className={styles.dayEmptyText}>{filtersActive ? "Nothing matching" : "No ice"}</span>
                      </div>
                    ) : (
                      visible.map(({ slot, detail }) => {
                        const skLeft = detail.openSpots.skater;
                        const glLeft = detail.openSpots.goalie;
                        const hasRoom = skLeft > 0 || glLeft > 0;
                        const cardIsToday = isSameDay(detail.session.date, TODAY);

                        if (!hasRoom) {
                          const alerted = waitlisted[slot.id] ?? false;
                          return (
                            <div key={slot.id} id={slot.id} className={styles.sessionCardFull}>
                              <div className={styles.sessionTimeFull}>{formatTime(slot.startTime)}</div>
                              <div className={styles.sessionLevelFull}>{slot.label}</div>
                              <div className={styles.fullFooter}>
                                <span className={styles.fullLabel}>Full</span>
                                <button
                                  type="button"
                                  onClick={() => toggleWaitlist(slot.id)}
                                  className={alerted ? styles.waitlistBtnActive : styles.waitlistBtn}
                                >
                                  {alerted ? "On the waitlist ✓" : "Join the waitlist"}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        const picked = picks[slot.id];
                        const roleRow = (role: Position, left: number) => {
                          const isPicked = picked?.role === role;
                          const label = role === "skater" ? "Skater" : "Goalie";
                          const priceCents = slot.price[role].extrasCents;
                          if (left === 0) {
                            return (
                              <div key={role} className={styles.roleRowBlocked}>
                                <span className={styles.roleRowLabel}>{label}</span>
                                <span className={styles.roleRowNote}>Full</span>
                              </div>
                            );
                          }
                          const cls = isPicked ? styles.roleRowSelected : left >= 3 ? styles.roleRowGreen : styles.roleRowAmber;
                          return (
                            <button key={role} type="button" onClick={() => togglePick(slot.id, role, priceCents)} className={cls}>
                              <span className={styles.roleRowLabel}>{label}</span>
                              <span className={styles.roleRowNote}>{isPicked ? "✓" : `${left} left`}</span>
                            </button>
                          );
                        };

                        return (
                          <div key={slot.id} id={slot.id} className={cardIsToday ? styles.sessionCardToday : styles.sessionCard}>
                            <div className={styles.sessionTime}>{formatTime(slot.startTime)}</div>
                            <div className={styles.sessionLevel}>{slot.label}</div>
                            <div className={styles.roleRowGroup}>
                              {roleRow("skater", skLeft)}
                              {roleRow("goalie", glLeft)}
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
                Claimed: {pickEntries.map(([slotId, p]) => `${pickShortLabel(slotId)} (${p.role})`).join(", ")}.
              </p>
            </div>
          ) : (
            <div className={styles.checkoutBar}>
              <div className={styles.checkoutInfo}>
                <div className={styles.checkoutCount}>{pickCount}</div>
                <div className={styles.checkoutSummary}>{pickSummary}</div>
              </div>
              {pickEntries.length > 0 && (
                <button type="button" onClick={() => setPicks({})} className={styles.checkoutClear}>
                  Clear
                </button>
              )}
              <div className={styles.checkoutRight}>
                <div className={styles.checkoutTotalWrap}>
                  <div className={styles.checkoutTotal} style={{ color: pickEntries.length === 0 ? "var(--muted-foreground)" : "var(--foreground)" }}>
                    {pickEntries.length === 0 ? "—" : total === 0 ? "Free" : formatEuros(total)}
                  </div>
                  <div className={styles.checkoutTotalLabel}>Total</div>
                </div>
                <button
                  type="button"
                  disabled={pickEntries.length === 0}
                  onClick={() => setCheckoutOpen(true)}
                  className={pickEntries.length === 0 ? styles.checkoutCtaDisabled : styles.checkoutCtaActive}
                >
                  {checkoutCtaLabel}
                </button>
              </div>
            </div>
          )}

          <p className={styles.footnote}>
            Taking a spot every week instead? A season night holds it for you automatically — see{" "}
            <Link href="/register">registering for the season</Link>.
          </p>
        </div>

        <ThemeToggle />
        <SiteFooter />
      </div>

      {checkoutOpen && pickEntries.length > 0 && (
        // Overlay, deliberately a sibling of .page rather than nested
        // inside it — position:fixed with inset:0 already covers the
        // whole viewport regardless, and keeping it outside means it's
        // never affected by .page's own flex layout.
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalEyebrow}>Claiming</div>
                <div className={styles.modalTitle}>{pickCount}</div>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} className={styles.modalClose} aria-label="Close">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalPicksList}>
                {pickEntries.map(([slotId, p]) => {
                  const { slot, detail } = allDetails.find((d) => d.slot.id === slotId)!;
                  return (
                    <div key={slotId} className={styles.modalPickRow}>
                      <span className={styles.modalPickWhen}>
                        {slot.weekdayLabel.slice(0, 3)} {detail.session.date.getDate()} · {formatTime(slot.startTime)}
                      </span>
                      <span className={styles.modalPickLevel}>{slot.label}</span>
                      <span className={styles.modalPickRole}>{p.role === "skater" ? "Skater" : "Goalie"}</span>
                      <span className={styles.modalPickPrice}>{p.priceCents === 0 ? "Free" : formatEuros(p.priceCents)}</span>
                    </div>
                  );
                })}
                <div className={styles.modalTotalRow}>
                  <span className={styles.modalTotalLabel}>Total</span>
                  <span className={styles.modalTotalValue}>{total === 0 ? "Free" : formatEuros(total)}</span>
                </div>
              </div>

              <div className={styles.modalAccountSection}>
                <div className={styles.modalAccountLabel}>Your account</div>
                <div className={styles.modalAccountFields}>
                  <GoogleSignInButton className={styles.modalGoogleBtn} />
                  <input type="email" placeholder="you@example.com" className={styles.modalInput} />
                  <input type="password" placeholder="Password" className={styles.modalInput} />
                </div>
              </div>

              <div className={styles.modalFooterRow}>
                <p className={styles.modalFinePrint}>
                  {total === 0
                    ? "Goalie spots are free — confirming holds them straight away."
                    : "You’ll be sent to your bank. Spots are yours the moment payment clears."}
                </p>
                <button type="button" onClick={completeCheckout} className={styles.modalPayBtn}>
                  {total === 0 ? "Confirm my spots →" : `Pay ${formatEuros(total)} via iDEAL →`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
