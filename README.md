# KB Navigator

KB Navigator is a self-hosted troubleshooting app for IT teams. It guides people through a question flow and lands them on the right solution quickly.

It includes a built-in admin editor so your team can manage the knowledgebase in the same app used for troubleshooting. No separate database is required.

## Contents
- Key Features
- Install and Run
- Configuration
- Operations
- Accessibility
- License
- API Reference

## Key Features

### End Users
- Guided troubleshooting from topic to final solution.
- Search across solutions with quick filtering and direct open.
- Shareable deep links to exact troubleshooting paths.
- Rich solution rendering (formatted text and images).
- Theme options (`Light`, `Dim`, `Dark`, `Black`).
- Stable performance and responsive layout across desktop, tablet, and phone.

### Admins
- Visual knowledgebase editor for topics, questions, and solutions.
- Rich-text solution editing with image upload and existing-image reuse.
- Version history and one-click rollback for question/solution content.
- Draft and edit-lock workflow for safer concurrent editing.
- Trash restore/purge workflows and integrity scanning.
- Batch admin actions for faster cleanup and conversion work.

### Superadmins
- User and role management (including approver permission).
- Approval workflow for solution changes, with approve/reject and reason tracking.
- Custom flag system to label and restrict solutions.
- In-app backup manager for manual backups, scheduled backups, retention, download, and restore.
- Role-gated audit log timeline with filtering, CSV export, and retention controls.

## Install and Run

### Path A: Self-Hosted (Non-Docker Source Install)

1. Prerequisites:
- Linux host/VM with sudo access
- Git
- Node.js 20+
- npm 10+

2. Install Node.js and npm (Ubuntu/Debian example):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

3. Create service user and install directory:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin kbnavigator || true
sudo mkdir -p /opt/KBNavigator
sudo chown -R kbnavigator:kbnavigator /opt/KBNavigator
sudo chmod -R u+rwX,g+rX,o-rwx /opt/KBNavigator
```

4. Clone and install:

```bash
sudo -u kbnavigator git clone https://github.com/jumby42/KB-Navigator.git /opt/KBNavigator
sudo -u kbnavigator -H bash -lc 'cd /opt/KBNavigator && npm install --omit=dev'
```

5. Configure runtime:

```bash
sudo -u kbnavigator cp /opt/KBNavigator/.env.example /opt/KBNavigator/.env
```

Edit `/opt/KBNavigator/.env` and set at least:
- `NODE_ENV=production`
- `PORT=3000`
- `AUTH_MODE=required`
- `SESSION_SECRET=<long-random-secret>`

Generate a strong secret:

```bash
openssl rand -hex 32
```

6. Start with systemd (recommended):

Create `/etc/systemd/system/kbnavigator.service`:

```ini
[Unit]
Description=KB Navigator
After=network.target

[Service]
Type=simple
User=kbnavigator
Group=kbnavigator
WorkingDirectory=/opt/KBNavigator
EnvironmentFile=/opt/KBNavigator/.env
ExecStart=/usr/bin/node /opt/KBNavigator/server/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable kbnavigator
sudo systemctl start kbnavigator
sudo systemctl status kbnavigator
```

Open the app:
- `http://<server-ip-or-hostname>:3000`

### Path B: Docker via GHCR Image

1. Prerequisites:
- Docker Engine
- Docker Compose plugin (`docker compose`)

2. Create deployment folder:

```bash
mkdir -p ~/kbnavigator-docker
cd ~/kbnavigator-docker
```

3. Create `.env`:

```bash
cat > .env <<'EOF'
NODE_ENV=production
PORT=3000
AUTH_MODE=required
SESSION_SECRET=
TRUST_PROXY=false
KBNAVIGATOR_IMAGE=ghcr.io/jumby42/kbnavigator:v1.0.0
KBNAVIGATOR_PORT=3000
EOF
```

4. Set a strong session secret:

```bash
SESSION_SECRET="$(openssl rand -hex 32)"
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
```

If OpenSSL is unavailable:

```bash
SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
```

5. Create `docker-compose.yml`:

```bash
cat > docker-compose.yml <<'EOF'
services:
  kbnavigator:
    image: ${KBNAVIGATOR_IMAGE:-ghcr.io/jumby42/kbnavigator:v1.0.0}
    restart: unless-stopped
    platform: linux/amd64
    env_file:
      - .env
    ports:
      - "${KBNAVIGATOR_PORT:-3000}:3000"
    volumes:
      - kbn_data:/app/data

volumes:
  kbn_data:
EOF
```

6. Pull and start:

```bash
docker compose pull
docker compose up -d
```

7. Check logs:

```bash
docker compose logs -f
```

8. Update to a newer image tag:

