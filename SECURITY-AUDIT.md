# Security Audit — Garden Tracker

**Date:** 2026-04-27
**Scope:** Full application — static code review + live penetration testing
**Target:** `http://localhost:3000` (personal single-user tool, no authentication layer)
**Methodology:** Static analysis of `server.js` + `public/index.html` + `package.json`; live pen test suite with 20+ targeted attack vectors against a running instance.

---

## Executive Summary

No critical vulnerabilities found. The application's core data handling is solid: all SQL queries are parameterised, there is no command injection surface, file upload path traversal is not possible (memory-only storage), SSRF is not possible, and no secrets are hardcoded in source code. Prototype pollution attempts were blocked by input validation.

Four high-severity findings were identified, all of which are straightforward to remediate:

| Severity | Count | Fixed? |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 4 | No |
| MEDIUM | 5 | No |
| LOW | 3 | No |
| INFO (positive) | 9 | — |

---

## Findings

### HIGH

#### H1 — No Security Headers

**Confirmed by live test.**

The Express app has no security header middleware. The following headers are absent from every response:

- `X-Content-Type-Options` — allows MIME-sniffing attacks in old browsers
- `X-Frame-Options` — the app can be embedded in an `<iframe>` by any site (clickjacking)
- `Referrer-Policy` — full URL leaked in `Referer` on outbound navigations
- `Content-Security-Policy` — no XSS mitigations in place (amplifies H2 below)
- `Permissions-Policy` — camera/mic/geolocation permissions unrestricted

Additionally, `X-Powered-By: Express` is sent on every response, revealing the framework and version to any observer.

**Live test result:**
```
curl -sI http://localhost:3000/
X-Powered-By: Express           ← confirmed present, should be removed
# Zero security headers in response
```

**Fix:**
```bash
npm install helmet
```
```js
// server.js — add as first middleware
const helmet = require('helmet');
app.use(helmet());
```

---

#### H2 — Stored XSS via Unescaped Data in `innerHTML` Templates

The frontend has an `escHtml()` helper but does not apply it consistently. The following server-supplied strings are interpolated directly into `innerHTML` template literals without escaping:

| Location | Unescaped value |
|---|---|
| `index.html:558` | `bed.name` |
| `index.html:573` | `task.bed_id.replace(...)` |
| `index.html:529` | stage label fallback — raw `stage` key if not in `STAGE_LABELS` |
| `index.html:814` | `plant.name` |
| `index.html:815` | `plant.variety` |

There is currently no API endpoint to create beds or modify plant names, so exploitation requires direct database access. However, this is a structural vulnerability: if a write endpoint is added (e.g., to rename a bed or add a plant), stored XSS becomes trivially achievable. With no CSP in place (H1), any XSS that does land executes without restriction.

**Fix:** Apply `escHtml()` to every server-supplied string going into `innerHTML`:
```js
// Before (index.html:558)
`<span class="bed-card-name">${bed.name}</span>`

// After
`<span class="bed-card-name">${escHtml(bed.name)}</span>`
```
Apply the same pattern to `plant.name`, `plant.variety`, `task.bed_id`, and the stage label fallback.

---

#### H3 — Internal Error Detail Leaked to Client

Two routes send raw error messages from third-party libraries directly to the client.

**`server.js:579` — Multer error:**
```js
return res.status(400).json({ error: err.message });
```
If multer throws an internal error (e.g., from a malformed multipart request rather than a user file type error), the raw Node/multer error message — which can contain internal paths, library details, and unexpected stack information — is sent to the client verbatim.

**`server.js:676` — Anthropic SDK error:**
```js
res.status(500).json({ error: 'Analysis failed', details: analysisErr.message });
```
Anthropic SDK exceptions can include the full HTTP response body from Anthropic's API: request IDs, rate-limit details, model identifiers, and internal error codes. Sending `details` to the client exposes infrastructure information unnecessarily.

**Fix:**
```js
// Line 579 — only pass through your own error messages
if (err instanceof multer.MulterError) {
  return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (10 MB max)' : 'Upload error' });
}
return res.status(400).json({ error: 'Invalid file' });

// Line 676 — log server-side, never send SDK internals to client
console.error('Analysis error:', analysisErr);
res.status(500).json({ error: 'Analysis failed' }); // drop the 'details' field
```

---

#### H4 — No Rate Limiting on Any Endpoint

**Confirmed by live test.**

