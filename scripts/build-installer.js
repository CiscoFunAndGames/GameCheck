#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');
const { getVersionInfo } = require('../src/version');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const INSTALLER_SUBDIR = path.join(DIST_DIR, 'installer');

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function buildPayloadStage(stageDir) {
  if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  const dirsToCopy = ['src', 'public', 'scripts', 'bin', 'native', 'assets'];
  for (const dirName of dirsToCopy) {
    const srcDir = path.join(ROOT_DIR, dirName);
    if (fs.existsSync(srcDir)) {
      copyRecursiveSync(srcDir, path.join(stageDir, dirName));
    }
  }

  const filesToCopy = [
    'package.json',
    'version.json',
    'GameCheck-Desktop.bat',
    'gamecheck-desktop.sh',
    'RigCheck-Desktop.bat',
    'rigcheck-desktop.sh',
    'README.md',
    'LICENSE',
    'SECURITY.md'
  ];
  for (const fileName of filesToCopy) {
    const srcFile = path.join(ROOT_DIR, fileName);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(stageDir, fileName));
    }
  }
}

function generateWindowsManifestXml(fullVersion) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity
    version="1.0.0.0"
    processorArchitecture="*"
    name="RigCheckProject.RigCheckOptimizer.Setup"
    type="win32"
  />
  <description>RigCheck Optimizer Native C++ Setup (CalVer v${fullVersion})</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/>
    </application>
  </compatibility>
</assembly>
`;
}

function generateLinuxInstallerScript(calver, fullVersion, payloadZipBase64) {
  return `#!/usr/bin/env bash
# ==============================================================================
# GameCheck — Native Self-Contained Linux Installer & Uninstaller (CalVer v${fullVersion})
# Prompts for user / sudo permissions, checks & installs missing Linux packages
# (nodejs, npm, g++, pciutils, mesa-utils, x11-xserver-utils, unzip), compiles
# the C++17 native probe (rigcheck_probe.cpp), and ensures Electron is installed.
# ==============================================================================
set -e

CALVER="${calver}"
FULL_VERSION="${fullVersion}"
INSTALL_DIR="\${HOME}/.local/share/GameChecker"
BIN_DIR="\${HOME}/.local/bin"
APPS_DIR="\${HOME}/.local/share/applications"
VERIFY_ONLY=0
CHECK_DEPS_ONLY=0
SILENT_MODE=0
SKIP_DEPS=0
UNINSTALL=0

for arg in "$@"; do
  case "$arg" in
    --verify)
      VERIFY_ONLY=1
      ;;
    --check-deps)
      CHECK_DEPS_ONLY=1
      ;;
    --silent|-y|--yes)
      SILENT_MODE=1
      ;;
    --no-deps)
      SKIP_DEPS=1
      ;;
    --uninstall)
      UNINSTALL=1
      ;;
    --install-dir=*)
      INSTALL_DIR="\${arg#*=}"
      ;;
  esac
done

if [ "$VERIFY_ONLY" -eq 1 ]; then
  echo "{\\"status\\":\\"INSTALLER_OK\\",\\"appName\\":\\"GameCheck\\",\\"calver\\":\\"\${CALVER}\\",\\"fullVersion\\":\\"\${FULL_VERSION}\\",\\"installerType\\":\\"linux-sh\\",\\"dependenciesManaged\\":[\\"nodejs\\",\\"npm\\",\\"electron\\",\\"g++\\",\\"pciutils\\",\\"mesa-utils\\",\\"x11-xserver-utils\\",\\"unzip\\"]}"
  exit 0
fi

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "true"
  else
    echo "false"
  fi
}

