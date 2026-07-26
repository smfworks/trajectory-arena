# Trajectory Arena Operations

## Supported production topology

Trajectory Arena 1.0 supports one Node.js process writing to one private, persistent filesystem volume. The storage layer serializes cross-process writes and fails competing writers closed, but this is not a shared database and is not designed for replicas, NFS, serverless ephemeral filesystems, or multi-tenant use.

Use PostgreSQL or another transactional service before introducing multiple application replicas.

## Deployment

### Docker Compose

1. Copy `.env.example` to `.env`.
2. Set a long, unique `TRAJECTORY_BASIC_AUTH_PASSWORD`.
3. Set `TRAJECTORY_PUBLIC_ORIGIN` to the externally visible HTTPS origin.
4. Start the service:

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 trajectory-arena
curl --fail http://127.0.0.1:3000/api/health
```

The Compose file binds port 3000 to loopback. Put a TLS reverse proxy in front of it for remote use. Configure request rate limits and a 10 MiB body limit at that proxy.

### Direct standalone Node deployment

```bash
npm ci
npm run check
npm run build
npm run prepare:standalone

export NODE_ENV=production
export HOSTNAME=127.0.0.1
export PORT=3000
export TRAJECTORY_DATA_DIR=/srv/trajectory-arena/data
export TRAJECTORY_BASIC_AUTH_USER=operator
export TRAJECTORY_BASIC_AUTH_PASSWORD='use-a-secret-manager'
export TRAJECTORY_PUBLIC_ORIGIN=https://arena.example.com
node .next/standalone/server.js
```

`TRAJECTORY_DATA_DIR` must be an explicit absolute path in production.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TRAJECTORY_DATA_DIR` | Production | none | Absolute path to the private persistent data directory |
| `TRAJECTORY_BASIC_AUTH_USER` | Normally | none | Single-operator HTTP Basic username |
| `TRAJECTORY_BASIC_AUTH_PASSWORD` | Normally | none | Single-operator HTTP Basic password |
| `TRAJECTORY_ALLOW_UNAUTHENTICATED` | No | `false` | Explicit fail-open override for isolated trusted environments |
| `TRAJECTORY_PUBLIC_ORIGIN` | Recommended | request origin | Canonical origin accepted for browser mutation requests |
| `TRAJECTORY_ALLOW_ORIGINLESS_MUTATIONS` | No | `false` | Permit authenticated trusted API clients without an `Origin` header; keep disabled for browser-only deployments |
| `TRAJECTORY_READ_ONLY` | No | `false` | Reject every write, import, seed, and delete operation |
| `TRAJECTORY_ENABLE_SEED` | No | `false` in production | Allow explicit bundled-example seeding |
| `HOSTNAME` | No | runtime-specific | Server bind host |
| `PORT` | No | `3000` | Server port |

Never combine `TRAJECTORY_ALLOW_UNAUTHENTICATED=true` with a network-exposed listener unless another trusted authentication layer protects the service.

## Health and monitoring

`GET /api/health` is unauthenticated and returns:

- application version;
- trajectory schema version;
- storage writability;
- task, trajectory, and run counts.

A corrupt entity or unavailable data directory makes health return HTTP 503. Monitor status code and latency. Application errors are logged to stderr; collect container stdout/stderr with the platform's log driver.

Alert on:

- repeated 401, 403, 409, 413, or 5xx responses at the reverse proxy;
- `/api/health` failures;
- persistent-volume exhaustion;
- unexpected growth in entity counts or backup size;
- container restart loops.

## Backup

Entity JSON files are the source of truth. For a consistent backup, prevent writes before copying.

### Docker Compose named volume

Run from the repository/deployment directory. This procedure resolves the real Compose-generated volume name from the service container instead of assuming a project prefix.

