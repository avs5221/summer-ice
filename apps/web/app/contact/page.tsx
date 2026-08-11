import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "../site-footer";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import { ContactForm } from "./contact-form";
import shared from "../page.module.css";
import styles from "./contact.module.css";

export const metadata: Metadata = {
  title: "Contact — Summer Ice",
};

export default function ContactPage() {
  return (
    <div className={shared.page}>
      {/* No `active` — Contact isn't one of the top nav's four
          destinations, matching Contact.dc.html's own nav exactly. */}
      <SiteNav />

      <div className={styles.headerBand}>
        <div className={styles.headerBandInner}>
          <div className={shared.eyebrow}>Get in touch</div>
          <h1 className={styles.pageTitle}>Contact</h1>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Send us a message</h2>
          <p className={styles.formSubtitle}>A person reads these — usually answered within a couple of days.</p>
          <ContactForm />
        </div>

        <div className={styles.sidebar}>
          <div className={styles.sideCard}>
            <div className={styles.sideLabel}>Email</div>
            {/* The design's own static link said hello@summerice.club —
                ".club" was the self-hosted plan's now-gone staging
                subdomain (ARCHITECTURE.md §10), not this project's real
                domain. First corrected to a guessed "hello@summerice.nl";
                replaced again here with the actual address confirmed from
                the real site's own terms-and-conditions page. */}
            <a href="mailto:info@summerice.nl" className={styles.sideEmail}>
              info@summerice.nl
            </a>
            <p className={styles.sideText}>For anything about registration, payment, or your slot.</p>
          </div>

          <div className={styles.sideCard}>
            <div className={styles.sideLabel}>Where we play</div>
            <div className={styles.sideHeading}>IJshal De Vliet</div>
            <p className={styles.sideText}>Leiden, Netherlands. Tuesday to Sunday evening, from 19:00 onwards.</p>
            <div className={styles.mapFrame}>
              <iframe
                title="Map of IJshal De Vliet, Leiden"
                src="https://www.google.com/maps?q=IJshal+De+Vliet+Leiden&output=embed"
                loading="lazy"
              />
            </div>
          </div>

          <div className={styles.sideCardMuted}>
            <div className={styles.sideLabel}>Before you write</div>
            <p className={styles.sideText} style={{ marginTop: 0 }}>
              <Link href="/how-it-works" className={styles.sideLink}>
                How it works
              </Link>{" "}
              covers registering, paying, missing a week, waitlists, and skills training.
            </p>
          </div>
        </div>
      </div>

      <ThemeToggle />
      <SiteFooter />
    </div>
  );
}
