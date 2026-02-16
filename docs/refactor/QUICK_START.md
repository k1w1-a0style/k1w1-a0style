# Quick Start (Patch 147 / Plan V3.1)

Apply patch:

```bash
unzip -o k1w1-a0style_patch_147_v31.zip -d .
rm -f k1w1-a0style_patch_147_v31.zip
```

Then run:

```bash
npm run typecheck
npm run lint:ci
npm run test:silent
```

This patch contains only **Phase 0.5 / PR-0 + PR-1 scaffolding** (shared types + docs + helper scripts).
No runtime behavior should change.
