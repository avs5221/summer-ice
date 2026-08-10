import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "./components/nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Summer Ice",
  description: "Summer ice hockey in Leiden — registration, schedule and admin.",
};

// Sets the `.dark` class (see globals.css's `@custom-variant dark`) before
// first paint, from a stored preference if the landing page's theme toggle
// has ever been used, falling back to the OS preference otherwise — so
// dark mode still "just works" with no toggle click on every other page,
// exactly as it did before the toggle existed. Doing this in an inline
// script, not an effect, is what avoids a flash of the wrong theme: an
// effect only runs after React has already painted the initial HTML.
const THEME_INIT_SCRIPT = `
  try {
    var stored = localStorage.getItem("si-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
