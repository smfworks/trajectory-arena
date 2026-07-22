"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  Clock,
  BarChart3,
  Terminal,
  FileText,
  Search,
  Download,
  Share2,
} from "lucide-react";
import type { Trajectory, TrajectoryStep } from "@/lib/schema";

export default function TrajectoryReplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activePanel, setActivePanel] = useState<
    "reasoning" | "tool" | "terminal" | "files" | "tests"
  >("reasoning");
  const [fileView, setFileView] = useState<"diff" | "content">("diff");
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const id = resolvedParams?.id || "";

  // Load trajectory
  useEffect(() => {
    if (!id) return;
    loadTrajectoryById(id);
  }, [id]);

  async function loadTrajectoryById(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/trajectories/${id}`);
      if (!res.ok) throw new Error("Trajectory not found");
      const data = await res.json();
      setTrajectory(data);
      setCurrentStep(0);
    } catch (error) {
      console.error("Failed to load trajectory:", error);
    } finally {
      setLoading(false);
    }
  }

  // Playback logic
  useEffect(() => {
    if (isPlaying && trajectory) {
      const interval = 1000 / playbackSpeed;
      playIntervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= trajectory.steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, trajectory]);

  const step = trajectory?.steps[currentStep];
  const steps = trajectory?.steps || [];

  const togglePlay = () => {
    if (currentStep >= (steps.length - 1 || 0)) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const goPrev = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
    setIsPlaying(false);
  };

  const goNext = () => {
    setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
    setIsPlaying(false);
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
    setIsPlaying(false);
  };

  // Determine the active panel based on the current step
  useEffect(() => {
    if (!step) return;
    switch (step.type) {
      case "reasoning":
        setActivePanel("reasoning");
        break;
      case "tool_call":
      case "tool_result":
        setActivePanel("tool");
        break;
      case "terminal":
        setActivePanel("terminal");
        break;
      case "file_edit":
        setActivePanel("files");
        break;
      case "test_result":
        setActivePanel("tests");
        break;
    }
  }, [step]);

  // Get the current file state from checkpoints
  const getCurrentFileState = (): Record<string, string> => {
    const files: Record<string, string> = {};
    for (let i = 0; i <= currentStep; i++) {
      const s = steps[i];
      if (s?.type === "file_edit" && s.data.fileEdit) {
        const { filePath, operation, newContent, oldContent } = s.data.fileEdit;
        if (operation === "create" && newContent) {
          files[filePath] = newContent;
        } else if (operation === "edit" && newContent) {
          files[filePath] = newContent;
        } else if (operation === "delete") {
          delete files[filePath];
        }
      }
      if (s?.type === "checkpoint" && s.data.checkpoint) {
        Object.assign(files, s.data.checkpoint.files);
      }
    }
    return files;
  };

  const currentFiles = getCurrentFileState();
  const currentFilePath =
    step?.type === "file_edit" ? step.data.fileEdit?.filePath : undefined;
  const currentFileContent = currentFilePath
    ? currentFiles[currentFilePath] || ""
    : Object.keys(currentFiles).length > 0
      ? currentFiles[Object.keys(currentFiles)[0]]
      : "";

  // Get diff for current step
  const getCurrentDiff = () => {
    if (!step?.data.fileEdit) return null;
    return step.data.fileEdit.diff || null;
  };

  const diff = getCurrentDiff();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-400">Loading trajectory...</p>
        </div>
      </div>
    );
  }

  if (!trajectory) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            Trajectory not found
          </h3>
          <Link
            href="/trajectories"
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to trajectories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/trajectories"
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white">
              {trajectory.metadata.task.title}
            </h1>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trajectory.outcome.status)}`}
            >
              {trajectory.outcome.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const dataStr = JSON.stringify(trajectory, null, 2);
                const dataUri =
                  "data:application/json;charset=utf-8," +
                  encodeURIComponent(dataStr);
                const exportFileDefault = `trajectory-${trajectory.id}.json`;
                const link = document.createElement("a");
                link.setAttribute("href", dataUri);
                link.setAttribute("download", exportFileDefault);
                link.click();
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Export JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/trajectories/${trajectory.id}`
                );
              }}
              className="p-2 text-slate-400 hover:text-white transition-colors"
              title="Copy share link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Timeline + Controls */}
        <div className="w-96 border-r border-slate-800 flex flex-col">
          {/* Playback Controls */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={goPrev}
                disabled={currentStep === 0}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={goNext}
                disabled={currentStep >= steps.length - 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-slate-500">Speed:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                </select>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentStep + 1) / steps.length) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>
                  Step {currentStep + 1}/{steps.length}
                </span>
                <span>
                  {step?.timestamp &&
                    new Date(step.timestamp).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                </span>
              </div>
            </div>
          </div>

          {/* Step List */}
          <div className="flex-1 overflow-y-auto">
            {steps.map((s, index) => {
              const isActive = index === currentStep;
              const isVisited = index <= currentStep;
              return (
                <button
                  key={index}
                  onClick={() => goToStep(index)}
                  className={`w-full text-left p-3 border-b border-slate-800/50 transition-colors ${
                    isActive
                      ? "bg-blue-500/10 border-l-2 border-l-blue-500"
                      : isVisited
                        ? "hover:bg-slate-800/30"
                        : "hover:bg-slate-800/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                        isActive
                          ? "bg-blue-500 text-white"
                          : isVisited
                            ? "bg-slate-600 text-white"
                            : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm truncate">
                      {getStepLabel(s)}
                    </span>
                  </div>
                  {isActive && (
                    <div className="mt-1.5 ml-7 text-xs text-slate-400">
                      {getStepPreview(s)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Content View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-slate-800 flex items-center">
            <button
              onClick={() => setActivePanel("reasoning")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activePanel === "reasoning"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Reasoning
            </button>
            <button
              onClick={() => setActivePanel("tool")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activePanel === "tool"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Tool Call
            </button>
            <button
              onClick={() => setActivePanel("terminal")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activePanel === "terminal"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Terminal
            </button>
            <button
              onClick={() => setActivePanel("files")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activePanel === "files"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setActivePanel("tests")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activePanel === "tests"
                  ? "text-blue-400 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Tests
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === "reasoning" && renderReasoningPanel(step)}
            {activePanel === "tool" && renderToolPanel(step)}
            {activePanel === "terminal" && renderTerminalPanel(step)}
            {activePanel === "files" &&
              renderFilesPanel(step, currentFiles, fileView, setFileView)}
            {activePanel === "tests" && renderTestsPanel(step)}
          </div>
        </div>
      </div>

      {/* Metrics Footer */}
      <div className="border-t border-slate-800 px-6 py-3">
        <div className="flex items-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">Steps:</span>
            <span className="text-white">{trajectory.metadata.stats.totalSteps}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">Duration:</span>
            <span className="text-white">
              {formatDuration(trajectory.metadata.stats.durationMs)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tokens:</span>
            <span className="text-white">
              {trajectory.metadata.stats.tokens.total.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Model:</span>
            <span className="text-white font-mono">
              {trajectory.metadata.model.name.split("/").pop()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tools:</span>
            <span className="text-white">
              {trajectory.metadata.stats.toolsUsed.join(", ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions

function getStatusColor(status: string) {
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
}

function getStepLabel(step: TrajectoryStep): string {
  switch (step.type) {
    case "reasoning":
      return "Thinking...";
    case "tool_call":
      return `→ ${step.data.toolCall?.name || "tool"}`;
    case "tool_result":
      return `= ${step.data.toolResult?.success ? "OK" : "Error"}`;
    case "file_edit":
      return `${step.data.fileEdit?.operation} ${step.data.fileEdit?.filePath}`;
    case "terminal":
      return `$ ${step.data.terminal?.command}`;
    case "test_result":
      return `${step.data.testResult?.status}: ${step.data.testResult?.testName}`;
    case "checkpoint":
      return "Checkpoint";
    case "message":
      return `${step.data.message?.sender}: ${step.data.message?.text.slice(0, 40)}...`;
    default:
      return step.type;
  }
}

function getStepPreview(step: TrajectoryStep): string {
  switch (step.type) {
    case "reasoning":
      return step.data.reasoning?.text.slice(0, 80) + "...";
    case "tool_call":
      return JSON.stringify(step.data.toolCall?.arguments || {}).slice(0, 80);
    case "tool_result":
      return step.data.toolResult?.output.slice(0, 80) || "";
    case "file_edit":
      return `${step.data.fileEdit?.operation} ${step.data.fileEdit?.filePath}`;
    case "terminal":
      return step.data.terminal?.output.slice(0, 80) || "";
    case "test_result":
      return step.data.testResult?.output.slice(0, 80) || "";
    case "message":
      return step.data.message?.text.slice(0, 80) + "...";
    default:
      return "";
  }
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function renderReasoningPanel(step: TrajectoryStep | undefined) {
  if (!step || step.type !== "reasoning") {
    return (
      <div className="p-6 text-slate-500">
        <p>No reasoning data for this step.</p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto">
      <h3 className="text-sm font-semibold text-slate-400 mb-3">
        Reasoning Block
      </h3>
      <div className="prose prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
          {step.data.reasoning?.text}
        </div>
      </div>
    </div>
  );
}

function renderToolPanel(step: TrajectoryStep | undefined) {
  if (!step) {
    return (
      <div className="p-6 text-slate-500">
        <p>No tool data for this step.</p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto">
      {step.type === "tool_call" && step.data.toolCall && (
        <>
          <h3 className="text-sm font-semibold text-slate-400 mb-3">
            Tool Call: {step.data.toolCall.name}
          </h3>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-2">Arguments:</div>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap">
              {JSON.stringify(step.data.toolCall.arguments, null, 2)}
            </pre>
          </div>
        </>
      )}

      {step.type === "tool_result" && step.data.toolResult && (
        <>
          <h3 className="text-sm font-semibold text-slate-400 mb-3">
            Tool Result
          </h3>
          <div
            className={`bg-slate-800 rounded-lg p-4 ${
              step.data.toolResult.success
                ? "border border-green-500/30"
                : "border border-red-500/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  step.data.toolResult.success
                    ? "bg-green-400"
                    : "bg-red-400"
                }`}
              />
              <span className="text-xs text-slate-400">
                {step.data.toolResult.success ? "Success" : "Error"}
              </span>
            </div>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap">
              {step.data.toolResult.output}
            </pre>
          </div>
        </>
      )}

      {step.type !== "tool_call" && step.type !== "tool_result" && (
        <p className="text-slate-500">
          This step is not a tool call or result.
        </p>
      )}
    </div>
  );
}

function renderTerminalPanel(step: TrajectoryStep | undefined) {
  if (!step || step.type !== "terminal") {
    return (
      <div className="p-6 text-slate-500">
        <p>No terminal data for this step.</p>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto">
      <h3 className="text-sm font-semibold text-slate-400 mb-3">
        Terminal Output
      </h3>
      <div className="bg-black rounded-lg p-4 font-mono text-sm">
        <div className="text-green-400 mb-2">$ {step.data.terminal?.command}</div>
        <pre className="text-slate-300 whitespace-pre-wrap">
          {step.data.terminal?.output}
        </pre>
        {step.data.terminal && (
          <div className="mt-2 text-xs text-slate-500">
            Exit code: {step.data.terminal.exitCode}
          </div>
        )}
      </div>
    </div>
  );
}

function renderFilesPanel(
  step: TrajectoryStep | undefined,
  currentFiles: Record<string, string>,
  fileView: "diff" | "content",
  setFileView: (v: "diff" | "content") => void
) {
  if (!step || step.type !== "file_edit") {
    // Show current file state
    const filePaths = Object.keys(currentFiles);
    return (
      <div className="p-6 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-400 mb-3">
          Files in Workspace
        </h3>
        {filePaths.length === 0 ? (
          <p className="text-slate-500">No files in workspace.</p>
        ) : (
          <div className="space-y-4">
            {filePaths.map((path) => (
              <div key={path} className="bg-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-blue-400">{path}</span>
                </div>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {currentFiles[path]}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const { filePath, operation, oldContent, newContent, diff } = step.data.fileEdit!;

  return (
    <div className="p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-slate-400" />
          <div>
            <h3 className="text-sm font-semibold text-slate-400">
              File: {filePath}
            </h3>
            <span className="text-xs text-slate-500">
              Operation: {operation}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFileView("diff")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              fileView === "diff"
                ? "bg-blue-500 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-300"
            }`}
          >
            Diff
          </button>
          <button
            onClick={() => setFileView("content")}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              fileView === "content"
                ? "bg-blue-500 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-300"
            }`}
          >
            Content
          </button>
        </div>
      </div>

      {fileView === "diff" && diff && (
        <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm">
          {diff.map((entry, i) => {
            const color =
              entry.type === "add"
                ? "text-green-400"
                : entry.type === "remove"
                  ? "text-red-400"
                  : "text-slate-500";
            const prefix =
              entry.type === "add" ? "+" : entry.type === "remove" ? "-" : " ";
            return (
              <div
                key={i}
                className={`${color} leading-tight`}
              >
                <span className="text-slate-600">{prefix}</span>
                {entry.content}
              </div>
            );
          })}
        </div>
      )}

      {fileView === "content" && (
        <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm">
          <pre className="text-slate-300 whitespace-pre-wrap">
            {newContent || "(empty)"}
          </pre>
        </div>
      )}
    </div>
  );
}

function renderTestsPanel(step: TrajectoryStep | undefined) {
  if (!step || step.type !== "test_result") {
    return (
      <div className="p-6 text-slate-500">
        <p>No test data for this step.</p>
      </div>
    );
  }

  const { testName, status, output, durationMs } = step.data.testResult!;

  return (
    <div className="p-6 overflow-y-auto">
      <h3 className="text-sm font-semibold text-slate-400 mb-3">
        Test Result
      </h3>
      <div
        className={`bg-slate-800 rounded-lg p-4 border ${
          status === "pass"
            ? "border-green-500/30"
            : status === "fail"
              ? "border-red-500/30"
              : "border-yellow-500/30"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "pass"
                  ? "bg-green-400"
                  : status === "fail"
                    ? "bg-red-400"
                    : "bg-yellow-400"
              }`}
            />
            <span className="text-sm font-medium text-white">{testName}</span>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              status === "pass"
                ? "bg-green-500/20 text-green-400"
                : status === "fail"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {status}
          </span>
        </div>
        <div className="text-xs text-slate-500 mb-2">
          Duration: {durationMs}ms
        </div>
        <pre className="text-sm text-slate-300 whitespace-pre-wrap">
          {output}
        </pre>
      </div>
    </div>
  );
}