```bash
# update KBNAVIGATOR_IMAGE in .env first
docker compose pull
docker compose up -d
```

9. Stop:

```bash
docker compose down
```

Persistent data:
- Docker uses named volume `kbn_data` mounted at `/app/data`.
- Knowledgebase, users, flags, approvals, versions, drafts, backups, and sessions persist across container restarts.

## Configuration

Configuration precedence:
1. Built-in defaults
2. `config.json` (optional)
3. Environment variable overrides
4. Validation

Common environment variables:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP listen port |
| `NODE_ENV` | `development` or `production` |
| `SESSION_SECRET` | Session signing secret (required in production) |
| `AUTH_MODE` | `optional` or `required` |
| `TRUST_PROXY` | Enable if behind reverse proxy |
| `KB_ROOT` | Knowledgebase root path |
| `DATA_DIR` | Data directory root |
| `BACKUPS_DIR` | Backup storage directory |

For full runtime options, see:
- `config.json.example`
- `.env.example`

## Operations

### First Run Setup
- On first launch, open the app and create the initial superadmin account.

### Backups and Restore
- Superadmins can create manual backups, configure scheduled backups, and set retention.
- Restore supports existing backup archives and uploaded archives.
- A safety snapshot is created automatically before restore apply.
- A service restart may be required after restore depending on runtime manager behavior.

### Reverse Proxy Example (nginx)

