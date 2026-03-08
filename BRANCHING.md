# Branch Strategy

This repo uses a simple scalable flow:

- `main`: production-ready code only
- `develop`: integration branch for upcoming release work
- `codex/*`: feature branches (short-lived)
- `release/*`: release hardening branches
- `hotfix/*`: urgent production fixes

## Daily feature workflow

```bash
git checkout develop
git pull origin develop
git checkout -b codex/feature-name
```

Build and test, then open PR:

- `codex/feature-name` -> `develop`

## Release workflow

When you are ready to prepare an App Store release:

```bash
git checkout develop
git pull origin develop
git checkout -b release/1.1.0
```

Only bug fixes and release polish go into the release branch.

Then open PRs:

- `release/1.1.0` -> `main`
- `release/1.1.0` -> `develop` (to keep history aligned)

Tag after merge to `main`:

```bash
git checkout main
git pull origin main
git tag v1.1.0
git push origin v1.1.0
```

## Hotfix workflow

For urgent issues in production:

```bash
git checkout main
git pull origin main
git checkout -b hotfix/1.0.1
```

Open PRs:

- `hotfix/1.0.1` -> `main`
- `hotfix/1.0.1` -> `develop`

## Current branches

- `main` (stable)
- `develop` (created)
- `codex/next-release-lab` (active feature branch)
