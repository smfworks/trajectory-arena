import { BarChart3, ExternalLink, FileCheck2, FileJson, Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AppHeader />
      <main className="container mx-auto px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold text-white md:text-5xl">
            Inspect agent behavior,
            <span className="block text-blue-400">step by validated step</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Import, replay, and compare agentic coding trajectories without sending session data to
            an external service. Every persisted document is schema-validated first.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/trajectories"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600"
            >
              <Play aria-hidden="true" className="h-5 w-5" />
              Browse trajectories
            </Link>
            <Link
              href="/import"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-6 py-3 font-medium text-white hover:bg-slate-600"
            >
              <FileJson aria-hidden="true" className="h-5 w-5" />
              Import JSON
            </Link>
          </div>
        </section>

        <section aria-label="Product capabilities" className="mt-20 grid gap-6 md:grid-cols-3">
          <Feature
            icon={<Play aria-hidden="true" className="h-6 w-6 text-blue-400" />}
            title="Interactive replay"
            text="Navigate reasoning, tool calls, terminals, file state, and tests with bounded timeline rendering and keyboard controls."
          />
          <Feature
            icon={<BarChart3 aria-hidden="true" className="h-6 w-6 text-purple-400" />}
            title="Honest comparison"
            text="Group imported runs by task and rank outcomes with a documented deterministic score and tie-break policy."
          />
          <Feature
            icon={<ShieldCheck aria-hidden="true" className="h-6 w-6 text-green-400" />}
            title="Local-first integrity"
            text="Use atomic JSON writes, strict runtime schemas, safe identifiers, read-only mode, bounded requests, and explicit example seeding."
          />
        </section>

        <section className="mx-auto mt-16 max-w-3xl rounded-xl border border-slate-700 bg-slate-800/40 p-6">
          <div className="flex items-start gap-3">
            <FileCheck2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
            <div>
              <h2 className="font-semibold text-white">Scope boundary</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Trajectory Arena visualizes and evaluates imported records. It does not execute
                agent code, run task commands, or provide multi-writer database semantics.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-800 px-4 py-6 sm:px-6">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>© 2026 SMF Works · Trajectory Arena v1.0.0</span>
          <a
            href="https://github.com/smfworks/trajectory-arena"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 hover:text-slate-300"
          >
            Source on GitHub
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </article>
  );
}
