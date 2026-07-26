import { Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/trajectories", label: "Trajectories" },
  { href: "/arena", label: "Arena" },
  { href: "/import", label: "Import" },
  { href: "/docs", label: "Docs" },
];

export function AppHeader({ icon }: { icon?: ReactNode }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/40">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500">
            {icon ?? <Play aria-hidden="true" className="h-5 w-5" />}
          </span>
          <span className="text-lg font-bold sm:text-xl">Trajectory Arena</span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
