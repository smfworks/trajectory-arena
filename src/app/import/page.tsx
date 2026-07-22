"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";

export default function ImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    id?: string;
    error?: string;
  } | null>(null);

  async function handleImport() {
    if (!jsonInput.trim()) return;

    setImporting(true);
    setResult(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trajectory: jsonInput,
          source: "web-import",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, id: data.id });
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
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
              href="/trajectories"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Trajectories
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-3xl">
        <div className="text-center mb-8">
          <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Import Trajectory
          </h2>
          <p className="text-slate-400">
            Paste a trajectory JSON below to import it into the arena.
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Trajectory JSON
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste trajectory JSON here..."
            className="w-full h-96 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300 font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-slate-500">
              Accepts the Trajectory Arena schema (v1.0.0) or compatible formats.
            </div>
            <button
              onClick={handleImport}
              disabled={importing || !jsonInput.trim()}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import
                </>
              )}
            </button>
          </div>
        </div>

        {result && (
          <div
            className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
              result.success
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            {result.success ? (
              <Check className="w-5 h-5 text-green-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            )}
            <div>
              {result.success ? (
                <>
                  <div className="font-semibold text-green-400">
                    Import successful!
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    Trajectory ID: {result.id}
                  </div>
                  <Link
                    href={`/trajectories/${result.id}`}
                    className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block"
                  >
                    View trajectory →
                  </Link>
                </>
              ) : (
                <>
                  <div className="font-semibold text-red-400">Import failed</div>
                  <div className="text-sm text-slate-300 mt-1">
                    {result.error}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
