"use client";

// "Continue with Google" from the design — shipped disabled, not wired to
// a live redirect. Google isn't enabled as a provider on the Supabase
// project yet (docs/STATE.md's "Not built yet" list — needs external
// Google Cloud Console setup no session here can do unattended).
//
// Tried wiring it for real first, on the theory that a future-proofed
// call costs nothing until the provider is turned on — the same
// reasoning behind keeping "iDEAL or Wero" in the register page's copy.
// It doesn't hold here the way it did there: tested `signInWithOAuth`
// against the actual disabled provider (screenshot in this session's
// browser-verification pass) and confirmed there's no way to catch the
// failure in JS. Even with `skipBrowserRedirect: true`, Supabase's
// "is this provider enabled" check only happens server-side, when the
// browser actually requests the authorize URL — so `data.url` still
// comes back with no local `error`, and navigating to it lands the user
// on Supabase's raw `{"code":400,...}` JSON, replacing the whole page.
// That's a broken-looking result, not a graceful future-proofed one, so
// disabled-with-an-honest-reason beats live-but-breaks until the
// provider is actually configured.
//
// Promoted here from login/google-signin-button.tsx (design_handoff_
// season_dropins, 2026-08-11) once the drop-ins checkout modal became a
// second real use of the identical disabled button — same markup, same
// reasoning, so a shared `.googleBtn` (page.module.css) beats a second
// copy. Callers needing different sizing pass `className` to extend it.
import styles from "./page.module.css";

export function GoogleSignInButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      title="Google sign-in isn't set up yet — use email and password below."
      className={className ? `${styles.googleBtn} ${className}` : styles.googleBtn}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </svg>
      Continue with Google (coming soon)
    </button>
  );
}