if [ "$CHECK_DEPS_ONLY" -eq 1 ]; then
  HAS_NODE=\$(check_cmd node)
  HAS_NPM=\$(check_cmd npm)
  HAS_GPP=\$(check_cmd g++)
  HAS_LSPCI=\$(check_cmd lspci)
  HAS_GLXINFO=\$(check_cmd glxinfo)
  HAS_XRANDR=\$(check_cmd xrandr)
  HAS_UNZIP=\$(check_cmd unzip)
  HAS_ELECTRON="false"
  if [ -x "\${INSTALL_DIR}/node_modules/.bin/electron" ] || command -v electron >/dev/null 2>&1; then
    HAS_ELECTRON="true"
  fi
  echo "{\\"status\\":\\"DEPS_CHECK\\",\\"platform\\":\\"linux\\",\\"dependencies\\":{\\"node\\":\${HAS_NODE},\\"npm\\":\${HAS_NPM},\\"g++\\":\${HAS_GPP},\\"lspci\\":\${HAS_LSPCI},\\"glxinfo\\":\${HAS_GLXINFO},\\"xrandr\\":\${HAS_XRANDR},\\"unzip\\":\${HAS_UNZIP},\\"electron\\":\${HAS_ELECTRON}}}"
  exit 0
fi

if [ "$UNINSTALL" -eq 1 ]; then
  if [ "$SILENT_MODE" -eq 0 ] && [ -t 0 ]; then
    read -r -p "Are you sure you want to completely uninstall GameCheck and remove all application files and shortcuts? [y/N] " CONFIRM_UNINSTALL
    case "\${CONFIRM_UNINSTALL}" in
      [yY][eE][sS]|[yY]) ;;
      *)
        echo "Uninstall cancelled."
        exit 1
        ;;
    esac
  fi
  rm -rf "\${INSTALL_DIR}"
  rm -f "\${BIN_DIR}/gamecheck"
  rm -f "\${BIN_DIR}/gamecheck-uninstall"
  rm -f "\${APPS_DIR}/gamecheck.desktop"
  rm -f "\${APPS_DIR}/gamecheck-uninstall.desktop"
  rm -f "\${BIN_DIR}/rigcheck-optimizer"
  rm -f "\${APPS_DIR}/rigcheck-optimizer.desktop"
  echo "GameCheck v\${FULL_VERSION} has been completely uninstalled."
  exit 0
fi

if [ "$SILENT_MODE" -eq 0 ]; then
  echo "=============================================================="
  echo "   GameCheck Linux Installer — CalVer v\${FULL_VERSION}"
  echo "=============================================================="
  echo "Tip: Enter /opt/GameChecker for a system-wide installation (uses sudo)."
  if [ -t 0 ]; then
    read -r -p "Choose install directory [\${HOME}/.local/share/GameChecker]: " USER_DIR
    if [ -n "\${USER_DIR}" ]; then
      INSTALL_DIR="\${USER_DIR}"
    fi
  fi
  echo "Target directory : \${INSTALL_DIR}"
  echo "Launcher command : \${BIN_DIR}/gamecheck"
  echo "Uninstaller cmd  : \${BIN_DIR}/gamecheck-uninstall"
  echo ""
  if [ -t 0 ]; then
    read -r -p "Do you grant permission to install GameCheck and verify dependencies? [Y/n] " USER_CONSENT
    case "\${USER_CONSENT}" in
      [nN][oO]|[nN])
        echo "{\\"status\\":\\"CANCELLED\\",\\"reason\\":\\"User declined installation permission\\"}"
        exit 1
        ;;
    esac
  fi
fi

DIR_SUDO=""
CHECK_PATH="\${INSTALL_DIR}"
while [ ! -e "\${CHECK_PATH}" ] && [ "\${CHECK_PATH}" != "/" ]; do
  CHECK_PATH="\$(dirname "\${CHECK_PATH}")"
done
if [ ! -w "\${CHECK_PATH}" ] && [ "\$(id -u)" -ne 0 ]; then
  DIR_SUDO="sudo"
fi

