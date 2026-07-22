# Trajectory Arena — Architecture

## Overview

Trajectory Arena is a local-first web application for recording, replaying, and
evaluating agentic coding trajectories. It visualizes how AI coding agents
think, call tools, edit files, and ship code — step by step.

## Architecture

```
trajectory-arena/
├── app/                    # Next.js App Router
│   ├── api/                # REST API routes
│   │   ├── trajectories/   # Trajectory CRUD
│   │   ├── trajectories/[id]/  # Single trajectory
│   │   ├── import/         # Import endpoint
│   │   ├── tasks/          # Task CRUD
│   │   ├── tasks/[id]/     # Single task
│   │   ├── runs/           # Run listing
│   │   └── leaderboard/    # Leaderboard
│   ├── trajectories/       # Trajectory list page
│   ├── trajectories/[id]/  # Trajectory replay page
│   ├── arena/              # Arena (tasks + leaderboard)
│   ├── arena/new/          # Task creation
│   ├── import/             # Import page
│   ├── docs/               # Documentation
│   ├── seed/               # Seed example data
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── lib/                    # Core libraries
│   ├── schema.ts           # Trajectory schema (TypeScript types)
│   ├── storage.ts          # Storage layer (SQLite + JSON)
│   └── examples.ts         # Example data generator
├── data/                   # Local data directory (auto-created)
│   ├── db.sqlite           # SQLite database
│   ├── trajectories/       # Trajectory JSON files
│   ├── tasks/              # Task JSON files
│   └── runs/               # Run JSON files
├── public/                 # Static assets
├── ARCHITECTURE.md         # This file
├── README.md               # Project readme
└── package.json
```

## Key Design Decisions

### 1. Local-First Storage

- **SQLite** for metadata indexing (fast queries, filtering, sorting)
- **JSON files** for full trajectory data (human-readable, portable)
- All data stored in `./data/` directory
- No external services or databases required

### 2. Trajectory Schema

The trajectory schema (`src/lib/schema.ts`) is versioned (semver) and
designed to be:

- **Clean**: Well-structured, easy to understand
- **Extensible**: Easy to add new step types and metadata
- **Portable**: Any tool can generate compatible logs

Schema version: `1.0.0`

### 3. Frontend Architecture

- **Next.js App Router** for server-side rendering and API routes
- **React** for interactive components
- **Tailwind CSS** for styling (dark theme, high contrast)
- **Lucide React** for icons

### 4. Replay Engine

The replay engine (`src/app/trajectories/[id]/page.tsx`) provides:

- Timeline scrubber with play/pause, speed control
- Step-by-step navigation
- Live code editor view with diff visualization
- Side panels for reasoning, tool calls, terminal, files, tests
- Smooth animations for timeline movement

### 5. Arena Mode

The arena mode (`src/app/arena/`) provides:

- Task definition interface (title, description, success criteria, starter files)
- Leaderboard for comparing multiple runs
- Task creation and management

## Data Flow

```
1. Trajectory Capture
   Agent → Trajectory Schema → Storage (SQLite + JSON)

2. Trajectory Replay
   Storage → API → Frontend → Replay Engine → UI

3. Arena
   Task Definition → Agent Run → Trajectory → Leaderboard
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trajectories` | List trajectories |
| POST | `/api/trajectories` | Create/update trajectory |
| GET | `/api/trajectories/:id` | Get trajectory |
| DELETE | `/api/trajectories/:id` | Delete trajectory |
| POST | `/api/import` | Import trajectory |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create/update task |
| GET | `/api/tasks/:id` | Get task |
| GET | `/api/runs` | List runs |
| GET | `/api/leaderboard` | Get leaderboard |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TRAJECTORY_DATA_DIR` | Data directory path | `./data` |

## Future Enhancements

- Phase 3: Agent launch hooks for automatic trajectory recording
- Phase 4: Video export, GIF generation, advanced metrics
- Monaco Editor integration for better code viewing
- WebSocket support for real-time trajectory streaming
