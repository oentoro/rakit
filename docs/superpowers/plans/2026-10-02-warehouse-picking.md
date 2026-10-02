# Warehouse Picking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox syntax for tracking.

**Goal:** Build a persistent Indonesian warehouse web app for admin order entry and phone-camera picking/packing with one scan per unit.

**Architecture:** One Next.js App Router application runs in the Node.js runtime with a persistent SQLite database and private local uploads. Route handlers call small domain functions that enforce authorization, validation, assignment, and transactional state changes. Client components handle forms and camera interaction; all secrets and authoritative state remain on the server.

**Tech Stack:** TypeScript, Next.js, React, Tailwind CSS, real shadcn/ui components, native `node:sqlite` and `node:crypto`, Zod, `@zxing/browser`, `pdf-lib`; Vitest and Playwright for relevant checks. Node.js 24+ with `node:sqlite` available without a CLI flag; verify against installed Node 26 before pinning package versions in the lockfile.

**Spec:** [Warehouse design](../specs/2026-10-02-warehouse-picking-design.md).

## Global Constraints

- “Aplikasi web berbahasa Indonesia dengan UI shadcn/ui untuk satu gudang berisi empat rak. Setiap rak memiliki enam ambalan A–F.”
- “Pengguna menyetujui alur dan aturan satu scan QR barang = satu unit.”
- “Browser tidak menerima API key AI.”
- “Staff tidak dapat mengubah akun, master barang, atau isi order melalui permintaan langsung.”
- “Setiap SKU memiliki satu lokasi aktif pada versi pertama.”
- “Pemindahan tidak mengubah qty, hasil picking, atau status order.”
- “Status: Menunggu → Picking → Packing → Selesai.”
- “Akses kamera membutuhkan HTTPS pada lingkungan penggunaan HP.”
- “Tidak ada order yang otomatis masuk antrean tanpa konfirmasi admin.”

## Decisions proposed for plan approval

- Initial AI integration: Gemini REST API, configured by `GEMINI_API_KEY` and `GEMINI_MODEL`; no hardcoded model or key. Gemini is a proposal, not a provider previously selected by the user. If another provider is selected at review, replace task 5's HTTP implementation before execution; preserve its extraction interface.
- SQLite and uploads require a persistent volume on a single self-hosted Node server. No ephemeral/serverless deployment for this version. Keep SQL synchronous transaction sections free of `await`; WAL, foreign keys, and busy timeout enabled.
- Upload limits: 15 MiB PDF and 5 MiB JPEG/PNG/WebP image, enforced before persistence and before calling AI. AI timeout: 60 seconds. Sessions expire after 12 hours. Login rate limit: five failed attempts per normalized username per 15 minutes.
- Bootstrap admin using a CLI that reads password interactively or from an explicitly supplied environment variable; no default/demo credential in production. Seed demo data only with an explicit development command.
- One confirmed order transaction at a time on the import review page; several orders may reference different pages from the same PDF. Saving one order never silently saves all extracted orders.
- Complete-order validation requires an airway bill and valid PDF receipt with selected pages. Manual order entry can omit these while waiting/picking; admin adds them before completion.
- No custom scanner hardware or camera-based proof that two physical units are distinct. The staff action represents one unit; scanned SKU identifies the product.

## Review Focus

1. Identical QR visible in consecutive frames must count once until explicit rearm; test in task 7.
2. Camera permission pending/denied and unmount during startup must not leak an active camera; test in task 7.
3. Multipage PDF containing several orders must print only selected receipt pages, including the last page; test in tasks 4 and 5.
4. Account deactivation and reassignment during an open staff session must revoke mutation rights immediately; test in tasks 1 and 6.
5. AI emits plausible but invalid SKU/qty/pages or duplicates an order: require correction and never bypass server checks; test in tasks 4 and 5.

## File responsibilities

