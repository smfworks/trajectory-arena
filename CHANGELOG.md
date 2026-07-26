# Changelog

All notable changes to Trajectory Arena are documented here. The project follows semantic versioning.

## [Unreleased]

### Added

- Strict Zod validation for all persisted entities and API inputs.
- Atomic, fsynced JSON persistence with ownership-checked cross-process locking, durable transaction-journal recovery, and rollback.
- Coherent task/trajectory/run graph imports and deterministic example seeding.
- Production Basic authentication, same-origin mutation enforcement, read-only mode, and explicit seed gating.
- Health endpoint, application/schema version reporting, security headers, and standalone container deployment.
- Vitest unit/API/storage suites with coverage thresholds and Playwright browser workflows.
- Responsive, accessible loading, error, empty, bounded-list, filtering, replay, arena, task, import, and seed states.

### Changed

- Upgraded Next.js and React and removed unused runtime dependencies.
- Replaced the incompatible lint configuration with Biome.
- Made the supported production topology explicit: one process on one persistent local volume.

### Security

- Prevented request-controlled path traversal and symbolic-link reads.
- Added bounded JSON requests, bounded pagination, strict schema versions, and generic integrity errors.
- Production now fails closed when access control or persistent storage is not configured.
