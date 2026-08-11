import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { dbPooled } from "@summerice/db";
import { getSlotFillOverview } from "@summerice/core";
import { SEASON, SLOTS, TODAY, formatTime, seasonPhase, sessionDetail, weekOpenSpotsTotals } from "~/lib/fake-data";
import { LandingSlotRow } from "./landing-slot-row";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";
import { ThemeToggle } from "./theme-toggle";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Summer Ice — 2026 Season",
  description: "Ice hockey, all summer. Weekly ice at IJshal De Vliet in Leiden, end of March to end of August.",
};

// force-dynamic, deliberately: this page reads live fill counts, and
// docs/ARCHITECTURE.md §8 ("The one cacheable page, and the rule that
// protects it") requires those counts be fetched fresh per request, never
// baked into a cached/prerendered HTML response — a stale baked-in count
// reproduces the exact "site says a slot is open, form says it's locked"
// bug this project exists to fix. Next would otherwise statically prerender
// "/" at build time (it has no dynamic params or uncached request data to
// force the switch on its own), which both bakes in stale numbers AND
// queries the database at build time, when Vercel's build environment may
// not even have the database env vars available.
//
// Do not "optimise" this back to static. If this page's marketing content
// (schedule, prices, copy) needs to cache while the fill numbers stay live,
// the correct refinement is a static shell with the fill list inside a
// Suspense boundary — see docs/ARCHITECTURE.md §8 for that as a recorded,
// not-yet-needed option, not a static export here.
export const dynamic = "force-dynamic";

// This is the first page reading real data — see docs/DOMAIN-MODEL.md §9
// and packages/core/slot-fill.ts. Fill numbers are fetched fresh on every
// render (never cached, never baked into a static response — see
// docs/ARCHITECTURE.md §8, "the one cacheable page"), then each row picks
// up live updates from there via LandingSlotRow's useLiveFill.
async function loadSlotFill() {
  const db = dbPooled();
  return db.transaction((tx) => getSlotFillOverview(tx));
}

