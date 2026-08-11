import Image from "next/image";
import Link from "next/link";
import { SEASON } from "~/lib/fake-data";
import styles from "./page.module.css";

// The "rich" footer (logo/wordmark, copyright, link row) shared by the
// pages using the full site chrome — factored out once Contact needed
// the identical one landing already had. Distinct from
// login.module.css's simpler centered footer, which is that page's own
// design, not this one reused.
//
// "Schedule" is `/#schedule`, not bare `#schedule` — that id only exists
// on "/" itself, so a bare fragment link only works when this footer
// happens to render there. The full path lets it work correctly from
// Contact too.
//
// "How it works" was removed (design handoff, 2026-08-11,
// "design_handoff_landing_ctas" — same reasoning as SiteNav dropping
// it: not critical enough to earn persistent placement). Links are now
// Schedule · Contact · Privacy.
//
// No theme toggle lives in here — every page renders its own standalone
// `<ThemeToggle />` (fixed to the viewport corner — see theme-toggle.tsx).
export function SiteFooter() {
  return (
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
          <Link href="/#schedule">Schedule</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