No rate limiting is configured on any route. The most dangerous target is `POST /api/analyse`, which accepts a file upload, performs Anthropic inference (billed per call), and writes to the database. An attacker with network access to the Docker container can exhaust the Anthropic API quota and generate significant billing cost in seconds.

**Live test result:**
```
20 rapid-fire POST /api/tasks/1/complete requests:
200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200
# All requests served, no throttling
```

**Fix:**
```bash
npm install express-rate-limit
```
```js
const rateLimit = require('express-rate-limit');

// Tight limit on the billed AI endpoint
app.use('/api/analyse', rateLimit({
  windowMs: 60_000, max: 10,
  message: { error: 'Too many requests — try again in a minute' }
}));

// General API limit
app.use('/api/', rateLimit({ windowMs: 60_000, max: 200 }));
```

---

### MEDIUM

#### M1 — `bed_id` Not Validated for Format or Length

`bed_id` is accepted from URL params and request bodies across six routes and passed directly to prepared statements. While parameterised queries prevent SQL injection, there is no format or length check. An 8 KB `bed_id` in the URL was tested — the app gracefully returned a 404, but the unbounded string reaches SQLite before the 404 is issued.

**Live test result:**
```
GET /api/beds/aaaa...8192 chars → 404 HTML (graceful, app survived)
```

**Fix:**
```js
function isValidBedId(id) {
  return typeof id === 'string' && /^[a-z0-9_-]{1,32}$/.test(id);
}
// Add at the top of every bed_id route handler
if (!isValidBedId(req.params.bed_id)) {
  return res.status(400).json({ error: 'Invalid bed id' });
}
```

---

#### M2 — MIME Type Validated by Client-Supplied Header Only

The multer `fileFilter` at `server.js:401` validates `file.mimetype`, which is the `Content-Type` header sent by the client — trivially spoofed. A caller can send an HTML or SVG file with `Content-Type: image/jpeg` and it passes the filter. The file is then stored in the `analysis_log.image_base64` column and forwarded to Anthropic as the declared type. There is no magic-byte check.

In the current architecture (memory storage, no server-side execution of uploaded files), the practical impact is limited to: polluting the analysis log with non-image data and sending a crafted payload to Anthropic with an incorrect declared type.

**Fix:** Add a magic-byte check using the `file-type` package after multer processes the file:
```bash
npm install file-type
```
```js
const { fileTypeFromBuffer } = require('file-type');
// Inside the upload callback, after multer:
const detectedType = await fileTypeFromBuffer(req.file.buffer);
const ALLOWED = new Set(['image/jpeg','image/png','image/heic','image/webp']);
if (!detectedType || !ALLOWED.has(detectedType.mime)) {
  return res.status(400).json({ error: 'File must be a JPEG, PNG, HEIC, or WebP image' });
}
// Use detectedType.mime instead of req.file.mimetype for the Anthropic call
```

---

#### M3 — No Explicit CORS Policy

**Confirmed by live test.**

There is no CORS configuration. For a same-origin SPA this is safe today, but the absence of an explicit CORS policy means behavior is unpredictable behind a reverse proxy or when the API port is accessed directly.

**Live test result:**
```
OPTIONS with Origin: http://evil.com → no Access-Control-Allow-Origin returned
# Correct for a browser client, but policy is implicit not enforced
```

**Fix:**
```js
const cors = require('cors');
app.use(cors({ origin: false })); // reject all cross-origin requests explicitly
```

---

#### M4 — Full Base64 Image Stored Indefinitely and Returned in API Response

Every analysis run stores the full base64-encoded image in `analysis_log.image_base64`. The `getAnalysisByBed` query returns these blobs to the browser in `GET /api/analysis/:bed_id`, even though the frontend never renders the stored image. This means:

1. Photos of the garden accumulate in the SQLite file indefinitely, growing the DB unboundedly
2. Full image bytes are sent over the wire on every analysis tab load unnecessarily
3. If the DB file is ever extracted from the Docker volume, it contains a photographic record of the property

**Fix — strip the column from the select query:**
```js
// server.js — getAnalysisByBed prepared statement
const getAnalysisByBed = db.prepare(
  'SELECT id, bed_id, result_json, created_at FROM analysis_log WHERE bed_id = ? ORDER BY id DESC LIMIT 3'
  // removed: image_base64
);
```
If you need to retain images for audit purposes, store only a SHA-256 hash of the image bytes instead.

