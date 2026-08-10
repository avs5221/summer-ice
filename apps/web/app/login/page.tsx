import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { SiteNav } from "../site-nav";
import { ThemeToggle } from "../theme-toggle";
import { GoogleSignInButton } from "./google-signin-button";
import { LoginForm } from "./login-form";
import shared from "../page.module.css";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in — Summer Ice",
};

// Thin server shell, same split as register/page.tsx: static chrome here,
// interaction (the form, the Google OAuth call) in client children.
export default function LoginPage() {
  return (
    <div className={shared.page}>
      <SiteNav active="login" />

      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.cardBrand}>
            <Image src="/logo-circle.png" alt="" width={26} height={26} className={shared.brandMark} />
            <span className={styles.cardWordmark}>
              Summer <span style={{ color: "var(--primary)" }}>Ice</span>
            </span>
          </div>

          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.subtitle}>Good to have you back.</p>

          <GoogleSignInButton />

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

      <ThemeToggle variant="floating" />

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/#how">How it works</Link>
          <span>© 2026 Summer Ice · Leiden, NL</span>
        </div>
      </footer>
    </div>
  );
}
