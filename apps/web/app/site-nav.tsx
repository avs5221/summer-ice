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
// "Sign in" gets the same underlined-active treatment as "Home" when
// `active === "login"` (per Login.dc.html), rather than a filled pill —
// it's a plain nav destination there, not also a CTA the way Register is.
// `active` is optional because not every page with this nav is one of its
// three destinations — Contact/Privacy/How It Works's own nav has no
// active item at all, so omitting it leaves every link in its plain,
// inactive state, matching those designs.
//
// "How it works" was removed entirely (design handoff, 2026-08-11,
// "design_handoff_landing_ctas": "it is not a critical page; it should
// not compete in persistent navigation"). It's still reachable — a link
// at the end of the landing page's own #how section, and Contact's
// sidebar note — just not from every page's nav anymore.
export function SiteNav({ active }: { active?: "home" | "register" | "login" }) {
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
          <Link href="/login" className={active === "login" ? styles.navLinkActive : styles.navLink}>
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