---

#### M5 — Multer File Size Limit Not Returned as JSON on Exceed

The 10 MB file size limit is correctly configured (`limits: { fileSize: 10 * 1024 * 1024 }`). However, when the limit is exceeded, the error response is not consistent JSON — a 15 MB upload returned an empty/unparseable response rather than `{"error":"..."}`. This means the frontend receives no structured error to display to the user.

**Live test result:**
```
15 MB upload → empty response body (connection closed, no JSON)
11 MB upload → {"error": "AI analysis unavailable..."} (unexpectedly passed size check)
```

This is related to H3 — the catch block at `server.js:579` may not be invoked for all multer error types when using the callback form.

**Fix:** See H3 fix above. Ensure the multer error handler returns `{"error":"File too large (10 MB max)"}` for `LIMIT_FILE_SIZE` errors.

---

### LOW

#### L1 — `X-Powered-By: Express` Header Exposed

Already covered in H1, but worth noting as a standalone: `app.disable('x-powered-by')` or `helmet()` removes this. Without either, the server announces its framework and version on every response, aiding fingerprinting.

---

#### L2 — `express.urlencoded({ extended: true })` Unnecessarily Enables Nested Parsing

`server.js:397` uses `extended: true`, which uses the `qs` library and enables nested objects in URL-encoded form bodies (`a[b][c]=1`). The app never uses nested URL-encoded data. Using `extended: false` eliminates this entire parsing surface.

**Fix:** `app.use(express.urlencoded({ extended: false }));`

---

#### L3 — Startup Errors Not Caught (DB path, directory creation)

`fs.mkdirSync` and `new Database(DB_PATH)` at startup throw synchronously on failure with no try/catch. An unhandled exception will print a stack trace containing `DB_PATH` to Docker logs.

**Fix:**
```js
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
} catch (e) {
  console.error('Failed to initialise database:', e.message);
  process.exit(1);
}
```

---

## Confirmed Clear (Positive Findings)

| Vector | Result |
|---|---|
| SQL injection | Not possible — every query uses `db.prepare()` with `?` placeholders. No string concatenation in SQL. Tested with `1 OR 1=1`, `'`, `'; DROP TABLE beds --`. |
| Path traversal | Not possible — multer uses memory storage (no disk writes). `express.static` uses only `__dirname`. |
| Command injection | Not possible — no `child_process`, `exec`, `eval`, or `Function()` constructor anywhere in the codebase. |
| SSRF | Not possible — `POST /api/analyse` only accepts multipart file upload. No URL is ever fetched from user-supplied input. |
| Prototype pollution | Blocked by input validation — `POST /api/notes/1` with `{"__proto__":{"admin":true},...}` was rejected at the `Bed not found` validation step. |
| ReDoS | Not possible — no user-controlled regex patterns. |
| Hardcoded secrets | None found — `ANTHROPIC_API_KEY` is read from `process.env` only; `.env` is in `.gitignore`. |
| Insecure deserialization | All `JSON.parse` calls on user-supplied data are in try/catch. |
| Crash on empty/missing body | Handled gracefully — `{"error":"content is required"}` returned; app remained healthy. |
| Crash on nonexistent task/bed IDs | Handled gracefully — `{"error":"Task not found"}` / `{"error":"Bed not found"}` returned. |
| HTTP verb tampering | Unregistered methods return Express default 404 HTML — no crash, no data exposure. |
| Stack trace leakage | No SQLite internals, file paths, or stack traces observed in any error response. |

---

## Priority Remediation Order

| Priority | Finding | Effort |
|---|---|---|
| 1 | **H1** — Install `helmet` | ~5 min, one `npm install` + one line |
| 2 | **H4** — Add rate limiting to `/api/analyse` | ~10 min, one `npm install` + two lines |
| 3 | **H2** — Apply `escHtml()` to 5 innerHTML interpolation sites | ~15 min |
| 4 | **M4** — Strip `image_base64` from `getAnalysisByBed` select | ~2 min, one line change |
| 5 | **H3** — Sanitise error responses (drop `details` field, fix multer catch) | ~15 min |
| 6 | **M1/M5** — Add `bed_id` format validation + consistent multer error JSON | ~20 min |

---

*Tested by: `security-reviewer` agent (static analysis) + targeted live pen test suite (20+ attack vectors). Scope: authorised self-assessment of owner's personal application.*
