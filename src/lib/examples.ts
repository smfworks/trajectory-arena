/**
 * Trajectory Arena — Example Data Generator
 *
 * Generates realistic example trajectories for demo purposes.
 * These are used to make the app demo-ready on first launch.
 */

import { v4 as uuidv4 } from "uuid";
import type { Trajectory, TaskDefinition, TaskRun } from "@/lib/schema";
import { TRAJECTORY_SCHEMA_VERSION } from "@/lib/schema";
import { computeStats } from "@/lib/storage";

/**
 * Create an example task: "Build a Todo List App"
 */
export function createTodoListTask(): TaskDefinition {
  return {
    id: "task-todo-list",
    title: "Build a Todo List App",
    description:
      "Create a simple todo list application using React. The app should allow users to add, remove, and mark todos as complete. Use a modern UI framework and ensure the app is responsive.",
    successCriteria: [
      "App displays a list of todos",
      "User can add new todos",
      "User can delete todos",
      "User can mark todos as complete/incomplete",
      "App is responsive and looks good",
    ],
    starterFiles: [
      {
        path: "package.json",
        content: JSON.stringify(
          {
            name: "todo-app",
            version: "1.0.0",
            private: true,
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              react: "^19.0.0",
              "react-dom": "^19.0.0",
            },
            devDependencies: {
              "@types/react": "^19.0.0",
              "@types/react-dom": "^19.0.0",
              vite: "^5.0.0",
              typescript: "^5.0.0",
            },
          },
          null,
          2
        ),
        language: "json",
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Todo List App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        language: "html",
      },
      {
        path: "src/main.tsx",
        content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        language: "typescript",
      },
    ],
    testCommands: ["npm run build"],
    tags: ["react", "typescript", "frontend", "beginner"],
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
}

/**
 * Create an example trajectory for the Todo List task.
 * This simulates a successful agent run.
 */
