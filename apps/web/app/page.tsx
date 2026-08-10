import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { dbPooled } from "@summerice/db";
import { getSlotFillOverview } from "@summerice/core";
import { SEASON } from "~/lib/fake-data";
import { LandingSlotRow } from "./landing-slot-row";
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

export default async function Home() {
  const slotFill = await loadSlotFill();
  const openSlots = slotFill.filter(
    (s) => s.skater.taken < s.skater.capacity || s.goalie.taken < s.goalie.capacity,
  ).length;

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="#top" className={styles.brand}>
            <Image src="/logo-circle.png" alt="Summer Ice" width={28} height={28} className={styles.brandMark} />
            <span className={styles.wordmark}>
              Summer <span style={{ color: "var(--primary)" }}>Ice</span>
            </span>
          </a>
          <div className={styles.navLinks}>
            <Link href="/" className={styles.navLinkActive}>
              Home
            </Link>
            <a href="#how" className={styles.navLink}>
              How it works
            </a>
            <Link href="/login" className={styles.navLink}>
              Sign in
            </Link>
            <Link href="/register" className={styles.registerBtn}>
              Register
            </Link>
          </div>
        </div>
      </nav>

      <div id="top" className={styles.hero}>
        <div className={styles.heroInner}>
          <div>
            <div className={styles.eyebrow}>Leiden · {SEASON.name.replace("Summer Season", "season")}</div>
            <h1 className={styles.heroTitle}>
              Ice hockey,
              <br />
              all summer.
            </h1>
            <p className={styles.heroDesc}>
              Weekly ice at IJshal De Vliet in Leiden, from the end of March to the end of August. Take a slot
              for the season and it&rsquo;s yours every week.
            </p>
            <div className={styles.heroLive}>
              <span className={styles.liveDot} />
              <span className={styles.liveText}>
                <strong>{openSlots}</strong> of <strong>{slotFill.length}</strong>{" "}
                {slotFill.length === 1 ? "slot" : "slots"} still have room for the season
              </span>
            </div>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.btnPrimary}>
                Sign me up →
              </Link>
              <a href="#schedule" className={styles.btnSun}>
                See the schedule
              </a>
            </div>
          </div>
          <Image src="/logo-circle.png" alt="" width={140} height={140} className={styles.heroLogo} priority />
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
        </div>
      </div>

      <div className={styles.main}>
        <section id="schedule">
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>Weekly schedule</div>
            <h2 className={styles.sectionTitle}>Pick the nights that suit you.</h2>
            <p className={styles.sectionDesc}>
              Skater and goalie spots are counted separately, and availability updates live.
            </p>
          </div>

          <div className={styles.scheduleCard}>
            <div className={styles.scheduleHead}>
              <span className={styles.scheduleHeadCell}>Day / Start</span>
              <span className={styles.scheduleHeadCell}>Level</span>
              <span className={styles.scheduleHeadCell}>Spots left</span>
              <span className={`${styles.scheduleHeadCell} ${styles.right}`}>Action</span>
            </div>
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

        <section className={styles.dropin}>
          <div>
            <div className={styles.eyebrow}>Not ready for the season?</div>
            <h2 className={styles.dropinTitle}>Skate a single night first.</h2>
            <p className={styles.dropinDesc}>
              When a registered player can&rsquo;t make their week, that spot opens up. Claim one, come skate,
              and see whether the level suits you before committing to a season.
            </p>
          </div>
          <Link href="/register" className={styles.btnSun} style={{ whiteSpace: "nowrap" }}>
            Claim a drop-in spot →
          </Link>
        </section>

        <section id="how">
          <div className={styles.eyebrow}>How it works</div>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 20 }}>
            Three steps, then just show up.
          </h2>
          <div className={styles.howGrid}>
            <div className={styles.howCard}>
              <div className={styles.howNum}>01</div>
              <h3 className={styles.howTitle}>Pick your slots</h3>
              <p className={styles.howDesc}>
                Take one slot or five. Register as a skater or a goalie — if you play both, you can pick a
                different role per slot.
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
        </section>

        <section id="rink" className={styles.rink}>
          <div>
            <div className={styles.eyebrow}>The rink</div>
            <h2 className={styles.rinkTitle}>IJshal De Vliet, Leiden.</h2>
            <p className={styles.rinkDesc}>
              Every slot runs on the same sheet, Tuesday through Sunday evening, from 19:00 onwards, right
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

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Image src="/logo-circle.png" alt="" width={18} height={18} className={styles.brandMark} />
            <span className={styles.footerWordmark}>
              Summer <span style={{ color: "var(--primary)" }}>Ice</span>
            </span>
          </div>
          <span>© {SEASON.startDate.getFullYear()} · Leiden, NL</span>
          <div className={styles.footerLinks}>
            <a href="#schedule">Schedule</a>
            <a href="#how">How it works</a>
            <a href="#">Contact</a>
            <a href="#">Privacy</a>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
