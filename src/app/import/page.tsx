"use client";

import { AlertCircle, CheckCircle2, FileUp, Upload } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { apiFetch, messageFromError } from "@/lib/client-api";

const maxImportBytes = 10 * 1024 * 1024;

export default function ImportPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ id?: string; error?: string } | null>(null);
  const fileSelection = useRef(0);

  async function importJson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImporting(true);
    setResult(null);
    try {
      const parsed = JSON.parse(jsonInput) as unknown;
      const response = await apiFetch<{ id: string }>("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trajectory: parsed, source: "web-import" }),
      });
      setResult({ id: response.id });
    } catch (importError) {
      setResult({ error: messageFromError(importError) });
    } finally {
      setImporting(false);
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const selection = ++fileSelection.current;
    if (file.size > maxImportBytes) {
      setResult({ error: "The selected file exceeds the 10 MiB import limit." });
      input.value = "";
      return;
    }
    try {
      const contents = await file.text();
      if (selection !== fileSelection.current) return;
      setJsonInput(contents);
      setResult(null);
    } catch (fileError) {
      if (selection !== fileSelection.current) return;
      setResult({ error: messageFromError(fileError) });
    } finally {
      input.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AppHeader icon={<Upload aria-hidden="true" className="h-5 w-5" />} />
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="text-center">
          <FileUp aria-hidden="true" className="mx-auto h-12 w-12 text-blue-400" />
          <h1 className="mt-4 text-3xl font-bold text-white">Import trajectory</h1>
          <p className="mt-2 text-slate-400">
            Import schema v1.0.0 JSON. Inputs are size-bounded and fully validated before storage.
          </p>
        </div>

        <form
          onSubmit={(event) => void importJson(event)}
          className="mt-8 rounded-xl border border-slate-700 bg-slate-800/60 p-5 sm:p-6"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="trajectory-json" className="text-sm font-medium text-slate-300">
              Trajectory JSON
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-400">
              <FileUp aria-hidden="true" className="h-4 w-4" />
              Choose JSON file
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => void loadFile(event)}
                className="sr-only"
              />
            </label>
          </div>
          <textarea
            id="trajectory-json"
            required
            value={jsonInput}
            onChange={(event) => {
              fileSelection.current += 1;
              setJsonInput(event.target.value);
            }}
            rows={20}
            spellCheck={false}
            placeholder="Paste a trajectory or TrajectoryExport JSON document"
            className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-400 focus:outline-none"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Maximum request size: 10 MiB</span>
            <button
              type="submit"
              disabled={importing || !jsonInput.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload aria-hidden="true" className="h-4 w-4" />
              {importing ? "Importing…" : "Validate and import"}
            </button>
          </div>
        </form>

        {result ? (
          result.id ? (
            <div
              role="status"
              className="mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-100"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 text-green-400" />
                <div>
                  <p className="font-semibold">Import completed</p>
                  <p className="mt-1 break-all font-mono text-sm text-green-200">{result.id}</p>
                  <Link
                    href={`/trajectories/${result.id}`}
                    className="mt-3 inline-block text-blue-300 hover:text-blue-200"
                  >
                    Open replay →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-100"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold">Import failed</p>
                <p className="mt-1 text-sm">{result.error}</p>
              </div>
            </div>
          )
        ) : null}
      </main>
    </div>
  );
}
