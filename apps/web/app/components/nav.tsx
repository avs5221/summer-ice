"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Plain, functional nav — no styling investment yet, just enough to walk
// the five wave-1 pages in order. Links to a concrete session so the roster
// page (which needs an :id) is reachable without clicking through admin.
const PROBLEM_SESSION_ID = "wed-2130";

const links = [
  { to: "/", label: "Home" },
  { to: "/register", label: "Register" },
  { to: "/schedule", label: "My schedule" },
  { to: "/admin", label: "Admin overview" },
  { to: `/admin/session/${PROBLEM_SESSION_ID}`, label: "Session roster" },
];

export function Nav() {
  const pathname = usePathname();

  // "/", "/register" and "/login" each have their own sticky nav
  // (site-nav.tsx), matching the "Summer Ice Landing" design — with a
  // Register CTA and a link to sign in, not this wave-1 walk-through nav.
  // Rendering both would stack two navs. The remaining wave-1 pages
  // (schedule, admin, session roster) haven't been restyled yet and
  // still use this one.
  if (pathname === "/" || pathname === "/register" || pathname === "/login") return null;

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <span className="font-bold text-gray-950 dark:text-white">Summer Ice</span>
        {links.map((link) => {
          // Exact match only — "/admin" and "/admin/session/…" would both
          // otherwise light up together under a startsWith check.
          const isActive = pathname === link.to;
          return (
            <Link
              key={link.to}
              href={link.to}
              className={
                isActive
                  ? "font-semibold text-gray-950 dark:text-white"
                  : "text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
