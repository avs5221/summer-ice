import { NavLink } from "react-router";

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

function linkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "font-semibold text-gray-950 dark:text-white"
    : "text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white";
}

export function Nav() {
  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <span className="font-bold text-gray-950 dark:text-white">Summer Ice</span>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={linkClass} end={link.to === "/"}>
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
