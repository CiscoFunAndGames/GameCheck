# GameCheck GitFlow & Contributing Guide

**GameCheck** is an open-source **MIT-licensed** project (`CiscoFunAndGames/GameCheck`). We follow a strict **`feature/*` → `dev` → `main`** GitFlow with automated security, anti-malware, and performance gates on every Pull Request.

---

## 1. Branch Structure & Protections

| Branch | Purpose | Lifetime | Protection & Rules |
| :--- | :--- | :--- | :--- |
| `main` | Production releases & GitHub Release builds | Permanent (Protected) | PR from `dev` only · 6 required CI checks · Code Owner (`@FranciscoFlorio25`) + CodeQL required |
| `dev` | Integration & pre-release testing | Permanent (Protected) | PR from `feature/*`, `fix/*`, or `docs/*` only · 6 required CI checks · Code Owner approval |
| `feature/<name>` / `fix/<name>` / `docs/<name>` | Isolated work for one feature, bug fix, or docs update | **Temporary** (delete after merge) | Created from `dev` (on your fork for external contributors) |

> [!IMPORTANT]
> **Admin-Only Pipeline & Security Files:** `.github/workflows/*`, `.github/CODEOWNERS`, `scripts/security-policy-scan.js`, and `scripts/perf-gate.js` are protected by `CODEOWNERS` and CI checks. Only the repository admin (`@FranciscoFlorio25`) can modify them.

---

## 2. How External Contributors Contribute (Fork Workflow)

1. **Fork & Clone**
   ```bash
   git clone https://github.com/<your-username>/GameCheck.git
   cd GameCheck
   git remote add upstream https://github.com/CiscoFunAndGames/GameCheck.git
   ```

2. **Sync `dev` & Create a Branch**
   Never work directly on `dev` or `main`:
   ```bash
   git fetch upstream
   git checkout dev
   git merge --ff-only upstream/dev
   git checkout -b feature/<short-description>   # or fix/... / docs/...
   ```

3. **Keep Your Code Clean, Safe & MIT-Compliant**
   - New C++ source files should include `// SPDX-License-Identifier: MIT`.
   - Keep all hardware/game detection **100% read-only & non-invasive** (no process injection, no keyboard hooks, no memory reading, no hardcoded secrets or personal paths).
   - Run local checks before pushing:
     ```bash
     node scripts/security-policy-scan.js
     node scripts/perf-gate.js
     node test/run-all.js
     ```

4. **Rebase/Sync Before Pushing & Open a PR to `dev`**
   ```bash
   git fetch upstream
   git rebase upstream/dev   # or: git merge upstream/dev
   git push -u origin feature/<short-description>
   ```
   Open a Pull Request targeting **`CiscoFunAndGames/GameCheck:dev`** (never directly to `main`).
   - First-time contributors require maintainer workflow approval before GitHub Actions runs.
   - All **6 required status checks** must pass before merge:
     1. `Enforce Admin-Only Pipeline & Scanner Protection`
     2. `Anti-Keylogger, Spyware, Secret & Dependency Audit` (Gitleaks + Security Policy + `npm audit`)
     3. `ClamAV Antivirus & Malware Scan`
     4. `CodeQL Static Security Analysis (javascript-typescript)`
     5. `CodeQL Static Security Analysis (cpp)`
     6. `Performance, Latency & Binary Footprint Gate`

5. **Clean Up After Merge**
   Once your PR is merged into `dev`, delete your temporary `feature/*` / `fix/*` / `docs/*` branch locally and on your fork. **Never delete `dev` or `main`.**

---

## 3. Release Flow (`dev` → `main`, Maintainers)

- Once `dev` is verified and ready for release, open a Pull Request **`dev` → `main`**.
- Merging into `main` triggers [`.github/workflows/ci-and-release.yml`](.github/workflows/ci-and-release.yml) to:
  1. Bump CalVer (`YYYY.MM.DD[.PATCH]`) and update `README.md` direct installer download links.
  2. Compile and verify **Windows** (`GameCheck-Setup-*.exe`) and **Linux** (`gamecheck-installer-*.sh`) installers + `SHA256SUMS.txt`.
  3. Publish the **GitHub Release** and sync `main` back into `dev`.