# 1. Check and install missing Linux system dependencies
if [ "$SKIP_DEPS" -eq 0 ]; then
  MISSING_CMDS=()
  command -v node >/dev/null 2>&1 || MISSING_CMDS+=("nodejs")
  command -v npm >/dev/null 2>&1 || MISSING_CMDS+=("npm")
  command -v g++ >/dev/null 2>&1 || MISSING_CMDS+=("g++")
  command -v lspci >/dev/null 2>&1 || MISSING_CMDS+=("pciutils")
  command -v glxinfo >/dev/null 2>&1 || MISSING_CMDS+=("mesa-utils")
  command -v xrandr >/dev/null 2>&1 || MISSING_CMDS+=("x11-xserver-utils")
  command -v unzip >/dev/null 2>&1 || MISSING_CMDS+=("unzip")

  if [ "\${#MISSING_CMDS[@]}" -gt 0 ]; then
    echo "[GameCheck Setup] Missing Linux packages detected: \${MISSING_CMDS[*]}"
    ALLOW_SUDO=1
    if [ "$SILENT_MODE" -eq 0 ] && [ -t 0 ]; then
      read -r -p "Grant permission to install missing system dependencies via sudo? [Y/n] " SUDO_CONSENT
      case "\${SUDO_CONSENT}" in
        [nN][oO]|[nN])
          ALLOW_SUDO=0
          ;;
      esac
    fi

    if [ "$ALLOW_SUDO" -eq 1 ]; then
      SUDO_CMD="sudo"
      if [ "\$(id -u)" -eq 0 ]; then
        SUDO_CMD=""
      fi
      if command -v apt-get >/dev/null 2>&1; then
        \$SUDO_CMD apt-get update -qq && \$SUDO_CMD apt-get install -y "\${MISSING_CMDS[@]}" || true
      elif command -v dnf >/dev/null 2>&1; then
        \$SUDO_CMD dnf install -y nodejs npm gcc-c++ pciutils mesa-demos xrandr unzip || true
      elif command -v pacman >/dev/null 2>&1; then
        \$SUDO_CMD pacman -Sy --noconfirm nodejs npm gcc pciutils mesa-utils xorg-xrandr unzip || true
      elif command -v zypper >/dev/null 2>&1; then
        \$SUDO_CMD zypper install -y nodejs npm gcc-c++ pciutils Mesa-demo-x xrandr unzip || true
      fi
    fi
  fi
fi

\$DIR_SUDO mkdir -p "\${INSTALL_DIR}"
mkdir -p "\${BIN_DIR}" "\${APPS_DIR}"

PAYLOAD_ZIP="/tmp/gamecheck_payload_\$\$.zip"
base64 -d << 'EOF_RIGCHECK_PAYLOAD' > "\${PAYLOAD_ZIP}"
${payloadZipBase64}
EOF_RIGCHECK_PAYLOAD

if command -v unzip >/dev/null 2>&1; then
  \$DIR_SUDO unzip -o -q "\${PAYLOAD_ZIP}" -d "\${INSTALL_DIR}"
elif command -v python3 >/dev/null 2>&1; then
  \$DIR_SUDO python3 -m zipfile -e "\${PAYLOAD_ZIP}" "\${INSTALL_DIR}"
fi
rm -f "\${PAYLOAD_ZIP}"
\$DIR_SUDO chmod +x "\${INSTALL_DIR}/gamecheck-desktop.sh" "\${INSTALL_DIR}/rigcheck-desktop.sh" 2>/dev/null || true

# 2. Compile C++17 Native Display Driver Probe & Desktop GUI for Linux if g++ is present
if command -v g++ >/dev/null 2>&1; then
  \$DIR_SUDO mkdir -p "\${INSTALL_DIR}/bin"
  if [ -f "\${INSTALL_DIR}/native/rigcheck_probe.cpp" ]; then
    \$DIR_SUDO g++ -O2 -std=c++17 "\${INSTALL_DIR}/native/rigcheck_probe.cpp" -o "\${INSTALL_DIR}/bin/rigcheck-native-probe" 2>/dev/null || true
    \$DIR_SUDO chmod +x "\${INSTALL_DIR}/bin/rigcheck-native-probe" 2>/dev/null || true
  fi
  if [ -f "\${INSTALL_DIR}/native/gamecheck_desktop.cpp" ]; then
    if command -v pkg-config >/dev/null 2>&1 && pkg-config --exists gtk+-3.0 2>/dev/null; then
      \$DIR_SUDO g++ -O2 -std=c++17 -DGAMECHECK_USE_GTK "\${INSTALL_DIR}/native/gamecheck_desktop.cpp" -o "\${INSTALL_DIR}/bin/gamecheck" \$(pkg-config --cflags --libs gtk+-3.0) -lpthread 2>/dev/null || \
      \$DIR_SUDO g++ -O2 -std=c++17 "\${INSTALL_DIR}/native/gamecheck_desktop.cpp" -o "\${INSTALL_DIR}/bin/gamecheck" -lpthread 2>/dev/null || true
    else
      \$DIR_SUDO g++ -O2 -std=c++17 "\${INSTALL_DIR}/native/gamecheck_desktop.cpp" -o "\${INSTALL_DIR}/bin/gamecheck" -lpthread 2>/dev/null || true
    fi
    \$DIR_SUDO chmod +x "\${INSTALL_DIR}/bin/gamecheck" 2>/dev/null || true
  fi
