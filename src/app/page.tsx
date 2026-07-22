import Link from "next/link";
import {
  Play,
  Trophy,
  FileText,
  BarChart3,
  ExternalLink,
} from "lucide-react";

export default function Home() {
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
              href="/trajectories"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Trajectories
            </Link>
            <Link
              href="/arena"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Arena
            </Link>
            <Link
              href="/docs"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Docs
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Visualize & Evaluate
            <span className="block text-blue-400">Agentic Coding Trajectories</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            Record, replay, and analyze full agentic coding sessions. Watch
            models think, call tools, edit files, and ship code — step by step.
            Built for researchers evaluating coding models like Laguna S2.1.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/trajectories"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <FileText className="w-5 h-5 mr-2" />
              Browse Trajectories
            </Link>
            <Link
              href="/arena"
              className="inline-flex items-center justify-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Arena Leaderboard
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Interactive Replay
            </h3>
            <p className="text-slate-400 text-sm">
              Scrub through trajectories with play/pause, speed control, and
              step-by-step navigation. Watch code evolve in real time.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Arena Mode
            </h3>
            <p className="text-slate-400 text-sm">
              Define tasks, launch agent runs, and compare results on a
              leaderboard. See which models perform best on your benchmarks.
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Local-First
            </h3>
            <p className="text-slate-400 text-sm">
              All data stored locally. No external services. Export to JSON,
              HTML, or shareable links. Privacy-respecting by design.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-full text-sm text-slate-400">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            v1.0.0 — Phase 1 Foundation
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6">
        <div className="container mx-auto px-6 flex items-center justify-between text-sm text-slate-500">
          <span>© 2026 Trajectory Arena — SMF Works</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/smfworks/trajectory-arena"
              className="hover:text-slate-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <span>Open Source</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
