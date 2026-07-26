"use client";

import { AlertTriangle, CheckCircle2, FileCheck2, Play, Plus, Trophy, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ErrorBanner } from "@/components/error-banner";
import { apiFetch, messageFromError } from "@/lib/client-api";
import type { LeaderboardEntry, TaskSummary } from "@/lib/storage";

const loadingItems = ["task-loading-one", "task-loading-two", "task-loading-three"];

export default function ArenaPage() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const leaderboardRequest = useRef(0);

  const loadLeaderboard = useCallback(async (taskId: string) => {
    const requestId = ++leaderboardRequest.current;
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const entries = await apiFetch<LeaderboardEntry[]>(
        `/api/leaderboard?taskId=${encodeURIComponent(taskId)}`,
      );
      if (requestId === leaderboardRequest.current) setLeaderboard(entries);
    } catch (loadError) {
      if (requestId === leaderboardRequest.current) {
        setLeaderboardError(messageFromError(loadError));
        setLeaderboard([]);
      }
    } finally {
      if (requestId === leaderboardRequest.current) setLeaderboardLoading(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setTaskError(null);
    setLeaderboardError(null);
    leaderboardRequest.current += 1;
    try {
      const loaded = await apiFetch<TaskSummary[]>("/api/tasks");
      setTasks(loaded);
      const first = loaded[0] ?? null;
      setSelectedTask(first);
      if (first) await loadLeaderboard(first.id);
    } catch (loadError) {
      setTasks([]);
      setSelectedTask(null);
      setLeaderboard([]);
      setTaskError(messageFromError(loadError));
    } finally {
      setLoading(false);
    }
  }, [loadLeaderboard]);

  useEffect(() => {
    void loadTasks();
    return () => {
      leaderboardRequest.current += 1;
    };
  }, [loadTasks]);

  function selectTask(task: TaskSummary) {
    setSelectedTask(task);
    void loadLeaderboard(task.id);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AppHeader icon={<Trophy aria-hidden="true" className="h-5 w-5" />} />
      <main className="container mx-auto px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Arena</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Define evaluation tasks and compare imported runs. Trajectory Arena does not execute
              agents; run data arrives through the import API.
            </p>
          </div>
          <Link
            href="/arena/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New task
          </Link>
        </div>

        {taskError ? (
          <div className="mb-6">
            <ErrorBanner message={taskError} onRetry={() => void loadTasks()} />
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section aria-labelledby="task-list-heading">
            <h2 id="task-list-heading" className="mb-3 text-lg font-semibold text-white">
              Tasks
            </h2>
            {loading ? (
              <div className="space-y-3" aria-hidden="true">
                {loadingItems.map((key) => (
                  <div
                    key={key}
                    className="h-28 animate-pulse rounded-lg border border-slate-700 bg-slate-800/50"
                  />
                ))}
              </div>
            ) : taskError ? null : tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/30 p-6 text-center">
                <FileCheck2 aria-hidden="true" className="mx-auto h-10 w-10 text-slate-500" />
                <p className="mt-3 text-slate-400">No tasks have been defined.</p>
                <Link
                  href="/arena/new"
                  className="mt-4 inline-block text-blue-400 hover:text-blue-300"
                >
                  Create the first task
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => selectTask(task)}
                    aria-pressed={selectedTask?.id === task.id}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedTask?.id === task.id
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                    }`}
                  >
                    <span className="safe-wrap font-semibold text-white">{task.title}</span>
                    <span className="mt-1 block line-clamp-2 text-sm text-slate-400">
                      {task.description}
                    </span>
                    <span className="mt-3 flex flex-wrap gap-1">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="leaderboard-heading" className="min-w-0">
            {selectedTask ? (
              <>
                <div className="mb-4">
                  <h2
                    id="leaderboard-heading"
                    className="safe-wrap text-xl font-semibold text-white"
                  >
                    {selectedTask.title}
                  </h2>
                  <p className="safe-wrap mt-1 text-sm text-slate-400">
                    {selectedTask.description}
                  </p>
                  {selectedTask.successCriteria.length > 0 ? (
                    <ul className="mt-3 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
                      {selectedTask.successCriteria.map((criterion) => (
                        <li key={criterion} className="flex items-start gap-2">
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 h-4 w-4 shrink-0 text-green-400"
                          />
                          {criterion}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-xs text-slate-400">
                  Score: success 100, partial 50, all other outcomes 0. Ties resolve by shorter
                  duration, fewer tokens, then fewer steps.
                </div>

                {leaderboardError ? (
                  <div className="mb-4">
                    <ErrorBanner
                      message={leaderboardError}
                      onRetry={() => void loadLeaderboard(selectedTask.id)}
                      retryLabel="Retry leaderboard"
                    />
                  </div>
                ) : null}

                {leaderboardLoading ? (
                  <p
                    aria-live="polite"
                    className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center text-slate-400"
                  >
                    Loading leaderboard…
                  </p>
                ) : leaderboardError ? null : leaderboard.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/30 p-10 text-center">
                    <Trophy aria-hidden="true" className="mx-auto h-11 w-11 text-slate-500" />
                    <h3 className="mt-3 font-semibold text-white">
                      No runs imported for this task
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Import trajectories whose embedded task ID matches{" "}
                      <code className="break-all text-slate-300">{selectedTask.id}</code>.
                    </p>
                    <Link
                      href="/import"
                      className="mt-4 inline-block text-blue-400 hover:text-blue-300"
                    >
                      Import trajectory JSON
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/30">
                    <table className="w-full min-w-[48rem] text-sm">
                      <caption className="sr-only">Ranked runs for {selectedTask.title}</caption>
                      <thead className="border-b border-slate-700 text-left text-slate-400">
                        <tr>
                          <th scope="col" className="px-4 py-3">
                            Rank
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Model
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Status
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Score
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Duration
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Steps
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Tokens
                          </th>
                          <th scope="col" className="px-4 py-3">
                            Replay
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, index) => (
                          <tr
                            key={entry.runId}
                            className="border-b border-slate-700/60 text-slate-300 last:border-0"
                          >
                            <td className="px-4 py-3 font-semibold text-white">#{index + 1}</td>
                            <td className="px-4 py-3 font-mono">{entry.modelName}</td>
                            <td className="px-4 py-3">
                              <RunStatus status={entry.status} />
                            </td>
                            <td className="px-4 py-3 font-bold text-white">{entry.score}</td>
                            <td className="px-4 py-3">{formatDuration(entry.durationMs)}</td>
                            <td className="px-4 py-3">{entry.steps}</td>
                            <td className="px-4 py-3">{entry.tokens.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/trajectories/${entry.trajectoryId}`}
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                              >
                                <Play aria-hidden="true" className="h-4 w-4" />
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : taskError ? null : (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center text-slate-500">
                Select a task to inspect its imported runs.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function RunStatus({ status }: { status: LeaderboardEntry["status"] }) {
  const Icon = status === "success" ? CheckCircle2 : status === "partial" ? AlertTriangle : XCircle;
  const color =
    status === "success"
      ? "text-green-400"
      : status === "partial"
        ? "text-amber-400"
        : "text-red-400";
  return (
    <span className={`inline-flex items-center gap-1.5 capitalize ${color}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      {status}
    </span>
  );
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1_000).toFixed(1)}s`;
  return `${(milliseconds / 60_000).toFixed(1)}m`;
}
