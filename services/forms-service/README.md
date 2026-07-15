# PASTODEL forms service prototype

Isolated Node.js 24 LTS prototype for the five public PASTODEL lead forms. It is not connected to production traffic.

Production activation requires SMTP configuration and explicit approval.

## Architecture

```text
Browser -> POST /api/forms -> nginx exact route -> 127.0.0.1:8787
        -> validation -> SMTP adapter -> approved recipient
```

The service uses built-in `node:http`, ESM and `node:test`. Nodemailer is the only runtime dependency. It does not use a database or persist submissions.

## Routes

- `GET /health`: minimal process/config/adapter readiness only. It never verifies SMTP, sends mail or discloses the delivery adapter.
- `POST /api/forms`: current frontend JSON contract `{ "form": "...", "payload": {} }`.
- Other paths return 404. Other methods on known routes return 405 with `Allow`.

The listener is restricted to `127.0.0.1`; configuration rejects other bind addresses.

## Local setup

Use Node 24 LTS from the service directory:

```bash
npm ci
cp .env.example .env.local
```

The service does not load `.env` files itself. Export reviewed values through the shell or a process supervisor. For a local mock run:

```bash
set -a
. ./.env.local
set +a
npm start
```

Do not put real SMTP values in repository files.

## Configuration

Required/common names are documented in `.env.example`:

- `PASTODEL_FORMS_HOST` must be `127.0.0.1`.
- `PASTODEL_FORMS_PORT` defaults to `8787`.
- `PASTODEL_ALLOWED_ORIGIN` is exact; production must use HTTPS.
- `PASTODEL_FORMS_DELIVERY` is `mock` or `smtp`.
- `PASTODEL_FORMS_TO` supplies the approved server-side recipient.
- `PASTODEL_FORMS_FROM` is required in SMTP mode.
- `PASTODEL_FORMS_REPLY_TO_ENABLED` controls applicant Reply-To.
- SMTP host, port, TLS mode, username, password and separate connection/greeting/socket/DNS timeouts are server-only.
- Body, header, request, keep-alive, per-socket request, concurrent-delivery and shutdown limits are bounded and validated.

The service fails closed for missing recipient/origin, invalid ports/limits, incomplete SMTP settings, non-loopback binding, and mock delivery under `NODE_ENV=production`.

## Delivery modes

### Mock

Mock delivery stores messages only in the current process memory. Tests cover success, failure and timeout. It never opens an SMTP connection. Production mock mode is forbidden.

### SMTP

SMTP uses Nodemailer without pooling, automatic startup verification or attachments. Port 465 requires implicit TLS (`secure=true`); port 587 requires STARTTLS (`secure=false`, `requireTLS=true`); other ports fail closed. Certificate verification remains enabled, protocol/debug logging is disabled, and file/URL access is disabled at transport and message levels. HTTP success is returned only when Nodemailer reports the configured recipient as accepted and not rejected.

An explicit `npm run smtp:verify` preflight is available for a separately approved staging check. It authenticates without sending a message, prints no configuration values and is never run by startup or tests.

## Validation and anti-abuse

- Exact Origin and exact `application/json` content type.
- Exact top-level and per-form field allowlists.
- Five allowlisted form IDs and exact select values.
- Required and conditional gateway fields.
- Bounded strings, conservative email/phone checks and product slug allowlist.
- Control-character, bidi/zero-width format-character and header-injection rejection.
- Consent must be the current frontend value `on`.
- A non-empty honeypot suppresses delivery and receives an accepted-like response.
- Body size, header/request/socket timeouts, header count and keep-alive request count are enforced in the service.
- SMTP deliveries are bounded by `PASTODEL_FORMS_MAX_IN_FLIGHT`; excess valid requests receive a generic 503 and are not queued.
- Nginx is responsible for per-IP rate limiting; the loopback service does not trust forwarded IP headers or log IP addresses.

All email output is plain text with stable server-defined field order. Every submitted line is prefixed inside a field block so user text cannot imitate service section headings unnoticed. Submitted markup remains literal text.

## Logging

Structured JSON logs go to stdout/stderr for journald. Allowed fields are timestamp, level, event, request ID, form ID, HTTP status, outcome, duration and reason code. Payload, names, companies, email addresses, phones, cities, messages, SMTP configuration, recipient and mail body are not logged.

## Tests

```bash
npm test
npm run check
```

Tests cover configuration, all form contracts, validation branches, HTTP headers/timeouts/body limits, origin spoofing, honeypot, bounded concurrency, graceful shutdown, SMTP/TLS mapping and acceptance with a fake transport, logging privacy and current FormRuntime compatibility. No real SMTP connection is used.

## Deployment templates

- `deploy/nginx-forms.conf.template` contains the proposed exact route and rate limit. It must be reviewed in the real nginx context before use.
- `deploy/pastodel-forms.service.template` contains a hardened systemd service outline with no secrets.
- `deploy/install-notes.md` separates backend, nginx, frontend configuration, smoke and rollback steps.

Templates are documentation only. This prototype does not install users, files, units or nginx configuration.

## Staging plan

1. Review code and threat model.
2. Create an isolated service user and root-owned environment file.
3. Configure a test SMTP destination and synthetic test data.
4. Start the loopback service and verify `/health` without SMTP delivery.
5. Apply the reviewed nginx route in staging only.
6. Build the frontend with the staging same-origin endpoint.
7. Send one approved staging submission per form and verify mail content/log privacy.
8. Test SMTP failure, timeout, rate limiting and rollback.

## Production activation gate

Activation requires an approved provider, SMTP host/port/TLS mode/user/password, approved and provider-authorized From address, SPF/DKIM/DMARC owner confirmation, reviewed secret placement, dedicated service user, nginx/systemd review, explicit staging approval and a separate explicit approval for one marked delivery test.

## Rollback concept

Backend and frontend roll back independently. Disable/remove the exact nginx route and stop the new service to restore the existing fail-closed frontend behavior; switch the static site to its previous release if frontend endpoint configuration also needs reversal. Do not delete the previous service or site release until production verification is complete.

## Privacy boundary

The application does not persist submissions or log payload data. SMTP infrastructure and the recipient mailbox become storage/processing locations outside this service; their retention, backup, access and deletion policies require an owner decision. This is a technical boundary statement, not legal advice, and legal/privacy copy requires separate approval before activation.
