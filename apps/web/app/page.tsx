import Link from "next/link";
import type { Metadata } from "next";
import { dbPooled } from "@summerice/db";
import { getSlotFillOverview } from "@summerice/core";
import { SEASON, formatEuros } from "~/lib/fake-data";
import { SlotFillRow } from "./slot-fill-row";

export const metadata: Metadata = {
  title: "Summer Ice — 2026 Season",
  description: "Summer ice hockey in Leiden. Ten hours a week, register by the hour.",
};

// This is the first page reading real data — see docs/DOMAIN-MODEL.md §9
// and packages/core/slot-fill.ts. Fill numbers are fetched fresh on every
// render (never cached, never baked into a static response — see
// docs/ARCHITECTURE.md §8, "the one cacheable page"), then the client picks
// up live updates from there via SlotFillRow's useLiveFill.
async function loadSlotFill() {
  const db = dbPooled();
  return db.transaction((tx) => getSlotFillOverview(tx));
}

export default async function Home() {
  const slotFill = await loadSlotFill();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Summer Ice</h1>
      <p className="mt-2 max-w-2xl text-gray-700 dark:text-gray-300">
        Summer ice hockey in Leiden. Five-on-five, no-contact scrimmage, ten hours a week
        from {SEASON.startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}{" "}
        to {SEASON.endDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} —
        {" "}
        {SEASON.weekCount} weeks. Register for a season, or claim a spot week to week once the
        season is under way.
      </p>

      <div className="mt-6">
        <Link
          href="/register"
          className="inline-block rounded bg-gray-950 px-5 py-2.5 font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
        >
          Register
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Prices</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="py-1.5 pr-4 font-medium">Position</th>
                <th className="py-1.5 pr-4 font-medium">Season, regular</th>
                <th className="py-1.5 pr-4 font-medium">Season, skills training</th>
                <th className="py-1.5 font-medium">Extras (per skate)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-900">
                <td className="py-1.5 pr-4">Skater</td>
                <td className="py-1.5 pr-4">{formatEuros(30000)}</td>
                <td className="py-1.5 pr-4">{formatEuros(45000)}</td>
                <td className="py-1.5">{formatEuros(1500)}</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4">Goalie</td>
                <td className="py-1.5 pr-4">{formatEuros(15000)}</td>
                <td className="py-1.5 pr-4">{formatEuros(45000)}</td>
                <td className="py-1.5">Free</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-950 dark:text-white">The ten hours</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Live fill per position. A full slot is still shown, with a waitlist.
        </p>
        <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">
          {slotFill.map((slot) => (
            <SlotFillRow key={slot.slotId} slot={slot} />
          ))}
        </ul>
      </section>
    </main>
  );
}
