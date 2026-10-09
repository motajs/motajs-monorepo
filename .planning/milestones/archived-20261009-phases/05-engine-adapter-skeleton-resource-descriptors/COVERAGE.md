# Phase 5: Engine Adapter Skeleton & Resource Descriptors — COVERAGE.md

No external API integration: this phase is a pure in-repo TypeScript contract refactor — it adds no HTTP client, SDK, webhook, or third-party service and installs no package.

Rationale: every artifact is a TypeScript/JS module inside this repository (core contract, the two-polarity
verifier, the engine-B test fixture, the editor-side mota adapter), and the adapter delegates file IO to the
already-existing injected `FsPort` / `FileHandlerManager`; no request is ever made off-repo.
Rationale: the phase touches no network surface — the only runtime dependencies it consumes are already in the
workspace (`alien-signals`, the existing core modules) — so there is no API contract to document, no credentials
to manage, and no external availability to verify; `RESEARCH.md` §Package Legitimacy Audit is correspondingly empty.
