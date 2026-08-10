"use client";

import { DatabaseZap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ErrorBanner } from "@/components/error-banner";
import { apiFetch, messageFromError } from "@/lib/client-api";

export default function SeedPage() {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function seed() {
    setSeeding(true);
    setError(null);
    try {
      await apiFetch<{ success: boolean }>("/api/seed", { method: "POST" });
      router.push("/trajectories");
      router.refresh();
    } catch (seedError) {
      setError(messageFromError(seedError));
      setSeeding(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <AppHeader icon={<DatabaseZap aria-hidden="true" className="h-5 w-5" />} />
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <DatabaseZap aria-hidden="true" className="mx-auto h-14 w-14 text-blue-400" />
        <h1 className="mt-5 text-3xl font-bold text-white">Load bundled examples</h1>
        <p className="mt-3 text-slate-400">
          This explicit action writes one task, two trajectories, and their run metadata when
          storage is empty. Production deployments must enable seeding with configuration.
        </p>
        {error ? (
          <div className="mt-6 text-left">
            <ErrorBanner message={error} />
          </div>
        ) : null}
        <button
          type="button"
          disabled={seeding}
          onClick={() => void seed()}
          className="mt-8 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {seeding ? "Loading examples…" : "Load example data"}
        </button>
      </main>
    </div>
  );
}