- `src/app`: login, protected warehouse pages, admin pages, and route handlers.
- `src/components/ui`: shadcn components generated from the official registry, limited to components actually used.
- `src/components/app-shell.tsx`: role-aware navigation and mobile layout.
- `src/components/order-form.tsx`: shared editable manual/extracted order form.
- `src/components/camera-scanner.tsx`: camera lifecycle and deliberate rearm interaction.
- `src/lib/db.ts`, `src/lib/schema.sql`: database connection and idempotent schema setup.
- `src/lib/types.ts`, `src/lib/validation.ts`, `src/lib/errors.ts`: shared domain types, Zod schemas, safe domain errors.
- `src/lib/auth.ts`, `src/lib/http.ts`: sessions/passwords/role checks, same-origin mutation protection, safe HTTP error conversion.
- `src/lib/catalog.ts`, `src/lib/orders.ts`, `src/lib/picking.ts`: catalog, order creation/update/read, transactional picking/packing.
- `src/lib/files.ts`, `src/lib/ai.ts`: private upload storage and PDF extraction.
- `scripts/admin.ts`, `scripts/demo.ts`: explicit initial account setup and development fixtures.
- `tests`: domain integration, route authorization, scanner lifecycle, and browser flow checks.
- `.env.example`, `README.md`: configuration, local start, AI setup, HTTPS camera use, backups and deployment limits.

## Shared interface contract

Define in task 1 and extend only as specified by each task:

```ts
type Role = "admin" | "staff";
type Status = "waiting" | "picking" | "packing" | "completed";
type Actor = { id: string; name: string; role: Role };
type OrderInput = {
  orderNumber: string; airwayBill?: string; pdfFileId?: string;
  receiptPages: number[]; // one-based, unique, ascending
  items: { productId: string; qty: number }[];
};
type ExtractedOrder = {
  orderNumber: string; airwayBill: string;
  receiptPages: number[];
  items: { sku: string; name: string; qty: number }[];
};
type OrderDetail = {
  id: string; orderNumber: string; airwayBill: string | null;
  status: Status; assigneeId: string | null;
  pdfFileId: string | null; receiptPages: number[];
  items: { productId: string; sku: string; name: string;
    photoFileId: string | null; rack: number; shelf: string;
    qty: number; pickedQty: number }[];
};
type ScanResult = { order: OrderDetail; message: string; replayed: boolean };
```

All IDs are random UUIDs. Domain functions take `Actor` explicitly and reload its current active role from the database before writes. Invalid input maps to 422, unauthenticated to 401, forbidden to 403, missing to 404, state/duplicate conflict to 409. SKU/airway bill remain strings: trim surrounding whitespace, retain leading zeros and case. No public caching of authenticated routes/files.

---

### Task 1: Persistent application foundation and authentication