```nginx
server {
  listen 80;
  server_name your-hostname;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Set `TRUST_PROXY=true` when running behind a reverse proxy.

### Audit Log
- Admins and superadmins can be granted Audit Log access by superadmin.
- Audit entries are append-only and automatically pruned by retention policy.
- Superadmins can set retention days in Settings.

### Troubleshooting
- App fails to start in production: set a valid `SESSION_SECRET`.
- Login API returns rate-limit errors: wait for window reset or tune rate-limit settings.
- Uploaded images do not load: confirm file exists under the solution folder and is served through `/api/asset/...`.
- Container does not start: check `docker compose ps` and `docker compose logs`.

## Accessibility

KB Navigator includes practical accessibility support for day-to-day use (keyboard navigation, focus handling for overlays/modals, readable themes, and reduced-motion behavior). It is not formally certified against WCAG/Section 508 standards.

## License

This project is licensed under the MIT License.
See `LICENSE` for full terms.

## API Reference

All API responses are JSON and include an `ok` boolean.

### Auth and Setup

| Method | Path | Auth | Description | Request |
|---|---|---|---|---|
| `GET` | `/api/setup/status` | Public | Check whether first-time setup is required | None |
| `POST` | `/api/setup/superadmin` | Public (first run only) | Create initial superadmin | Body: `username`, `password`, `confirmPassword` |
| `POST` | `/api/auth/login` | Public | Authenticate and create session | Body: `username`, `password`, `rememberMe` |
| `POST` | `/api/auth/logout` | Session optional | Destroy session | None |
| `GET` | `/api/auth/me` | Session optional | Get current user session state | None |
| `POST` | `/api/user/change-password` | Authenticated | Change current user password | Body: `oldPassword`, `newPassword` |
| `POST` | `/api/auth/change-password` | Authenticated | Alias endpoint for password change | Body: `oldPassword`, `newPassword` |

### Read Endpoints

| Method | Path | Auth | Description | Request |
|---|---|---|---|---|
| `GET` | `/api/public/stats` | Public | Get public landing-page stats (`solutionCount`) | None |
| `GET` | `/api/ui/settings` | Public or Auth (depends on `AUTH_MODE`) | Get global UI defaults for flag contrast display | None |
| `GET` | `/api/topics` | Public or Auth (depends on `AUTH_MODE`) | List top-level troubleshooting topics | None |
| `GET` | `/api/search` | Public or Auth (depends on `AUTH_MODE`) | Search terminal solutions by name and `solution.html` text | Query: `q`, optional `page`, optional `pageSize` (max 25) |
| `GET` | `/api/node` | Public or Auth (depends on `AUTH_MODE`) | Get node or terminal payload | Query: `path=<kb-relative-path>` |
| `GET` | `/api/asset/*` | Same as read mode | Serve uploaded image assets from KB | Wildcard path |

`/api/node` returns:
- `type: "node"` with `question` and `answers`
- `type: "terminal"` with `solutionHtml` (or restricted message when blocked)
- `type: "missing"` when path is not valid

### UI Preferences Endpoints

| Method | Path | Auth | Description | Request |
|---|---|---|---|---|
| `GET` | `/api/ui/preferences/display` | Session optional | Get current display preferences (`theme` always; tree preferences for admin/superadmin) | None |
| `POST` | `/api/ui/preferences/display` | Authenticated | Save display preferences for current user account | Body: display fields to update |

### Admin Endpoints (`admin` or `superadmin`)

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/admin/tree` | Get Knowledgebase + Trash trees | None |
| `GET` | `/api/admin/tree/status` | Get admin tree cache status | None |
| `GET` | `/api/admin/integrity/scan` | Run/read integrity scan results | Query: optional `force=true` |
| `DELETE` | `/api/admin/integrity/history` | Clear persisted integrity scan history | None |
| `GET` | `/api/admin/search/index/status` | Get search index runtime status | None |
| `POST` | `/api/admin/search/index/rebuild` | Trigger search index rebuild | Body: optional `reason` |
| `POST` | `/api/admin/topic` | Create top-level topic | Body: `name`, `question` |
| `POST` | `/api/admin/answer` | Create child answer node/folder | Body: `parentPath`, `answerName`, `kind` (`question` or `solution`) |
| `GET` | `/api/admin/question` | Read question text | Query: `path` |
| `PUT` | `/api/admin/question` | Save question text | Query: `path`, Body: `question` |
| `GET` | `/api/admin/solution/view` | Read sanitized solution preview + flag metadata | Query: `path` |
| `GET` | `/api/admin/solution/images` | List solution-folder image files for insert/delete actions | Query: `path` |
| `GET` | `/api/admin/solution` | Open solution editor, acquire lock, and return review status context | Query: `path` |
| `GET` | `/api/admin/solution/draft` | Read existing draft content for a solution | Query: `path` |
| `POST` | `/api/admin/solution/draft` | Save solution draft | Query: `path`, Body: `content` |
| `DELETE` | `/api/admin/solution/draft` | Discard solution draft | Query: `path` |
| `PUT` | `/api/admin/solution` | Approver: publish immediately. Non-approver: submit/update pending review item | Query: `path`, Body: `content`, optional `pendingImageDeletes`, optional `pendingFlags` |
| `PUT` | `/api/admin/solution/flags` | Assign flags to solution (or require approval submission when enabled for non-approvers) | Query: `path`, Body: `flagNames[]` |
| `GET` | `/api/admin/history` | List version history for a question/solution node | Query: `path` |
| `POST` | `/api/admin/history/rollback` | Roll back node content to a prior version | Body: `path`, `versionId` |
| `POST` | `/api/admin/history/delete` | Delete one version history entry | Body: `path`, `versionId` |
| `POST` | `/api/admin/convert/solution-to-node` | Convert terminal solution into question node | Body: `path`, `question` |
| `POST` | `/api/admin/convert/node-to-solution` | Convert question node into terminal solution | Body: `path`, `confirmDestructive` |
| `POST` | `/api/admin/batch-delete` | Multi-delete questions/solutions/answers | Body: `items[]` |
| `POST` | `/api/admin/batch-convert` | Batch convert homogeneous node set | Body: `mode`, `paths[]`, optional `questionText` |
| `POST` | `/api/admin/lock/heartbeat` | Renew active solution lock | Body: `path`, `type="solution"` |
| `POST` | `/api/admin/lock/release` | Release own solution lock | Body: `path`, `type="solution"` |
| `POST` | `/api/admin/lock/force-release` | Force-release lock | Body: `path`, `type="solution"`, `confirm` |
| `POST` | `/api/admin/rename` | Rename KB path | Body: `path`, `newName` |
| `POST` | `/api/admin/move-question` | Move question subtree under another question node | Body: `sourcePath`, `destinationParentPath` |
| `POST` | `/api/admin/delete` | Soft-delete KB path to Trash | Body: `path`, `confirmRecursive` |
| `POST` | `/api/admin/trash/list` | List trash tree | None |
| `POST` | `/api/admin/trash/restore-plan` | Build restore preflight plan for selected trash items | Body: `trashPaths[]`, `mode`, optional `newRootPath` |
| `POST` | `/api/admin/trash/restore-bulk` | Restore selected trash entries in one run | Body: `mode`, optional `newRootPath`, `entries[]` |
| `POST` | `/api/admin/trash/restore` | Restore one trash item | Body: `trashPath`, optional `restoreToPath` |
| `POST` | `/api/admin/trash/purge-bulk` | Permanently purge selected trash entries | Body: `trashPaths[]`, `confirm=true` |
| `POST` | `/api/admin/trash/purge` | Permanently remove one trash item | Body: `trashPath`, `confirm=true` |
| `POST` | `/api/admin/solution/images/delete` | Delete image from solution folder (approver only) | Body: `path`, `filename` |
| `POST` | `/api/admin/upload-image` | Upload image for a solution folder (approver only) | Query: `path`, multipart field: `image` |

### Solution Review Endpoints (Admin and Superadmin)

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/admin/reviews/settings` | Get approval settings and whether current user is an approver | None |
| `GET` | `/api/admin/reviews/mine` | List current user submissions (default pending/rejected) | Query: `status`, `limit` |
| `GET` | `/api/admin/reviews/mine/:id` | Get one of the current user submissions (approvers may also view) | None |
| `GET` | `/api/admin/reviews/solution-status` | Get pending/rejected status for current user at a solution path | Query: `path` |
| `POST` | `/api/admin/reviews/submissions/:id/withdraw` | Withdraw own pending submission | None |
| `GET` | `/api/admin/reviews/pending` | List pending review queue (approver only) | Query: `limit` |
| `GET` | `/api/admin/reviews/submissions/:id` | Get pending submission detail + published content (approver only) | None |
| `POST` | `/api/admin/reviews/submissions/:id/approve` | Approve and publish pending submission (approver only) | None |
| `POST` | `/api/admin/reviews/submissions/:id/reject` | Reject pending submission with required reason (approver only) | Body: `reason` |

### Superadmin Approval Endpoints

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/superadmin/approvals/settings` | Get approval workflow settings | None |
| `POST` | `/api/superadmin/approvals/settings` | Update approval workflow settings | Body: `flagEditsRequireApproval` |

### Superadmin Flag Endpoints

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/superadmin/flags/` | List flags and allowed metadata | None |
| `POST` | `/api/superadmin/flags/` | Create flag definition | Body: `name`, `message`, `colorClass`, `backgroundColor`, `iconClass`, `restrictionType`, `allowedRoles`, `allowedUsers` |
| `POST` | `/api/superadmin/flags/update` | Update flag definition and marker assignments | Body: `existingName`, plus create fields |
| `POST` | `/api/superadmin/flags/settings` | Update global display defaults (auto contrast toggle/strictness) | Body: `autoContrastFlagBackground`, `autoContrastStrictness` |
| `POST` | `/api/superadmin/flags/delete` | Delete flag definition and marker assignments | Body: `name` |

Flag rules:
- Name is normalized to dot-marker format (for example, `urgent` becomes `.urgent`).
- `.lock` is reserved and cannot be created.
- Icons must be valid Bootstrap Icons.
- Colors are configurable through the `colorClass` and `backgroundColor` fields.

### Superadmin Backup Endpoints

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/superadmin/backups/settings` | Get backup scheduler/settings and runtime state | None |
| `POST` | `/api/superadmin/backups/settings` | Update backup scheduler/settings | Body: `scheduleEnabled`, `schedulePreset`, `retentionMode`, `keepLast`, `maxAgeDays`, `includeConfig` |
| `GET` | `/api/superadmin/backups/runs` | List backup/restore run history and active run | Query: optional `limit` |
| `GET` | `/api/superadmin/backups/runs/:runId` | Get one backup/restore run detail | None |
| `GET` | `/api/superadmin/backups/runs/:runId/stream` | Stream live backup/restore progress (SSE) | None |
| `POST` | `/api/superadmin/backups/run` | Start manual backup run | Body: optional `label` |
| `POST` | `/api/superadmin/backups/restore` | Start full restore run | Body for existing source, or multipart upload with file field `archive` |
| `GET` | `/api/superadmin/backups/download/:archiveId` | Download backup ZIP archive | None |
| `DELETE` | `/api/superadmin/backups/runs/:archiveId` | Delete one run record and associated archive (if present) | None |

### Audit Log Endpoints

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/admin/audit/events` | List audit events with filtering and pagination (`canViewAudit=true` required) | Query: `actor`, `action`, `status`, `from`, `to`, `q`, `page`, `limit` |
| `GET` | `/api/admin/audit/export.csv` | Export filtered audit events as CSV (UTC timestamps) | Same query filters as `/events` |
| `GET` | `/api/admin/audit/settings` | Get audit retention/runtime summary and action list | None |
| `POST` | `/api/superadmin/audit/settings` | Update audit retention days (superadmin only) | Body: `retentionDays` |

### Superadmin User Endpoints

| Method | Path | Description | Request |
|---|---|---|---|
| `GET` | `/api/superadmin/users/` | List users | None |
| `POST` | `/api/superadmin/users/` | Create user | Body: `username`, `password`, `role`, optional `canApprove`, optional `canViewAudit` |
| `POST` | `/api/superadmin/users/update-role` | Change user role/permission flags | Body: `username`, `role`, optional `canApprove`, optional `canViewAudit` |
| `POST` | `/api/superadmin/users/reset-password` | Reset password and return temporary password | Body: `username` |
| `POST` | `/api/superadmin/users/delete` | Delete user and clean sessions/locks/drafts | Body: `username`, `confirm` |



