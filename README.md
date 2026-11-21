# GameCheck

**Check if your PC can run any game — and get the best graphics & GPU driver settings in seconds.**

GameCheck is a lightweight, 100% read-only desktop app for **Windows** and **Linux**. It detects your CPU, GPU, RAM, storage, and monitor refresh rate locally, finds your installed games (Steam, Epic Games, GOG, Xbox), estimates your FPS, and recommends the best settings for your exact screen and hardware — **with zero telemetry and zero anti-cheat risk**.

> [Download Now](#download--install) · [How to Use](#how-to-use-gamecheck) · [🇪🇸 Español](#español--descarga-instalación-y-guía-de-uso) · [Technical & Build Info](#technical-details--build-from-source)

---

## Download & Install

Grab the latest official release from **[GitHub Releases (Latest)](https://github.com/CiscoFunAndGames/GameCheck/releases/latest)**:

| Platform | Download | What It Does |
| :--- | :--- | :--- |
| **Windows 10 / 11 (64-bit)** | **[`GameCheck-Setup-2026.11.21.exe`](https://github.com/CiscoFunAndGames/GameCheck/releases/download/v2026.11.21.4/GameCheck-Setup-2026.11.21.exe)** | Native Windows installer (Desktop & Start Menu shortcuts + Uninstaller) |
| **Linux (x86_64)** | **[`gamecheck-installer-2026.11.21.sh`](https://github.com/CiscoFunAndGames/GameCheck/releases/download/v2026.11.21.4/gamecheck-installer-2026.11.21.sh)** | Self-contained GTK3 installer & desktop launcher |
| **Windows Portable** | **[`GameCheck-App-Payload-2026.11.21.zip`](https://github.com/CiscoFunAndGames/GameCheck/releases/download/v2026.11.21.4/GameCheck-App-Payload-2026.11.21.zip)** | Extract anywhere and run `bin/GameCheck.exe` without installing |

### Windows Installation
1. Open the **[Latest Release](https://github.com/CiscoFunAndGames/GameCheck/releases/latest)** page and download **`GameCheck-Setup-2026.11.21.exe`**.
2. Double-click the `.exe` (approve the administrator prompt if installing to `C:\Program Files\GameChecker`).
   > [!NOTE]
   > **Windows SmartScreen:** Because GameCheck is a free open-source MIT project without a paid Authenticode certificate yet, Windows may show *"Windows protected your PC"*. Click **More info** → **Run anyway** (you can also verify the file's hash against `SHA256SUMS.txt` on the release page).
3. Choose your install folder, keep **Create a Desktop shortcut** checked if you want one, and click **Install**.
4. *(To uninstall later: open Windows **Installed Apps** and select **GameCheck**, or run `Uninstall-GameCheck.exe` in the install folder.)*

### Linux Installation
1. Download **`gamecheck-installer-2026.11.21.sh`** from the **[Latest Release](https://github.com/CiscoFunAndGames/GameCheck/releases/latest)** page.
2. Run it in your terminal:
   ```bash
   chmod +x gamecheck-installer-*.sh
   ./gamecheck-installer-*.sh
   ```
3. Follow the prompt to choose an install directory and install any missing system packages (`g++`, `libgtk-3-dev`, `pciutils`, `mesa-utils`, `x11-xserver-utils`).

---

## How to Use GameCheck

1. **View Your PC & Installed Games**
   - When GameCheck opens, your **CPU, GPU, RAM/Storage, and Monitor** appear in the top bar.
   - Your **installed games** (Steam, Epic Games, GOG, Xbox) load automatically at the top of the left list. Use the dropdown next to the search box to switch between **Installed Games** and the **56+ Game Catalog**.

2. **Pick Your Optimization Goal**
   - **Optimal (Auto):** Best balance of sharp visuals and smooth FPS for your monitor.
   - **Max FPS:** Pushes as close to your monitor's max refresh rate (`Hz`) as possible.
   - **Balanced:** Smooth frame pacing inside your FreeSync / G-Sync VRR window.
   - **Quality (30–60 FPS):** Prioritizes maximum visual fidelity.

3. **Read Your Settings Across 4 Tabs**
   - **Quick Settings:** Shows a plain-English **Quick Takeaway**, recommended in-game preset, and the **Top 3 FPS Boosts** (or click **Detailed View (All)** to see everything).
   - **PC Match & Impact:** Compares your CPU, GPU, VRAM, RAM, and disk against the game's Minimum & Recommended specs.
   - **Driver App:** Gives exact toggle recommendations for **AMD Adrenalin**, **NVIDIA App / Control Panel**, or **Intel Arc**.
   - **Upscaling & Tips:** Compares **FSR / DLSS / XeSS** quality tiers, internal resolutions, and VRAM savings.

4. **Extra Tools & Exporting**
   - **Copy Settings / Export ▾:** Copy a clean summary to your clipboard or save `.INI`, `.JSON`, or `.MD` guides.
   - **Open Game Folder:** Appears in the footer whenever an installed game is selected so you can jump straight to its files.
   - **Simulate Upgrade:** Click **Simulate Upgrade** in the hardware bar to test how a new GPU, CPU, RAM, or monitor would improve FPS before buying.
   - **+ Add Custom Game (Steam Specs):** At the bottom of the left sidebar — paste requirements from any Steam store page to analyze games not in the catalog.
   - **Language:** Switch between **EN | English** and **ES | Español** anytime in the top-right header.

---

## Español — Descarga, Instalación y Guía de Uso

Descarga la última versión oficial desde **[GitHub Releases (Última Versión)](https://github.com/CiscoFunAndGames/GameCheck/releases/latest)**:

| Plataforma | Descarga | Descripción |
| :--- | :--- | :--- |
| **Windows 10 / 11 (64-bit)** | **[`GameCheck-Setup-2026.11.21.exe`](https://github.com/CiscoFunAndGames/GameCheck/releases/download/v2026.11.21.4/GameCheck-Setup-2026.11.21.exe)** | Instalador nativo de Windows (accesos directos + desinstalador) |
| **Linux (x86_64)** | **[`gamecheck-installer-2026.11.21.sh`](https://github.com/CiscoFunAndGames/GameCheck/releases/download/v2026.11.21.4/gamecheck-installer-2026.11.21.sh)** | Instalador GTK3 autocontenido con lanzador de escritorio |
| **Windows Portable** | **[`GameCheck-App-Payload-2026.11.21.zip`](https://github.com/CiscoFunAndGames/GameCheck/releases/download/v2026.11.21.4/GameCheck-App-Payload-2026.11.21.zip)** | Descomprime y ejecuta `bin/GameCheck.exe` sin instalar |

### Cómo Instalar
- **Windows:** Descarga `GameCheck-Setup-2026.11.21.exe`, ejecútalo (acepta el permiso de administrador si instalas en `C:\Program Files\GameChecker`), elige la carpeta y haz clic en **Install**.
  > *(Nota sobre **Windows SmartScreen**: al ser un proyecto open-source bajo licencia MIT sin certificado comercial pago, Windows puede mostrar "Windows protegió su PC". Haz clic en **Más información** → **Ejecutar de todas formas**; también puedes verificar el `SHA-256` en `SHA256SUMS.txt`.)*
- **Linux:** Descarga `gamecheck-installer-2026.11.21.sh` y ejecuta en terminal:
  ```bash
  chmod +x gamecheck-installer-*.sh
  ./gamecheck-installer-*.sh
  ```

### Cómo Usar GameCheck
1. **Tu PC y Juegos Instalados:** Al abrir la app verás tu CPU, GPU, RAM y Monitor en la barra superior, y tus juegos instalados (Steam, Epic, GOG, Xbox) arriba de todo en la lista izquierda. Puedes cambiar el filtro entre **Juegos Instalados** y **Todos** o usar el buscador.
2. **Elige un Perfil:** Selecciona **Óptimo (Auto)**, **Máx FPS**, **Balanceado** o **Calidad (30–60 FPS)** según lo que busques.
3. **Revisa las 4 Pestañas:**
   - **Ajustes Rápidos:** Resumen claro en una frase + los 3 ajustes que más FPS ganan.
   - **Hardware e Impacto:** Compara cada componente de tu PC con los requisitos del juego.
   - **App de Drivers:** Ajustes recomendados para **AMD Adrenalin**, **NVIDIA App** o **Intel Arc**.
   - **Escalado y Consejos:** Comparativa de **FSR / DLSS / XeSS** y ahorro de VRAM.
4. **Herramientas Extra:**
   - Usa **Copiar Ajustes** o **Exportar ▾** (`.INI`, `.JSON`, `.MD`) para guardar tu guía.
   - Haz clic en **Simular Mejora** para probar qué FPS tendrías cambiando de placa de video, procesador o monitor.
   - Usa **+ Agregar Juego (Req. Steam)** abajo a la izquierda para pegar requisitos de cualquier juego desde Steam.
   - Cambia entre **ES | Español** y **EN | English** arriba a la derecha.

---

## Technical Details & Build from Source

### Architecture
- **Core Engine ([`native/gamecheck_core.hpp`](./native/gamecheck_core.hpp)):** Self-contained C++17 header-only engine (hardware/EDID telemetry, read-only Steam/Epic/GOG/Xbox manifest scanner, 4-mode optimizer, driver advisor, upscaling matrix, regional price finder with firewall consent gate, SHA-256 updater).
- **Desktop GUI ([`native/gamecheck_desktop.cpp`](./native/gamecheck_desktop.cpp)):** Native Win32 + GDI+ dark-slate UI (`bin/GameCheck.exe`) on Windows and native GTK3 (`bin/gamecheck`) on Linux — `0%` idle CPU and `<5 ms` hardware scan.
- **Native Installer ([`native/rigcheck_installer.cpp`](./native/rigcheck_installer.cpp)):** Self-extracting Win32 C++17 setup & self-deleting uninstaller (`Uninstall-GameCheck.exe`).

### Build & Test Commands
```powershell
# Windows: compile core tests & GUI (MinGW-w64)
C:\mingw64\bin\windres.exe native/gamecheck.rc -O coff -o native/gamecheck_res.o
C:\mingw64\bin\g++.exe -O2 -std=c++17 native/test_core.cpp -o bin/test-gamecheck-core.exe -lwinhttp -luser32 -lgdi32 -ladvapi32 -lshell32 -static -s
C:\mingw64\bin\g++.exe -O2 -std=c++17 -mwindows native/gamecheck_desktop.cpp native/gamecheck_res.o -o bin/GameCheck.exe -lgdiplus -luxtheme -lcomctl32 -lcomdlg32 -lshell32 -luser32 -lgdi32 -ladvapi32 -lole32 -luuid -lwinhttp -static -s

# Run verification & security/performance gates
.\bin\test-gamecheck-core.exe
.\bin\GameCheck.exe --smoke-test
node test/run-all.js
node scripts/security-policy-scan.js
node scripts/perf-gate.js
node scripts/build-installer.js
```

```bash
# Linux: build & launch native GTK3 GUI
./gamecheck-desktop.sh
```

---

## Security, Privacy & Legal Disclaimers

- **Read-Only & Anti-Cheat Safe:** GameCheck never injects DLLs, never reads or modifies game process memory, never hooks `DirectX`/`Vulkan`/`OpenGL`, and sends zero telemetry. Outbound network checks (for optional deals or updates) use explicit user consent or standard GitHub Releases checks. See [`SECURITY.md`](./SECURITY.md).
- **Estimates Only ("AS IS"):** FPS numbers, bottleneck indicators, and configuration recommendations are heuristic estimates provided **"AS IS"** without warranty of any kind under the **[MIT License](./LICENSE)**. Applying exported settings or purchasing hardware from third-party retailers is at your own discretion and risk.
- **Trademarks:** All third-party product names, game titles, and trademarks (*Steam, Epic Games, GOG, Xbox, AMD, NVIDIA, Intel*) belong to their respective owners and are used strictly for compatibility identification.

---

Released under the **[MIT License](./LICENSE)** · `Copyright (c) 2026 GameCheck Contributors`
