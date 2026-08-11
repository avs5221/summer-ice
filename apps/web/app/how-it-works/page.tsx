import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "../site-footer";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import { TocNav, type TocEntry } from "../toc-nav";
import shared from "../page.module.css";
import styles from "./how-it-works.module.css";

export const metadata: Metadata = {
  title: "How it works — Summer Ice",
};

const TOC: TocEntry[] = [
  { id: "slots", label: "Slots and sessions" },
  { id: "roles", label: "Skater or goalie" },
  { id: "pay", label: "Registering and paying" },
  { id: "miss", label: "Weeks you can't make" },
  { id: "wait", label: "Waitlists and drop-ins" },
  { id: "skills", label: "Skills training" },
  { id: "level", label: "Level" },
];

// Both numbers match packages the rest of the app already treats as the
// source of truth, not invented for this page: HOLD_MINUTES in
// register-client.tsx, RELEASE_HOURS_BEFORE in lib/fake-data.ts.
const HOLD_MINUTES = 10;
const RELEASE_HOURS = 48;

export default function HowItWorksPage() {
  return (
    <div className={shared.page}>
      {/* No `active` — "How it works" is no longer a nav destination at
          all (design handoff, 2026-08-11), matching Contact/Privacy's
          own no-active-item nav exactly. */}
      <SiteNav />

      <div className={styles.headerBand}>
        <div className={styles.headerBandInner}>
          <div className={shared.eyebrow}>The league, explained</div>
          <h1 className={styles.pageTitle}>How it works</h1>
        </div>
      </div>

      <div className={styles.main}>
        <TocNav entries={TOC} />

        <div className={styles.content}>
          <p className={styles.intro}>
            Summer Ice runs weekly ice hockey at IJshal De Vliet in Leiden, from the end of March to the end of
            August. You take a slot for the season, and that spot is yours every week.
          </p>

          <section id="slots" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>01</span>
              <h2 className={styles.sectionTitle}>Slots and sessions</h2>
            </div>
            <p className={styles.sectionDesc}>
              Ten slots run each week, spread across Tuesday to Sunday evening. Registering takes one for the
              whole season — you are not signing up week by week.
            </p>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Slot</div>
                <div className={styles.rowText}>A recurring weekly time, like Tuesday 21:30. This is what you register for.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Session</div>
                <div className={styles.rowText}>One evening of a slot, on a specific date.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Scrimmage</div>
                <div className={styles.rowText}>Ordinary pickup hockey. Eight of the ten slots.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Skills training</div>
                <div className={styles.rowText}>Drills instead of a game. The other two slots.</div>
              </div>
            </div>
          </section>

          <section id="roles" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>02</span>
              <h2 className={styles.sectionTitle}>Skater or goalie</h2>
            </div>
            <p className={styles.sectionDesc}>
              Skater and goalie spots are counted separately, so a slot with a full skater list can still be wide
              open for goalies. Play both? Pick your usual role when you register and change it per slot — goalie
              on Sunday, skater on Thursday is fine.
            </p>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Skater</div>
                <div className={styles.rowText}>20 per scrimmage slot. The spots that go first.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Goalie</div>
                <div className={styles.rowText}>2 per scrimmage slot, at a reduced season rate. Always the hardest spots to fill.</div>
              </div>
            </div>
          </section>

          <section id="pay" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>03</span>
              <h2 className={styles.sectionTitle}>Registering and paying</h2>
            </div>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>1. Pick slots</div>
                <div className={styles.rowText}>Choose one or more from the ten. Availability is shown for the role you selected.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>2. They are held</div>
                <div className={styles.rowText}>
                  Your picks are held for {HOLD_MINUTES} minutes while you check out, so nobody takes them
                  mid-payment.
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>3. Pay once</div>
                <div className={styles.rowText}>
                  One iDEAL or Wero payment covers the full season for everything in your basket. No card details,
                  ever.
                </div>
              </div>
            </div>
          </section>

          <section id="miss" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>04</span>
              <h2 className={styles.sectionTitle}>Weeks you can&rsquo;t make</h2>
            </div>
            <p className={styles.sectionDesc}>
              Before each session you say whether you&rsquo;re playing. <strong>Decline up to {RELEASE_HOURS} hours
              ahead</strong> and your spot is released to someone else for that week only — you keep it for the
              rest of the season, and there is nothing to arrange yourself. After the deadline the spot stays
              yours whether you skate or not.
            </p>
          </section>

          <section id="wait" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>05</span>
              <h2 className={styles.sectionTitle}>Waitlists and drop-ins</h2>
            </div>
            <p className={styles.sectionDesc}>Both are first come, first served. There is no priority queue.</p>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Waitlist</div>
                <div className={styles.rowText}>Slot full? Join its waitlist and we&rsquo;ll tell you the moment a spot opens.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Drop-in</div>
                <div className={styles.rowText}>Claim a released spot one night at a time, and skate before committing to a season.</div>
              </div>
            </div>
          </section>

          <section id="skills" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>06</span>
              <h2 className={styles.sectionTitle}>Skills training</h2>
            </div>
            <p className={styles.sectionDesc}>
              Two of the ten slots are skills training rather than scrimmage: drills for skaters and goalies, run
              with goalie coaches and volunteer shooters. It is registered for like any other slot, and it is
              priced on its own: €450 for the season as a skater, €600 as a goalie. The Wednesday session is
              skaters only — goalies play the Saturday one.
            </p>
          </section>

          <section id="level" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>07</span>
              <h2 className={styles.sectionTitle}>Level</h2>
            </div>
            <p className={styles.sectionDesc}>
              Slots are grouped by division — 2nd/3rd, 3rd/4th, 5th/6th, and recreational. The level is advisory:
              it tells you what to expect from the pace, not who is allowed on the ice. If a slot turns out to be
              the wrong fit, talk to us and we&rsquo;ll move you.
            </p>
          </section>

          <div className={styles.ctaRow}>
            <Link href="/register" className={shared.btnPrimary}>
              Sign me up →
            </Link>
            <Link href="/#schedule" className={styles.ctaSecondary}>
              See the schedule
            </Link>
          </div>
        </div>
      </div>

      <ThemeToggle />
      <SiteFooter />
    </div>
  );
}