fi

# 3. Install Electron runtime via npm if not yet present in node_modules
if [ "$SKIP_DEPS" -eq 0 ] && [ ! -d "\${INSTALL_DIR}/node_modules/electron" ] && command -v npm >/dev/null 2>&1; then
  echo "[GameCheck Setup] Installing Electron desktop runtime via npm install..."
  (cd "\${INSTALL_DIR}" && \$DIR_SUDO npm install --no-audit --no-fund) || true
fi

cat << EOF_LAUNCHER > "\${BIN_DIR}/gamecheck"
#!/usr/bin/env bash
cd "\${INSTALL_DIR}"
if [ -x "./node_modules/.bin/electron" ]; then
  exec "./node_modules/.bin/electron" . "\\$@"
elif command -v electron >/dev/null 2>&1; then
  exec electron "\${INSTALL_DIR}" "\\$@"
else
  exec node "\${INSTALL_DIR}/src/cli.js" "\\$@"
fi
EOF_LAUNCHER
chmod +x "\${BIN_DIR}/gamecheck"

cat << EOF_UNINSTALL > "\${BIN_DIR}/gamecheck-uninstall"
#!/usr/bin/env bash
set -e
SILENT=0
for arg in "\\$@"; do
  case "\\$arg" in
    --silent|-y|--yes)
      SILENT=1
      ;;
  esac
done

if [ "\\$SILENT" -eq 0 ]; then
  read -r -p "Are you sure you want to completely uninstall GameCheck and remove all application files and shortcuts? [y/N] " CONFIRM
  case "\\$CONFIRM" in
    [yY][eE][sS]|[yY]) ;;
    *)
      echo "Uninstall cancelled."
      exit 1
      ;;
  esac
fi

rm -rf "\${INSTALL_DIR}"
rm -f "\${BIN_DIR}/gamecheck"
rm -f "\${BIN_DIR}/gamecheck-uninstall"
rm -f "\${APPS_DIR}/gamecheck.desktop"
rm -f "\${APPS_DIR}/gamecheck-uninstall.desktop"
rm -f "\${BIN_DIR}/rigcheck-optimizer"
rm -f "\${APPS_DIR}/rigcheck-optimizer.desktop"
echo "GameCheck has been completely uninstalled."
EOF_UNINSTALL
chmod +x "\${BIN_DIR}/gamecheck-uninstall"

cat << EOF_UNINSTALL_LOCAL > "\${INSTALL_DIR}/uninstall.sh"
#!/usr/bin/env bash
exec "\${BIN_DIR}/gamecheck-uninstall" "\\$@"
EOF_UNINSTALL_LOCAL
chmod +x "\${INSTALL_DIR}/uninstall.sh"

cat << EOF_DESKTOP > "\${APPS_DIR}/gamecheck.desktop"
[Desktop Entry]
Type=Application
Version=1.0
Name=GameCheck
Comment=Cross-Platform PC Hardware & Game Compatibility Checker (CalVer v\${FULL_VERSION})
Exec=\${BIN_DIR}/gamecheck
Path=\${INSTALL_DIR}
Terminal=false
Categories=Game;Utility;System;
StartupNotify=true
EOF_DESKTOP

