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
// Contact too. "How it works" points at its own real page now that one
// exists, not `/#how`'s landing-page teaser section.
//
// No theme toggle lives in here (it used to, on some pages, per an
// earlier revision — see DECISIONS.md and theme-toggle.tsx): every page
// now renders exactly one `<ThemeToggle />` directly, positioned against
// `.page` itself rather than laid out as a footer link.
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
          <Link href="/how-it-works">How it works</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
