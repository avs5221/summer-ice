import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in — Summer Ice",
};

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Log in</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">
        New here?{" "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
        .
      </p>
      <LoginForm />
    </main>
  );
}
