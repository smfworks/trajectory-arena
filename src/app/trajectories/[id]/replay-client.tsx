"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  FileCode2,
  Files,
  FlaskConical,
  Gauge,
  Pause,
  Play,
  TerminalSquare,
  Wrench,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ErrorBanner } from "@/components/error-banner";
import { apiFetch, messageFromError } from "@/lib/client-api";
import {
  getFileStateAtStep,
  getPanelForStep,
  type ReplayPanel,
  replayProgress,
} from "@/lib/replay";
import type { TestResult, Trajectory, TrajectoryStep } from "@/lib/schema";

const panels: Array<{ id: ReplayPanel; label: string; icon: typeof Brain }> = [
  { id: "reasoning", label: "Reasoning", icon: Brain },
  { id: "tool", label: "Tool", icon: Wrench },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "files", label: "Files", icon: Files },
  { id: "tests", label: "Tests", icon: FlaskConical },
];
const maxRenderedTestResults = 200;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="tab"]',
    ) !== null
  );
}

export function ReplayClient({ id }: { id: string }) {
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [panelOverride, setPanelOverride] = useState<{
    step: number;
    panel: ReplayPanel;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const loadTrajectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrajectory(await apiFetch<Trajectory>(`/api/trajectories/${encodeURIComponent(id)}`));
      setCurrentIndex(0);
      setPlaying(false);
    } catch (loadError) {
      setTrajectory(null);
      setError(messageFromError(loadError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTrajectory();
  }, [loadTrajectory]);

  const totalSteps = trajectory?.steps.length ?? 0;
  const step = trajectory?.steps[currentIndex];
  const activePanel =
    panelOverride?.step === currentIndex ? panelOverride.panel : getPanelForStep(step);
  const files = useMemo(
    () =>
      getFileStateAtStep(
        trajectory?.steps ?? [],
        currentIndex,
        trajectory?.metadata.task.starterFiles ?? [],
      ),
    [currentIndex, trajectory?.metadata.task.starterFiles, trajectory?.steps],
  );
  const fileNames = useMemo(() => Object.keys(files).sort(), [files]);
  const activeFile = selectedFile && selectedFile in files ? selectedFile : fileNames[0];

  const visibleTimeline = useMemo(() => {
    const steps = trajectory?.steps ?? [];
    const start = Math.max(0, currentIndex - 100);
    const end = Math.min(steps.length, currentIndex + 101);
    return { start, end, steps: steps.slice(start, end) };
  }, [currentIndex, trajectory?.steps]);

  useEffect(() => {
    if (!playing || totalSteps === 0) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= totalSteps - 1) {
          setPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 1_000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, totalSteps]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPlaying(false);
        setCurrentIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPlaying(false);
        setCurrentIndex((value) => Math.min(Math.max(0, totalSteps - 1), value + 1));
      }
      if (event.key === " ") {
        event.preventDefault();
        if (totalSteps === 0) return;
        if (!playing && currentIndex >= totalSteps - 1) setCurrentIndex(0);
        setPlaying((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, playing, totalSteps]);

  function movePanelFocus(event: ReactKeyboardEvent<HTMLButtonElement>, panelIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") nextIndex = (panelIndex - 1 + panels.length) % panels.length;
    if (event.key === "ArrowRight") nextIndex = (panelIndex + 1) % panels.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = panels.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextPanel = panels[nextIndex];
    setPanelOverride({ step: currentIndex, panel: nextPanel.id });
    const tabs = event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[nextIndex]?.focus();
  }

  async function copyTrajectory() {
    if (!trajectory) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(trajectory, null, 2));
      setCopyStatus("Copied trajectory JSON");
    } catch (copyError) {
      setCopyStatus(`Copy failed: ${messageFromError(copyError)}`);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <p aria-live="polite">Loading trajectory…</p>
      </div>
    );
  }

  if (error || !trajectory) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <Link href="/trajectories" className="inline-flex items-center gap-2 text-blue-400">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to trajectories
          </Link>
          <ErrorBanner
            message={error ?? "Trajectory was not found"}
            onRetry={() => void loadTrajectory()}
          />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-white lg:h-dvh lg:overflow-hidden">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/trajectories"
              aria-label="Back to trajectories"
              className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-semibold">{trajectory.metadata.task.title}</h1>
              <p className="truncate text-sm text-slate-400">{trajectory.metadata.model.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyTrajectory()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
            >
              <Clipboard aria-hidden="true" className="h-4 w-4" />
              Copy
            </button>
            <a
              href={`/api/trajectories/${encodeURIComponent(trajectory.id)}/export`}
              download
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm hover:bg-blue-600"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Export
            </a>
          </div>
        </div>
        {copyStatus ? (
          <p aria-live="polite" className="mt-2 text-right text-xs text-slate-400">
            {copyStatus}
          </p>
        ) : null}
      </header>

      <section
        aria-label="Final trajectory outcome"
        className="border-b border-slate-800 bg-slate-900/70 px-4 py-3 sm:px-6"
      >
        <div className="flex flex-wrap items-start gap-3 text-sm">
          <span className="rounded-full bg-slate-800 px-2.5 py-1 font-medium capitalize text-slate-200">
            {trajectory.outcome.status}
          </span>
          <p className="safe-wrap min-w-0 flex-1 leading-6 text-slate-300">
            {trajectory.outcome.summary}
          </p>
        </div>
      </section>

      {totalSteps === 0 ? (
        <main className="flex-1 overflow-auto px-6 py-12">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="text-center">
              <FileCode2 aria-hidden="true" className="mx-auto h-12 w-12 text-slate-600" />
              <h2 className="mt-4 text-xl font-semibold">This trajectory has no replay steps</h2>
              <p className="mt-2 text-slate-400">
                Metadata and outcome are valid. Starter files and final tests remain available
                below.
              </p>
            </div>
            <ZeroStepDetails trajectory={trajectory} />
          </div>
        </main>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <aside className="max-h-72 w-full shrink-0 overflow-y-auto border-b border-slate-800 bg-slate-900 lg:max-h-none lg:w-96 lg:border-b-0 lg:border-r">
              <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-400">
                Showing steps {visibleTimeline.start + 1}–{visibleTimeline.end} of {totalSteps}
              </div>
              <ol className="p-2" start={visibleTimeline.start + 1}>
                {visibleTimeline.steps.map((timelineStep, localIndex) => {
                  const absoluteIndex = visibleTimeline.start + localIndex;
                  const selected = absoluteIndex === currentIndex;
                  return (
                    <li key={timelineStep.stepIndex}>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentIndex(absoluteIndex);
                          setPlaying(false);
                        }}
                        aria-current={selected ? "step" : undefined}
                        className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors ${
                          selected
                            ? "bg-blue-500/20 text-blue-100"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                          {absoluteIndex + 1}. {timelineStep.type.replaceAll("_", " ")}
                        </span>
                        <span className="mt-1 block truncate text-sm">
                          {stepSummary(timelineStep)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div
                className="overflow-x-auto border-b border-slate-800 bg-slate-900 px-2"
                role="tablist"
                aria-label="Replay detail panels"
              >
                <div className="flex min-w-max">
                  {panels.map((panel, panelIndex) => {
                    const Icon = panel.icon;
                    return (
                      <button
                        key={panel.id}
                        type="button"
                        role="tab"
                        id={`replay-tab-${panel.id}`}
                        aria-controls="replay-tabpanel"
                        aria-selected={activePanel === panel.id}
                        tabIndex={activePanel === panel.id ? 0 : -1}
                        onClick={() => setPanelOverride({ step: currentIndex, panel: panel.id })}
                        onKeyDown={(event) => movePanelFocus(event, panelIndex)}
                        className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm ${
                          activePanel === panel.id
                            ? "border-blue-400 text-blue-300"
                            : "border-transparent text-slate-400 hover:text-white"
                        }`}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {panel.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <section
                id="replay-tabpanel"
                role="tabpanel"
                aria-labelledby={`replay-tab-${activePanel}`}
                className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-6"
              >
                <a
                  href="#replay-panel-content"
                  className="sr-only focus:not-sr-only focus:mb-4 focus:inline-block focus:rounded focus:bg-blue-500 focus:px-3 focus:py-2 focus:text-white"
                >
                  Jump to replay output
                </a>
                <div id="replay-panel-content">
                  {renderPanel(
                    activePanel,
                    step,
                    trajectory,
                    files,
                    fileNames,
                    activeFile,
                    setSelectedFile,
                  )}
                </div>
              </section>
            </main>
          </div>

          <footer className="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3 sm:px-6">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-blue-500 transition-[width]"
                style={{ width: `${replayProgress(currentIndex, totalSteps) * 100}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous step"
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setPlaying(false);
                    setCurrentIndex((value) => Math.max(0, value - 1));
                  }}
                  className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label={playing ? "Pause replay" : "Play replay"}
                  onClick={() => {
                    if (playing) {
                      setPlaying(false);
                      return;
                    }
                    if (currentIndex >= totalSteps - 1) setCurrentIndex(0);
                    setPlaying(totalSteps > 0);
                  }}
                  className="rounded-lg bg-blue-500 p-2 hover:bg-blue-600"
                >
                  {playing ? (
                    <Pause aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Play aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Next step"
                  disabled={currentIndex >= totalSteps - 1}
                  onClick={() => {
                    setPlaying(false);
                    setCurrentIndex((value) => Math.min(totalSteps - 1, value + 1));
                  }}
                  className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronRight aria-hidden="true" className="h-5 w-5" />
                </button>
                <span className="ml-2 text-sm text-slate-400">
                  Step {currentIndex + 1} of {totalSteps}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <Gauge aria-hidden="true" className="h-4 w-4" />
                Speed
                <select
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-white"
                >
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
              </label>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

function renderPanel(
  panel: ReplayPanel,
  step: TrajectoryStep | undefined,
  trajectory: Trajectory,
  files: Record<string, string>,
  fileNames: string[],
  activeFile: string | undefined,
  selectFile: (path: string) => void,
) {
  if (!step) return <EmptyPanel message="No step selected" />;
  if (panel === "reasoning") {
    const text = step.data.reasoning?.text ?? step.data.message?.text;
    return text ? (
      <CodeBlock value={text} />
    ) : (
      <EmptyPanel message="No reasoning or message for this step" />
    );
  }
  if (panel === "tool") {
    if (step.data.toolCall) {
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{step.data.toolCall.name}</h2>
          <CodeBlock value={JSON.stringify(step.data.toolCall.arguments, null, 2)} />
        </div>
      );
    }
    if (step.data.toolResult) {
      const result = step.data.toolResult;
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Tool result</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                result.success ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"
              }`}
            >
              {result.success ? "Succeeded" : "Failed"}
            </span>
          </div>
          {result.error ? (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Error</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-red-100">{result.error}</p>
            </div>
          ) : null}
          <CodeBlock value={result.output} />
        </div>
      );
    }
    return <EmptyPanel message="No tool call or result for this step" />;
  }
  if (panel === "terminal") {
    const terminal = step.data.terminal;
    return terminal ? (
      <div className="space-y-3">
        <p className="font-mono text-sm text-green-300">$ {terminal.command}</p>
        <CodeBlock value={terminal.output} />
        <p className="text-xs text-slate-500">Exit code: {terminal.exitCode}</p>
      </div>
    ) : (
      <EmptyPanel message="No terminal output for this step" />
    );
  }
  if (panel === "files") {
    const edit = step.data.fileEdit;
    return (
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
          <h2 className="px-2 py-2 text-sm font-semibold">Files at this step</h2>
          {fileNames.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">No files recorded</p>
          ) : (
            fileNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => selectFile(name)}
                className={`mb-1 w-full truncate rounded px-2 py-2 text-left font-mono text-xs ${
                  activeFile === name
                    ? "bg-blue-500/20 text-blue-200"
                    : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                {name}
              </button>
            ))
          )}
        </div>
        <div className="min-w-0 space-y-4">
          {edit ? (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-100">
              {edit.operation} <span className="font-mono">{edit.filePath}</span>
            </div>
          ) : null}
          {activeFile ? (
            <CodeBlock value={files[activeFile] ?? ""} />
          ) : (
            <EmptyPanel message="Select a file" />
          )}
        </div>
      </div>
    );
  }
  const tests: TestResult[] = step.data.testResult
    ? [
        {
          name: step.data.testResult.testName,
          status: step.data.testResult.status,
          output: step.data.testResult.output,
          durationMs: step.data.testResult.durationMs,
        },
      ]
    : trajectory.outcome.testResults;
  return <TestResults results={tests} />;
}

function ZeroStepDetails({ trajectory }: { trajectory: Trajectory }) {
  const starterFiles = trajectory.metadata.task.starterFiles;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-semibold">Starter files</h3>
        {starterFiles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No starter files recorded.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {starterFiles.map((file) => (
              <div key={file.path} className="min-w-0">
                <p className="mb-2 break-all font-mono text-xs text-blue-300">{file.path}</p>
                <CodeBlock value={file.content} />
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 font-semibold">Final tests</h3>
        <TestResults results={trajectory.outcome.testResults} />
      </section>
    </div>
  );
}

function TestResults({ results }: { results: TestResult[] }) {
  if (results.length === 0) return <EmptyPanel message="No test results recorded" />;
  const visible = results.slice(0, maxRenderedTestResults);
  const occurrences = new Map<string, number>();
  const keyedResults = visible.map((result) => {
    const signature = JSON.stringify(result);
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    return { key: `${signature}-${occurrence}`, result };
  });
  return (
    <div className="space-y-3">
      {results.length > visible.length ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Showing {visible.length} of {results.length} test results. Export the trajectory JSON for
          the complete set.
        </p>
      ) : null}
      {keyedResults.map(({ key, result }) => (
        <article key={key} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            {result.status === "pass" ? (
              <Check aria-hidden="true" className="h-5 w-5 text-green-400" />
            ) : result.status === "skip" ? (
              <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-400" />
            ) : (
              <XCircle aria-hidden="true" className="h-5 w-5 text-red-400" />
            )}
            <h2 className="font-semibold">{result.name}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                result.status === "pass"
                  ? "bg-green-500/15 text-green-300"
                  : result.status === "skip"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-red-500/15 text-red-300"
              }`}
            >
              {result.status}
            </span>
            <span className="ml-auto text-xs text-slate-500">{result.durationMs}ms</span>
          </div>
          <div className="mt-3">
            <CodeBlock value={result.output} />
          </div>
        </article>
      ))}
    </div>
  );
}

function CodeBlock({ value }: { value: string }) {
  const display =
    value.length > 200_000 ? `${value.slice(0, 200_000)}\n\n[output truncated in UI]` : value;
  return (
    <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-300">
      {display}
    </pre>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return <p className="py-12 text-center text-slate-500">{message}</p>;
}

function stepSummary(step: TrajectoryStep): string {
  const value =
    step.data.reasoning?.text ??
    step.data.message?.text ??
    step.data.toolCall?.name ??
    (step.data.toolResult
      ? step.data.toolResult.toolCallId
        ? `Tool result ${step.data.toolResult.toolCallId}`
        : "Tool result"
      : undefined) ??
    step.data.fileEdit?.filePath ??
    step.data.terminal?.command ??
    step.data.testResult?.testName ??
    (step.data.checkpoint ? "State checkpoint" : undefined) ??
    step.type.replaceAll("_", " ");
  return value.length > 100 ? `${value.slice(0, 100)}…` : value;
}
