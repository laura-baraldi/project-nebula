"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";

// Next.js provides the error and reset function to this error boundary.
type ProductsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProductsError({ reset }: ProductsErrorProps) {
  const router = useRouter();

  // Retry loading the current route and reset the error boundary.
  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-violet-50 px-6 py-16">
      <div
        role="alert"
        className="w-full max-w-lg rounded-2xl border border-violet-200 bg-white px-8 py-12 text-center shadow-sm"
      >
        <div aria-hidden="true" className="mb-4 text-5xl">
          🛸
        </div>

        <h1 className="text-2xl font-bold text-violet-900">
          Something went wrong
        </h1>

        <p className="mt-3 text-violet-700">
          We couldn&apos;t load the products right now. Please try again.
        </p>

        <button
          type="button"
          onClick={handleRetry}
          className="mt-6 rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-800"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
