# Tolk by Lunola — Detailed Audit

Audit mode: read-only. No application source was changed.

## Release blockers (P0)

1. `npm run lint` fails at `src/components/Sidebar.tsx:393`: `onOpenOverflowMenu` is referenced after the prop was renamed to `_onOpenOverflowMenu`.
2. `server.ts:297-302` seeds a fallback admin identity and password when environment variables are absent. Production startup must fail closed instead of using defaults.
3. `server.ts:67-70` creates an in-memory random session signing secret if `SESSION_SECRET` is absent. Require a persistent secret in production; otherwise restart invalidates tokens and a multi-instance deployment cannot verify sessions consistently.
4. `docker-compose.yml` contains fallback database password `change_me_in_env`. Require a non-default secret before starting PostgreSQL/Tinode.
5. The WebSocket upgrade at `server.ts:4101-4117` accepts `/ws` before authentication and does not validate the `Origin` header. Add origin allowlisting and a connection/message rate limit to reduce CSWSH and resource abuse risk.

## Security hardening (P1)

6. Auth tokens are stored in browser `localStorage` (`src/App.tsx`). An XSS can read them. Prefer an `HttpOnly; Secure; SameSite` cookie session, or document the threat model and add strict CSP plus short token TTL/rotation.
7. QR login status sends the secret in the URL query (`src/lib/api.ts`, `/api/auth/qr/status`). Query strings can leak into logs, history, and proxy telemetry. Move the secret to a POST body or an authenticated polling channel.
8. Upload checks declared MIME/data URL and size. Add magic-byte/content validation, image re-encoding, archive bomb checks, and malware scanning for public deployment.
9. Add per-route throttles for login, QR creation/status, upload, AI endpoints, admin unlock, and WebSocket connection/auth. A single global rate setting is not enough.
10. `allowBackup="true"` in Android can include app data in device backups. Decide explicitly whether chat/session data may be backed up and add Android backup rules or set it false.
11. Review `POST /api/link-preview` SSRF defenses whenever allowlisted hosts change; keep private/link-local IP blocking and short timeouts.
12. Make admin actions re-authenticate for destructive operations and ensure audit logs cannot be altered by the same admin role.

## Reliability and data integrity (P1)

13. JSON fallback storage is not safe for multiple server instances and can lose updates under concurrent writes. Production should require MySQL/Postgres, transactions, migrations, and a backup/restore test.
14. Session/device records need explicit expiry and cleanup policy; verify whether stale sessions are removed and whether logout revokes all associated sockets in every failure path.
15. Add WebSocket heartbeat/ping, maximum frame size, reconnect backoff, duplicate-event handling, and backpressure for slow clients.
16. Add idempotency keys for message send, upload, report, and payment-like/admin mutation endpoints to prevent duplicate actions on retries.
17. Add health/readiness separation: `/api/health` currently reports `ok` while dependency readiness and configuration validity need separate checks.

## Dependency and build findings

18. `npm audit --omit=dev` reports 5 vulnerabilities: 1 low (`esbuild`) and 4 moderate (`glob`, `minimatch`, `workbox-build`, `vite-plugin-pwa` dependency chain). Update in a branch, run the full build and PWA smoke test, then review the major-version change suggested for `vite-plugin-pwa`.
19. Add CI for `npm ci`, lint, frontend/server build, dependency audit policy, and a smoke test against `/api/health` plus an authenticated WebSocket flow.
20. The comment in `wasmer.toml` refers to `npm run build:wasmer`, but `package.json` has no such script. Add a canonical build/deploy command or correct the documentation.
21. Keep `dist`, `dist-server`, APKs, `data`, and `uploads` out of release source unless explicitly required. Ensure no real user data or seeded credentials are packaged.

## Architecture and maintainability (P2)

22. `server.ts` is a large monolith (~156 KB); split auth, chat, stories, calls, upload, admin, and persistence modules with typed service boundaries.
23. `ChatWindow.tsx`, `Modals.tsx`, and other UI modules are large; split by feature and add component-level tests.
24. Replace repeated inline color/radius/shadow values with the centralized UI tokens in `UI-UX-GUIDE.md`.
25. Remove or map conflicting visual systems (Playful Crisp, Sky-Butter, Maroon, brutal, and liquid glass) so each surface has one visual language.
26. Fix malformed UTF-8 strings visible in source/UI (`Â·`, `â€¢`) and add an encoding check to CI.
27. Add an error boundary, offline/reconnect state, loading skeletons, focus restoration for modals/drawers, keyboard navigation, and screen-reader labels to the core chat flow.

## Verification matrix before release

- Auth: register, login, logout, password failure, session expiry, restart persistence.
- QR: create, expiry, approve from another device, replay/duplicate approval.
- Chat: 1:1, group, typing, delivered/read, reconnect, duplicate send, offline queue.
- Files: each allowed type, invalid MIME, oversized payload, malicious filename/content, download headers.
- Admin: least privilege for every route, destructive confirmation, audit log, lockout/rate limit.
- Deploy: clean checkout build, Wasmer health/readiness, WebSocket TLS, MySQL migration/backup, PWA cache update, Android permissions/backup.
- UI: light/dark, mobile/tablet/desktop, 44px touch targets, keyboard/focus, WCAG AA contrast, reduced motion.

## Bottom line

The deployment is reachable and feature-rich, but the release gate should remain closed until P0 items are fixed, the dependency chain is updated or accepted with rationale, and the verification matrix passes on a clean build.
