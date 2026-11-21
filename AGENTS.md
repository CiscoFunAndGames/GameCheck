# GameCheck — Repository GitFlow & PR Workflow Rules

This repository (`CiscoFunAndGames/GameCheck`) is **Public**, **MIT-licensed**, and protected on both `dev` and `main`. Follow these rules for every change:

## 1. Strict GitFlow (`feature/*` / `fix/*` / `docs/*` / `chore/*` -> `dev` -> `main`)
- **Never push directly to `dev` or `main`.**
- Before starting new work, always sync `dev`:
  `git fetch origin && git checkout dev && git pull --ff-only origin dev`
- Branch from `dev` using a descriptive prefix (`feature/`, `fix/`, `docs/`, `chore/`, `refactor/`).
- Before pushing or opening a PR, fetch `origin/dev` and rebase/merge cleanly so no one else's work is overwritten.
- Open PRs into **`dev`** (using `gh pr create --base dev --head <branch>`). Only release PRs go from `dev` -> `main`.
- Delete temporary branches after merge; **never** delete `dev` or `main`.

## 2. Updating an Already-Open PR (Close-Update-Reopen Rule)
When an open PR you created needs additional modifications:
1. **Close the existing PR first** (`gh pr close <number>`).
2. Update/sync the branch with the new commits and push (`git push origin <branch>`).
3. **Open a fresh PR** (`gh pr create --base dev --head <branch> ...`) containing all changes cleanly bundled so it is easier to review and merge.

## 3. Required Local Checks & Public-Repo Guardrails
- Always run before opening a PR:
  - `node scripts/security-policy-scan.js`
  - `node scripts/perf-gate.js`
  - `node test/run-all.js` (and `.\bin\test-gamecheck-core.exe` / `.\bin\GameCheck.exe --smoke-test` when C++ changes)
- Keep all code 100% read-only, non-invasive, MIT-licensed (`// SPDX-License-Identifier: MIT` on C++ files), and free of personal/host data.
- Never modify `.github/workflows/*`, `.github/CODEOWNERS`, `scripts/security-policy-scan.js`, or `scripts/perf-gate.js` unless explicitly instructed by the repository admin (`@FranciscoFlorio25`).
