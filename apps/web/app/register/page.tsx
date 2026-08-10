import type { Metadata } from "next";
import { RegisterClient } from "./register-client";

export const metadata: Metadata = {
  title: "Register — Summer Ice",
};

// Thin server shell so the route carries static metadata; all interaction
// (basket state, countdowns, the simulate button) lives in the client child.
export default function RegisterPage() {
  return <RegisterClient />;
}
