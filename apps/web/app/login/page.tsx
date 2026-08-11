import Link from "next/link";
import type { Metadata } from "next";
import { GoogleSignInButton } from "../google-signin-button";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import { LoginForm } from "./login-form";
import shared from "../page.module.css";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in — Summer Ice",
};

// Thin server shell, same split as register/page.tsx: static chrome here,
// interaction (the form, the Google OAuth call) in client children.
//
// Sky page header carries the hero role here (design_handoff_season_dropins,
// 2026-08-11) — "Sign in" as an h1 with a blurb underneath, no eyebrow. The
// card below holds only the controls now; the logo lockup and the old
// title/subtitle that used to live inside it moved up into this header
// (the logo lockup is redundant with SiteNav's own brand mark directly
// above it, so it's dropped rather than duplicated).
export default function LoginPage() {
  return (
    <div className={shared.page}>
      <SiteNav active="login" />

      <div className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.heroTitle}>Sign in</h1>
          <p className={styles.heroBlurb}>
            See your nights, tell us when you can&rsquo;t make one, and pick up spots that open during the week.
          </p>
        </div>
      </div>

      <div className={styles.shell}>
        <div className={styles.card}>
          <GoogleSignInButton className={styles.googleBtnFullWidth} />

          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <div className={styles.dividerLine} />
          </div>

          <LoginForm />

          <p className={styles.switchLine}>
            No account yet?{" "}
            <Link href="/signup" className={styles.switchLink}>
              Create an account →
            </Link>
          </p>
        </div>
      </div>

      <ThemeToggle />

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/how-it-works">How it works</Link>
          <span>© 2026 Summer Ice · Leiden, NL</span>
        </div>
      </footer>
    </div>
  );
}
