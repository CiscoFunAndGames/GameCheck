# GameCheck (`pc-game-checker`) — CalVer `2026.11.17.2` (`v2026.11.17.2`)

**GameCheck** (formerly *RigCheck Optimizer*) is a **100% Native C++17 Desktop GUI Application (`bin/GameCheck.exe`)** built with **Win32 API + GDI+ + Common Controls (`ComCtl32`) + Native Dialogs (`ComDlg32`)** on **Windows (`win32`)**, and **C++17 (`GTK3` / CLI)** on **Linux (`linux`)** — with **zero web-wrapper / Electron overhead during native execution (0% idle CPU, <15ms startup)**.

It detects your PC hardware and primary gaming display (`width x height @ refreshRateHz`) locally in read-only mode via pure Win32/Registry and Linux `/proc` & `/sys/class/drm` APIs, scans installed game libraries across Steam, Proton/Wine, Epic Games, and standalone folders, evaluates game compatibility (`Can I Run It?`) on a normalized 0–100 benchmark scale, generates **4 Screen-Aware Graphics Optimization Profiles** (`Optimal`, `Full FPS`, `Balanced`, `Quality 30–60 FPS`), simulates hardware upgrades (`What-If Simulator`), and searches **Country-Aware Verified Component Deals** behind an explicit **Firewall Consent Gate** and **Seller Reputation Shield**.

---

## Table of Contents