export function createTodoListTrajectory(): Trajectory {
  const startedAt = "2026-07-22T14:00:00.000Z";
  const endedAt = "2026-07-22T14:05:32.000Z";
  const durationMs = 332000;

  const steps = [
    {
      stepIndex: 0,
      timestamp: "2026-07-22T14:00:00.000Z",
      type: "message" as const,
      data: {
        message: {
          text: "You are a coding agent. Your task is to build a todo list application using React. Create the following files: App.tsx, TodoItem.tsx, TodoInput.tsx, and index.css. Make it look modern and responsive.",
          sender: "user" as const,
        },
      },
    },
    {
      stepIndex: 1,
      timestamp: "2026-07-22T14:00:01.000Z",
      type: "reasoning" as const,
      data: {
        reasoning: {
          text: "I need to build a todo list app with React. Let me start by understanding the task: I need to create App.tsx (main component), TodoItem.tsx (individual todo item), TodoInput.tsx (input form), and index.css (styling). I'll use TypeScript and make it responsive with a modern design. Let me first check the existing files, then create each component.",
        },
      },
    },
    {
      stepIndex: 2,
      timestamp: "2026-07-22T14:00:02.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "read_file",
          arguments: { path: "src/main.tsx" },
          toolCallId: "call_read_main",
        },
      },
    },
    {
      stepIndex: 3,
      timestamp: "2026-07-22T14:00:02.500Z",
      type: "tool_result" as const,
      data: {
        toolResult: {
          success: true,
          output: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
          toolCallId: "call_read_main",
        },
      },
    },
    {
      stepIndex: 4,
      timestamp: "2026-07-22T14:00:03.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "write_file",
          arguments: {
            path: "src/App.tsx",
            content: `import React, { useState } from "react";
import TodoInput from "./TodoInput.tsx";
import TodoItem from "./TodoItem.tsx";
import "./index.css";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
    };
    setTodos([newTodo, ...todos]);
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.length - activeCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-white">
          Todo List
        </h1>
        <TodoInput onAdd={addTodo} />
        <div className="mt-4 space-y-2">
          {todos.length === 0 ? (
            <p className="text-center text-slate-400 py-8">
              No todos yet. Add one above!
            </p>
          ) : (
            todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
              />
            ))
          )}
        </div>
        {todos.length > 0 && (
          <div className="mt-4 text-center text-sm text-slate-400">
            {activeCount} active, {completedCount} completed
          </div>
        )}
      </div>
    </div>
  );
}`,
          },
          toolCallId: "call_write_app",
        },
      },
    },
    {
      stepIndex: 5,
      timestamp: "2026-07-22T14:00:04.000Z",
      type: "file_edit" as const,
      data: {
        fileEdit: {
          filePath: "src/App.tsx",
          operation: "create" as const,
          oldContent: "",
          newContent: `import React, { useState } from "react";
import TodoInput from "./TodoInput.tsx";
import TodoItem from "./TodoItem.tsx";
import "./index.css";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);

  const addTodo = (text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
    };
    setTodos([newTodo, ...todos]);
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.length - activeCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-white">
          Todo List
        </h1>
        <TodoInput onAdd={addTodo} />
        <div className="mt-4 space-y-2">
          {todos.length === 0 ? (
            <p className="text-center text-slate-400 py-8">
              No todos yet. Add one above!
            </p>
          ) : (
            todos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
              />
            ))
          )}
        </div>
        {todos.length > 0 && (
          <div className="mt-4 text-center text-sm text-slate-400">
            {activeCount} active, {completedCount} completed
          </div>
        )}
      </div>
    </div>
  );
}`,
        },
      },
    },
    {
      stepIndex: 6,
      timestamp: "2026-07-22T14:00:05.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "write_file",
          arguments: {
            path: "src/TodoItem.tsx",
            content: `import React from "react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
      <button
        onClick={() => onToggle(todo.id)}
        className="flex items-center gap-3 flex-1 text-left"
      >
        <span
          className={\`w-5 h-5 rounded-full flex items-center justify-center \${
            todo.completed
              ? "bg-blue-500 text-white"
              : "border-2 border-slate-500"
          }\`}
        >
          {todo.completed && "✓"}
        </span>
        <span
          className={\`\${
            todo.completed ? "line-through text-slate-500" : "text-white"
          }\`}
        >
          {todo.text}
        </span>
      </button>
      <button
        onClick={() => onDelete(todo.id)}
        className="ml-2 text-red-400 hover:text-red-300 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}`,
          },
          toolCallId: "call_write_item",
        },
      },
    },
    {
      stepIndex: 7,
      timestamp: "2026-07-22T14:00:06.000Z",
      type: "file_edit" as const,
      data: {
        fileEdit: {
          filePath: "src/TodoItem.tsx",
          operation: "create" as const,
          oldContent: "",
          newContent: `import React from "react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
      <button
        onClick={() => onToggle(todo.id)}
        className="flex items-center gap-3 flex-1 text-left"
      >
        <span
          className={\`w-5 h-5 rounded-full flex items-center justify-center \${
            todo.completed
              ? "bg-blue-500 text-white"
              : "border-2 border-slate-500"
          }\`}
        >
          {todo.completed && "✓"}
        </span>
        <span
          className={\`\${
            todo.completed ? "line-through text-slate-500" : "text-white"
          }\`}
        >
          {todo.text}
        </span>
      </button>
      <button
        onClick={() => onDelete(todo.id)}
        className="ml-2 text-red-400 hover:text-red-300 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}`,
        },
      },
    },
    {
      stepIndex: 8,
      timestamp: "2026-07-22T14:00:07.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "write_file",
          arguments: {
            path: "src/TodoInput.tsx",
            content: `import React, { useState } from "react";

interface TodoInputProps {
  onAdd: (text: string) => void;
}

export default function TodoInput({ onAdd }: TodoInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text.trim());
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Add
      </button>
    </form>
  );
}`,
          },
          toolCallId: "call_write_input",
        },
      },
    },
    {
      stepIndex: 9,
      timestamp: "2026-07-22T14:00:08.000Z",
      type: "file_edit" as const,
      data: {
        fileEdit: {
          filePath: "src/TodoInput.tsx",
          operation: "create" as const,
          oldContent: "",
          newContent: `import React, { useState } from "react";

interface TodoInputProps {
  onAdd: (text: string) => void;
}

export default function TodoInput({ onAdd }: TodoInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text.trim());
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Add
      </button>
    </form>
  );
}`,
        },
      },
    },
    {
      stepIndex: 10,
      timestamp: "2026-07-22T14:00:09.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "write_file",
          arguments: {
            path: "src/index.css",
            content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-900 text-slate-100 antialiased;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: theme("colors.slate.800");
}
::-webkit-scrollbar-thumb {
  background: theme("colors.slate.600");
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: theme("colors.slate.500");
}`,
          },
          toolCallId: "call_write_css",
        },
      },
    },
    {
      stepIndex: 11,
      timestamp: "2026-07-22T14:00:10.000Z",
      type: "file_edit" as const,
      data: {
        fileEdit: {
          filePath: "src/index.css",
          operation: "create" as const,
          oldContent: "",
          newContent: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-900 text-slate-100 antialiased;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: theme("colors.slate.800");
}
::-webkit-scrollbar-thumb {
  background: theme("colors.slate.600");
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: theme("colors.slate.500");
}`,
        },
      },
    },
    {
      stepIndex: 12,
      timestamp: "2026-07-22T14:00:11.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "terminal",
          arguments: {
            command: "npm install",
            cwd: "/workspace/todo-app",
          },
          toolCallId: "call_npm_install",
        },
      },
    },
    {
      stepIndex: 13,
      timestamp: "2026-07-22T14:00:15.000Z",
      type: "terminal" as const,
      data: {
        terminal: {
          command: "npm install",
          output: `added 42 packages, and audited 43 packages in 4s

4 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities`,
          exitCode: 0,
        },
      },
    },
    {
      stepIndex: 14,
      timestamp: "2026-07-22T14:00:16.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "terminal",
          arguments: {
            command: "npm run build",
            cwd: "/workspace/todo-app",
          },
          toolCallId: "call_npm_build",
        },
      },
    },
    {
      stepIndex: 15,
      timestamp: "2026-07-22T14:00:20.000Z",
      type: "terminal" as const,
      data: {
        terminal: {
          command: "npm run build",
          output: `
  vite v5.0.0  ready in 847 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose

  (Press h to see available commands)
`,
          exitCode: 0,
        },
      },
    },
    {
      stepIndex: 16,
      timestamp: "2026-07-22T14:00:21.000Z",
      type: "test_result" as const,
      data: {
        testResult: {
          testName: "npm run build",
          status: "pass" as const,
          output: "Build completed successfully. No errors.",
          durationMs: 4000,
        },
      },
    },
    {
      stepIndex: 17,
      timestamp: "2026-07-22T14:00:22.000Z",
      type: "reasoning" as const,
      data: {
        reasoning: {
          text: "The build succeeded. Let me verify the app works by checking the output. The todo list app is complete with all required features: adding todos, deleting todos, marking as complete, and a responsive design with a modern dark theme. All success criteria are met.",
        },
      },
    },
    {
      stepIndex: 18,
      timestamp: "2026-07-22T14:00:23.000Z",
      type: "message" as const,
      data: {
        message: {
          text: "The todo list app is complete. I've created:\n\n1. **App.tsx** - Main component with state management for todos\n2. **TodoItem.tsx** - Individual todo item with toggle and delete\n3. **TodoInput.tsx** - Input form for adding new todos\n4. **index.css** - Tailwind CSS styling with dark theme\n\nThe app allows users to:\n- Add new todos via the input field\n- Mark todos as complete/incomplete by clicking the checkbox\n- Delete todos by clicking the ✕ button\n- See active/completed counts\n\nThe design uses a modern dark theme with gradient background, rounded corners, and smooth hover transitions. The build completed successfully with no errors.",
          sender: "agent" as const,
        },
      },
    },
  ];

  const stats = computeStats(steps);
  stats.tokens = { input: 1247, output: 2156, total: 3403 };

  const trajectory: Trajectory = {
    schemaVersion: TRAJECTORY_SCHEMA_VERSION,
    id: uuidv4(),
    runId: uuidv4(),
    metadata: {
      task: createTodoListTask(),
      model: {
        name: "poolside/Laguna-S-2.1-NVFP4",
        provider: "custom:dgx-spark",
        config: {
          temperature: 0.3,
          maxTokens: 4096,
        },
      },
      environment: {
        os: "Ubuntu 22.04 (DGX Spark)",
        workingDir: "/workspace/todo-app",
        nodeVersion: "v20.11.0",
        timestamp: "2026-07-22T14:00:00.000Z",
      },
      timing: {
        startedAt,
        endedAt,
        durationMs,
      },
      stats,
    },
    steps,
    outcome: {
      status: "success",
      summary:
        "Successfully built a complete todo list application with React, TypeScript, and Tailwind CSS. All files created, build passes, all success criteria met.",
      testResults: [
        {
          name: "npm run build",
          status: "pass" as const,
          output: "Build completed successfully. No errors.",
          durationMs: 4000,
        },
      ],
    },
  };

  return trajectory;
}

