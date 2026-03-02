# Smoke Repo Fixtures

Fixtures for deterministic E2E buildflow smoke tests.

- `missing-all-minimum`: intentionally empty fixture (no app/eas/workflow/projectId files)
- `missing-easProfiles`: has `eas.json` but missing `build.preview`
- `workflow-colon-quoting`: contains an unquoted workflow `name: Foo: Bar`
- `secrets-missing`: valid local files, but tests simulate empty pipeline secrets

