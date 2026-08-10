"use client";

// Sticky table-of-contents with scroll-spy — highlights whichever section
// is currently under the sticky nav as the page scrolls, per
// Privacy.dc.html's own Component.onScroll. Reimplemented as a scroll
// listener rather than an IntersectionObserver to match that logic
// exactly: the *last* section whose top has crossed 120px from the
// viewport top is "current," not the first one merely visible — that
// distinction matters right at a section boundary.
import { useEffect, useState } from "react";
import styles from "./privacy.module.css";

export interface TocEntry {
  id: string;
  label: string;
}

export function TocNav({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState(entries[0]?.id ?? "");

  useEffect(() => {
    function onScroll() {
      let current = entries[0]?.id ?? "";
      for (const { id } of entries) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActive((prev) => (prev === current ? prev : current));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [entries]);

  return (
    <aside className={styles.tocAside}>
      <div className={styles.tocLabel}>On this page</div>
      <nav className={styles.tocList}>
        {entries.map((entry, i) => {
          const isActive = entry.id === active;
          return (
            <a key={entry.id} href={`#${entry.id}`} className={isActive ? styles.tocLinkActive : styles.tocLink}>
              <span className={isActive ? styles.tocNumActive : styles.tocNum}>{String(i + 1).padStart(2, "0")}</span>
              <span>{entry.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
