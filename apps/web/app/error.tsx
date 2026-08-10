"use client";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>Error</h1>
      <p>{error.message || "An unexpected error occurred."}</p>
      {process.env.NODE_ENV === "development" && error.stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{error.stack}</code>
        </pre>
      )}
    </main>
  );
}
