"use client";

// One "ten hours" row on the homepage. Renders with the server-fetched
// fill immediately, then layers live updates on top via useLiveFill — see
// docs/DOMAIN-MODEL.md §9 and app/lib/use-live-fill.ts.
import Link from "next/link";
import { useMemo } from "react";
import { useLiveFill } from "~/lib/use-live-fill";

export interface HomepageSlot {
  slotId: string;
  weekdayLabel: string;
  startTime: string; // "HH:MM:SS"
  endTime: string;
  label: string;
  skater: { capacity: number; taken: number };
  goalie: { capacity: number; taken: number };
  nextSession: { id: string; startAt: Date } | null;
}

function formatTimeString(t: string): string {
  return t.slice(0, 5);
}

export function SlotFillRow({ slot }: { slot: HomepageSlot }) {
  // useLiveFill's reset logic keys off this object's identity — a fresh
  // literal on every render would either fight the live broadcast value or,
  // when the object also changed slotId, loop. Memoize it so it only
  // changes identity when slot.skater/slot.goalie themselves do.
  const initialFill = useMemo(() => ({ skater: slot.skater, goalie: slot.goalie }), [slot.skater, slot.goalie]);
  const fill = useLiveFill(slot.slotId, initialFill);

  const skaterFull = fill.skater.taken >= fill.skater.capacity;
  const goalieFull = fill.goalie.taken >= fill.goalie.capacity;
  // Both positions full before the whole slot reads "Full" — a slot with
  // room left for one position isn't a dead end, it's a different link.
  const isFull = skaterFull && goalieFull;

  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-medium text-gray-950 dark:text-white">
          {slot.weekdayLabel} {formatTimeString(slot.startTime)}–{formatTimeString(slot.endTime)}
          {" · "}
          <span className="font-normal text-gray-600 dark:text-gray-400">{slot.label}</span>
          {slot.nextSession && (
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
              next{" "}
              {slot.nextSession.startAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className={skaterFull ? "font-semibold text-amber-700 dark:text-amber-500" : undefined}>
            {fill.skater.taken}/{fill.skater.capacity} skaters
          </span>
          {" · "}
          {/* Goalie deficit reads more alarming than skater deficit, per
              DOMAIN-MODEL §9 — any shortfall at all is red, not just full. */}
          <span
            className={
              goalieFull
                ? "font-semibold text-red-700 dark:text-red-500"
                : fill.goalie.taken < fill.goalie.capacity
                  ? "text-red-600 dark:text-red-400"
                  : undefined
            }
          >
            {fill.goalie.taken}/{fill.goalie.capacity} goalies
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">
        {isFull ? (
          <Link
            href="/register"
            className="text-sm font-medium text-gray-700 underline hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
          >
            Full — join waitlist
          </Link>
        ) : (
          <Link
            href="/register"
            className="text-sm font-medium text-gray-700 underline hover:text-gray-950 dark:text-gray-300 dark:hover:text-white"
          >
            Register
          </Link>
        )}
      </div>
    </li>
  );
}