**Files:** create package/config files, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/login/page.tsx`, `src/app/api/auth/{login,logout}/route.ts`, `src/lib/{db,types,validation,errors,auth,http}.ts`, `src/lib/schema.sql`, `scripts/admin.ts`, `.env.example`, `tests/auth.test.ts`.

**Interfaces:** `openDatabase(path: string): DatabaseSync`, `getDatabase(): DatabaseSync`, `inTransaction<T>(fn: () => T): T`; `authenticate(username: string, password: string): Promise<string>` produces an opaque session token; `requireActor(request: Request, roles?: Role[]): Actor`; `assertActiveActor(actor: Actor, roles?: Role[]): Actor`; `assertSameOrigin(request: Request): void`.

- [ ] Write failing tests asserting login accepts a valid password, rejects invalid/inactive accounts, expiry rejects sessions, staff fails admin authorization, and an existing session fails after account deactivation.
- [ ] Run `npm test -- tests/auth.test.ts`; confirm failure is due to missing implementation. Install the minimal selected dependencies/config beforehand so the test runner itself works.
- [ ] Implement database schema for users, sessions, login attempts, files, products, orders, order items, activities, and scan requests. Add database CHECK/FK/UNIQUE constraints for roles/status, racks 1–4, shelves A–F, positive qty, picked qty within qty, unique SKU/order number/nonempty airway bill.
- [ ] Implement salted scrypt passwords, hashed random session tokens, HttpOnly/SameSite cookies with Secure on HTTPS, expiry and fresh account/role checks. Parameterize every SQL query. Enforce same-origin mutation requests and rate limit login failures. Run route handlers in the Node runtime.
- [ ] Implement CLI bootstrap and shadcn login form; never populate default production passwords.
- [ ] Run `npm test -- tests/auth.test.ts` and `npm run typecheck`; expect success. Reopen a temporary on-disk DB and assert committed account data survives.
- [ ] Initialize version control if needed and commit this completed deliverable plus approved docs, subject to workspace permissions.

### Task 2: Shell and admin staff management

**Files:** create `src/components/app-shell.tsx`, `src/app/(warehouse)/layout.tsx`, `src/app/(warehouse)/admin/staff/page.tsx`, `src/app/api/staff/route.ts`, `src/app/api/staff/[id]/route.ts`, required `src/components/ui/*`, `tests/staff.test.ts`.

**Interfaces:** consume task 1 auth/http; `createStaff(actor: Actor, input: {name: string; username: string; password: string}): Actor`, `setStaffActive(actor: Actor, id: string, active: boolean): void`. Put staff functions in `src/lib/auth.ts` rather than a new abstraction.

- [ ] Write tests: admin creates a staff account; duplicate username rejected; staff cannot create/deactivate users; last active admin cannot be deactivated. Expect current-session revocation when staff is deactivated.
- [ ] Run `npm test -- tests/staff.test.ts`; confirm missing behavior fails.
- [ ] Implement minimal account listing/create/activate/deactivate/password reset with server validation and role checks. Build Indonesian role-aware navigation and responsive content layout using actual shadcn components.
- [ ] Run staff/auth tests and typecheck; verify phone-width navigation and keyboard-accessible forms manually.
- [ ] Commit the deliverable.

### Task 3: SKU master, photos and movable rack locations

**Files:** create `src/lib/catalog.ts`, initial `src/lib/files.ts`, `src/app/(warehouse)/admin/products/page.tsx`, `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`, `src/app/api/files/route.ts`, `src/app/api/files/[id]/route.ts`, `tests/catalog.test.ts`, `tests/files.test.ts`.

**Interfaces:** `saveProduct(actor: Actor, id: string | null, input: {sku: string; name: string; rack: number; shelf: string; photoFileId?: string; active: boolean}): string`; `storeUpload(actor: Actor, file: File, kind: "photo" | "pdf"): Promise<{id: string; pageCount: number | null}>`; `readAuthorizedFile(actor: Actor, id: string): {bytes: Uint8Array; mimeType: string; name: string}`. File access is authorized for admin, or staff through an associated order/product; raw storage paths never enter the API.

- [ ] Write tests for Rak 1/B and Rak 4/F, duplicate/leading-zero SKU, invalid racks/shelves, oversized and content-mismatched images, path traversal, and denied unauthenticated/private file access.
- [ ] Run catalog/files tests; confirm failing behavior.
- [ ] Implement admin CRUD with inactive flag, image upload, one of 24 locations, immutable SKU once referenced by an order, and unchanged photo when only location changes. Validate MIME against file signatures; store under generated filenames outside `public/`.
- [ ] Implement authenticated image serving with no-store responses. Exclude uploads, database, secrets, and build outputs from version control.
- [ ] Run catalog/files tests and typecheck; verify create/edit/move/photo preview at desktop and phone widths.
- [ ] Commit the deliverable.

### Task 4: Manual orders and validated printable receipts

**Files:** create `src/lib/orders.ts`, `src/components/order-form.tsx`, `src/app/(warehouse)/admin/orders/{page,new/page}.tsx`, `src/app/(warehouse)/orders/[id]/page.tsx`, `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`, `src/app/api/orders/[id]/receipt/route.ts`, extend `src/lib/files.ts`, `tests/orders.test.ts`, `tests/receipts.test.ts`.

**Interfaces:** `createOrder(actor: Actor, input: OrderInput): string`; `updateOrder(actor: Actor, id: string, input: OrderInput): void`; `getOrder(actor: Actor, id: string): OrderDetail`; `listOrders(actor: Actor, filter: {status?: Status; search?: string}): OrderDetail[]`; `buildReceipt(actor: Actor, orderId: string): Promise<Uint8Array>`.

- [ ] Write tests: create qty two; merge repeated products; reject nonpositive/fractional/unsafe-integer qty and duplicate order/resi; optional resi/PDF accepted for manual order; staff cannot create/edit; editing items during picking rejected.
- [ ] Add tests showing a master relocation updates detail from Rak 1/B to Rak 4/F without changing picked qty; uploaded PDF can select pages 1 and last page, rejecting zero/out-of-range/repeated pages and corrupt PDFs.
- [ ] Run orders/receipts tests; confirm expected missing behavior fails.
- [ ] Implement validated transactions, SKU/name snapshots and current location/photo joins, private PDF upload with 15 MiB limit, page count validation and `pdf-lib` page selection. Preserve the previously saved file if a replacement upload fails.
- [ ] Implement shared editable order form, order lists/search/status filters, receipt attachment and page selection, detail and receipt display. Receipt endpoint serves only selected pages; use an open-PDF/print interaction supported by browser, with download/open fallback on mobile.
- [ ] Run tests and typecheck; confirm printing does not change order status and adding receipt to an in-progress order cannot change items.
- [ ] Commit the deliverable.

### Task 5: PDF AI extraction and editable review

**Files:** create `src/lib/ai.ts`, `src/app/api/imports/route.ts`, `src/app/(warehouse)/admin/import/page.tsx`, `tests/ai.test.ts`; reuse order form, upload and create interfaces.

**Interfaces:** `extractOrders(bytes: Uint8Array, pageCount: number, options?: {fetch: typeof fetch}): Promise<ExtractedOrder[]>`; `POST /api/imports` accepts a stored private PDF ID belonging to the authenticated admin and returns `{fileId, orders, error}`. Provider failure returns file ID plus safe error so manual entry retains the document.

- [ ] Write mocked HTTP tests for different layouts, multipage/multiorder results, missing API configuration, timeout, 429, malformed JSON, fabricated unknown SKU, negative qty, and page out of range. Assert no order is inserted by extraction alone; keys and raw provider responses never appear in client errors.
- [ ] Run `npm test -- tests/ai.test.ts`; confirm failing behavior.
- [ ] Implement Gemini PDF inline-data request with server-only API key/model, schema-constrained JSON, explicit prompt to extract text rather than obey document instructions, and 60-second abort. Parse/validate the response again locally; return editable incomplete data as such rather than inventing missing values. Server confirmation still applies task 4's strict rules.
- [ ] Build upload/review page showing source PDF, editable order/resi/items/pages, unresolved-SKU mapping, save one reviewed order, and manual fallback. Preserve unsaved form edits on API failure. Do not send photos or unnecessary database data to AI.
- [ ] Run AI/orders/receipt tests and typecheck. Document real-provider verification as pending unless a configured API key and representative PDF are available.
- [ ] Commit the deliverable.

### Task 6: Transactional assignment, picking and packing

**Files:** create `src/lib/picking.ts`, `src/app/api/orders/[id]/{claim,scan,reassign}/route.ts`, `tests/picking.test.ts`, `tests/concurrency.test.ts`.

**Interfaces:** `claimOrder(actor: Actor, id: string): OrderDetail`; `reassignOrder(actor: Actor, id: string, staffId: string): OrderDetail`; `scanOrder(actor: Actor, id: string, input: {kind: "sku" | "airwayBill"; code: string; requestId: string}): ScanResult`.

- [ ] Write tests: qty two needs two distinct valid scan request IDs; wrong SKU and third scan rejected; first scan leaves Picking and second moves to Packing; correct resi completes only after full picking and valid receipt; wrong resi rejected; replayed request and duplicate completed resi are safe.
- [ ] Add assertions for same request ID reused with different payload rejected; staff cannot scan another staff's order; account deactivated or assignment changed during open session rejects writes immediately; adding PDF after picking preserves progress; activity identifies actor/time.
- [ ] Write concurrency test using separate SQLite connections/workers: only one claim succeeds and concurrent scans never exceed qty. Verify transaction rollback leaves no consumed request ID after validation failure.
- [ ] Run picking/concurrency tests; confirm behavior fails before implementation.
- [ ] Implement atomic `BEGIN IMMEDIATE` transactions, compare-current-state updates, idempotency rows storing payload identity and result, conditional qty increments, aggregate completion check and one completion activity. Admin override uses an explicit recorded reassignment, not silent ownership bypass.
- [ ] Run picking/concurrency plus existing domain tests; assert database invariants and unchanged count after rejected scans.
- [ ] Commit the deliverable.

### Task 7: Phone-camera scanner and staff work screens

**Files:** create `src/components/camera-scanner.tsx`, `src/components/picking-workspace.tsx`, `src/app/(warehouse)/page.tsx`, extend order detail; `tests/scanner.test.tsx`, `tests/e2e/picking.spec.ts`.

**Interfaces:** `CameraScanner({kind, onScan}: {kind: "sku" | "airwayBill"; onScan: (code: string, requestId: string) => Promise<{message: string}>})`; reuse scan API and OrderDetail. Rearm creates a new request ID; network retry retains the old one.

- [ ] Write scanner tests with a fake decoder emitting identical values across frames: one callback only, explicit rearm produces second callback, inflight submit blocks rearm, error shows manual/retry controls, cleanup stops every media track even if camera startup resolves after unmount.
- [ ] Run scanner tests; confirm failure.
- [ ] Implement `@zxing/browser` multi-format reader client-side for QR and common airway-bill barcodes (Code 128, Code 39, EAN/ITF as supported). Prefer rear camera with `facingMode: environment`, `playsInline`, and explicit start/close controls. Check secure context and explain permission/camera errors in Indonesian.
- [ ] Lock scan handling synchronously on first decoded frame, pause processing, show returned success/error, and require “Scan unit berikutnya” to rearm. Provide manual entry with the same server validation. Never show success before response confirmation; uncertain requests can retry with the same ID before rearming.
- [ ] Build staff queue/claim and detail cards sorted by rack/shelf with photo, SKU, target/picked qty, refresh location, progress, packing/resi scanner, print/open PDF, and completion state. Staff navigation hides admin pages while endpoints remain protected.
- [ ] Run scanner tests and Playwright staff flow with simulated decoder and real HTTP mutations. Include phone viewport, wrong SKU/resi, two units, print/open receipt, and completed status after resi scan.
- [ ] Commit the deliverable.

### Task 8: Operational setup and final acceptance verification

**Files:** create/update `README.md`, `.env.example`, `scripts/demo.ts`, `playwright.config.ts`, `tests/e2e/admin.spec.ts`; update deployment configuration only if required by the actual selected platform.

**Interfaces:** `npm run dev`, `npm run build`, `npm start`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run admin:create`, `npm run seed:demo` are documented reproducible commands.

- [ ] Add browser test for admin login, SKU/photo/location edit, staff creation, manual order, AI failure fallback preserving PDF, and staff direct-admin-route denial. Demo fixtures use generated local placeholder images and generated PDFs, never assumed real product photographs.
- [ ] Run the browser test and implement only missing operational/UI behavior exposed by it.
- [ ] Document install/start, persistent `DATABASE_PATH`/`UPLOAD_DIR`, admin bootstrap, Gemini model/key, HTTPS reverse proxy, browser camera permissions, supported code formats, opening/printing PDF on phone, and coherent DB+upload backup/restore. No external deployment without user authorization.
- [ ] Run `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`; record actual output and resolve failures before declaring software complete. Check built-server startup and persistence across restart.
- [ ] Inspect UI at 390px and desktop widths, ensure readable location/photo/qty and keyboard-accessible admin forms. Exercise QR/barcode fixture images with the real decoder; clearly distinguish that from live phone camera testing.
- [ ] When devices/credentials are supplied, test a real HP camera against actual QR SKU and airway-bill barcode through HTTPS, then a real AI import. Otherwise explicitly report those remaining field checks without claiming they passed.
- [ ] Commit verified deliverables and provide start instructions, AI configuration needs, and honest verification limits.

## Self-review result

The tasks cover all specification sections: authentication and roles (1–2), photos and movable location (3–4), manual order/PDF/page printing (4), AI and fallback (5), transactional scan/status/assignment (6), phone camera/mobile picking and packing (7), persistence/deployment/use instructions and final checks (8). Review-focus cases have tests assigned above. Interfaces use the same Actor/OrderInput/OrderDetail/ScanResult definitions throughout. No API key, real PDF, live camera, external service deployment, or independent review is assumed to be available.

## Reference documentation

- Next.js: https://nextjs.org/docs/app/getting-started/installation
- shadcn/ui: https://ui.shadcn.com/docs/installation/next
- Node SQLite: https://nodejs.org/api/sqlite.html
- Gemini PDF: https://ai.google.dev/gemini-api/docs/document-processing
- Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- ZXing browser: https://github.com/zxing-js/browser
- PDF page copying: https://pdf-lib.js.org/
- Browser camera permissions/HTTPS: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