```bash
set -euo pipefail
mkdir -p backups
archive="trajectory-arena-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"

docker compose stop trajectory-arena
container=$(docker compose ps -aq trajectory-arena)
test -n "$container"
volume=$(docker inspect "$container" \
  --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')
test -n "$volume"

docker run --rm --read-only \
  --volume "$volume:/data:ro" \
  --volume "$PWD/backups:/backup" \
  --env ARCHIVE="$archive" \
  node:24.14.0-alpine@sha256:7fddd9ddeae8196abf4a3ef2de34e11f7b1a722119f91f28ddf1e99dcafdf114 \
  sh -euc 'tar --create --gzip --file "/backup/$ARCHIVE" --directory /data .'

sha256sum "backups/$archive" > "backups/$archive.sha256"
docker compose start trajectory-arena
curl --fail http://127.0.0.1:3000/api/health
```

If any backup command fails after the stop, restart the service only after inspecting the partial archive and removing it if necessary. Store the completed archive and checksum in a separate failure domain.

### Direct standalone data directory

Set `TRAJECTORY_READ_ONLY=true` and restart, confirm `/api/health` is healthy, then archive the complete configured data directory:

```bash
tar --create --gzip --file trajectory-arena-$(date -u +%Y%m%dT%H%M%SZ).tar.gz \
  --directory /srv/trajectory-arena data
sha256sum trajectory-arena-*.tar.gz > trajectory-arena-backups.sha256
```

Back up the complete directory. Do not copy individual collections independently while writes are enabled.

## Restore drill

### Docker Compose named volume

First preserve the current volume with the backup procedure above. Then select an archive and restore it into the stopped service's named volume:

```bash
set -euo pipefail
archive=trajectory-arena-YYYYMMDDTHHMMSSZ.tar.gz
sha256sum --check "backups/$archive.sha256"

docker compose stop trajectory-arena
container=$(docker compose ps -aq trajectory-arena)
test -n "$container"
volume=$(docker inspect "$container" \
  --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')
test -n "$volume"

docker run --rm \
  --volume "$volume:/data" \
  --volume "$PWD/backups:/backup:ro" \
  --env ARCHIVE="$archive" \
  node:24.14.0-alpine@sha256:7fddd9ddeae8196abf4a3ef2de34e11f7b1a722119f91f28ddf1e99dcafdf114 \
  sh -euc '
    find /data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
    tar --extract --gzip --file "/backup/$ARCHIVE" --directory /data
    chown -R 1001:1001 /data
    chmod 700 /data /data/tasks /data/trajectories /data/runs
    find /data -type f -exec chmod 600 {} +
  '

docker compose start trajectory-arena
curl --fail http://127.0.0.1:3000/api/health
```

Verify the list endpoints, representative replay, export, and leaderboard after health succeeds. For a drill, perform the restore against a disposable Compose project/volume and destroy it only after recording the verification output.

### Direct standalone data directory

1. Stop the service.
2. Preserve the failed/current data directory separately.
3. Verify the archive checksum.
4. Extract into a new empty directory.
5. Set owner-only permissions on the directory and files.
6. Start a disposable instance against the restored directory.
7. Verify `/api/health`, list endpoints, representative trajectory replay, export, and leaderboard.
8. Promote the restored directory only after verification.

Never overwrite the only copy of damaged data during recovery.

## Upgrade and rollback

Before upgrading:

- capture a backup;
- record the current image digest or release tag;
- run the release's documented checks;
- verify available disk space.

Rollback application code by restoring the previous immutable image. If a future release changes the schema or storage layout, follow that release's migration notes and restore the matching backup when rolling back. Version 1.0 does not perform destructive automatic migrations.

## Incident response

If corruption or unexpected access is detected:

1. Set the deployment read-only or stop it.
2. Preserve logs, the data directory, image digest, and configuration timestamps.
3. Rotate Basic credentials if disclosure is possible.
4. Do not delete or rewrite evidence.
5. Restore into a separate directory and validate before service recovery.
6. Report security issues using `SECURITY.md`.
