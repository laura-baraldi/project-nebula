import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-violet-50 px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div aria-hidden="true" className="mb-6 text-6xl">
          🪐
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-violet-950">
          Product not found
        </h1>

        <p className="mt-4 leading-7 text-gray-600">
          This product may no longer be available or doesn&apos;t exist.
        </p>

        <Link
          href="/products"
          className="mt-8 inline-block rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-800"
        >
          Back to products
        </Link>
      </div>
    </main>
  );
}