cat << EOF_DESKTOP_UNINSTALL > "\${APPS_DIR}/gamecheck-uninstall.desktop"
[Desktop Entry]
Type=Application
Version=1.0
Name=Uninstall GameCheck
Comment=Uninstall GameCheck and remove all application files and shortcuts
Exec=\${BIN_DIR}/gamecheck-uninstall
Terminal=true
Categories=Utility;System;
StartupNotify=false
EOF_DESKTOP_UNINSTALL

echo "{\\"status\\":\\"INSTALLED\\",\\"calver\\":\\"\${CALVER}\\",\\"installerType\\":\\"linux-sh\\",\\"installDir\\":\\"\${INSTALL_DIR}\\"}"
`;
}

function findCppToolchain() {
  const mingwGpp = 'C:\\mingw64\\bin\\g++.exe';
  const mingwWindres = 'C:\\mingw64\\bin\\windres.exe';
  if (fs.existsSync(mingwGpp) && fs.existsSync(mingwWindres)) {
    return { gpp: mingwGpp, windres: mingwWindres, binDir: 'C:\\mingw64\\bin' };
  }
  return { gpp: 'g++', windres: 'windres', binDir: null };
}

function buildInstallers() {
  const versionInfo = getVersionInfo(ROOT_DIR);
  const calver = versionInfo.calver;
  const fullVersion = versionInfo.fullVersion;

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(INSTALLER_SUBDIR, { recursive: true });

  // Ensure native probe is freshly built first
  const probeCppPath = path.join(ROOT_DIR, 'native', 'rigcheck_probe.cpp');
  const probeExePath = path.join(ROOT_DIR, 'bin', 'rigcheck-native-probe.exe');
  const toolchain = findCppToolchain();
  const buildEnv = toolchain.binDir
    ? { ...process.env, PATH: `${toolchain.binDir};${process.env.PATH}` }
    : process.env;

  if (process.platform === 'win32' && fs.existsSync(probeCppPath)) {
    fs.mkdirSync(path.join(ROOT_DIR, 'bin'), { recursive: true });
    execFileSync(
      toolchain.gpp,
      ['-O2', '-s', '-std=c++17', 'native/rigcheck_probe.cpp', '-o', 'bin/rigcheck-native-probe.exe', '-luser32', '-lgdi32', '-ladvapi32', '-static'],
      { cwd: ROOT_DIR, env: buildEnv }
    );
  }

  const guiCppPath = path.join(ROOT_DIR, 'native', 'gamecheck_desktop.cpp');
  const coreHppPath = path.join(ROOT_DIR, 'native', 'gamecheck_core.hpp');
  const rcGuiPath = path.join(ROOT_DIR, 'native', 'gamecheck.rc');
  const icoPath = path.join(ROOT_DIR, 'assets', 'gamecheck.ico');
  if (process.platform === 'win32' && fs.existsSync(guiCppPath) && fs.existsSync(coreHppPath)) {
    fs.mkdirSync(path.join(ROOT_DIR, 'bin'), { recursive: true });
    const guiCompileArgs = [
      '-O2',
      '-std=c++17',
      '-mwindows',
      'native/gamecheck_desktop.cpp'
    ];
    if (fs.existsSync(rcGuiPath) && fs.existsSync(icoPath)) {
      execFileSync(
        toolchain.windres,
        ['native/gamecheck.rc', '-O', 'coff', '-o', 'native/gamecheck_res.o'],
        { cwd: ROOT_DIR, env: buildEnv }
      );
      guiCompileArgs.push('native/gamecheck_res.o');
    }
    guiCompileArgs.push(
      '-o',
      'bin/GameCheck.exe',
      '-lgdiplus',
      '-luxtheme',
      '-lcomctl32',
      '-lcomdlg32',
      '-lshell32',
      '-luser32',
      '-lgdi32',
      '-ladvapi32',
      '-lole32',
      '-luuid',
      '-lwinhttp',
      '-static',
      '-s'
    );
    execFileSync(toolchain.gpp, guiCompileArgs, { cwd: ROOT_DIR, env: buildEnv });
  }

  const stageDir = path.join(DIST_DIR, '_stage_payload');
  buildPayloadStage(stageDir);

  const payloadZipName = `RigCheck-App-Payload-${calver}.zip`;
  const payloadZipPath = path.join(DIST_DIR, payloadZipName);
  if (fs.existsSync(payloadZipPath)) {
    fs.unlinkSync(payloadZipPath);
  }

  // Create zip archive of staged files using Windows native tar.exe (bsdtar) or zip
  if (process.platform === 'win32') {
    const stageEntries = fs.readdirSync(stageDir);
    execFileSync('tar.exe', ['-a', '-c', '-f', payloadZipPath, ...stageEntries], { cwd: stageDir });
  } else {
    execSync(`zip -r -q "${payloadZipPath}" .`, { cwd: stageDir });
  }

  // Clean up stage directory
  fs.rmSync(stageDir, { recursive: true, force: true });

  // 1. Build Windows Native C++ .exe Installer (`dist/GameCheck-Setup-<calver>.exe` + `dist/RigCheck-Optimizer-Setup-<calver>.exe`)
  const gameCheckExeName = `GameCheck-Setup-${calver}.exe`;
  const gameCheckExePath = path.join(DIST_DIR, gameCheckExeName);
  const winExeName = `RigCheck-Optimizer-Setup-${calver}.exe`;
  const winExePath = path.join(DIST_DIR, winExeName);

  if (process.platform === 'win32') {
    const installerCppPath = path.join(ROOT_DIR, 'native', 'rigcheck_installer.cpp');
    const configHeaderPath = path.join(DIST_DIR, '_installer_config.h');
    const rcPath = path.join(DIST_DIR, '_installer.rc');
    const resObjPath = path.join(DIST_DIR, '_installer_res.o');

    const configHeader = `#pragma once
