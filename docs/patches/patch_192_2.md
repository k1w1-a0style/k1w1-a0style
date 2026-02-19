# Patch 192.2

## Fix
- Fix Jest module mocking for `useOneClickDeploy` tests by mocking dependencies via resolved absolute module paths and requiring the hook after mocks.

## Why
`useOneClickDeploy` imports dependencies using deep-relative paths (e.g. `../../../infra/...`). Jest applies mocks by module id string; mocking with a different relative string from the test file does not match and results in `undefined` exports.
