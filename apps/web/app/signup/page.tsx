import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up — Summer Ice",
};

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Create an account</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        Already have one?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
        .
      </p>
      <SignupForm />
    </main>
  );
}
