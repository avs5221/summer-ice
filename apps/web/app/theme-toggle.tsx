"use client";

// Light/dark toggle from the "Summer Ice Landing" design. Two variants
// across the design's own pages, both implemented rather than reconciled
// to one: "inline" is a small bordered icon button sitting in a footer's
// link row or a sticky bar (landing, register); "floating" is the
// original fixed bottom-right button (login — that page's own revision
// never got moved to the inline style the others did). Toggles the
// `.dark` class on <html> — see globals.css's `@custom-variant dark`,
// which makes every `dark:` Tailwind utility site-wide follow this class
// rather than only `prefers-color-scheme`. The class itself is initialised
// before paint by the inline script in layout.tsx, so this component only
// ever reflects an already-correct state, never causes the flash it would
// if it were the thing setting the class for the first time.
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const STORAGE_KEY = "si-theme";

export function ThemeToggle({
  size,
  variant = "inline",
}: {
  size?: number;
  variant?: "inline" | "floating";
}) {
  // Null until mounted: matches whatever the inline script already put on
  // <html>, rather than guessing and risking a hydration mismatch.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Deliberately not a lazy `useState(() => ...)` initializer: that would
    // read `document` during the client's hydration render itself, so this
    // component's very first client render could already disagree with the
    // server-rendered icon (server never knows the theme) — the same class
    // of hydration mismatch `suppressHydrationWarning` fixes on <html> in
    // layout.tsx, but not fixable that way here since it's a structural
    // difference (which SVG renders), not just an attribute. Reading it a
    // tick later in an effect means the first client render still matches
    // the server, then corrects itself immediately after.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !(dark ?? document.documentElement.classList.contains("dark"));
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage disabled (private browsing, etc.) — the toggle still works
      // for this page load, it just won't persist.
    }
    setDark(next);
  }

  const isDark = dark ?? false;
  const resolvedSize = size ?? (variant === "floating" ? 44 : 34);

  return (
    <button
      type="button"
      onClick={toggle}
      title="Switch theme"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={variant === "floating" ? styles.themeToggleFloating : styles.themeToggle}
      style={{ width: resolvedSize, height: resolvedSize }}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M13.5 9.2A5.5 5.5 0 0 1 6.8 2.5a5.5 5.5 0 1 0 6.7 6.7Z" />
        </svg>
      )}
    </button>
  );
}
