import Link from "next/link";
import { ShoppingCart } from "lucide-react";

export default function CartLink() {
  return (
    <Link
      href="/cart"
      aria-label="View shopping cart"
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-violet-900 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
    >
      <ShoppingCart size={24} aria-hidden="true" />
      <span>Cart</span>
    </Link>
  );
}
