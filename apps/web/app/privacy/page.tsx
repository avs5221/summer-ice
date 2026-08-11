import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "../site-footer";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import { TocNav, type TocEntry } from "../toc-nav";
import shared from "../page.module.css";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy — Summer Ice",
};

const TOC: TocEntry[] = [
  { id: "store", label: "What we store" },
  { id: "why", label: "Why we hold it" },
  { id: "who", label: "Who can see it" },
  { id: "proc", label: "Processors we use" },
  { id: "keep", label: "How long we keep it" },
  { id: "rights", label: "Your rights" },
  { id: "cancel", label: "Payments and cancellations" },
  { id: "ask", label: "Questions" },
  { id: "entity", label: "Who we are" },
];

export default function PrivacyPage() {
  return (
    <div className={shared.page}>
      {/* No `active` — Privacy isn't one of the top nav's four
          destinations, matching Privacy.dc.html's own nav exactly. */}
      <SiteNav />

      <div className={styles.headerBand}>
        <div className={styles.headerBandInner}>
          <div className={shared.eyebrow}>Legal</div>
          <h1 className={styles.pageTitle}>Privacy</h1>
        </div>
      </div>

      <div className={styles.main}>
        <TocNav entries={TOC} />

        <div className={styles.content}>
          <p className={styles.intro}>
            We keep as little about you as the league can run on. This page says what that is, why we hold it, and
            how to get it back or removed.
          </p>

          <section id="store" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>01</span>
              <h2 className={styles.sectionTitle}>What we store</h2>
            </div>
            <p className={styles.sectionDesc}>Only what the league needs to allocate spots, reach you, and keep the books straight.</p>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>We keep</div>
                <div className={styles.rowText}>
                  Your name and email, a phone number if you give one, your level and preferred role, the slots
                  you&rsquo;re registered for and your answer for each session, and a record of what you&rsquo;ve
                  paid — plus the same for a family member whose registration you manage.
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>We never keep</div>
                <div className={styles.rowText}>
                  IP addresses, device names, or browser fingerprints. Your date of birth — only that you confirmed
                  you&rsquo;re 16 or over. Card numbers, ever: payment happens at your bank.
                </div>
              </div>
            </div>
          </section>

          <section id="why" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>02</span>
              <h2 className={styles.sectionTitle}>Why we hold it</h2>
            </div>
            <p className={styles.sectionDesc}>
              To run the league: allocate spots, tell you when a session changes, send the reminders you have to
              answer, and keep the books straight. Nothing is used for advertising, and nothing is sold on.
            </p>
          </section>

          <section id="who" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>03</span>
              <h2 className={styles.sectionTitle}>Who can see it</h2>
            </div>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Organisers</div>
                <div className={styles.rowText}>Everything needed to run sessions, including payments.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Schedulers</div>
                <div className={styles.rowText}>Rosters and attendance. No payments, no balances.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Other players</div>
                <div className={styles.rowText}>At most a first name and surname initial on a roster. Never contact details.</div>
              </div>
            </div>
          </section>

          <section id="proc" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>04</span>
              <h2 className={styles.sectionTitle}>Processors we use</h2>
            </div>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Mollie</div>
                <div className={styles.rowText}>Handles iDEAL and Wero, and returns only whether a payment succeeded.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Hosting</div>
                <div className={styles.rowText}>Our database and servers sit in the EU.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Email</div>
                <div className={styles.rowText}>Our mail provider sees your address and the message we send you.</div>
              </div>
            </div>
          </section>

          <section id="keep" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>05</span>
              <h2 className={styles.sectionTitle}>How long we keep it</h2>
            </div>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Registrations</div>
                <div className={styles.rowText}>As long as you play with us, plus the current season.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Payments</div>
                <div className={styles.rowText}>As long as Dutch tax rules require.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Everything else</div>
                <div className={styles.rowText}>Deleted with your account, on request.</div>
              </div>
            </div>
          </section>

          <section id="rights" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>06</span>
              <h2 className={styles.sectionTitle}>Your rights</h2>
            </div>
            <p className={styles.sectionDesc}>
              Under the GDPR you can ask for a copy of your data, have it corrected, or have it deleted. Email us
              and we&rsquo;ll handle it within a month — usually the same week. If you&rsquo;re not satisfied, you
              can complain to the Autoriteit Persoonsgegevens.
            </p>
          </section>

          <section id="cancel" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>07</span>
              <h2 className={styles.sectionTitle}>Payments and cancellations</h2>
            </div>
            <p className={styles.sectionDesc}>
              Bookings and payments are governed by Dutch consumer law, not by this page — this is a summary of
              the parts that matter most; the{" "}
              <a
                href="https://www.summerice.nl/terms-conditions/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.inlineLink}
              >
                full terms and conditions
              </a>{" "}
              have the rest.
            </p>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>14-day cooling-off</div>
                <div className={styles.rowText}>
                  You can withdraw within 14 days of booking. A full refund if no sessions have happened yet; a
                  pro-rated refund — the sessions already delivered deducted — if some have.
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>After 14 days</div>
                <div className={styles.rowText}>Cancellations are non-refundable unless the specific booking says otherwise.</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>Governing law</div>
                <div className={styles.rowText}>
                  Dutch consumer law, including the Burgerlijk Wetboek, and applicable EU consumer protection
                  rules.
                </div>
              </div>
            </div>
          </section>

          <section id="ask" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>08</span>
              <h2 className={styles.sectionTitle}>Questions</h2>
            </div>
            <p className={styles.sectionDesc}>
              Write to us on the{" "}
              <Link href="/contact" className={styles.inlineLink}>
                contact page
              </Link>{" "}
              and a person will answer, or reach us directly at{" "}
              <a href="mailto:info@summerice.nl" className={styles.inlineLink}>
                info@summerice.nl
              </a>{" "}
              or +31 6 18367156.
            </p>
          </section>

          <section id="entity" className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionNum}>09</span>
              <h2 className={styles.sectionTitle}>Who we are</h2>
            </div>
            <p className={styles.sectionDesc}>Summer Ice is a trade name of The Goalie Store.</p>
            <div className={styles.rowList}>
              <div className={styles.row}>
                <div className={styles.rowLabel}>KVK</div>
                <div className={styles.rowText}>81043333</div>
              </div>
              <div className={styles.row}>
                <div className={styles.rowLabel}>VAT (BTW)</div>
                <div className={styles.rowText}>NL003525536B16</div>
              </div>
            </div>
          </section>

          <p className={styles.updated}>Last updated 11 August 2026.</p>
        </div>
      </div>

      <SiteFooter />
      <ThemeToggle />
    </div>
  );
}
