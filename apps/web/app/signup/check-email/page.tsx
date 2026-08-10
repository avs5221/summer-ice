import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check your email — Summer Ice",
};

export default function CheckEmailPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Check your email</h1>
      <p className="mt-2 max-w-2xl text-gray-700 dark:text-gray-300">
        We&apos;ve sent a confirmation link to the address you signed up with. Follow it to
        finish creating your account.
      </p>
    </main>
  );
}
