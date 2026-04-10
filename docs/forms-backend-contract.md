# Forms Backend Contract (Phase 2)

## Environment variables

- `PUBLIC_PASTODEL_FORMS_ENDPOINT` (required in production): HTTPS endpoint for form submission.
- `PUBLIC_PASTODEL_FORMS_TIMEOUT_MS` (optional, default `10000`): client timeout in milliseconds.
- `PUBLIC_ALLOW_FORM_STUB`:
  - `0` in production (required)
  - may be `1` only for controlled non-production diagnostics.

## Request contract

Client sends `POST` with `Content-Type: application/json`.

Payload shape:

```json
{
  "form": "partneram-b2b",
  "payload": {
    "name": "Иван",
    "email": "ivan@example.com",
    "phone": "+7 (999) 111-22-33",
    "privacy": "on"
  }
}
```

Notes:
- `form` is a frontend form identifier (`data-form-name`).
- `payload` contains all submitted fields as strings.
- Honeypot field `company_site` may be present and should be treated as spam signal.

## Backend validation expectations

Backend/provider should validate:
- required business fields per form type,
- email format,
- phone normalization,
- consent checkbox (`privacy`),
- anti-spam/honeypot behavior.

## Response contract

Frontend shows success only if all conditions below are true:

1. HTTP status is `2xx`
2. `Content-Type` includes `application/json`
3. JSON body contains:
   - `ok: true`
   - `status: "accepted"` or `"queued"` (or omitted for backward compatibility)

Recommended success response:

```json
{
  "ok": true,
  "status": "accepted",
  "requestId": "lead_20260410_abc123"
}
```

Any non-2xx response, timeout, network failure, invalid JSON, or malformed body is treated as failure.

## User-visible behavior

- `sending`: submit button switches to `Отправка...`
- `success`: shown only after accepted response contract above
- `temporary failure`: explicit error message for timeout/network/service issues
- `unconfigured`: in production without endpoint, submit is disabled and user sees honest availability message
