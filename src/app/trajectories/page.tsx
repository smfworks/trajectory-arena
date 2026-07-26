"use client";

import {
  Calendar,
  CheckCircle2,
  Clock3,
  FileJson,
  Import,
  Play,
  PlusCircle,
  Search,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ErrorBanner } from "@/components/error-banner";
import { apiFetch, messageFromError } from "@/lib/client-api";
import type { Status } from "@/lib/schema";
import type { TrajectorySummary } from "@/lib/storage";

const loadingCards = ["loading-one", "loading-two", "loading-three"];
const pageSize = 100;

export default function TrajectoriesPage() {
  const [trajectories, setTrajectories] = useState<TrajectorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [model, setModel] = useState("");

  const loadTrajectories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await apiFetch<TrajectorySummary[]>(
        `/api/trajectories?limit=${pageSize}&offset=0`,
      );
      setTrajectories(loaded);
      setHasMore(loaded.length === pageSize);
    } catch (loadError) {
      setTrajectories([]);
      setHasMore(false);
      setError(messageFromError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMoreTrajectories() {
    setLoadingMore(true);
    setError(null);
    try {
      const loaded = await apiFetch<TrajectorySummary[]>(
        `/api/trajectories?limit=${pageSize}&offset=${trajectories.length}`,
      );
      setTrajectories((items) => [...items, ...loaded]);
      setHasMore(loaded.length === pageSize);
    } catch (loadError) {
      setError(messageFromError(loadError));
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadTrajectories();
  }, [loadTrajectories]);

  const modelOptions = useMemo(
    () => [...new Set(trajectories.map((item) => item.modelName))].sort(),
    [trajectories],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trajectories.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.modelName.toLowerCase().includes(query);
      return (
        matchesSearch && (!status || item.status === status) && (!model || item.modelName === model)
      );
    });
  }, [model, search, status, trajectories]);

  async function seedExamples() {
    setSeeding(true);
    setError(null);
    try {
      await apiFetch<{ success: boolean }>("/api/seed", { method: "POST" });
      await loadTrajectories();
    } catch (seedError) {
      setError(messageFromError(seedError));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AppHeader icon={<FileJson aria-hidden="true" className="h-5 w-5" />} />
      <main className="container mx-auto px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Trajectories</h1>
            <p className="mt-2 text-slate-400">
              Search, inspect, replay, and export validated agent sessions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/import"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
            >
              <Import aria-hidden="true" className="h-4 w-4" />
              Import JSON
            </Link>
            <Link
              href="/arena/new"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              New task
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6">
            <ErrorBanner message={error} onRetry={() => void loadTrajectories()} />
          </div>
        ) : null}

        <section
          aria-label="Trajectory filters"
          className="mb-6 grid gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4 md:grid-cols-[minmax(0,1fr)_12rem_16rem]"
        >
          <label className="relative">
            <span className="sr-only">Search trajectories</span>
            <Search aria-hidden="true" className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, description, or model"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pl-10 pr-3 text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
            />
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as Status | "")}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="partial">Partial</option>
              <option value="failure">Failure</option>
              <option value="running">Running</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by model</span>
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-blue-400 focus:outline-none"
            >
              <option value="">All models</option>
              {modelOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {loading || !error ? (
          <p aria-live="polite" className="mb-4 text-sm text-slate-400">
            {loading
              ? "Loading trajectories…"
              : `${filtered.length} of ${trajectories.length} loaded trajectories`}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-4" aria-hidden="true">
            {loadingCards.map((key) => (
              <div
                key={key}
                className="h-44 animate-pulse rounded-xl border border-slate-700 bg-slate-800/50"
              />
            ))}
          </div>
        ) : error ? null : trajectories.length === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-600 bg-slate-800/30 px-6 py-16 text-center">
            <FileJson aria-hidden="true" className="mx-auto h-12 w-12 text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">No trajectories yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-400">
              Import a validated trajectory or explicitly load the bundled examples. Browsing this
              page never changes stored data.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/import"
                className="rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
              >
                Import trajectory
              </Link>
              <button
                type="button"
                disabled={seeding}
                onClick={() => void seedExamples()}
                className="rounded-lg bg-slate-700 px-4 py-2 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
              >
                {seeding ? "Loading examples…" : "Load examples"}
              </button>
            </div>
          </section>
        ) : filtered.length === 0 ? (
          <section className="rounded-xl border border-slate-700 bg-slate-800/30 px-6 py-12 text-center">
            <Search aria-hidden="true" className="mx-auto h-10 w-10 text-slate-500" />
            <h2 className="mt-3 text-lg font-semibold text-white">No matching trajectories</h2>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("");
                setModel("");
              }}
              className="mt-4 text-blue-400 hover:text-blue-300"
            >
              Clear filters
            </button>
          </section>
        ) : (
          <>
            <div className="space-y-4">
              {filtered.map((trajectory) => (
                <TrajectoryCard key={trajectory.id} trajectory={trajectory} />
              ))}
            </div>
            {hasMore ? (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMoreTrajectories()}
                  className="rounded-lg bg-slate-700 px-5 py-2.5 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  {loadingMore ? "Loading more…" : "Load more trajectories"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function TrajectoryCard({ trajectory }: { trajectory: TrajectorySummary }) {
  return (
    <article className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 transition-colors hover:border-slate-600">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={trajectory.status} />
            <span className="truncate font-mono text-xs text-slate-500">{trajectory.id}</span>
          </div>
          <h2 className="safe-wrap mt-3 text-xl font-semibold text-white">{trajectory.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{trajectory.description}</p>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Model</dt>
              <dd className="font-mono text-slate-300">{trajectory.modelName}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="h-4 w-4" />
              <dt className="sr-only">Duration</dt>
              <dd>{formatDuration(trajectory.durationMs)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Play aria-hidden="true" className="h-4 w-4" />
              <dt className="sr-only">Steps</dt>
              <dd>{trajectory.stepsCount} steps</dd>
            </div>
            <div className="flex items-center gap-2">
              <Calendar aria-hidden="true" className="h-4 w-4" />
              <dt className="sr-only">Started</dt>
              <dd>{new Date(trajectory.startedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        <Link
          href={`/trajectories/${trajectory.id}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Play aria-hidden="true" className="h-4 w-4" />
          Replay
        </Link>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    success: "border-green-500/30 bg-green-500/10 text-green-300",
    partial: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    failure: "border-red-500/30 bg-red-500/10 text-red-300",
    running: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    cancelled: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  };
  const icons: Record<Status, typeof CheckCircle2> = {
    success: CheckCircle2,
    partial: TriangleAlert,
    failure: XCircle,
    running: Play,
    cancelled: XCircle,
  };
  const Icon = icons[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${styles[status]}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)}s`;
  return `${(milliseconds / 60_000).toFixed(1)}m`;
}
