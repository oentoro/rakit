# Execution ledger — docs/superpowers/plans/2026-10-02-warehouse-picking.md

Execution: native, approved by user. Specification approved including Gemini proposal.

Ruling: workspace is a new directory without Git, existing code, or baseline tests. Implement in this dedicated project directory; linked worktree is inapplicable until a repository exists. No main/master branch will be changed. Preserve documentation and use a feature branch if Git setup is permitted.

Pre-flight: tasks 1–8 share Actor and authorization; every mutation must reload active account. Tasks 3–5 share private files and order validation; extraction never writes an order. Tasks 4/6/7 share OrderDetail and ScanResult; live location joins preserve pickedQty. Tasks 6/7 share requestId: retries retain ID, rearm replaces ID.

Ruling: keep progress ledger in docs because there is initially no Git-aware skill workspace. Track verified task results here; do not assume commits are possible under metadata permissions.

Tasks 1/3/4/5/6 domain gates passed: 15 tests; task 2 staff management test passed. Task 7 scanner frame/rearm/denial/network-retry tests and direct-route permission tests passed. Subsequent full domain/scanner/concurrency suite: 20 tests passed, typecheck passed. UI implementation exists; browser acceptance remains in progress.
Ruling: approved Git init failed because metadata writes are denied; no commits made. Do not request repeated approval to proceed with ordinary implementation.
Ruling: generated shadcn registry uses Base UI and cn dependency; retain official generated components instead of replacing them with imitations. Use system fonts to avoid a build-time font service dependency.
Ruling: switch Next dev/build to supported webpack path after Turbopack fails on an internal port binding even on escalated retry. This changes the bundler, not app behavior.
Ruling: Playwright config loads in both parent and worker; retain inherited E2E_DATABASE_PATH so seed script and server use the same database.

Task 1: complete — login/expiry/revocation, database reopen persistence, safe account bootstrap, typecheck verified.
Task 2: complete — shadcn shell, admin staff management, direct-route staff denial verified.
Task 3: complete — catalog, per-SKU photos, 24 movable locations, private uploads verified in integration and browser tests.
Task 4: complete — manual entry, qty/duplicate validation, selected first/last PDF pages, live location and frozen-item updates verified.
Task 5: complete — Gemini REST with structured drafts, server-only configuration, simulated failures/malformed output, editable review and real browser manual fallback verified. No live API credentials available.
Task 6: complete — claim/reassign, transactional picking/packing, wrong SKU/resi/qty rejection, idempotent retry, independent-process concurrency verified.
Task 7: complete — camera permission/lifecycle, synchronous frame gate, deliberate rearm, manual fallback, per-order pending retry persistence, mobile flow verified. Real ZXing decoder additionally verified against QR on a simulated browser video stream.
Task 8: complete — operational README/env setup, production build and built-server acceptance flows verified. Git commit steps deferred because metadata writes are prohibited; files preserved in project directory.

Independent final review: no Critical findings; two Important findings fixed in one pass with RED→GREEN tests. (1) Explicit getUserMedia generation check before attachment and dedicated video per camera startup prevent stale permission grants from reopening/clearing another session. (2) Started orders may retain inactive products while adding receipt data; new/editable waiting orders still require active products.

Other verified correction: convert SQLite null-prototype row objects to plain DTOs before React server/client boundaries; regression test passes. Browser-selector correction scopes product error alerts separately from Next's route announcer.

Final evidence before dependency pruning: 23 tests passed; typecheck passed; webpack build passed; 3 development E2E and 3 production E2E passed. Production E2E includes admin SKU/photo/location/staff/manual/AI fallback, actual QR decoding on simulated video, and staff two-unit picking to completed resi verification.

Field checks not claimed: actual HP camera/lighting, physical airway bill barcode type, real printer behavior, live Gemini extraction quality on warehouse PDF, and deployment HTTPS configuration. Require user environment/credentials; manual operation remains available without AI.

Final cleanup: removed unused radix-ui/clsx/tailwind-merge direct dependencies (70 packages removed; required transitive utilities retained). Created .env.local from .env.example without credentials. Fresh post-cleanup typecheck, 23 tests, and webpack production build passed. No Git integration action applies because workspace has no repository; preserve all work in place.
