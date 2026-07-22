# Contributing to Trajectory Arena

Thank you for your interest in contributing to Trajectory Arena! This document
outlines the development setup and guidelines.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/smfworks/trajectory-arena.git
cd trajectory-arena

# Install dependencies
npm install

# Start the development server
npm run dev

# Open http://localhost:3000
```

## Project Structure

```
src/
├── app/
│   ├── api/              # REST API routes (server-side)
│   ├── trajectories/     # Trajectory list + replay pages
│   ├── arena/            # Task definition + leaderboard
│   ├── import/           # Trajectory import page
│   ├── docs/             # Documentation page
│   ├── seed/             # Example data seeder
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── lib/
│   ├── schema.ts         # Trajectory schema (v1.0.0)
│   ├── storage.ts        # JSON file storage
│   └── examples.ts       # Example trajectory generator
└── public/               # Static assets
```

## Key Concepts

### Trajectory Schema
The trajectory schema is defined in `src/lib/schema.ts`. It is versioned
and designed to be extensible. When adding new fields:
- Add them to the appropriate interface
- Update the version if the change is breaking
- Document the change in the schema file

### Storage Layer
The storage layer (`src/lib/storage.ts`) uses JSON files for local-first
operation. The storage directory is `data/` (gitignored). Key functions:
- `saveTrajectory(trajectory)` — Save a trajectory
- `loadTrajectory(id)` — Load a trajectory by ID
- `listTrajectories()` — List all trajectories
- `deleteTrajectory(id)` — Delete a trajectory

### API Routes
API routes are in `src/app/api/`. They are server-side functions that
interact with the storage layer. All routes return JSON.

## Coding Guidelines

- Use TypeScript for all code
- Use `"use client"` for components that use client-side hooks
- Use `lucide-react` for icons
- Use Tailwind CSS for styling
- Keep components modular and reusable
- Document complex functions with JSDoc comments

## Adding a New Feature

1. **Schema changes** — Update `src/lib/schema.ts` if needed
2. **Storage** — Update `src/lib/storage.ts` if needed
3. **API** — Add or update routes in `src/app/api/`
4. **UI** — Add pages in `src/app/`
5. **Documentation** — Update README.md and ARCHITECTURE.md

## Testing

Currently, there is no formal test suite. To verify changes:
1. Run `npm run dev` and check the browser
2. Use `curl` to test API endpoints
3. Verify the seed endpoint works: `curl -X POST http://localhost:3000/api/seed`

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

By contributing, you agree that your contributions will be licensed under
the MIT License.