1. [What the App Does & Core Features](#what-the-app-does--core-features)
2. [Architecture Overview](#architecture-overview)
3. [Quick Start: Run, Build & Test](#quick-start-run-build--test)
4. [CalVer Versioning (`YYYY.MM.DD[.PATCH]`) & Live Patch Engine (`.rigpatch.json`)](#calver-versioning-yyyymmddpatch--live-patch-engine-rigpatchjson)
5. [Native Installers (Windows C++17 `.exe` & Linux `.sh`)](#native-installers-windows-c17-exe--linux-sh)
6. [GitHub Actions CI/CD Auto-Release Pipeline](#github-actions-cicd-auto-release-pipeline)
7. [⚖️ Legal Disclaimers, Limitation of Liability & Terms of Use](#️-legal-disclaimers-limitation-of-liability--terms-of-use)

---

## What the App Does & Core Features

### 1. Pure C++17 Native Desktop GUI & Hardware Telemetry (`native/gamecheck_core.hpp` + `native/gamecheck_desktop.cpp`)
- **True Native Win32 + GDI+ Desktop Application (`bin/GameCheck.exe`)**:
  - Custom double-buffered GDI+ dark-mode rendering (`WM_PAINT`), DPI-aware layout (`SetProcessDPIAware`), responsive vertical game `ListView` (`WC_LISTVIEWW`), Hero Game Banners with stylized monogram emblems, and native Windows file dialogs (`GetSaveFileNameW`, `GetOpenFileNameW`).
- **Zero-Telemetry Local Hardware Inspection (`<15ms`)**:
  - **Windows (`win32`)**: Queries Registry `HKLM\HARDWARE\Description\System\CentralProcessor\0`, `GlobalMemoryStatusEx`, 64-bit GPU registry keys (`HardwareInformation.qwMemorySize` to accurately detect `>4 GB` VRAM without 32-bit overflow), `GetLogicalDriveStringsW` + `GetDiskFreeSpaceExW`, and `EnumDisplayDevicesW` + `EnumDisplaySettingsExW` + EDID `0xFC` monitor descriptors.
  - **Linux (`linux`)**: Queries `/proc/cpuinfo`, `/proc/meminfo`, `/sys/class/drm/card*/device/mem_info_vram_total`, `statvfs`, and `xrandr --current` / DRM modes.

### 2. Four Screen-Aware Graphics Optimization Modes (`optimizationMode`)
Tailors graphics presets, resolution scaling (`DLSS` / `FSR` / `XeSS`), frame generation, VRAM texture budgets, and VRR/frame-cap advice to **both** your PC hardware (`CPU`, `GPU`, `VRAM`, `RAM`) and your monitor's exact resolution and refresh rate (`1080p @ 180Hz Display`, `1440p @ 165Hz Display`, `4K @ 120Hz Display`, etc.):
- **`0 / optimal` — Optimal (Rig + Screen Balance)**: Balances visual fidelity and frame pacing for your GPU/CPU tier and your monitor's native resolution & refresh rate (`Hz`).
- **`1 / full_fps` — Full FPS (Max Hz Competitive)**: Maximizes framerate to saturate high-refresh monitors (`120Hz–240Hz+`), reducing GPU-heavy effects (volumetrics, ray tracing, contact shadows) for minimum input latency while keeping safe VRAM headroom.
- **`2 / balanced` — Balanced (FPS & Visual Quality)**: Targets a smooth `60–100+ FPS` window using High visual presets and Quality-tier upscaling.
- **`3 / quality_30_60` — Quality (30–60 FPS Cinematic)**: Prioritizes Ultra/High visual fidelity at native resolution while maintaining a stable `30–60 FPS` floor.

### 3. 24-Game Benchmark Catalog & Non-Invasive Installed Game Scanner
- Scans installed games across:
  - **Steam** (Windows & Linux `libraryfolders.vdf` + `appmanifest_*.acf`, including `LastUpdated` / `LastPlayed` timestamps)
  - **Epic Games Launcher** (`C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item`)
  - **Standalone Game Folders**
- Displays a **Vertical Game List with Hero Artwork Banners**, compatibility verdicts (`ULTRA READY`, `RECOMMENDED`, `MINIMUM`, `BELOW MIN`), and **non-invasive play activity badges** (`🟢 PLAYING NOW`, `🕒 RECENTLY PLAYED`, `💾 INSTALLED`, `📚 CATALOG`) using a read-only OS process name snapshot (`CreateToolhelp32Snapshot` / `/proc`) without touching game files or process memory.

### 4. Hardware Upgrade ("What-If") Simulator & Raw Steam Req Parser
- **What-If Simulator**: Cycle or test hardware & screen overrides (`Detected Rig`, `RTX 4070 Super + 1440p@165Hz`, `RX 7800 XT + 1080p@240Hz`, `Budget GTX 1060 + 1080p@60Hz`) to see instant FPS and refresh-rate saturation changes.
- **Steam Requirements Parser**: Parse raw Steam `Minimum:` / `Recommended:` system requirements from your clipboard or sample specs and export `.ini`, `.json`, or `.md` configuration profiles via native `GetSaveFileNameW` dialogs.

### 5. Country-Aware Component Price & Verified Deals Finder
- **Explicit Firewall Consent Gate**: All outbound network/browser requests are **blocked by default** (`FIREWALL_PERMISSION_REQUIRED`). Outbound HTTPS (`TCP 443`) access only occurs if the user explicitly grants session permission via the native Firewall Consent Gate dialog (`MessageBoxW`), and access can be revoked anytime.
- **Regional Hardware Catalog (`AR`, `US`, `BR`, `CL`, `MX`, `ES`)**: Includes dedicated support for **🇦🇷 Argentina (`ARS $`)** hardware retailers (*HardGamers Argentina, Compra Gamer, Maximus Gaming Hardware, Venex Computación, FullH4rd, Mexx Computación, MercadoLibre Argentina Official Stores & Platinum Filter*) and international regions.
- **Seller Reputation Shield**: Automatically blocks untrusted/scam sellers (`<90%` positive ratings or unverified grey-market listings) and displays a full `reputationAudit` breakdown.

---

## Architecture Overview

```
pc-game-checker/
├── version.json                  # Canonical CalVer (YYYY.MM.DD[.PATCH]) release metadata (v2026.11.17.2)
├── SECURITY.md                   # Security, privacy, anti-cheat & firewall architecture
├── LICENSE                       # MIT License ("AS IS" no-warranty terms)
├── GameCheck-Desktop.bat         # Windows launcher for bin/GameCheck.exe
├── gamecheck-desktop.sh          # Linux launcher & native C++17 builder for bin/gamecheck-desktop
├── native/
│   ├── gamecheck_core.hpp        # Self-contained 100% Pure C++17 Core Engine (Hardware, Scanner, Optimizer, Deals)
│   ├── gamecheck_desktop.cpp     # Native C++17 Desktop GUI Application (Win32 API + GDI+ + ComCtl32 + ComDlg32)
│   ├── test_core.cpp             # Pure C++17 Core Engine automated verification suite
│   ├── rigcheck_probe.cpp        # Pure C++17 Win32/DRM Display & GPU Driver CLI Probe
│   └── rigcheck_installer.cpp    # Pure C++17 Windows Setup Installer source (RCDATA + UAC)
├── bin/
│   ├── GameCheck.exe             # Compiled 100% Native C++17 Windows Desktop GUI Executable
│   ├── test-gamecheck-core.exe   # Compiled C++17 Core Engine unit test binary
│   └── rigcheck-native-probe.exe # Compiled C++17 native display & driver probe binary
├── src/                          # Node.js / CLI / Patch / CI companion modules
├── scripts/
│   ├── calver.js                 # CalVer CLI bumper (status / bump / patch / set)
│   ├── create-patch.js           # SHA-256 .rigpatch.json creator, applier & rollback CLI
│   └── build-installer.js        # Builds GameCheck-Setup-2026.11.17.exe & Linux .sh installers + checksums
└── test/
    ├── run-all.js                # Full verification & integration test runner (including C++17 binaries)
    ├── hardware.test.js          # Windows & Linux hardware/display parser unit tests
    ├── scanner.test.js           # Multi-launcher game scanner & play status tests
    ├── version-patch.test.js     # CalVer, SHA-256 tamper detection, rollback & installer tests
    └── price-finder.test.js      # Firewall gate, country catalog & reputation shield tests
```

---

## Quick Start: Run, Build & Test

### 1. Launch the Native C++17 Desktop GUI (`GameCheck.exe`)
```powershell
# Windows (instant native Win32/GDI+ GUI launch)
.\bin\GameCheck.exe
# or double-click GameCheck-Desktop.bat

# Headless JSON Diagnostics / Smoke Test
.\bin\GameCheck.exe --smoke-test
```

```bash
# Linux
./gamecheck-desktop.sh
```

### 2. Compile the Native C++17 Desktop GUI & Core Test Suite from Source
```powershell
# Compile GameCheck Native Win32 + GDI+ Desktop GUI
C:\mingw64\bin\g++.exe -O2 -std=c++17 native/gamecheck_desktop.cpp -o bin/GameCheck.exe -lgdiplus -luxtheme -lcomctl32 -lcomdlg32 -lshell32 -luser32 -lgdi32 -ladvapi32 -lole32 -luuid -static -s

# Compile & run Pure C++17 Core Engine Test Suite
C:\mingw64\bin\g++.exe -O2 -std=c++17 native/test_core.cpp -o bin/test-gamecheck-core.exe -luser32 -lgdi32 -ladvapi32 -lshell32 -static -s
.\bin\test-gamecheck-core.exe
```

### 3. Run the Full Automated Verification Suite
```bash
npm test
# or directly:
node test/run-all.js
```

---

## CalVer Versioning (`YYYY.MM.DD[.PATCH]`) & Live Patch Engine (`.rigpatch.json`)

GameCheck uses **Calendar Versioning (`YYYY.MM.DD[.PATCH]`)** stored in [`version.json`](./version.json):
```bash
npm run version:status               # Print current CalVer version & release metadata
npm run version:bump                 # Bump to today's date (YYYY.MM.DD)
npm run version:patch                # Increment same-day patch level (YYYY.MM.DD.N)
npm run patch:create                 # Package signed .rigpatch.json delta bundle in dist/patches/
npm run patch:apply                  # Verify SHA-256 hashes, snapshot backup, and apply patch
npm run patch:rollback               # Restore pre-patch snapshot from dist/backups/
```

---

## Native Installers (Windows C++17 `.exe` & Linux `.sh`)

Build both cross-platform installers, portable payload archive, `dist/SHA256SUMS.txt`, and `dist/release-manifest.json`:

```bash
npm run installer:build
# or
node scripts/build-installer.js
```

- **Windows Native C++17 Installer (`dist/GameCheck-Setup-2026.11.17.exe` & `dist/RigCheck-Optimizer-Setup-2026.11.17.exe`)**:
  - Self-contained Windows executable compiled with MinGW-w64 `g++ -O2 -s -std=c++17` and `windres` (embeds the ZIP payload containing `bin/GameCheck.exe` as an `RCDATA` resource and strips local build symbols).
  - Prompts for user permission (or runs headlessly with `--silent`), installs to `%LOCALAPPDATA%\Programs\GameCheck`, checks dependencies (`--check-deps`), and supports `--verify`.
- **Linux Self-Contained Installer (`dist/gamecheck-installer-2026.11.17.sh`)**:
  - Prompts for user/sudo consent to verify or install `g++`, `pciutils`, `mesa-utils`, `x11-xserver-utils`, and `unzip`, compiles `native/gamecheck_desktop.cpp` locally, and installs the desktop entry.

---

## GitHub Actions CI/CD Auto-Release Pipeline

- **`.github/workflows/ci-and-release.yml`**:
  - Runs on every push to `main`/`master`, pull request, manual `workflow_dispatch`, or `v*` tag push (e.g., `v2026.11.17.2`).
  - Builds and verifies the C++17 native binaries (`bin/GameCheck.exe`, `bin/test-gamecheck-core.exe`, `bin/rigcheck-native-probe.exe`), `.rigpatch.json` bundle, Windows `.exe` installer, and Linux `.sh` installer, runs all test suites (`node test/run-all.js`), and publishes a GitHub Release with `SHA256SUMS.txt` and `release-manifest.json`.

---

## ⚖️ Legal Disclaimers, Limitation of Liability & Terms of Use

> [!IMPORTANT]
> **PLEASE READ CAREFULLY BEFORE INSTALLING, RUNNING, OR USING THIS SOFTWARE.**
> By downloading, installing, compiling, executing, or otherwise using **GameCheck / RigCheck Optimizer (`pc-game-checker`)**, you acknowledge that you have read, understood, and agreed to be bound by all disclaimers, limitations of liability, and terms of use set forth below. If you do not agree to these terms, do not use this software.

### 1. No Warranty & Limitation of Liability ("AS IS" Clause)
THIS SOFTWARE, ITS SOURCE CODE, NATIVE BINARIES, INSTALLERS, PATCH BUNDLES, AND ALL ASSOCIATED DOCUMENTATION ARE PROVIDED **"AS IS"** AND **"AS AVAILABLE"**, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, RELIABILITY, SECURITY, OR NON-INFRINGEMENT.

IN NO EVENT SHALL THE AUTHOR(S), CREATOR(S), MAINTAINER(S), OR CONTRIBUTOR(S) BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES (INCLUDING, WITHOUT LIMITATION, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, SAVED GAMES, OR PROFITS; BUSINESS INTERRUPTION; HARDWARE MALFUNCTION, OVERHEATING, COMPONENT DEGRADATION, DRIVER CONFLICTS, OPERATING SYSTEM INSTABILITY, OR ACCOUNT RESTRICTIONS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE), ARISING IN ANY WAY OUT OF THE INSTALLING, RUNNING, OR USE OF—OR INABILITY TO USE—THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### 2. Hardware Telemetry & Game Configuration Disclaimer
- **Heuristic Estimates Only**: All hardware benchmark scores (0–100 scale), bottleneck percentages, VRAM utilization projections, estimated framerates (FPS ranges), compatibility tiers (`ULTRA READY`, `RECOMMENDED`, `MINIMUM`, `BELOW MIN`), and graphics setting recommendations (`Optimal`, `Full FPS`, `Balanced`, `Quality 30–60 FPS`) generated by GameCheck are **theoretical, heuristic estimates** provided strictly for general informational and educational purposes. Actual in-game performance varies significantly based on silicon lottery, thermal conditions, background processes, OS versions, GPU driver releases, and game patches.
- **No Hardware Modification or Overclocking**: GameCheck operates strictly as a read-only diagnostic and recommendation utility. It does **not** overclock CPUs/GPUs, modify voltage/fan curves, flash BIOS/UEFI firmware, or alter system registry performance tunables.
- **User Assumes Sole Risk for Configuration Files**: Any configuration files (`.ini`, `.json`, `.md`) generated or exported by the application are saved only when explicitly requested by the user. Applying or copying exported configuration parameters into any game or graphics driver is performed **entirely at the user's own sole risk and discretion**.

### 3. Third-Party Retailers, Pricing & Marketplace Disclaimer
- **Informational Aggregation Only**: The **Country-Aware Component Price & Deals Finder** generates search links, reference price estimates, and automated seller reputation indicators purely for informational convenience.
- **No Endorsement, Brokerage, or Guarantee**: The author(s) and contributor(s) of GameCheck are **not** hardware retailers, brokers, payment processors, affiliate agents, or financial advisors. Inclusion of any store, marketplace, or merchant link does **not** constitute an endorsement, certification, or guarantee of that merchant's legitimacy, trustworthiness, product authenticity, stock availability, shipping reliability, pricing accuracy, or warranty fulfillment.
- **Zero Financial or Transactional Liability**: The automated *Seller Reputation Shield* is a statistical heuristic filter and **cannot** guarantee protection against fraud, counterfeit goods, pricing errors, or merchant default. Users conduct any third-party browsing, purchasing, or payment transactions **strictly at their own sole risk**. The author(s) assume **zero legal, financial, or contractual responsibility** for any purchases, scams, defective hardware, shipping losses, taxes, customs duties, or disputes between you and any third-party retailer, marketplace, or seller.

### 4. Non-Affiliation, Trademarks & Fair Use Notice
- **Independent Open-Source Project**: GameCheck is an independent software project and is **not** affiliated with, endorsed by, sponsored by, authorized by, or in any way officially connected with Valve Corporation, Steam, Epic Games, Inc., GOG sp. z o o., Heroic Games Launcher, Lutris, Microsoft Corporation, Advanced Micro Devices, Inc. (AMD), NVIDIA Corporation, Intel Corporation, MercadoLibre S.R.L., or any game publisher, studio, or hardware retailer referenced within the software.
- **Nominative Fair Use of Trademarks & Artwork**: All third-party product names, game titles, promotional header/banner artwork URLs, company names, logos, and registered or unregistered trademarks (including but not limited to *Steam, Proton, Epic Games, GOG, Windows, DirectX, Linux, AMD, Ryzen, Radeon, FSR, NVIDIA, GeForce, RTX, DLSS, Intel, Arc, XeSS, MercadoLibre,* and individual game titles in the benchmark catalog) remain the exclusive property of their respective owners. They are referenced strictly for **descriptive compatibility identification and interoperability analysis under nominative fair use**.

### 5. Privacy, Anti-Cheat & Non-Invasive Operation Statement
- **100% Local Read-Only Execution & Zero Telemetry**: GameCheck processes your hardware specifications and installed game manifests locally on your machine. It collects, stores, or transmits **zero personal data, telemetry, analytics, usernames, or machine identifiers**.
- **Anti-Cheat Safe (No Memory Reading or Code Injection)**: GameCheck **never** reads or modifies game process memory, never injects DLLs or shared libraries, never hooks rendering APIs (`DirectX`, `Vulkan`, `OpenGL`), and never modifies game executables. Installed game status (`PLAYING NOW`, `RECENTLY PLAYED`, `INSTALLED`) is checked solely via standard, non-invasive OS process listing (`CreateToolhelp32Snapshot` / `/proc`).
- **User-Gated Outbound Network Access**: Outbound network connections (HTTPS TCP port `443` for the Component Deals Finder) are disabled by default and require explicit, revocable user authorization via the in-app Firewall Permission Gate. See [`SECURITY.md`](./SECURITY.md) for full technical details.

---

## License

Released under the [MIT License](./LICENSE). See [`LICENSE`](./LICENSE) and [`SECURITY.md`](./SECURITY.md) for complete legal and security terms.
