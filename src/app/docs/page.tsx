import { Book, Code, Database, Layout, Play, BarChart3 } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Book className="w-8 h-8 text-blue-400" />
            <h1 className="text-xl font-bold text-white">Trajectory Arena</h1>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="/"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Home
            </a>
            <a
              href="/trajectories"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Trajectories
            </a>
            <a
              href="/arena"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Arena
            </a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <h2 className="text-3xl font-bold text-white mb-8">Documentation</h2>

        <div className="prose prose-invert max-w-none">
          <div className="space-y-8">
            {/* Overview */}
            <section>
              <h3 className="text-xl font-semibold text-white">Overview</h3>
              <p className="text-slate-300 leading-relaxed">
                Trajectory Arena is an open-source tool for recording,
                replaying, and evaluating agentic coding trajectories. It
                allows you to visualize how AI coding agents think, call tools,
                edit files, and ship code — step by step.
              </p>
            </section>

            {/* Trajectory Schema */}
            <section>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-400" />
                Trajectory Schema (v1.0.0)
              </h3>
              <p className="text-slate-300">
                Trajectories are stored as JSON files with a versioned schema.
                The schema is designed to be clean and extensible.
              </p>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto">
{`{
  "schemaVersion": "1.0.0",
  "id": "uuid",
  "runId": "uuid",
  "metadata": {
    "task": { "id": "...", "title": "...", "description": "..." },
    "model": { "name": "...", "provider": "...", "config": {} },
    "environment": { "os": "...", "workingDir": "..." },
    "timing": { "startedAt": "...", "endedAt": "...", "durationMs": 0 },
    "stats": { "totalSteps": 0, "tokens": { "input": 0, "output": 0 } }
  },
  "steps": [
    {
      "stepIndex": 0,
      "timestamp": "ISO8601",
      "type": "reasoning|tool_call|tool_result|file_edit|terminal|test_result|checkpoint|message",
      "data": { ... }
    }
  ],
  "outcome": { "status": "success|failure|partial", "summary": "..." }
}`}
                </pre>
              </div>
            </section>

            {/* Storage */}
            <section>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-green-400" />
                Storage
              </h3>
              <p className="text-slate-300">
                All data is stored locally. The application uses SQLite for
                metadata indexing and JSON files for full trajectory data.
              </p>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mt-4">
                <pre className="text-sm text-slate-300">
{`data/
  db.sqlite              # SQLite database (index)
  trajectories/          # Full trajectory JSON files
  tasks/                 # Task definition JSON files
  runs/                  # Run metadata JSON files`}
                </pre>
              </div>
            </section>

            {/* API */}
            <section>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Layout className="w-5 h-5 text-purple-400" />
                API
              </h3>
              <p className="text-slate-300">
                REST API for trajectory management.
              </p>
              <div className="space-y-2 mt-4">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <code className="text-blue-400">GET</code>{" "}
                  <code className="text-slate-300">/api/trajectories</code>
                  <span className="text-slate-500"> — List trajectories</span>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <code className="text-blue-400">GET</code>{" "}
                  <code className="text-slate-300">/api/trajectories/:id</code>
                  <span className="text-slate-500"> — Get trajectory</span>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <code className="text-green-400">POST</code>{" "}
                  <code className="text-slate-300">/api/import</code>
                  <span className="text-slate-500"> — Import trajectory</span>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <code className="text-blue-400">GET</code>{" "}
                  <code className="text-slate-300">/api/leaderboard?taskId=xxx</code>
                  <span className="text-slate-500"> — Get leaderboard</span>
                </div>
              </div>
            </section>

            {/* Architecture */}
            <section>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-yellow-400" />
                Architecture
              </h3>
              <p className="text-slate-300">
                See <a href="/ARCHITECTURE.md" className="text-blue-400">ARCHITECTURE.md</a> for the full architecture document.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