/**
 * Create a second example trajectory — a partial failure.
 * This simulates an agent that struggles with a task.
 */
export function createTodoListFailureTrajectory(): Trajectory {
  const startedAt = "2026-07-22T15:00:00.000Z";
  const endedAt = "2026-07-22T15:08:45.000Z";
  const durationMs = 525000;

  const steps = [
    {
      stepIndex: 0,
      timestamp: "2026-07-22T15:00:00.000Z",
      type: "message" as const,
      data: {
        message: {
          text: "Build a todo list app with React. Make sure it has add, delete, and toggle functionality.",
          sender: "user" as const,
        },
      },
    },
    {
      stepIndex: 1,
      timestamp: "2026-07-22T15:00:01.000Z",
      type: "reasoning" as const,
      data: {
        reasoning: {
          text: "I need to build a todo list app. Let me start by creating the main App component and the supporting components.",
        },
      },
    },
    {
      stepIndex: 2,
      timestamp: "2026-07-22T15:00:02.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "write_file",
          arguments: {
            path: "src/App.tsx",
            content: `import React, { useState } from "react";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { text: input, id: Date.now() }]);
      setInput("");
    }
  };

  return (
    <div>
      <h1>Todo List</h1>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}`,
          },
          toolCallId: "call_write_app",
        },
      },
    },
    {
      stepIndex: 3,
      timestamp: "2026-07-22T15:00:03.000Z",
      type: "file_edit" as const,
      data: {
        fileEdit: {
          filePath: "src/App.tsx",
          operation: "create" as const,
          oldContent: "",
          newContent: `import React, { useState } from "react";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { text: input, id: Date.now() }]);
      setInput("");
    }
  };

  return (
    <div>
      <h1>Todo List</h1>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>{todo.text}</li>
        ))}
      </ul>
    </div>
  );
}`,
        },
      },
    },
    {
      stepIndex: 4,
      timestamp: "2026-07-22T15:00:04.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "terminal",
          arguments: {
            command: "npm run build",
            cwd: "/workspace/todo-app",
          },
          toolCallId: "call_build",
        },
      },
    },
    {
      stepIndex: 5,
      timestamp: "2026-07-22T15:00:08.000Z",
      type: "terminal" as const,
      data: {
        terminal: {
          command: "npm run build",
          output: `
src/App.tsx:1:13 - error TS2307: Cannot find module 'react' or its corresponding type declarations.

1 import React, { useState } from "react";
              ~~~~~~~~~~~~~~

src/App.tsx:11:15 - error TS2332: Cannot find name 'useState'. Did you mean 'useState'?

11   const [todos, setTodos] = useState([]);
              ~~~~~~~~

Found 2 errors.

error Command failed with exit code 1.
`,
          exitCode: 1,
        },
      },
    },
    {
      stepIndex: 6,
      timestamp: "2026-07-22T15:00:09.000Z",
      type: "reasoning" as const,
      data: {
        reasoning: {
          text: "The build failed because React isn't installed. I need to run npm install first. Let me fix that.",
        },
      },
    },
    {
      stepIndex: 7,
      timestamp: "2026-07-22T15:00:10.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "terminal",
          arguments: {
            command: "npm install",
            cwd: "/workspace/todo-app",
          },
          toolCallId: "call_install",
        },
      },
    },
    {
      stepIndex: 8,
      timestamp: "2026-07-22T15:00:15.000Z",
      type: "terminal" as const,
      data: {
        terminal: {
          command: "npm install",
          output: `added 42 packages, and audited 43 packages in 4s

found 0 vulnerabilities`,
          exitCode: 0,
        },
      },
    },
    {
      stepIndex: 9,
      timestamp: "2026-07-22T15:00:16.000Z",
      type: "tool_call" as const,
      data: {
        toolCall: {
          name: "terminal",
          arguments: {
            command: "npm run build",
            cwd: "/workspace/todo-app",
          },
          toolCallId: "call_build2",
        },
      },
    },
    {
      stepIndex: 10,
      timestamp: "2026-07-22T15:00:20.000Z",
      type: "terminal" as const,
      data: {
        terminal: {
          command: "npm run build",
          output: `
  vite v5.0.0  ready in 847 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose

  (Press h to see available commands)
`,
          exitCode: 0,
        },
      },
    },
    {
      stepIndex: 11,
      timestamp: "2026-07-22T15:00:21.000Z",
      type: "test_result" as const,
      data: {
        testResult: {
          testName: "npm run build",
          status: "pass" as const,
          output: "Build completed successfully.",
          durationMs: 4000,
        },
      },
    },
    {
      stepIndex: 12,
      timestamp: "2026-07-22T15:00:22.000Z",
      type: "reasoning" as const,
      data: {
        reasoning: {
          text: "The build passes now, but I notice the app is missing delete and toggle functionality. The success criteria require all three features. Let me check if I should add them. The task says 'add, delete, and toggle functionality' but I only implemented add. I need to add the missing features.",
        },
      },
    },
    {
      stepIndex: 13,
      timestamp: "2026-07-22T15:00:23.000Z",
      type: "message" as const,
      data: {
        message: {
          text: "The build passes, but the app is missing delete and toggle functionality. The success criteria require all three features. I was unable to complete all requirements within the time limit. The app only has add functionality.",
          sender: "agent" as const,
        },
      },
    },
  ];

  const stats = computeStats(steps);
  stats.tokens = { input: 982, output: 1543, total: 2525 };

  const trajectory: Trajectory = {
    schemaVersion: TRAJECTORY_SCHEMA_VERSION,
    id: uuidv4(),
    runId: uuidv4(),
    metadata: {
      task: createTodoListTask(),
      model: {
        name: "poolside/Laguna-S-2.1-NVFP4",
        provider: "custom:dgx-spark",
        config: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      environment: {
        os: "Ubuntu 22.04 (DGX Spark)",
        workingDir: "/workspace/todo-app",
        nodeVersion: "v20.11.0",
        timestamp: "2026-07-22T15:00:00.000Z",
      },
      timing: {
        startedAt,
        endedAt,
        durationMs,
      },
      stats,
    },
    steps,
    outcome: {
      status: "partial",
      summary:
        "Build passes but app is missing delete and toggle functionality. Only add feature implemented.",
      testResults: [
        {
          name: "npm run build",
          status: "pass" as const,
          output: "Build completed successfully.",
          durationMs: 4000,
        },
      ],
    },
  };

  return trajectory;
}

