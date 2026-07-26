"use client";

import { FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ErrorBanner } from "@/components/error-banner";
import { apiFetch, messageFromError } from "@/lib/client-api";

interface TextRow {
  id: string;
  value: string;
}

interface FileRow {
  id: string;
  path: string;
  language: string;
  content: string;
}

function newId(): string {
  return crypto.randomUUID();
}

export default function NewTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<TextRow[]>([{ id: "criterion-initial", value: "" }]);
  const [commands, setCommands] = useState<TextRow[]>([{ id: "command-initial", value: "" }]);
  const [files, setFiles] = useState<FileRow[]>([
    { id: "file-initial", path: "", language: "typescript", content: "" },
  ]);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ id: string }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          successCriteria: criteria.map((item) => item.value.trim()).filter(Boolean),
          testCommands: commands.map((item) => item.value.trim()).filter(Boolean),
          starterFiles: files
            .filter((file) => file.path.trim())
            .map(({ path, language, content }) => ({
              path: path.trim(),
              language: language.trim() || undefined,
              content,
            })),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      router.push("/arena");
      router.refresh();
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <AppHeader icon={<FilePlus2 aria-hidden="true" className="h-5 w-5" />} />
      <main className="container mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">New evaluation task</h1>
          <p className="mt-2 text-slate-400">
            Define the task contract used to group and compare imported trajectories.
          </p>
        </div>

        {error ? (
          <div className="mb-6">
            <ErrorBanner message={error} />
          </div>
        ) : null}

        <form onSubmit={(event) => void submit(event)} className="space-y-6">
          <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-white">Task details</h2>
            <div className="mt-4 space-y-4">
              <label htmlFor="task-title" className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Title</span>
                <input
                  id="task-title"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white focus:border-blue-400 focus:outline-none"
                  placeholder="Build a reliable queue worker"
                />
              </label>
              <label htmlFor="task-description" className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Description</span>
                <textarea
                  id="task-description"
                  maxLength={100_000}
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-y rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-blue-400 focus:outline-none"
                  placeholder="Describe requirements, constraints, and expected behavior."
                />
              </label>
              <label htmlFor="task-tags" className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Tags</span>
                <input
                  id="task-tags"
                  maxLength={2_000}
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white focus:border-blue-400 focus:outline-none"
                  placeholder="typescript, backend, reliability"
                />
                <span className="mt-1 block text-xs text-slate-500">Comma-separated</span>
              </label>
            </div>
          </section>

          <TextRowsSection
            title="Success criteria"
            description="Observable conditions that determine whether a run succeeded."
            rows={criteria}
            placeholder="All retry tests pass"
            inputPrefix="criterion"
            addLabel="Add criterion"
            onAdd={() => setCriteria((items) => [...items, { id: newId(), value: "" }])}
            onChange={(id, value) =>
              setCriteria((items) =>
                items.map((item) => (item.id === id ? { ...item, value } : item)),
              )
            }
            onRemove={(id) => setCriteria((items) => items.filter((item) => item.id !== id))}
          />

          <TextRowsSection
            title="Test commands"
            description="Commands recorded with the task contract; Trajectory Arena does not execute them."
            rows={commands}
            placeholder="npm test"
            inputPrefix="command"
            addLabel="Add command"
            onAdd={() => setCommands((items) => [...items, { id: newId(), value: "" }])}
            onChange={(id, value) =>
              setCommands((items) =>
                items.map((item) => (item.id === id ? { ...item, value } : item)),
              )
            }
            onRemove={(id) => setCommands((items) => items.filter((item) => item.id !== id))}
          />

          <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Starter files</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Optional source files embedded in the task definition.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFiles((items) => [
                    ...items,
                    { id: newId(), path: "", language: "typescript", content: "" },
                  ])
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add file
              </button>
            </div>
            <div className="mt-4 space-y-5">
              {files.map((file) => (
                <fieldset key={file.id} className="rounded-lg border border-slate-700 p-4">
                  <legend className="px-2 text-sm text-slate-400">Starter file</legend>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                    <label htmlFor={`file-path-${file.id}`}>
                      <span className="sr-only">File path</span>
                      <input
                        id={`file-path-${file.id}`}
                        value={file.path}
                        onChange={(event) =>
                          updateFile(setFiles, file.id, "path", event.target.value)
                        }
                        placeholder="src/index.ts"
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:border-blue-400 focus:outline-none"
                      />
                    </label>
                    <label htmlFor={`file-language-${file.id}`}>
                      <span className="sr-only">Language</span>
                      <input
                        id={`file-language-${file.id}`}
                        value={file.language}
                        onChange={(event) =>
                          updateFile(setFiles, file.id, "language", event.target.value)
                        }
                        placeholder="typescript"
                        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="Remove starter file"
                      disabled={files.length === 1}
                      onClick={() =>
                        setFiles((items) => items.filter((item) => item.id !== file.id))
                      }
                      className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                    >
                      <Trash2 aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                  <label htmlFor={`file-content-${file.id}`} className="mt-3 block">
                    <span className="sr-only">File contents</span>
                    <textarea
                      id={`file-content-${file.id}`}
                      rows={7}
                      value={file.content}
                      onChange={(event) =>
                        updateFile(setFiles, file.id, "content", event.target.value)
                      }
                      placeholder="File contents"
                      className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-white focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save aria-hidden="true" className="h-5 w-5" />
              {saving ? "Saving…" : "Save task"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function TextRowsSection({
  title,
  description,
  rows,
  placeholder,
  inputPrefix,
  addLabel,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  description: string;
  rows: TextRow[];
  placeholder: string;
  inputPrefix: string;
  addLabel: string;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <label htmlFor={`${inputPrefix}-${row.id}`} className="min-w-0 flex-1">
              <span className="sr-only">{title} item</span>
              <input
                id={`${inputPrefix}-${row.id}`}
                value={row.value}
                onChange={(event) => onChange(row.id, event.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <button
              type="button"
              aria-label={`Remove ${title.toLowerCase()} item`}
              disabled={rows.length === 1}
              onClick={() => onRemove(row.id)}
              className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function updateFile(
  setFiles: React.Dispatch<React.SetStateAction<FileRow[]>>,
  id: string,
  field: "path" | "language" | "content",
  value: string,
) {
  setFiles((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
}
