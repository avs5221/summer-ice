import { Link } from "react-router";
import {
  SLOTS,
  formatDate,
  formatTime,
  nextSessionFor,
  seasonFill,
  statusCounts,
} from "~/lib/fake-data";

export function meta() {
  return [{ title: "Overview — Admin — Summer Ice" }];
}

function goalieAlarmClass(goalies: number, capacity: number): string {
  if (goalies === 0) return "border-red-600 bg-red-100 text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-200";
  if (goalies < capacity) return "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200";
  return "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300";
}

export default function AdminOverview() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-950 dark:text-white">Overview</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        All ten hours, next session each. A goalie shortage is flagged harder than a skater
        shortage — a session with one goalie is much rougher than one twelve players short.
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SLOTS.map((slot) => {
          const session = nextSessionFor(slot.id)!;
          const fill = seasonFill(slot.id);
          const skaterCounts = statusCounts(session.skaters);
          const goalieCounts = statusCounts(session.goalies);
          const goalieUrgent = fill.goalie === 0;

          return (
            <li key={slot.id}>
              <Link
                to={`/admin/session/${slot.id}`}
                className="block rounded border border-gray-200 p-3 hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-gray-950 dark:text-white">
                    {slot.weekdayLabel} {formatTime(slot.startTime)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(session.date)}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{slot.label}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <div className="rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-800 dark:bg-gray-950">
                    <span className="font-semibold text-gray-950 dark:text-white">
                      {fill.skater}/{slot.capacity.skater} skaters
                    </span>
                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                      ({skaterCounts.confirmed} confirmed · {skaterCounts.unanswered} unanswered)
                    </span>
                  </div>
                  <div className={`rounded border px-2 py-1 text-xs font-medium ${goalieAlarmClass(fill.goalie, slot.capacity.goalie)}`}>
                    <span className="font-semibold">
                      {goalieUrgent ? "⚠ " : ""}{fill.goalie}/{slot.capacity.goalie} goalies
                    </span>
                    <span className="ml-1">
                      ({goalieCounts.confirmed} confirmed · {goalieCounts.unanswered} unanswered)
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
