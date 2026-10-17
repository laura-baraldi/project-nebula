import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-violet-50 px-6 text-center">
      <span className="text-6xl">🐈‍⬛</span>

      <h1 className="text-5xl font-bold text-violet-900">Welcome to Nebula</h1>

      <p className="max-w-lg text-lg text-violet-700">
        Discover extraordinary products from a planet inhabited by adorable
        hairless cats.
      </p>

      <Link
        href="/products"
        className="rounded-full bg-violet-700 px-8 py-3 font-semibold text-white hover:bg-violet-800"
      >
        Explore the Galaxy
      </Link>
    </main>
  );
}