function formatSeasonRange(): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(SEASON.startDate)} – ${fmt(SEASON.endDate)}`;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// Fixed Tue→Sun column order for the in-season week calendar — the
// league's own schedule shape (no Monday slot exists), not a derived
// "whatever order sessions happen to come in" list.
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

export default async function Home() {
  const slotFill = await loadSlotFill();
  const openSlots = slotFill.filter(
    (s) => s.skater.taken < s.skater.capacity || s.goalie.taken < s.goalie.capacity,
  ).length;
  const totalSkaterOpen = slotFill.reduce((sum, s) => sum + Math.max(0, s.skater.capacity - s.skater.taken), 0);
  const totalGoalieOpen = slotFill.reduce((sum, s) => sum + Math.max(0, s.goalie.capacity - s.goalie.taken), 0);

  // "auto" always resolves to "during" for TODAY's fixed 10 Aug 2026 (see
  // fake-data.ts) — the "before" branch below still renders correctly if
  // that ever changes, it's just not reachable to screenshot today.
  const phase = seasonPhase();
  const weekTotals = phase === "during" ? weekOpenSpotsTotals() : null;

  return (
    <div className={styles.page}>
      <SiteNav active="home" />

      {/* Hero rebuilt around two CTA cards (design_handoff_season_dropins,
          2026-08-11) — the fourth hero shape this session; see
          page.module.css's own comment and DECISIONS.md for the chain. */}
      <div id="top" className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <div>
              <div className={styles.eyebrow}>Leiden · {SEASON.name.replace("Summer Season", "season")}</div>
              <h1 className={styles.heroTitle}>Ice hockey, all summer.</h1>
              <p className={styles.heroDesc}>
                Weekly pickup ice at IJshal De Vliet in Leiden, 30 March – 30 August. Take a night for the season,
                or drop in when a spot opens.
              </p>
            </div>
            <Image src="/logo-circle.png" alt="" width={116} height={116} className={styles.heroLogo} priority />
          </div>

          <div className={styles.heroCards}>
            <div className={styles.heroCard} style={{ order: phase === "during" ? 2 : 1 }}>
              <div className={styles.heroCardEyebrowRow}>
                <span className={styles.liveDot} />
                <span className={styles.heroCardEyebrow}>2026 season · open now</span>
              </div>
              <div className={styles.heroStatsRow}>
                <div>
                  <div className={styles.heroStatNum}>{totalSkaterOpen}</div>
                  <div className={styles.heroStatLabel}>Skater spots left</div>
                </div>
                <div>
                  <div className={styles.heroStatNum}>{totalGoalieOpen}</div>
                  <div className={styles.heroStatLabel}>Goalie spots left</div>
                </div>
              </div>
              <p className={styles.heroCardSub}>
                Across{" "}
                <strong>
                  {openSlots} of {slotFill.length}
                </strong>{" "}
                nights · €300 for the season, €150 for goalies
              </p>
              <Link href="/register" className={styles.heroCardCta}>
                Pick my nights &amp; sign up →
              </Link>
            </div>

            <div className={styles.heroCard} style={{ order: phase === "during" ? 1 : 2 }}>
              {phase === "during" && weekTotals ? (
                <>
                  <div className={styles.heroCardEyebrowRow}>
                    <span className={styles.liveDot} />
                    <span className={styles.heroCardEyebrowSun}>Drop in this week · live</span>
                  </div>
                  <div className={styles.heroStatsRow}>
                    <div>
                      <div className={styles.heroStatNum}>{weekTotals.skater}</div>
                      <div className={styles.heroStatLabel}>Skater spots open</div>
                    </div>
                    <div>
                      <div className={styles.heroStatNum}>{weekTotals.goalie}</div>
                      <div className={styles.heroStatLabel}>Goalie spots open</div>
                    </div>
                  </div>
                  <p className={styles.heroCardSub}>Tue–Sun this week · €15 a night, goalies free</p>
                  <Link href="/drop-ins" className={styles.heroCardCtaSun}>
                    Claim a spot this week →
                  </Link>
                </>
              ) : (
                <>
                  <div className={styles.heroCardEyebrowSun}>Drop-ins · once the season starts</div>
                  <p className={styles.heroCardText}>
                    Not ready to commit? Any week a regular can&rsquo;t make their night, the spot opens up to
                    anyone. Claim it, pay for the night, skate.
                  </p>
                  <p className={styles.heroCardSub}>From 30 March · €15 a night, goalies free</p>
                  <Link href="/drop-ins" className={styles.heroCardCtaOutline}>
                    See spots open this week →
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statBand}>
        <div className={styles.statBandInner}>
          <div className={styles.stat}>
            <div className={styles.statValue}>Tue–Sun</div>
            <div className={styles.statLabel}>Evening ice</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>2nd–6th + rec</div>
            <div className={styles.statLabel}>Levels</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{formatSeasonRange()}</div>
            <div className={styles.statLabel}>{SEASON.startDate.getFullYear()} season</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>Five-on-five</div>
            <div className={styles.statLabel}>No contact</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>Goalies free</div>
            <div className={styles.statLabel}>On drop-in nights</div>
          </div>
        </div>
      </div>

      <div className={styles.main}>
        {phase === "during" ? (
          <section id="schedule">
            <div className={styles.weekHead}>
              <div>
                <div className={styles.weekHeadEyebrowRow}>
                  <span className={styles.weekHeadDot} />
                  <span className={styles.weekHeadEyebrow}>Open now · this week</span>
                </div>
                <h2 className={styles.weekHeadTitle}>The next six nights.</h2>
              </div>
              <Link href="/drop-ins" className={styles.weekHeadLink}>
                All open spots →
              </Link>
            </div>

            <div className={styles.weekGridScroll}>
              <div className={styles.weekGrid}>
                {WEEK_COLUMNS.map((col) => {
                  const daySlots = SLOTS.filter((s) => s.weekday === col.weekday);
                  const details = daySlots.map((s) => ({ slot: s, detail: sessionDetail(s.id)! }));
                  const isToday = details.some(({ detail }) => isSameDay(detail.session.date, TODAY));
                  const date = details[0]?.detail.session.date;

                  return (
                    <div key={col.weekday} className={styles.weekCol}>
                      <div className={isToday ? styles.weekColHeadToday : styles.weekColHead}>
                        <span className={isToday ? styles.weekColLabelToday : styles.weekColLabel}>{col.label}</span>
                        {date && (
                          <span className={styles.weekColDate}>
                            {date.getDate()} {date.toLocaleDateString("en-GB", { month: "short" })}
                          </span>
                        )}
                      </div>

                      {details.length === 0 ? (
                        <div className={styles.weekEmpty}>
                          <span className={styles.weekEmptyText}>No ice</span>
                        </div>
                      ) : (
                        details.map(({ slot, detail }) => {
                          const cardIsToday = isSameDay(detail.session.date, TODAY);
                          const skLeft = detail.openSpots.skater;
                          const glLeft = detail.openSpots.goalie;
                          return (
                            <Link
                              key={slot.id}
                              href={`/drop-ins#${slot.id}`}
                              className={cardIsToday ? styles.weekCardToday : styles.weekCard}
                            >
                              {cardIsToday && <div className={styles.weekCardTonight}>Tonight</div>}
                              <div className={styles.weekCardTime}>{formatTime(slot.startTime)}</div>
                              <div className={styles.weekCardLevel}>{slot.label}</div>
                              <div className={styles.weekCardFooter}>
                                <span className={styles.weekCardStat}>
                                  {skLeft === 0 ? "Skaters full" : `${pluralize(skLeft, "skater")} left`}
                                </span>
                                <span className={styles.weekCardStat} style={{ color: glLeft > 0 ? "var(--green)" : "var(--muted-foreground)" }}>
                                  {glLeft === 0 ? "Goalies full" : `${pluralize(glLeft, "goalie")} left`}
                                </span>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.weekFooterRow}>
              <span className={styles.weekFooterText}>
                Claim a spot and it&rsquo;s yours for that night — €15, goalies free. Gone when someone else takes
                it.
              </span>
              <Link href="/drop-ins" className={styles.weekFooterCta}>
                Claim a spot this week →
              </Link>
            </div>
          </section>
        ) : (
          <section id="schedule">
            <div className={styles.scheduleListHead}>
              <div>
                <div className={styles.scheduleListEyebrow}>The ten nights</div>
                <p className={styles.scheduleListDesc}>Every week, all season. Tap a night to sign up.</p>
              </div>
              <Link href="/register" className={styles.scheduleListLink}>
                Prices &amp; sign-up →
              </Link>
            </div>

            <div className={styles.scheduleListCard}>
              {slotFill.map((slot) => (
                <LandingSlotRow
                  key={slot.slotId}
                  slot={{
                    slotId: slot.slotId,
                    weekdayLabel: slot.weekdayLabel,
                    startTime: slot.startTime,
                    label: slot.label,
                    skater: slot.skater,
                    goalie: slot.goalie,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section id="how">
          <div className={styles.eyebrow}>How it works</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 20 }}>
            Three steps, then just show up.
          </h2>
          <div className={styles.howGrid}>
            <div className={styles.howCard}>
              <div className={styles.howNum}>01</div>
              <h3 className={styles.howTitle}>Pick your nights</h3>
              <p className={styles.howDesc}>
                Take one night or five. Register as a skater or a goalie — if you play both, you can pick a
                different role per night.
              </p>
            </div>
            <div className={styles.howCard}>
              <div className={styles.howNum}>02</div>
              <h3 className={styles.howTitle}>Pay once, for the season</h3>
              <p className={styles.howDesc}>
                One iDEAL or Wero payment covers the whole season. Your spot is held for ten minutes while you pay.
              </p>
            </div>
            <div className={styles.howCard}>
              <div className={styles.howNum}>03</div>
              <h3 className={styles.howTitle}>Say when you can&rsquo;t make it</h3>
              <p className={styles.howDesc}>
                Decline a date up to 48 hours ahead and your spot opens for someone else that week. Nothing to
                arrange yourself.
              </p>
            </div>
          </div>
          <div className={styles.howLinkRow}>
            <Link href="/how-it-works" className={styles.howLink}>
              Read how it all works →
            </Link>
          </div>
        </section>

        <section className={styles.waysIn}>
          <div className={styles.waysInEyebrow}>Two more ways in</div>
          <h2 className={styles.waysInTitle}>Can&rsquo;t commit to the whole summer?</h2>
          <p className={styles.waysInDesc}>
            Then play week to week instead. Every week someone can&rsquo;t make their night, and that spot opens
            to anyone — neither of these is a queue for a season slot.
          </p>
          <div className={styles.waysInList}>
            <div className={styles.waysInRow}>
              <div className={styles.waysInLabel}>Reserves list</div>
              <div className={styles.waysInText}>
                Register, then put yourself on the reserves for a whole night for the season, or just for the
                dates you&rsquo;re free. We message you whenever a spot opens. First come, first served.
              </div>
              {/* Now /register (was /contact in the previous handoff pass) —
                  this bundle's own source copy points the reserves flow
                  through registration rather than an out-of-band request,
                  reversing that pass's "Ask to be added → /contact" open
                  question. See DECISIONS.md. */}
              <Link href="/register" className={styles.waysInActionFilled}>
                Join the reserves →
              </Link>
            </div>
            <div className={styles.waysInRow}>
              <div className={styles.waysInLabel}>Drop-in</div>
              <div className={styles.waysInText}>
                Already know you&rsquo;re free? Take an open spot as you find it, without being on any list. €15 a
                night, goalies free.
              </div>
              <Link href="/drop-ins" className={styles.waysInActionOutline}>
                See spots open this week →
              </Link>
            </div>
          </div>
        </section>

        <section id="rink" className={styles.rink}>
          <div>
            <div className={styles.eyebrow}>The rink</div>
            <h2 className={styles.rinkTitle}>IJshal De Vliet, Leiden.</h2>
            <p className={styles.rinkDesc}>
              Every night runs on the same sheet, Tuesday through Sunday evening, from 19:00 onwards, right
              through to the end of August.
            </p>
          </div>
          <div className={styles.mapFrame}>
            <iframe
              title="Map of IJshal De Vliet, Leiden"
              src="https://www.google.com/maps?q=IJshal+De+Vliet+Leiden&output=embed"
              loading="lazy"
            />
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div>
            <h2 className={styles.ctaTitle}>Your spot, every week.</h2>
            <p className={styles.ctaDesc}>
              Registration for the {SEASON.startDate.getFullYear()} season is open. One payment holds your slot
              for the whole season — no weekly sign-ups.
            </p>
          </div>
          <div className={styles.ctaBtnWrap}>
            <Link href="/register" className={styles.ctaBtn}>
              Sign me up for the season →
            </Link>
          </div>
        </section>
      </div>

      <ThemeToggle />
      <SiteFooter />
    </div>
  );
}
