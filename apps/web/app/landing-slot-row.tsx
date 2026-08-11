"use client";

// The landing page's pre-season schedule row (seasonPhase() === "before")
// — a plain link-row, not a row-with-a-button: the whole row links to
// /register, matching design_handoff_season_dropins's simpler pre-season
// list. Live-fill wiring (useLiveFill) is this repo's own wave-2 logic,
// kept and restyled rather than dropped — the design's own JS used a
// static seed array with no live depletion, which would have thrown away
// the one thing this hook exists to demonstrate. See docs/DOMAIN-MODEL.md
// §9 and app/lib/use-live-fill.ts.
import Link from "next/link";
import { useMemo } from "react";
import { useLiveFill } from "~/lib/use-live-fill";
import styles from "./page.module.css";

export interface LandingSlot {
  slotId: string;
  weekdayLabel: string;
  startTime: string; // "HH:MM:SS"
  label: string;
  skater: { capacity: number; taken: number };
  goalie: { capacity: number; taken: number };
}

function formatTimeString(t: string): string {
  return t.slice(0, 5);
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function LandingSlotRow({ slot }: { slot: LandingSlot }) {
  const initialFill = useMemo(() => ({ skater: slot.skater, goalie: slot.goalie }), [slot.skater, slot.goalie]);
  const fill = useLiveFill(slot.slotId, initialFill);

  const skLeft = Math.max(0, fill.skater.capacity - fill.skater.taken);
  const glLeft = Math.max(0, fill.goalie.capacity - fill.goalie.taken);
  const isFull = skLeft === 0 && glLeft === 0;

  if (isFull) {
    return (
      <div className={styles.scheduleListRowFull}>
        <span className={styles.scheduleListDayTime} style={{ opacity: 0.5 }}>
          <span className={styles.scheduleListDay}>{slot.weekdayLabel.slice(0, 3)}</span>
          <span className={styles.scheduleListTime}>{formatTimeString(slot.startTime)}</span>
        </span>
        <span className={styles.scheduleListLevel} style={{ opacity: 0.5 }}>
          {slot.label}
        </span>
        <span className={styles.fullBadge}>Full</span>
      </div>
    );
  }

  // Same non-distinguishing "goalies full" wording the source design uses
  // for a genuinely zero-capacity slot (Wednesday Skills Training, D12) —
  // not a special case introduced here. Register's grid is the one place
  // that spells out "SKATERS ONLY" instead, per the handoff's own §3.
  const label =
    skLeft > 0 && glLeft > 0
      ? `${pluralize(skLeft, "skater")} · ${pluralize(glLeft, "goalie")} left`
      : skLeft > 0
        ? `${pluralize(skLeft, "skater")} left · goalies full`
        : `${pluralize(glLeft, "goalie")} left · skaters full`;

  return (
    <Link href={`/register#${slot.slotId}`} className={styles.scheduleListRow}>
      <span className={styles.scheduleListDayTime}>
        <span className={styles.scheduleListDay}>{slot.weekdayLabel.slice(0, 3)}</span>
        <span className={styles.scheduleListTime}>{formatTimeString(slot.startTime)}</span>
      </span>
      <span className={styles.scheduleListLevel}>{slot.label}</span>
      <span className={styles.scheduleListLabel} style={{ color: skLeft <= 2 ? "var(--sun-text-on-lo)" : "var(--foreground)" }}>
        {label}
      </span>
    </Link>
  );
}
