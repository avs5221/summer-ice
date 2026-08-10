"use client";

import { useState } from "react";
import {
  CURRENT_PLAYER_NAME,
  CURRENT_PLAYER_REGISTRATIONS,
  TODAY,
  type AttendanceStatus,
  formatDate,
  formatDateTime,
  slotById,
} from "~/lib/fake-data";

function statusLabel(status: AttendanceStatus): string {
  if (status === "attending") return "Playing";
  if (status === "not_attending") return "Not playing";
  return "No reply yet";
}

function statusClass(status: AttendanceStatus): string {
  if (status === "attending") return "text-green-700 dark:text-green-400";
  if (status === "not_attending") return "text-gray-500 dark:text-gray-500";
  return "font-medium text-amber-700 dark:text-amber-500";
}

export function ScheduleClient() {
  // Local overrides layered on top of the fake-data answers — confirming or
  // declining here only changes what this page renders, per the brief.
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({});

  function rowKey(slotId: string, dateIso: string): string {
    return `${slotId}:${dateIso}`;
  }

  function answer(slotId: string, dateIso: string, status: AttendanceStatus) {
    setOverrides((o) => ({ ...o, [rowKey(slotId, dateIso)]: status }));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-950 dark:text-white">My schedule</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{CURRENT_PLAYER_NAME}</p>

      {CURRENT_PLAYER_REGISTRATIONS.map((reg) => {
        const slot = slotById(reg.slotId)!;
        return (
          <section key={reg.slotId} className="mt-8">
            <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
              {slot.weekdayLabel} {slot.label} · <span className="capitalize">{reg.position}</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {reg.dates.length} dated sessions this season.
            </p>

            <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
              {reg.dates.map((d) => {
                const dateIso = d.date.toISOString();
                const status = overrides[rowKey(reg.slotId, dateIso)] ?? d.status;
                const isPast = d.startAt < TODAY;
                const needsReply = status === "unknown";

                return (
                  <li key={dateIso} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <span className="text-gray-950 dark:text-white">{formatDate(d.date)}</span>
                      {" — "}
                      <span className={statusClass(status)}>{statusLabel(status)}</span>
                      {needsReply && (
                        <span className="ml-2 text-gray-500 dark:text-gray-400">
                          Respond by {formatDateTime(d.releaseAt)}
                        </span>
                      )}
                    </div>
                    {needsReply && !isPast && (
                      <div className="flex gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => answer(reg.slotId, dateIso, "attending")}
                          className="rounded border border-green-600 px-2 py-1 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => answer(reg.slotId, dateIso, "not_attending")}
                          className="rounded border border-gray-400 px-2 py-1 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-900"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
