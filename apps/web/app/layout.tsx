import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "./components/nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Summer Ice",
  description: "Summer ice hockey in Leiden — registration, schedule and admin.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
