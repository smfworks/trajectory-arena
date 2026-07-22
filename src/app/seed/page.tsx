"use client";

import { useEffect } from "react";

export default function SeedPage() {
  useEffect(() => {
    fetch("/api/seed", { method: "POST" }).then(() => {
      window.location.href = "/trajectories";
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Seeding example data...</p>
      </div>
    </div>
  );
}
