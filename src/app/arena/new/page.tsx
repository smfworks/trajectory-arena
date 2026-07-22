"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Plus, Trash2, Tag, FileText } from "lucide-react";
import type { TaskDefinition, FileSpec } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";

export default function NewTaskPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [successCriteria, setSuccessCriteria] = useState<string[]>([""]);
  const [testCommands, setTestCommands] = useState<string[]>([""]);
  const [tags, setTags] = useState("");
  const [starterFiles, setStarterFiles] = useState<FileSpec[]>([
    { path: "", content: "", language: "typescript" },
  ]);
  const [saving, setSaving] = useState(false);

  const addSuccessCriterion = () => {
    setSuccessCriteria([...successCriteria, ""]);
  };

  const updateSuccessCriterion = (index: number, value: string) => {
    const newCriteria = [...successCriteria];
    newCriteria[index] = value;
    setSuccessCriteria(newCriteria);
  };

  const removeSuccessCriterion = (index: number) => {
    setSuccessCriteria(successCriteria.filter((_, i) => i !== index));
  };

  const addTestCommand = () => {
    setTestCommands([...testCommands, ""]);
  };

  const updateTestCommand = (index: number, value: string) => {
    const newCommands = [...testCommands];
    newCommands[index] = value;
    setTestCommands(newCommands);
  };

  const removeTestCommand = (index: number) => {
    setTestCommands(testCommands.filter((_, i) => i !== index));
  };

  const updateStarterFile = (index: number, field: keyof FileSpec, value: string) => {
    const newFiles = [...starterFiles];
    newFiles[index] = { ...newFiles[index], [field]: value };
    setStarterFiles(newFiles);
  };

  const addStarterFile = () => {
    setStarterFiles([...starterFiles, { path: "", content: "", language: "typescript" }]);
  };

  const removeStarterFile = (index: number) => {
    setStarterFiles(starterFiles.filter((_, i) => i !== index));
  };

  async function handleSave() {
    if (!title.trim()) return;

    setSaving(true);
    try {
      const task: TaskDefinition = {
        id: uuidv4(),
        title,
        description,
        successCriteria: successCriteria.filter((c) => c.trim()),
        testCommands: testCommands.filter((c) => c.trim()),
        starterFiles: starterFiles.filter((f) => f.path.trim()),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });

      if (res.ok) {
        window.location.href = "/arena";
      }
    } catch (error) {
      console.error("Failed to save task:", error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
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
              href="/arena"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Arena
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">New Task</h2>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Task
              </>
            )}
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Basic Info</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Build a Todo List App"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of the task..."
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="react, typescript, frontend (comma-separated)"
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Success Criteria */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Success Criteria
              </h3>
              <button
                onClick={addSuccessCriterion}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="space-y-3">
              {successCriteria.map((criterion, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={criterion}
                    onChange={(e) => updateSuccessCriterion(index, e.target.value)}
                    placeholder={`Criterion ${index + 1}`}
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {successCriteria.length > 1 && (
                    <button
                      onClick={() => removeSuccessCriterion(index)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Test Commands */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Test Commands
              </h3>
              <button
                onClick={addTestCommand}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="space-y-3">
              {testCommands.map((command, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => updateTestCommand(index, e.target.value)}
                    placeholder={`e.g., npm test, npm run build`}
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  {testCommands.length > 1 && (
                    <button
                      onClick={() => removeTestCommand(index)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Starter Files */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Starter Files</h3>
              <button
                onClick={addStarterFile}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="space-y-4">
              {starterFiles.map((file, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={file.path}
                      onChange={(e) =>
                        updateStarterFile(index, "path", e.target.value)
                      }
                      placeholder="File path (e.g., src/App.tsx)"
                      className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={file.language}
                      onChange={(e) =>
                        updateStarterFile(index, "language", e.target.value)
                      }
                      placeholder="Language"
                      className="w-32 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {starterFiles.length > 1 && (
                      <button
                        onClick={() => removeStarterFile(index)}
                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={file.content}
                    onChange={(e) =>
                      updateStarterFile(index, "content", e.target.value)
                    }
                    placeholder="File contents..."
                    rows={6}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
