import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";

// Shared sticky nav for the pages that have their own "Summer Ice Landing"
// design chrome (currently "/" and "/register") — factored out once a
// second page needed the identical shell, rather than duplicated per page.
// The global app/components/nav.tsx (the plain wave-1 walk-through nav)
// hides itself on both routes to avoid stacking two navs; see its own
// comment for which routes that covers.
//
// "Register" is always a filled pill, unlike the other links (plain
// underlined text) — it doubles as both a nav item and the primary CTA.
// Its color is the only thing that changes with `active`: `--foreground`
// (a neutral CTA) everywhere except the register page itself, where it
// switches to `--primary` to double as that page's "you are here" marker
// — matching the source design exactly, not a convention invented here.
export function SiteNav({ active }: { active: "home" | "register" }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo-circle.png" alt="Summer Ice" width={28} height={28} className={styles.brandMark} />
          <span className={styles.wordmark}>
            Summer <span style={{ color: "var(--primary)" }}>Ice</span>
          </span>
        </Link>
        <div className={styles.navLinks}>
          <Link href="/" className={active === "home" ? styles.navLinkActive : styles.navLink}>
            Home
          </Link>
          <Link href="/#how" className={styles.navLink}>
            How it works
          </Link>
          <Link href="/login" className={styles.navLink}>
            Sign in
          </Link>
          <Link href="/register" className={active === "register" ? styles.registerBtnActive : styles.registerBtn}>
            Register
          </Link>
        </div>
      </div>
    </nav>
  );
}
