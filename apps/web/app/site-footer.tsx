import Image from "next/image";
import Link from "next/link";
import { SEASON } from "~/lib/fake-data";
import { ThemeToggle } from "./theme-toggle";
import styles from "./page.module.css";

// The "rich" footer (logo/wordmark, copyright, link row, inline theme
// toggle) shared by the pages using the full site chrome — factored out
// once Contact needed the identical one landing already had. Distinct
// from login.module.css's simpler centered footer, which is that page's
// own design, not this one reused.
//
// "Schedule" and "How it works" are `/#schedule`/`/#how`, not bare
// `#schedule`/`#how` — those ids only exist on "/" itself, so a bare
// fragment link only works when this footer happens to render there.
// The full path lets it work correctly from Contact too.
//
// `themeToggle` defaults to the inline footer icon (what "/" itself
// uses, per that design's later revision — see DECISIONS.md), but
// Contact.dc.html's own footer has no toggle in it at all: that page
// still uses the older floating bottom-right button on its own,
// separately from the footer, the same as Login. Passing `false` avoids
// rendering both at once on a page using the floating variant.
export function SiteFooter({ themeToggle = true }: { themeToggle?: boolean }) {
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
          <Link href="/#how">How it works</Link>
          <Link href="/contact">Contact</Link>
          <a href="#">Privacy</a>
          {themeToggle && <ThemeToggle />}
        </div>
      </div>
    </footer>
  );
}
