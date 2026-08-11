import type { Metadata } from "next";
import { DropInsClient } from "./drop-ins-client";

export const metadata: Metadata = {
  title: "Drop in this week — Summer Ice",
};

// Thin server shell, same split as register/page.tsx: static chrome here,
// all interaction (filters, picks, checkout) in the client child.
export default function DropInsPage() {
  return <DropInsClient />;
}
