"use client";

import { useEffect, useState } from "react";
import {
  type Position,
  type Slot,
  SLOTS,
  WAITLISTS,
  formatEuros,
  formatTime,
  seasonFill,
} from "~/lib/fake-data";

const HOLD_MINUTES = 10;
const SIMULATED_SLOT_ID = "fri-2130";
const SIMULATED_POSITION: Position = "skater";

interface BasketLine {
  id: string;
  slotId: string;
  position: Position;
  kind: "held" | "waitlisted";
  holdExpiresAt: number | null; // ms epoch; null for waitlisted lines
  priceCents: number;
}

function key(slotId: string, position: Position): string {
  return `${slotId}:${position}`;
}

export function RegisterClient() {
  const [globalPosition, setGlobalPosition] = useState<Position | "both">("skater");
  const [rowOverrides, setRowOverrides] = useState<Record<string, Position>>({});
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [simulatedExtra, setSimulatedExtra] = useState<Record<string, number>>({});
  const [paid, setPaid] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // A basket line's hold is only real while its countdown is running — tick
  // once a second so expiry frees capacity the moment it lapses, with no
  // sweep step, same as the real system.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function positionFor(slotId: string): Position {
    return rowOverrides[slotId] ?? (globalPosition === "both" ? "skater" : globalPosition);
  }

  function taken(slotId: string, position: Position): number {
    const base = seasonFill(slotId)[position];
    const extra = simulatedExtra[key(slotId, position)] ?? 0;
    const held = basket.filter(
      (l) =>
        l.slotId === slotId &&
        l.position === position &&
        l.kind === "held" &&
        (paid || (l.holdExpiresAt !== null && l.holdExpiresAt > now)),
    ).length;
    return base + extra + held;
  }

  function available(slot: Slot, position: Position): number {
    return Math.max(0, slot.capacity[position] - taken(slot.id, position));
  }

  function addToBasket(slot: Slot) {
    const position = positionFor(slot.id);
    const room = available(slot, position);
    const line: BasketLine = room > 0
      ? {
          id: crypto.randomUUID(),
          slotId: slot.id,
          position,
          kind: "held",
          // react-hooks/purity flags any Date.now() call textually inside a
          // component's source, even here where it only ever runs inside
          // this onClick-triggered function — never during render itself.
          // eslint-disable-next-line react-hooks/purity
          holdExpiresAt: Date.now() + HOLD_MINUTES * 60 * 1000,
          priceCents: slot.price[position].seasonCents,
        }
      : {
          id: crypto.randomUUID(),
          slotId: slot.id,
          position,
          kind: "waitlisted",
          holdExpiresAt: null,
          priceCents: 0,
        };
    setBasket((b) => [...b, line]);
  }

  function removeFromBasket(id: string) {
    setBasket((b) => b.filter((l) => l.id !== id));
  }

  function simulateOtherPlayer() {
    const slot = SLOTS.find((s) => s.id === SIMULATED_SLOT_ID)!;
    if (available(slot, SIMULATED_POSITION) <= 0) return;
    setSimulatedExtra((extra) => ({
      ...extra,
      [key(SIMULATED_SLOT_ID, SIMULATED_POSITION)]: (extra[key(SIMULATED_SLOT_ID, SIMULATED_POSITION)] ?? 0) + 1,
    }));
  }

  function waitlistQueuePosition(line: BasketLine): number {
    const base = WAITLISTS[line.slotId]?.filter((w) => w.position === line.position).length ?? 0;
    const before = basket.filter(
      (l) => l.slotId === line.slotId && l.position === line.position && l.kind === "waitlisted",
    );
    return base + before.indexOf(line) + 1;
  }

  function alternativeSuggestion(slotId: string, position: Position): string | null {
    for (const slot of SLOTS) {
      if (slot.id === slotId) continue;
      const room = available(slot, position);
      if (room > 0) {
        return `${slot.weekdayLabel} ${formatTime(slot.startTime)} has ${room} ${position} spot${room === 1 ? "" : "s"}.`;
      }
    }
    return null;
  }

  const heldLines = basket.filter((l) => l.kind === "held");
  const waitlistedLines = basket.filter((l) => l.kind === "waitlisted");
  const payableLines = heldLines.filter((l) => paid || (l.holdExpiresAt !== null && l.holdExpiresAt > now));
  const total = payableLines.reduce((sum, l) => sum + l.priceCents, 0);

  const simulatedSlot = SLOTS.find((s) => s.id === SIMULATED_SLOT_ID)!;
  const simulatedRoom = available(simulatedSlot, SIMULATED_POSITION);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-950 dark:text-white">Register</h1>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          1. Position
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Applies to new lines. &ldquo;Both&rdquo; leaves each hour to its own selector below
          — the per-line override is promoted rather than hidden.
        </p>
        <div className="mt-2 flex gap-2">
          {(["skater", "goalie", "both"] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setGlobalPosition(pos)}
              className={`rounded border px-3 py-1.5 text-sm capitalize ${
                globalPosition === pos
                  ? "border-gray-950 bg-gray-950 text-white dark:border-white dark:bg-white dark:text-gray-950"
                  : "border-gray-300 text-gray-700 hover:border-gray-500 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          2. Pick hours
        </h2>

        <div className="mt-3 rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-gray-700 dark:text-gray-300">
            Demo: simulate contention on Friday 21:30 (skaters, {simulatedRoom} spot{simulatedRoom === 1 ? "" : "s"}{" "}
            left).
          </p>
          <button
            type="button"
            onClick={simulateOtherPlayer}
            disabled={simulatedRoom <= 0}
            className="mt-2 rounded border border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-800 hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
          >
            {simulatedRoom <= 0 ? "Friday 21:30 skaters is now full" : "Simulate another player takes Friday 21:30"}
          </button>
        </div>

        <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">
          {SLOTS.map((slot) => {
            const position = positionFor(slot.id);
            const room = available(slot, position);
            const isFull = room <= 0;
            return (
              <li key={slot.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-gray-950 dark:text-white">
                    {slot.weekdayLabel} {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                    {" · "}
                    <span className="font-normal text-gray-600 dark:text-gray-400">{slot.label}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {formatEuros(slot.price[position].seasonCents)} for the season
                    {" · "}
                    {isFull ? (
                      <span className="font-semibold text-amber-700 dark:text-amber-500">Full</span>
                    ) : (
                      <span>{room} {position} spot{room === 1 ? "" : "s"} left</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={position}
                    onChange={(e) =>
                      setRowOverrides((o) => ({ ...o, [slot.id]: e.target.value as Position }))
                    }
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                    aria-label={`Position for ${slot.weekdayLabel} ${formatTime(slot.startTime)}`}
                  >
                    <option value="skater">Skater</option>
                    <option value="goalie">Goalie</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => addToBasket(slot)}
                    className="rounded bg-gray-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                  >
                    {isFull ? "Join waitlist" : "Add to basket"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          3. Basket
        </h2>

        {basket.length === 0 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Nothing added yet.</p>
        )}

        {heldLines.length > 0 && (
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Held — payable</h3>
            <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-800">
              {heldLines.map((line) => {
                const slot = SLOTS.find((s) => s.id === line.slotId)!;
                const remainingMs = line.holdExpiresAt !== null ? line.holdExpiresAt - now : 0;
                const expired = !paid && remainingMs <= 0;
                return (
                  <li key={line.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <div className="text-gray-950 dark:text-white">
                        {slot.weekdayLabel} {formatTime(slot.startTime)} · {line.position} ·{" "}
                        {formatEuros(line.priceCents)}
                      </div>
                      <div className={expired ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}>
                        {paid
                          ? "Confirmed"
                          : expired
                            ? "Hold expired — spot released"
                            : `Hold expires in ${formatCountdown(remainingMs)}`}
                      </div>
                    </div>
                    {!paid && (
                      <button
                        type="button"
                        onClick={() => removeFromBasket(line.id)}
                        className="text-gray-500 underline hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {waitlistedLines.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Waitlisted — free</h3>
            <ul className="mt-1 divide-y divide-gray-200 dark:divide-gray-800">
              {waitlistedLines.map((line) => {
                const slot = SLOTS.find((s) => s.id === line.slotId)!;
                const suggestion = alternativeSuggestion(line.slotId, line.position);
                return (
                  <li key={line.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-gray-950 dark:text-white">
                        {slot.weekdayLabel} {formatTime(slot.startTime)} · {line.position} · #
                        {waitlistQueuePosition(line)} in line
                      </div>
                      {!paid && (
                        <button
                          type="button"
                          onClick={() => removeFromBasket(line.id)}
                          className="text-gray-500 underline hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {suggestion && (
                      <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                        {slot.weekdayLabel} {formatTime(slot.startTime)} is full — {suggestion}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {basket.length > 0 && !paid && (
          <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Total due now: <span className="font-semibold">{formatEuros(total)}</span>
              {waitlistedLines.length > 0 && " — waitlisted lines cost nothing unless promoted."}
            </p>
            <button
              type="button"
              disabled={payableLines.length === 0}
              onClick={() => setPaid(true)}
              className="mt-2 rounded bg-gray-950 px-5 py-2.5 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
            >
              Pay {formatEuros(total)} (simulated — jumps straight to confirmed)
            </button>
          </div>
        )}

        {paid && (
          <div className="mt-5 rounded border border-green-300 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950">
            <p className="font-semibold text-green-900 dark:text-green-200">You&apos;re confirmed.</p>
            <p className="mt-1 text-green-800 dark:text-green-300">
              Confirmed: {heldLines.length === 0 ? "nothing" : heldLines.map((l) => {
                const slot = SLOTS.find((s) => s.id === l.slotId)!;
                return `${slot.weekdayLabel} ${formatTime(slot.startTime)} (${l.position})`;
              }).join(", ")}.
            </p>
            {waitlistedLines.length > 0 && (
              <p className="mt-1 text-green-800 dark:text-green-300">
                Still waitlisted: {waitlistedLines.map((l) => {
                  const slot = SLOTS.find((s) => s.id === l.slotId)!;
                  return `${slot.weekdayLabel} ${formatTime(slot.startTime)} (${l.position}, #${waitlistQueuePosition(l)})`;
                }).join(", ")}.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
