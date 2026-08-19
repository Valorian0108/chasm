---
name: Local-first screening
description: Why early Claims Checker demos should remain usable without a connected AI provider.
---

The comparison workflow should have a deterministic local screening path before it depends on an external model. The first proof case needs to be runnable, inspectable, and demoable even when provider access or account billing is unavailable.

**Why:** The first AI provider setup was unavailable and the user declined supplying a private provider key. A hard AI dependency would have blocked validating the product idea and the initial evidence pairs.

**How to apply:** Keep local screening as an explicit fallback and preserve the source quotes it uses. Add a model-backed pass later as an enhancement with a clear provider state, never as a silent replacement for the evidence trail.