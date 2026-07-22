"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Play,
  Plus,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import type { TaskSummary, LeaderboardEntry } from "@/lib/storage";

export default function ArenaPage() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data);
      if (data.length > 0) {
        setSelectedTask(data[0]);
        loadLeaderboard(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard(taskId: string) {
    try {
      const res = await fetch(`/api/leaderboard?taskId=${taskId}`);
      const data = await res.json();
      setLeaderboard(data);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failure":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "partial":
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case "running":
        return <Play className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-white" />
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

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Arena</h2>
          <Link
            href="/arena/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Tasks List */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold text-white mb-4">Tasks</h3>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 animate-pulse"
                  >
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">No tasks yet</p>
                <Link
                  href="/arena/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create First Task
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      loadLeaderboard(task.id);
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedTask?.id === task.id
                        ? "bg-blue-500/10 border-blue-500/50"
                        : "bg-slate-800/50 border-slate-700 hover:bg-slate-700/50"
                    }`}
                  >
                    <h4 className="font-semibold text-white">{task.title}</h4>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-slate-700/50 rounded-full text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="lg:col-span-2">
            {selectedTask ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Leaderboard: {selectedTask.title}
                  </h3>
                  <Link
                    href={`/arena/${selectedTask.id}`}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    View Details →
                  </Link>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="text-center py-12 bg-slate-800/30 border border-slate-700 rounded-xl">
                    <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 mb-4">
                      No runs yet for this task
                    </p>
                    <Link
                      href={`/arena/${selectedTask.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Run Task
                    </Link>
                  </div>
                ) : (
                  <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Rank
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Model
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Score
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Duration
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Steps
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                            Tokens
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((entry, rank) => (
                          <tr
                            key={entry.runId}
                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                  rank === 0
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : rank === 1
                                      ? "bg-slate-500/20 text-slate-400"
                                      : rank === 2
                                        ? "bg-orange-500/20 text-orange-400"
                                        : "bg-slate-700/20 text-slate-400"
                                }`}
                              >
                                {rank + 1}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-sm text-white">
                                {entry.modelName.split("/").pop()}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(entry.status)}
                                <span className="text-sm text-slate-300">
                                  {entry.status}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`font-bold ${getScoreColor(entry.score)}`}
                              >
                                {entry.score.toFixed(1)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-400">
                              {formatDuration(entry.durationMs)}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-400">
                              {entry.steps}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-400">
                              {entry.tokens.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p>Select a task to see the leaderboard</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
