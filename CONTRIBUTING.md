# GameCheck GitFlow & Branching Rules

This repository follows a strict **`feature/*` → `dev` → `main`** GitFlow to protect production releases and prevent accidental overwrites.

---

## 1. Branch Structure

| Branch | Purpose | Lifetime | Direct Push Allowed? |
|---|---|---|---|
| `main` | Production-ready releases & CI/CD auto-release builds | Permanent (Protected) | **No** (merge via PR from `dev` only) |
| `dev` | Integration & testing branch | Permanent (Protected) | **No** (merge via PR from `feature/*` or `fix/*` only) |
| `feature/<name>` / `fix/<name>` | Isolated work for a single feature or bug fix | **Temporary** (deleted after merge into `dev`) | Yes (for that branch only) |

---

## 2. Step-by-Step Workflow

### Step 1 — Always Sync `dev` First
Before creating a new branch, always fetch the latest remote changes so you never squash or overwrite someone else's work:
```bash
git fetch origin
git checkout dev
git pull --ff-only origin dev
```

### Step 2 — Create a `feature/*` or `fix/*` Branch from `dev`
Never develop directly on `dev` or `main`:
```bash
git checkout -b feature/<short-description>
# or for bug fixes:
git checkout -b fix/<short-description>
```

### Step 3 — Check for New `dev` Changes Before Pushing
Before pushing your feature branch (or opening a PR), check for any new commits in `origin/dev` and merge/rebase cleanly so nothing is squashed:
```bash
git fetch origin
git rebase origin/dev   # or: git merge origin/dev
git push -u origin feature/<short-description>
```

### Step 4 — Merge into `dev` & Delete the Feature Branch
- Open a Pull Request: **`feature/<short-description>` → `dev`**.
- After the PR is merged into `dev`:
  - **Delete** the `feature/*` / `fix/*` branch (remotely and locally: `git branch -d feature/<short-description>`).
  - **Never delete `dev` or `main`**.

### Step 5 — Release to `main` (Triggers CI/CD & Auto-Versioning)
- Once `dev` is tested and ready for release, open a Pull Request: **`dev` → `main`**.
- Merging into `main` automatically triggers [`.github/workflows/ci-and-release.yml`](.github/workflows/ci-and-release.yml) to:
  1. Auto-bump the version (`YYYY.MM.DD[.PATCH]`).
  2. Compile and test both **Windows** and **Linux** native binaries.
  3. Publish the **GitHub Release** with downloadable installers and `SHA256SUMS.txt`.
- After `dev` → `main` completes, sync `dev` with `main` (`git fetch origin && git checkout dev && git merge origin/main && git push origin dev`) so the auto-bumped version commit stays in sync.
