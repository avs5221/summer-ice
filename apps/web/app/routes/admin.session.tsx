import { Link } from "react-router";
import type { Route } from "./+types/admin.session";
import {
  type AttendanceStatus,
  type RosterEntry,
  formatDate,
  formatDateTime,
  formatTime,
  sessionDetail,
} from "~/lib/fake-data";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Session — Admin — Summer Ice" }];
  return [{ title: `${loaderData.slot.weekdayLabel} ${formatTime(loaderData.slot.startTime)} — Admin — Summer Ice` }];
}

export function loader({ params }: Route.LoaderArgs) {
  const detail = params.id ? sessionDetail(params.id) : undefined;
  if (!detail) throw new Response("Session not found", { status: 404 });
  return detail;
}

function statusLabel(status: AttendanceStatus): string {
  if (status === "attending") return "Playing";
  if (status === "not_attending") return "Not playing";
  return "No reply";
}

function statusBadgeClass(status: AttendanceStatus): string {
  if (status === "attending") return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (status === "not_attending") return "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
}

function RosterList({ entries }: { entries: RosterEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-2 text-sm text-gray-500 dark:text-gray-400">Nobody registered.</p>;
  }
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
      {entries.map((entry) => (
        <li key={entry.name} className="flex items-center justify-between py-2">
          <span className="text-gray-950 dark:text-white">{entry.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(entry.status)}`}>
            {statusLabel(entry.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminSession({ loaderData }: Route.ComponentProps) {
  const { slot, session, openSpots, claims } = loaderData;
  const goalieUrgent = session.goalies.length === 0 || openSpots.goalie >= slot.capacity.goalie;

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <Link to="/admin" className="text-sm text-gray-500 underline hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
        ← Overview
      </Link>

      <h1 className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
        {slot.weekdayLabel} {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">{slot.label}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(session.date)}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
        Unanswered spots release at {formatDateTime(session.releaseAt)}.
      </p>

      <div className="mt-4 flex gap-2">
        <div className="flex-1 rounded border border-gray-200 p-3 text-center dark:border-gray-800">
          <div className="text-2xl font-bold text-gray-950 dark:text-white">
            {session.skaters.length}/{slot.capacity.skater}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">skaters</div>
        </div>
        <div
          className={`flex-1 rounded border p-3 text-center ${
            goalieUrgent
              ? "border-red-600 bg-red-100 dark:border-red-500 dark:bg-red-950"
              : "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
          }`}
        >
          <div className={`text-2xl font-bold ${goalieUrgent ? "text-red-900 dark:text-red-200" : "text-amber-900 dark:text-amber-200"}`}>
            {goalieUrgent && "⚠ "}
            {session.goalies.length}/{slot.capacity.goalie}
          </div>
          <div className={`text-xs ${goalieUrgent ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
            goalies
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Skaters
        </h2>
        <RosterList entries={session.skaters} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Goalies
        </h2>
        <RosterList entries={session.goalies} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Open spots
        </h2>
        <ul className="mt-1 space-y-1 text-sm">
          <li className="text-gray-800 dark:text-gray-200">{openSpots.skater} skater spot{openSpots.skater === 1 ? "" : "s"} open</li>
          <li className="text-gray-800 dark:text-gray-200">{openSpots.goalie} goalie spot{openSpots.goalie === 1 ? "" : "s"} open</li>
        </ul>
        {claims.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {claims.map((claim) => (
              <li key={claim.name}>
                Claimed by {claim.name} ({claim.position}) — {claim.note}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
