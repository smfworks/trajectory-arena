# Security Policy

## Supported versions

Security updates are provided for the latest tagged release on `main`.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for `smfworks/trajectory-arena`, or contact SMF Works through the private contact channel listed on the organization profile.

Include:

- affected version or commit;
- reproduction steps and request payloads;
- expected and observed impact;
- whether credentials, source code, terminal output, or filesystem data may have been exposed;
- any temporary mitigation already applied.

We will acknowledge a complete report, assess severity, coordinate remediation, and publish an advisory when appropriate. Please do not access data that is not yours and do not disrupt production systems while validating a report.

## Security model

Trajectory Arena is a **single-operator, single-instance** application. Production access is protected by HTTP Basic authentication and must be placed behind TLS. It is not a multi-tenant authorization system.

Production fails closed unless either:

- `TRAJECTORY_BASIC_AUTH_USER` and `TRAJECTORY_BASIC_AUTH_PASSWORD` are both configured; or
- `TRAJECTORY_ALLOW_UNAUTHENTICATED=true` is explicitly set for a trusted, isolated deployment.

The health endpoint is intentionally unauthenticated for orchestrator probes and exposes only version, schema version, writability, and entity counts.

## Operational requirements

- Terminate TLS at a trusted reverse proxy.
- Bind the container port to loopback unless remote access is intentional.
- Apply reverse-proxy rate and body-size limits.
- Keep originless mutations disabled unless a trusted authenticated API client cannot send an `Origin` header.
- Keep the persistent data volume private to one Trajectory Arena process.
- Never place multiple replicas on the same JSON volume.
- Back up the data directory before upgrades.
- Leave example seeding disabled in production except during an explicit operator action.
