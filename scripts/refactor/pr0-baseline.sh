#!/usr/bin/env bash
set -euo pipefail
mkdir -p refactor-baseline
echo "== Baseline =="
npm run typecheck | tee refactor-baseline/typecheck.txt
npm run lint:ci | tee refactor-baseline/lint.txt
npm run test:silent | tee refactor-baseline/tests.txt
echo "Saved outputs to refactor-baseline/"
