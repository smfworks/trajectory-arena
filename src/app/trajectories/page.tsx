"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Play,
  Search,
  Filter,
  Trash2,
  Download,
  Calendar,
  Clock,
  BarChart3,
} from "lucide-react";
import type { TrajectorySummary } from "@/lib/storage";

export default function TrajectoriesPage() {
  const [trajectories, setTrajectories] = useState<TrajectorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState("");

  useEffect(() => {
    // Seed example data on first load via API
    fetch("/api/seed", { method: "POST" }).then(() => loadTrajectories());
  }, []);

  async function loadTrajectories() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterModel) params.set("model", filterModel);
      const res = await fetch(`/api/trajectories?${params.toString()}`);
      const data = await res.json();
      setTrajectories(data);
    } catch (error) {
      console.error("Failed to load trajectories:", error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = trajectories.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.modelName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-500/20 text-green-400";
      case "failure":
        return "bg-red-500/20 text-red-400";
      case "partial":
        return "bg-yellow-500/20 text-yellow-400";
      case "running":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-slate-500/20 text-slate-400";
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTokens = (n: number) => {
    if (n < 1000) return `${n}`;
    return `${(n / 1000).toFixed(1)}k`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Trajectory Arena</h1>
          </div>
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/arena"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Arena
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search trajectories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <select
              value={filterModel}
              onChange={(e) => {
                setFilterModel(e.target.value);
                loadTrajectories();
              }}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Models</option>
              <option value="poolside/Laguna-S-2.1-NVFP4">Laguna S2.1</option>
            </select>
            <Link
              href="/import"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <UploadIcon className="w-4 h-4" />
              Import
            </Link>
          </div>
        </div>

        {/* Trajectory List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 animate-pulse"
              >
                <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              No trajectories found
            </h3>
            <p className="text-slate-500">
              Import a trajectory or run a task in the Arena.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((t) => (
              <Link
                key={t.id}
                href={`/trajectories/${t.id}`}
                className="block bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:bg-slate-700/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {t.title}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                      {t.description}
                    </p>
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        <span>{t.stepsCount} steps</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(t.durationMs)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{formatTokens(t.tokensTotal)} tokens</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(t.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm font-mono text-slate-500">
                      {t.modelName.split("/").pop()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function UploadIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
