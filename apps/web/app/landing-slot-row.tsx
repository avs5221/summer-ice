"use client";

// One schedule-table row on the landing page. Renders with the
// server-fetched fill immediately, then layers live updates on top via
// useLiveFill — see docs/DOMAIN-MODEL.md §9 and app/lib/use-live-fill.ts.
// Visually this is the "Summer Ice Landing" design's schedule table row
// (open vs. full variants); the live-fill wiring is the same mechanism
// slot-fill-row.tsx used on the old plain homepage.
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

export function LandingSlotRow({ slot }: { slot: LandingSlot }) {
  const initialFill = useMemo(() => ({ skater: slot.skater, goalie: slot.goalie }), [slot.skater, slot.goalie]);
  const fill = useLiveFill(slot.slotId, initialFill);

  const skLeft = Math.max(0, fill.skater.capacity - fill.skater.taken);
  const glLeft = Math.max(0, fill.goalie.capacity - fill.goalie.taken);
  const isFull = skLeft === 0 && glLeft === 0;

  if (isFull) {
    return (
      <div className={`${styles.row} ${styles.rowFull}`}>
        <div className={styles.cellDay}>
          <div className={styles.dayLabel}>{slot.weekdayLabel.slice(0, 3)}</div>
          <div className={styles.timeValue}>{formatTimeString(slot.startTime)}</div>
        </div>
        <div className={styles.cellLevel}>
          <div className={styles.levelName}>{slot.label}</div>
        </div>
        <div>
          <span className={styles.fullBadge}>Full</span>
        </div>
        <div className={styles.cellAction}>
          <Link href="/register" className={styles.waitlistBtn}>
            Join reserves →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.cellDay}>
        <div className={styles.dayLabel}>{slot.weekdayLabel.slice(0, 3)}</div>
        <div className={styles.timeValue}>{formatTimeString(slot.startTime)}</div>
      </div>
      <div className={styles.cellLevel}>
        <div className={styles.levelName}>{slot.label}</div>
      </div>
      <div className={styles.cellCounts}>
        <div className={styles.skCount}>
          <strong>{skLeft}</strong> {skLeft === 1 ? "skater" : "skaters"}
        </div>
        <div className={glLeft > 0 ? styles.glCount : styles.glCountRed}>
          <strong>{glLeft}</strong> {glLeft === 1 ? "goalie" : "goalies"}
        </div>
      </div>
      <div className={styles.cellAction}>
        <Link href="/register" className={styles.claimBtn}>
          Season spot →
        </Link>
      </div>
    </div>
  );
}