/**
 * Seed the database with example data.
 */
export async function seedExampleData(): Promise<void> {
  const { saveTask, saveTrajectory, saveRun, listTrajectories } = await import("@/lib/storage");

  // Check if we already have data
  const existing = await listTrajectories();
  if (existing.length > 0) {
    console.log(`[seed] ${existing.length} trajectories already exist, skipping seed.`);
    return;
  }

  // Save task
  const task = createTodoListTask();
  await saveTask(task);

  // Save trajectories
  const traj1 = createTodoListTrajectory();
  await saveTrajectory(traj1);

  const traj2 = createTodoListFailureTrajectory();
  await saveTrajectory(traj2);

  // Save runs
  const run1: TaskRun = {
    id: traj1.runId!,
    taskId: task.id,
    trajectoryId: traj1.id,
    model: traj1.metadata.model,
    status: traj1.outcome.status,
    startedAt: traj1.metadata.timing.startedAt,
    endedAt: traj1.metadata.timing.endedAt,
    durationMs: traj1.metadata.timing.durationMs,
    testResults: traj1.outcome.testResults,
  };
  await saveRun(run1);

  const run2: TaskRun = {
    id: traj2.runId!,
    taskId: task.id,
    trajectoryId: traj2.id,
    model: traj2.metadata.model,
    status: traj2.outcome.status,
    startedAt: traj2.metadata.timing.startedAt,
    endedAt: traj2.metadata.timing.endedAt,
    durationMs: traj2.metadata.timing.durationMs,
    testResults: traj2.outcome.testResults,
  };
  await saveRun(run2);

  console.log("[seed] Created 1 task, 2 trajectories, 2 runs.");
}
