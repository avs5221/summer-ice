import type { Metadata } from "next";
import { ScheduleClient } from "./schedule-client";

export const metadata: Metadata = {
  title: "My schedule — Summer Ice",
};

export default function SchedulePage() {
  return <ScheduleClient />;
}
