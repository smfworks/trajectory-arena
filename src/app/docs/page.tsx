import { BookOpen, Database, FileJson, LockKeyhole, Network } from "lucide-react";
import { AppHeader } from "@/components/app-header";

const endpoints = [
  ["GET", "/api/health", "Liveness and storage integrity summary"],
  ["GET", "/api/trajectories", "List trajectory summaries with bounded pagination"],
  ["POST", "/api/trajectories", "Create or replace a validated trajectory"],
  ["GET", "/api/trajectories/:id", "Read one trajectory"],
  ["GET", "/api/trajectories/:id/export", "Download a TrajectoryExport document"],
  ["POST", "/api/import", "Import a raw trajectory or export wrapper"],
  ["GET", "/api/tasks", "List evaluation tasks"],
  ["POST", "/api/tasks", "Create or update a task"],
  ["GET", "/api/leaderboard?taskId=:id", "Rank imported runs for a task"],
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AppHeader icon={<BookOpen aria-hidden="true" className="h-5 w-5" />} />
      <main className="container mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Documentation</h1>
          <p className="mt-2 text-slate-400">Runtime contract for Trajectory Arena v1.0.0.</p>
        </div>

        <DocSection icon={FileJson} title="Trajectory schema">
          <p>
            The canonical schema version is <code>1.0.0</code>. Imports reject unknown versions,
            unexpected object keys, mismatched step payloads, non-contiguous step indexes, invalid
            timestamps, non-finite numbers, and oversized fields. Structural statistics are
            recomputed while token and duration metrics are preserved.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">{`{
  "schemaVersion": "1.0.0",
  "id": "safe-entity-id",
  "metadata": { "task": {}, "model": {}, "environment": {}, "timing": {}, "stats": {} },
  "steps": [{ "stepIndex": 0, "timestamp": "ISO-8601", "type": "reasoning", "data": {} }],
  "outcome": { "status": "success", "summary": "...", "testResults": [] }
}`}</pre>
        </DocSection>

        <DocSection icon={Database} title="Storage model">
          <p>
            Validated JSON entity files under <code>data/trajectories</code>,{" "}
            <code>data/tasks</code>, and
            <code>data/runs</code> are the source of truth. Writes use a same-directory temporary
            file, filesystem sync, and atomic rename. Lists are derived from entity files, so
            mutable indexes cannot diverge after a crash. A persistent writable volume is required
            for containers.
          </p>
        </DocSection>

        <DocSection icon={Network} title="HTTP API">
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-900 text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Method
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Path
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(([method, path, purpose]) => (
                  <tr
                    key={`${method}-${path}`}
                    className="border-b border-slate-700/60 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-blue-300">{method}</td>
                    <td className="px-4 py-3 font-mono text-slate-200">{path}</td>
                    <td className="px-4 py-3 text-slate-400">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DocSection>

        <DocSection icon={LockKeyhole} title="Deployment security">
          <p>
            Production starts fail closed at the request boundary unless Basic authentication is
            configured or unauthenticated access is explicitly allowed. Set{" "}
            <code>TRAJECTORY_READ_ONLY=true</code> for immutable deployments. Example seeding is
            disabled in production unless
            <code>TRAJECTORY_ENABLE_SEED=true</code>. Put TLS termination in front of the service
            and keep the Docker port bound to loopback unless remote access is intentional.
          </p>
        </DocSection>
      </main>
    </div>
  );
}

function DocSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileJson;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
        <Icon aria-hidden="true" className="h-5 w-5 text-blue-400" />
        {title}
      </h2>
      <div className="docs-copy mt-3 min-w-0 leading-7 text-slate-300">{children}</div>
    </section>
  );
}