#define RIGCHECK_CALVER "${calver}"
#define RIGCHECK_FULL_VERSION "${fullVersion}"
`;
    fs.writeFileSync(configHeaderPath, configHeader, 'utf8');

    const installerIconLine = fs.existsSync(icoPath)
      ? '101 ICON "../assets/gamecheck.ico"\n'
      : '';
    const rcContent = `#include <windows.h>
${installerIconLine}101 RCDATA "${payloadZipName}"
`;
    fs.writeFileSync(rcPath, rcContent, 'utf8');

    // Compile Windows resource script (.rc -> .o) with windres using relative paths
    execFileSync(toolchain.windres, ['_installer.rc', '-O', 'coff', '-o', '_installer_res.o'], { cwd: DIST_DIR, env: buildEnv });

    // Compile & link C++17 installer with embedded payload & stripped symbols
    execFileSync(
      toolchain.gpp,
      [
        '-O2',
        '-s',
        '-std=c++17',
        '-mwindows',
        '-Idist',
        'native/rigcheck_installer.cpp',
        'dist/_installer_res.o',
        '-o',
        `dist/${gameCheckExeName}`,
        '-luser32',
        '-lgdi32',
        '-lshell32',
        '-ladvapi32',
        '-lole32',
        '-luuid',
        '-static'
      ],
      { cwd: ROOT_DIR, env: buildEnv }
    );

    fs.copyFileSync(gameCheckExePath, winExePath);

    fs.rmSync(configHeaderPath, { force: true });
    fs.rmSync(rcPath, { force: true });
    fs.rmSync(resObjPath, { force: true });
  }

  // 2. Build Linux Native Self-Contained Installer (`dist/gamecheck-installer-<calver>.sh` + `dist/rigcheck-installer-<calver>.sh`)
  const gameCheckLinuxShName = `gamecheck-installer-${calver}.sh`;
  const gameCheckLinuxShPath = path.join(DIST_DIR, gameCheckLinuxShName);
  const linuxShName = `rigcheck-installer-${calver}.sh`;
  const linuxShPath = path.join(DIST_DIR, linuxShName);
  const payloadBase64 = fs.readFileSync(payloadZipPath).toString('base64').replace(/(.{76})/g, '$1\n');
  const linuxScript = generateLinuxInstallerScript(calver, fullVersion, payloadBase64);
  fs.writeFileSync(linuxShPath, linuxScript, { encoding: 'utf8', mode: 0o755 });
  fs.writeFileSync(gameCheckLinuxShPath, linuxScript, { encoding: 'utf8', mode: 0o755 });

  const gameCheckPayloadZipName = `GameCheck-App-Payload-${calver}.zip`;
  const gameCheckPayloadZipPath = path.join(DIST_DIR, gameCheckPayloadZipName);
  fs.copyFileSync(payloadZipPath, gameCheckPayloadZipPath);

  // Copy artifacts into dist/installer/ as well
  fs.copyFileSync(payloadZipPath, path.join(INSTALLER_SUBDIR, payloadZipName));
  fs.copyFileSync(gameCheckPayloadZipPath, path.join(INSTALLER_SUBDIR, gameCheckPayloadZipName));
  if (fs.existsSync(gameCheckExePath)) {
    fs.copyFileSync(gameCheckExePath, path.join(INSTALLER_SUBDIR, gameCheckExeName));
  }
  if (fs.existsSync(winExePath)) {
    fs.copyFileSync(winExePath, path.join(INSTALLER_SUBDIR, winExeName));
  }
  fs.copyFileSync(linuxShPath, path.join(INSTALLER_SUBDIR, linuxShName));
  fs.copyFileSync(gameCheckLinuxShPath, path.join(INSTALLER_SUBDIR, gameCheckLinuxShName));

  // Locate latest .rigpatch.json patch bundle in dist/patches/ if available
  const patchesDir = path.join(DIST_DIR, 'patches');
  let latestPatchEntry = null;
  if (fs.existsSync(patchesDir)) {
    const patchFiles = fs
      .readdirSync(patchesDir)
      .filter((f) => f.endsWith('.rigpatch.json'))
      .map((f) => {
        const fullPath = path.join(patchesDir, f);
        return { name: f, path: fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (patchFiles.length > 0) {
      const pf = patchFiles[0];
      // Also copy latest patch into dist/ root for direct GitHub Release attachment
      const rootPatchCopy = path.join(DIST_DIR, pf.name);
      if (pf.path !== rootPatchCopy) {
        fs.copyFileSync(pf.path, rootPatchCopy);
      }
      latestPatchEntry = {
        fileName: pf.name,
        relativePath: `dist/patches/${pf.name}`,
        sizeBytes: fs.statSync(pf.path).size,
        sha256: sha256File(pf.path)
      };
    }
  }

  // Generate dist/SHA256SUMS.txt and dist/release-manifest.json for GitHub Releases
  const releaseAssets = [];
  if (fs.existsSync(gameCheckExePath)) {
    releaseAssets.push({
      fileName: gameCheckExeName,
      relativePath: `dist/${gameCheckExeName}`,
      platform: 'win32',
      type: 'windows-native-cpp-installer',
      sizeBytes: fs.statSync(gameCheckExePath).size,
      sha256: sha256File(gameCheckExePath)
    });
  }
  if (fs.existsSync(winExePath)) {
    releaseAssets.push({
      fileName: winExeName,
      relativePath: `dist/${winExeName}`,
      platform: 'win32',
      type: 'windows-native-cpp-installer',
      sizeBytes: fs.statSync(winExePath).size,
      sha256: sha256File(winExePath)
    });
  }
  releaseAssets.push({
    fileName: gameCheckLinuxShName,
    relativePath: `dist/${gameCheckLinuxShName}`,
    platform: 'linux',
    type: 'linux-self-contained-installer',
    sizeBytes: fs.statSync(gameCheckLinuxShPath).size,
    sha256: sha256File(gameCheckLinuxShPath)
  });
  releaseAssets.push({
    fileName: linuxShName,
    relativePath: `dist/${linuxShName}`,
    platform: 'linux',
    type: 'linux-self-contained-installer',
    sizeBytes: fs.statSync(linuxShPath).size,
    sha256: sha256File(linuxShPath)
  });
  releaseAssets.push({
    fileName: gameCheckPayloadZipName,
    relativePath: `dist/${gameCheckPayloadZipName}`,
    platform: 'cross-platform',
    type: 'portable-app-payload-zip',
    sizeBytes: fs.statSync(gameCheckPayloadZipPath).size,
    sha256: sha256File(gameCheckPayloadZipPath)
  });
  releaseAssets.push({
    fileName: payloadZipName,
    relativePath: `dist/${payloadZipName}`,
    platform: 'cross-platform',
    type: 'portable-app-payload-zip',
    sizeBytes: fs.statSync(payloadZipPath).size,
    sha256: sha256File(payloadZipPath)
  });
  if (latestPatchEntry) {
    releaseAssets.push({
      fileName: latestPatchEntry.fileName,
      relativePath: `dist/${latestPatchEntry.fileName}`,
      platform: 'cross-platform',
      type: 'calver-sha256-live-patch',
      sizeBytes: latestPatchEntry.sizeBytes,
      sha256: latestPatchEntry.sha256
    });
  }

  const sha256SumsPath = path.join(DIST_DIR, 'SHA256SUMS.txt');
  const sha256Lines = releaseAssets.map((a) => `${a.sha256}  ${a.fileName}`).join('\n') + '\n';
  fs.writeFileSync(sha256SumsPath, sha256Lines, 'utf8');
  fs.copyFileSync(sha256SumsPath, path.join(INSTALLER_SUBDIR, 'SHA256SUMS.txt'));

  const releaseManifestPath = path.join(DIST_DIR, 'release-manifest.json');
  const releaseManifest = {
    appName: 'RigCheck Optimizer',
    calver,
    fullVersion,
    gitTag: versionInfo.gitTag || `v${fullVersion}`,
    channel: versionInfo.channel || 'stable',
    releasedAt: versionInfo.releasedAt || new Date().toISOString(),
    notes: versionInfo.notes || '',
    generatedAt: new Date().toISOString(),
    assets: releaseAssets
  };
  fs.writeFileSync(releaseManifestPath, JSON.stringify(releaseManifest, null, 2) + '\n', 'utf8');
  fs.copyFileSync(releaseManifestPath, path.join(INSTALLER_SUBDIR, 'release-manifest.json'));

  const result = {
    calver,
    fullVersion,
    gitTag: versionInfo.gitTag || `v${fullVersion}`,
    sha256SumsPath,
    releaseManifestPath,
    payloadZip: {
      path: payloadZipPath,
      sizeBytes: fs.statSync(payloadZipPath).size,
      sha256: sha256File(payloadZipPath)
    },
    windowsExe: fs.existsSync(winExePath)
      ? {
          path: winExePath,
          sizeBytes: fs.statSync(winExePath).size,
          sha256: sha256File(winExePath)
        }
      : null,
    linuxSh: {
      path: linuxShPath,
      sizeBytes: fs.statSync(linuxShPath).size,
      sha256: sha256File(linuxShPath)
    },
    latestPatch: latestPatchEntry
  };

  console.log('==============================================================');
  console.log('   RIGCHECK OPTIMIZER — NATIVE C++ & LINUX INSTALLERS BUILT');
  console.log('==============================================================');
  console.log(`CalVer Release : v${fullVersion} (Tag: ${result.gitTag})`);
  if (result.windowsExe) {
    console.log(`Windows Setup  : dist/${winExeName} (${(result.windowsExe.sizeBytes / 1024).toFixed(1)} KB)`);
    console.log(`  Compiler     : MinGW-w64 C++17 (g++ + windres)`);
    console.log(`  SHA-256      : ${result.windowsExe.sha256}`);
  }
  console.log(`Linux Installer: dist/${linuxShName} (${(result.linuxSh.sizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`  SHA-256      : ${result.linuxSh.sha256}`);
  console.log(`App Payload    : dist/${payloadZipName} (${(result.payloadZip.sizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`SHA256SUMS.txt : dist/SHA256SUMS.txt`);
  console.log(`Release Manif. : dist/release-manifest.json (${releaseAssets.length} downloadable assets)`);
  console.log('==============================================================');

  return result;
}

if (require.main === module) {
  buildInstallers();
}

module.exports = { buildInstallers };
