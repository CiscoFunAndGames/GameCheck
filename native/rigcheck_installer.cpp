// =============================================================================
// RigCheck Optimizer — Native Windows C++17 Self-Contained Installer
// Compiled with MinGW-w64 g++ & windres (embeds ZIP payload + UAC manifest)
// Checks user/Administrator permissions, verifies & installs Node.js, Electron,
// and the C++17 Native Display Driver Probe, and creates shortcuts & registry keys.
// =============================================================================

#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <objbase.h>
#include <shobjidl.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <cstdlib>

#if __has_include("_installer_config.h")
#include "_installer_config.h"
#endif

#ifndef RIGCHECK_CALVER
#define RIGCHECK_CALVER "2026.11.17"
#endif

#ifndef RIGCHECK_FULL_VERSION
#define RIGCHECK_FULL_VERSION "2026.11.17"
#endif

#define IDR_PAYLOAD_ZIP 101

static std::string wideToUtf8(const std::wstring& w) {
    if (w.empty()) return "";
    int sz = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    if (sz <= 0) return "";
    std::string out(sz, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), &out[0], sz, nullptr, nullptr);
    return out;
}

static std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return L"";
    int sz = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    if (sz <= 0) return L"";
    std::wstring out(sz, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &out[0], sz);
    return out;
}

static std::string jsonEscape(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

static std::string trimString(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

static std::string toLowerAscii(std::string s) {
    for (char& c : s) {
        if (c >= 'A' && c <= 'Z') c = (char)(c - 'A' + 'a');
    }
    return s;
}

static std::string normalizeWinPath(std::string p) {
    for (char& c : p) {
        if (c == '/') c = '\\';
    }
    while (p.size() > 3 && p.back() == '\\') {
        p.pop_back();
    }
    return p;
}

static std::string getSelfExePath() {
    wchar_t buf[MAX_PATH];
    DWORD len = GetModuleFileNameW(nullptr, buf, MAX_PATH);
    if (len == 0 || len >= MAX_PATH) return "";
    return wideToUtf8(std::wstring(buf, len));
}

static std::string getParentDir(const std::string& path) {
    size_t pos = path.find_last_of("\\/");
    if (pos == std::string::npos) return "";
    return path.substr(0, pos);
}

static std::string getFileNameOnly(const std::string& path) {
    size_t pos = path.find_last_of("\\/");
    if (pos == std::string::npos) return path;
    return path.substr(pos + 1);
}

static bool spawnDetachedDeleteDir(const std::string& targetDir) {
    wchar_t tempBuf[MAX_PATH];
    DWORD tLen = GetTempPathW(MAX_PATH, tempBuf);
    std::wstring workDir = (tLen > 0 && tLen < MAX_PATH) ? std::wstring(tempBuf) : L"C:\\";

    std::wstring wCmd = L"cmd.exe /c ping -n 2 127.0.0.1 >nul & rmdir /s /q \"" + utf8ToWide(targetDir) + L"\"";
    STARTUPINFOW si = {};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;

    PROCESS_INFORMATION pi = {};
    BOOL ok = CreateProcessW(
        nullptr,
        &wCmd[0],
        nullptr,
        nullptr,
        FALSE,
        CREATE_NO_WINDOW | DETACHED_PROCESS,
        nullptr,
        workDir.c_str(),
        &si,
        &pi
    );
    if (ok) {
        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        return true;
    }
    return false;
}

static bool fileExists(const std::string& path) {
    DWORD attr = GetFileAttributesW(utf8ToWide(path).c_str());
    return (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY));
}

static bool dirExists(const std::string& path) {
    DWORD attr = GetFileAttributesW(utf8ToWide(path).c_str());
    return (attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY));
}

static void createDirsRecursive(const std::string& path) {
    std::string accum;
    for (size_t i = 0; i < path.size(); ++i) {
        char c = path[i];
        if ((c == '\\' || c == '/') && !accum.empty() && accum.back() != ':') {
            CreateDirectoryW(utf8ToWide(accum).c_str(), nullptr);
        }
        accum += c;
    }
    if (!accum.empty()) {
        CreateDirectoryW(utf8ToWide(accum).c_str(), nullptr);
    }
}

static bool isRunningAsAdmin() {
    BOOL isAdmin = FALSE;
    PSID adminGroup = nullptr;
    SID_IDENTIFIER_AUTHORITY ntAuthority = SECURITY_NT_AUTHORITY;
    if (AllocateAndInitializeSid(&ntAuthority, 2, SECURITY_BUILTIN_DOMAIN_RID,
                                 DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &adminGroup)) {
        CheckTokenMembership(nullptr, adminGroup, &isAdmin);
        FreeSid(adminGroup);
    }
    return isAdmin == TRUE;
}

static bool runElevatedProcess(const std::wstring& file, const std::wstring& params, bool waitProcess = true) {
    SHELLEXECUTEINFOW sei = {};
    sei.cbSize = sizeof(sei);
    sei.fMask = SEE_MASK_NOCLOSEPROCESS;
    sei.lpVerb = L"runas";
    sei.lpFile = file.c_str();
    sei.lpParameters = params.c_str();
    sei.nShow = SW_SHOWNORMAL;
    if (!ShellExecuteExW(&sei)) {
        return false;
    }
    if (waitProcess && sei.hProcess) {
        WaitForSingleObject(sei.hProcess, INFINITE);
        DWORD exitCode = 1;
        GetExitCodeProcess(sei.hProcess, &exitCode);
        CloseHandle(sei.hProcess);
        return exitCode == 0;
    }
    if (sei.hProcess) CloseHandle(sei.hProcess);
    return true;
}

static int runCommandCapture(const std::string& cmd, std::string& outputOut, const std::string& workingDir = "") {
    outputOut.clear();
    SECURITY_ATTRIBUTES sa = {};
    sa.nLength = sizeof(sa);
    sa.bInheritHandle = TRUE;

    HANDLE hRead = nullptr, hWrite = nullptr;
    if (!CreatePipe(&hRead, &hWrite, &sa, 0)) return -1;
    SetHandleInformation(hRead, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOW si = {};
    si.cb = sizeof(si);
    si.dwFlags = STARTF_USESTDHANDLES | STARTF_USESHOWWINDOW;
    si.hStdOutput = hWrite;
    si.hStdError = hWrite;
    si.wShowWindow = SW_HIDE;

    PROCESS_INFORMATION pi = {};
    std::wstring wCmd = L"cmd.exe /c " + utf8ToWide(cmd);
    std::wstring wDir = utf8ToWide(workingDir);

    BOOL ok = CreateProcessW(
        nullptr,
        &wCmd[0],
        nullptr,
        nullptr,
        TRUE,
        CREATE_NO_WINDOW,
        nullptr,
        workingDir.empty() ? nullptr : wDir.c_str(),
        &si,
        &pi
    );
    CloseHandle(hWrite);

    if (!ok) {
        CloseHandle(hRead);
        return -1;
    }

    char buf[1024];
    DWORD bytesRead = 0;
    while (ReadFile(hRead, buf, sizeof(buf) - 1, &bytesRead, nullptr) && bytesRead > 0) {
        buf[bytesRead] = '\0';
        outputOut += buf;
    }
    CloseHandle(hRead);

    WaitForSingleObject(pi.hProcess, 120000);
    DWORD exitCode = 1;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return (int)exitCode;
}

static std::string getEnvVar(const char* name) {
    wchar_t buf[4096];
    DWORD len = GetEnvironmentVariableW(utf8ToWide(name).c_str(), buf, 4096);
    if (len == 0 || len >= 4096) return "";
    return wideToUtf8(buf);
}

static bool createWindowsShortcut(const std::string& shortcutPath, const std::string& targetPath, const std::string& workingDir, const std::string& description) {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    bool shouldUninit = SUCCEEDED(hr);

    IShellLinkW* psl = nullptr;
    hr = CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_IShellLinkW, (LPVOID*)&psl);
    if (FAILED(hr) || !psl) {
        if (shouldUninit) CoUninitialize();
        return false;
    }

    psl->SetPath(utf8ToWide(targetPath).c_str());
    psl->SetWorkingDirectory(utf8ToWide(workingDir).c_str());
    psl->SetDescription(utf8ToWide(description).c_str());

    IPersistFile* ppf = nullptr;
    hr = psl->QueryInterface(IID_IPersistFile, (LPVOID*)&ppf);
    bool saved = false;
    if (SUCCEEDED(hr) && ppf) {
        hr = ppf->Save(utf8ToWide(shortcutPath).c_str(), TRUE);
        saved = SUCCEEDED(hr);
        ppf->Release();
    }
    psl->Release();
    if (shouldUninit) CoUninitialize();
    return saved;
}

struct DependencyStatus {
    bool nodeInstalled = false;
    std::string nodeVersion;
    bool npmInstalled = false;
    std::string npmVersion;
    bool gppInstalled = false;
    std::string gppPath;
    bool electronInstalled = false;
    bool nativeProbeInstalled = false;
    bool gameCheckExeInstalled = false;
};

static DependencyStatus checkDependencies(const std::string& targetDir, const std::string& sourceWorkspace) {
    DependencyStatus st;
    std::string out;

    if (runCommandCapture("node -v", out) == 0) {
        st.nodeInstalled = true;
        st.nodeVersion = trimString(out);
    }
    if (runCommandCapture("npm -v", out) == 0) {
        st.npmInstalled = true;
        st.npmVersion = trimString(out);
    }
    if (fileExists("C:\\mingw64\\bin\\g++.exe")) {
        st.gppInstalled = true;
        st.gppPath = "C:\\mingw64\\bin\\g++.exe";
    } else if (runCommandCapture("g++ --version", out) == 0) {
        st.gppInstalled = true;
        st.gppPath = "g++";
    }

    std::string checkDir = !targetDir.empty() && dirExists(targetDir) ? targetDir : sourceWorkspace;
    if (!checkDir.empty()) {
        if (fileExists(checkDir + "\\node_modules\\electron\\index.js") ||
            dirExists(checkDir + "\\node_modules\\electron") ||
            fileExists(checkDir + "\\bin\\GameCheck.exe")) {
            st.electronInstalled = true;
        }
        if (fileExists(checkDir + "\\bin\\rigcheck-native-probe.exe")) {
            st.nativeProbeInstalled = true;
        }
        if (fileExists(checkDir + "\\bin\\GameCheck.exe")) {
            st.gameCheckExeInstalled = true;
        }
    }
    return st;
}

static std::string detectRuntimeWorkspace() {
    wchar_t cwdBuf[MAX_PATH];
    if (GetCurrentDirectoryW(MAX_PATH, cwdBuf) > 0) {
        std::string cwd = wideToUtf8(cwdBuf);
        if (dirExists(cwd + "\\node_modules\\electron") || fileExists(cwd + "\\bin\\rigcheck-native-probe.exe")) {
            return cwd;
        }
    }
    wchar_t exeBuf[MAX_PATH];
    if (GetModuleFileNameW(nullptr, exeBuf, MAX_PATH) > 0) {
        std::string exePath = wideToUtf8(exeBuf);
        size_t slash = exePath.find_last_of("\\/");
        if (slash != std::string::npos) {
            std::string exeDir = exePath.substr(0, slash);
            if (dirExists(exeDir + "\\node_modules\\electron")) return exeDir;
            size_t parentSlash = exeDir.find_last_of("\\/");
            if (parentSlash != std::string::npos) {
                std::string parentDir = exeDir.substr(0, parentSlash);
                if (dirExists(parentDir + "\\node_modules\\electron") || fileExists(parentDir + "\\bin\\rigcheck-native-probe.exe")) {
                    return parentDir;
                }
            }
        }
    }
    return "";
}

int main(int argc, char* argv[]) {
    std::string calver = RIGCHECK_CALVER;
    std::string fullVersion = RIGCHECK_FULL_VERSION;
    std::string sourceWorkspace = detectRuntimeWorkspace();

    std::string localAppData = getEnvVar("LOCALAPPDATA");
    if (localAppData.empty()) {
        localAppData = getEnvVar("USERPROFILE") + "\\AppData\\Local";
    }
    std::string defaultInstallDir = localAppData + "\\Programs\\GameCheck";

    std::string selfExePath = getSelfExePath();
    std::string selfExeDir = getParentDir(selfExePath);
    std::string selfExeNameLower = toLowerAscii(getFileNameOnly(selfExePath));
    bool detectedUninstallByName = (selfExeNameLower.find("uninstall") != std::string::npos);

    bool verifyOnly = false;
    bool checkDepsOnly = false;
    bool silentMode = false;
    bool skipRegistryAndShortcuts = false;
    bool skipDeps = false;
    bool uninstallMode = detectedUninstallByName;
    bool elevateSelf = false;
    std::string customInstallDir;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--verify") verifyOnly = true;
        else if (arg == "--check-deps") checkDepsOnly = true;
        else if (arg == "--silent" || arg == "/S" || arg == "/s") silentMode = true;
        else if (arg == "--no-shortcuts" || arg == "--portable") skipRegistryAndShortcuts = true;
        else if (arg == "--no-deps") skipDeps = true;
        else if (arg == "--uninstall") uninstallMode = true;
        else if (arg == "--elevate") elevateSelf = true;
        else if (arg.rfind("--install-dir=", 0) == 0) {
            customInstallDir = arg.substr(std::string("--install-dir=").size());
            if (customInstallDir.size() >= 2 && customInstallDir.front() == '"' && customInstallDir.back() == '"') {
                customInstallDir = customInstallDir.substr(1, customInstallDir.size() - 2);
            }
        }
    }

    std::string targetDir = !customInstallDir.empty()
        ? customInstallDir
        : (detectedUninstallByName && !selfExeDir.empty() ? selfExeDir : defaultInstallDir);
    targetDir = normalizeWinPath(targetDir);

    if (elevateSelf && !isRunningAsAdmin()) {
        wchar_t selfPath[MAX_PATH];
        GetModuleFileNameW(nullptr, selfPath, MAX_PATH);
        std::wstring params = L"--silent";
        if (!customInstallDir.empty()) {
            params += L" --install-dir=\"" + utf8ToWide(customInstallDir) + L"\"";
        }
        bool ok = runElevatedProcess(selfPath, params, true);
        return ok ? 0 : 1;
    }

    // Locate embedded RCDATA payload zip
    HRSRC hRes = FindResourceW(nullptr, MAKEINTRESOURCEW(IDR_PAYLOAD_ZIP), (LPCWSTR)RT_RCDATA);
    DWORD payloadBytes = 0;
    const void* payloadData = nullptr;
    if (hRes) {
        payloadBytes = SizeofResource(nullptr, hRes);
        HGLOBAL hLoaded = LoadResource(nullptr, hRes);
        if (hLoaded) {
            payloadData = LockResource(hLoaded);
        }
    }

    if (verifyOnly) {
        if (payloadBytes == 0 || !payloadData) {
            std::cerr << "{\"status\":\"ERROR\",\"reason\":\"Embedded C++ RCDATA payload missing\"}" << std::endl;
            return 1;
        }
        std::cout << "{\"status\":\"INSTALLER_OK\""
                  << ",\"appName\":\"GameCheck\""
                  << ",\"calver\":\"" << jsonEscape(calver) << "\""
                  << ",\"fullVersion\":\"" << jsonEscape(fullVersion) << "\""
                  << ",\"installerType\":\"win32-native-cpp-exe\""
                  << ",\"compiler\":\"MinGW-w64 C++17 (g++ + windres)\""
                  << ",\"uacAware\":true"
                  << ",\"dependenciesManaged\":[\"GameCheck.exe Native C++17 GUI\",\"Node.js\",\"Electron\",\"C++17 Native Display Probe\"]"
                  << ",\"embeddedPayloadBytes\":" << payloadBytes
                  << "}" << std::endl;
        return 0;
    }

    if (checkDepsOnly) {
        DependencyStatus st = checkDependencies(targetDir, sourceWorkspace);
        std::cout << "{\"status\":\"DEPS_CHECK\""
                  << ",\"platform\":\"win32\""
                  << ",\"isAdmin\":" << (isRunningAsAdmin() ? "true" : "false")
                  << ",\"dependencies\":{"
                  << "\"gameCheckExe\":{\"installed\":" << (st.gameCheckExeInstalled ? "true" : "false") << "},"
                  << "\"node\":{\"installed\":" << (st.nodeInstalled ? "true" : "false")
                  << ",\"version\":\"" << jsonEscape(st.nodeVersion) << "\"},"
                  << "\"npm\":{\"installed\":" << (st.npmInstalled ? "true" : "false")
                  << ",\"version\":\"" << jsonEscape(st.npmVersion) << "\"},"
                  << "\"electron\":{\"installed\":" << (st.electronInstalled ? "true" : "false") << "},"
                  << "\"nativeProbe\":{\"installed\":" << (st.nativeProbeInstalled ? "true" : "false")
                  << ",\"compiler\":\"" << jsonEscape(st.gppPath) << "\"}"
                  << "}}" << std::endl;
        return 0;
    }

    if (uninstallMode) {
        if (!silentMode) {
            int confirm = MessageBoxW(
                nullptr,
                L"Are you sure you want to completely uninstall GameCheck and remove all application files, shortcuts, and registry entries?",
                L"GameCheck — Uninstall",
                MB_YESNO | MB_ICONQUESTION | MB_SETFOREGROUND
            );
            if (confirm != IDYES) {
                std::cout << "{\"status\":\"CANCELLED\",\"reason\":\"User declined uninstall\"}" << std::endl;
                return 1;
            }
        }

        if (!skipRegistryAndShortcuts) {
            std::string userProfile = getEnvVar("USERPROFILE");
            if (!userProfile.empty()) {
                std::string gameCheckDesktopLnk = userProfile + "\\Desktop\\GameCheck.lnk";
                if (fileExists(gameCheckDesktopLnk)) DeleteFileW(utf8ToWide(gameCheckDesktopLnk).c_str());
                std::string legacyDesktopLnk = userProfile + "\\Desktop\\RigCheck Optimizer.lnk";
                if (fileExists(legacyDesktopLnk)) DeleteFileW(utf8ToWide(legacyDesktopLnk).c_str());
            }

            std::string appData = getEnvVar("APPDATA");
            if (!appData.empty()) {
                std::string startMenuFolder = appData + "\\Microsoft\\Windows\\Start Menu\\Programs\\GameCheck";
                std::string smAppLnk = startMenuFolder + "\\GameCheck.lnk";
                std::string smUninstLnk = startMenuFolder + "\\Uninstall GameCheck.lnk";
                if (fileExists(smAppLnk)) DeleteFileW(utf8ToWide(smAppLnk).c_str());
                if (fileExists(smUninstLnk)) DeleteFileW(utf8ToWide(smUninstLnk).c_str());
                if (dirExists(startMenuFolder)) RemoveDirectoryW(utf8ToWide(startMenuFolder).c_str());

                std::string legacyStartMenuLnk = appData + "\\Microsoft\\Windows\\Start Menu\\Programs\\RigCheck Optimizer.lnk";
                if (fileExists(legacyStartMenuLnk)) DeleteFileW(utf8ToWide(legacyStartMenuLnk).c_str());
            }

            RegDeleteTreeW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameCheck");
            RegDeleteTreeW(HKEY_CURRENT_USER, L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\RigCheckOptimizer");
        }

        if (!targetDir.empty() && dirExists(targetDir)) {
            std::string normSelfLower = toLowerAscii(normalizeWinPath(selfExePath));
            std::string normTargetLower = toLowerAscii(normalizeWinPath(targetDir));
            bool runningInsideTarget = (normSelfLower.size() > normTargetLower.size() &&
                                        normSelfLower.rfind(normTargetLower + "\\", 0) == 0);
            if (runningInsideTarget) {
                spawnDetachedDeleteDir(targetDir);
            } else {
                std::string rmOut;
                runCommandCapture("rmdir /s /q \"" + targetDir + "\"", rmOut);
            }
        }

        if (!silentMode) {
            MessageBoxW(
                nullptr,
                L"GameCheck has been completely uninstalled from your computer.",
                L"GameCheck — Uninstall Complete",
                MB_OK | MB_ICONINFORMATION | MB_SETFOREGROUND
            );
        }

        std::cout << "{\"status\":\"UNINSTALLED\",\"installDir\":\"" << jsonEscape(targetDir) << "\"}" << std::endl;
        return 0;
    }

    // Interactive User Permission Prompt (when not running in --silent mode)
    if (!silentMode) {
        std::wstring promptMsg =
            L"GameCheck Setup (CalVer v" + utf8ToWide(fullVersion) + L")\n\n"
            L"This native C++ installer will:\n"
            L"1. Install GameCheck to:\n   " + utf8ToWide(targetDir) + L"\n"
            L"2. Verify & install required runtime dependencies:\n"
            L"   - GameCheck.exe Native C++17 GUI\n"
            L"   - Node.js LTS Runtime & npm\n"
            L"   - Electron Desktop App Shell\n"
            L"   - C++17 Native Display Driver Probe (rigcheck-native-probe.exe)\n"
            L"3. Register Desktop, Start Menu, and Windows Installed Apps entries\n\n"
            L"Do you grant permission to proceed with installation?";

        int response = MessageBoxW(
            nullptr,
            promptMsg.c_str(),
            L"GameCheck — Native Setup Permission",
            MB_YESNO | MB_ICONQUESTION | MB_SETFOREGROUND
        );
        if (response != IDYES) {
            std::cout << "{\"status\":\"CANCELLED\",\"reason\":\"User declined installation permission\"}" << std::endl;
            return 1;
        }

        std::cout << "==============================================================" << std::endl;
        std::cout << "   GameCheck Native C++ Setup — CalVer v" << fullVersion << std::endl;
        std::cout << "==============================================================" << std::endl;
        std::cout << "Installing to: " << targetDir << std::endl;
    }

    // Create target directory and write embedded payload zip
    createDirsRecursive(targetDir);
    std::string tempZip = targetDir + "\\_payload_extract.zip";

    if (payloadData && payloadBytes > 0) {
        std::ofstream ofs(tempZip, std::ios::binary | std::ios::trunc);
        if (!ofs) {
            std::cerr << "[RigCheck Setup Error] Failed to write temporary payload archive to " << tempZip << std::endl;
            return 1;
        }
        ofs.write(reinterpret_cast<const char*>(payloadData), payloadBytes);
        ofs.close();
    } else {
        std::cerr << "[RigCheck Setup Error] Embedded payload resource missing." << std::endl;
        return 1;
    }

    // Extract payload zip using Windows 10/11 native tar.exe (with PowerShell fallback)
    std::string cmdOut;
    std::string tarCmd = "tar.exe -xf \"" + tempZip + "\" -C \"" + targetDir + "\"";
    int extractCode = runCommandCapture(tarCmd, cmdOut);
    if (extractCode != 0) {
        std::string psCmd = "powershell -NoProfile -Command \"Expand-Archive -Path '" + tempZip + "' -DestinationPath '" + targetDir + "' -Force\"";
        extractCode = runCommandCapture(psCmd, cmdOut);
    }
    DeleteFileW(utf8ToWide(tempZip).c_str());

    if (extractCode != 0) {
        std::cerr << "[RigCheck Setup Error] Failed to extract payload archive: " << cmdOut << std::endl;
        return 1;
    }

    // Check & Install Dependencies
    DependencyStatus deps = checkDependencies(targetDir, sourceWorkspace);

    if (!skipDeps) {
        // 1. Node.js & npm check — install via winget with UAC elevation if missing
        if (!deps.nodeInstalled) {
            bool allowNodeInstall = silentMode;
            if (!silentMode) {
                int r = MessageBoxW(
                    nullptr,
                    L"Node.js LTS was not detected on your PATH.\n\n"
                    L"Would you like RigCheck Setup to install OpenJS.NodeJS.LTS automatically via Windows Package Manager (winget)?\n"
                    L"(This may request Administrator UAC permission)",
                    L"RigCheck Optimizer — Install Node.js Dependency",
                    MB_YESNO | MB_ICONINFORMATION
                );
                allowNodeInstall = (r == IDYES);
            }
            if (allowNodeInstall) {
                if (!silentMode) std::cout << "[RigCheck Setup] Installing OpenJS.NodeJS.LTS via winget..." << std::endl;
                std::wstring wingetArgs = L"install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements";
                runElevatedProcess(L"winget.exe", wingetArgs, true);
            }
        }

        // 2. Link or install Electron & node_modules in targetDir
        std::string targetNodeModules = targetDir + "\\node_modules";
        std::string sourceNodeModules = sourceWorkspace + "\\node_modules";
        if (!dirExists(targetNodeModules) && !sourceWorkspace.empty() && dirExists(sourceNodeModules)) {
            std::string mklinkCmd = "mklink /J \"" + targetNodeModules + "\" \"" + sourceNodeModules + "\"";
            runCommandCapture(mklinkCmd, cmdOut);
        }

        if (!dirExists(targetNodeModules + "\\electron") && deps.npmInstalled) {
            if (!silentMode) {
                std::cout << "[RigCheck Setup] Installing Electron desktop runtime via npm install..." << std::endl;
            }
            runCommandCapture("npm install --no-audit --no-fund", cmdOut, targetDir);
        }

        // 3. Ensure C++17 Native Display Driver Probe & GameCheck.exe binaries are present or compiled
        std::string probeExe = targetDir + "\\bin\\rigcheck-native-probe.exe";
        std::string probeCpp = targetDir + "\\native\\rigcheck_probe.cpp";
        if (!fileExists(probeExe) && fileExists(probeCpp) && deps.gppInstalled) {
            createDirsRecursive(targetDir + "\\bin");
            std::string buildCmd = "\"" + deps.gppPath + "\" -O2 -std=c++17 \"" + probeCpp + "\" -o \"" + probeExe + "\" -luser32 -lgdi32 -ladvapi32 -static";
            runCommandCapture(buildCmd, cmdOut, targetDir);
        }
        std::string guiExe = targetDir + "\\bin\\GameCheck.exe";
        std::string guiCpp = targetDir + "\\native\\gamecheck_desktop.cpp";
        if (!fileExists(guiExe) && fileExists(guiCpp) && deps.gppInstalled) {
            createDirsRecursive(targetDir + "\\bin");
            std::string buildGuiCmd = "\"" + deps.gppPath + "\" -O2 -std=c++17 \"" + guiCpp + "\" -o \"" + guiExe + "\" -lgdiplus -luxtheme -lcomctl32 -lcomdlg32 -lshell32 -luser32 -lgdi32 -ladvapi32 -lole32 -luuid -static -s";
            runCommandCapture(buildGuiCmd, cmdOut, targetDir);
        }
    }

    // Re-verify dependency status after installation
    DependencyStatus finalDeps = checkDependencies(targetDir, sourceWorkspace);

    // Copy self into targetDir as self-contained Uninstall-GameCheck.exe
    std::string uninstallerExePath = targetDir + "\\Uninstall-GameCheck.exe";
    if (!selfExePath.empty()) {
        CopyFileW(utf8ToWide(selfExePath).c_str(), utf8ToWide(uninstallerExePath).c_str(), FALSE);
    }

    if (!skipRegistryAndShortcuts) {
        std::string gameCheckExe = targetDir + "\\bin\\GameCheck.exe";
        HKEY hKey = nullptr;
        if (RegCreateKeyExW(
                HKEY_CURRENT_USER,
                L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GameCheck",
                0, nullptr, 0, KEY_WRITE, nullptr, &hKey, nullptr) == ERROR_SUCCESS) {
            auto setRegStr = [&](const wchar_t* name, const std::string& val) {
                std::wstring wv = utf8ToWide(val);
                RegSetValueExW(hKey, name, 0, REG_SZ, reinterpret_cast<const BYTE*>(wv.c_str()), (DWORD)((wv.size() + 1) * sizeof(wchar_t)));
            };
            setRegStr(L"DisplayName", "GameCheck");
            setRegStr(L"DisplayVersion", fullVersion);
            setRegStr(L"Publisher", "GameCheck Contributors");
            setRegStr(L"DisplayIcon", gameCheckExe);
            setRegStr(L"InstallLocation", targetDir);
            setRegStr(L"UninstallString", "\"" + uninstallerExePath + "\"");
            setRegStr(L"QuietUninstallString", "\"" + uninstallerExePath + "\" --silent");
            DWORD dwordOne = 1;
            RegSetValueExW(hKey, L"NoModify", 0, REG_DWORD, reinterpret_cast<const BYTE*>(&dwordOne), sizeof(DWORD));
            RegSetValueExW(hKey, L"NoRepair", 0, REG_DWORD, reinterpret_cast<const BYTE*>(&dwordOne), sizeof(DWORD));
            RegCloseKey(hKey);
        }

        std::string userProfile = getEnvVar("USERPROFILE");
        std::string appData = getEnvVar("APPDATA");
        if (!userProfile.empty()) {
            createWindowsShortcut(
                userProfile + "\\Desktop\\GameCheck.lnk",
                gameCheckExe,
                targetDir,
                "GameCheck — PC Hardware & Game Compatibility Checker"
            );
        }
        if (!appData.empty()) {
            std::string startMenuFolder = appData + "\\Microsoft\\Windows\\Start Menu\\Programs\\GameCheck";
            createDirsRecursive(startMenuFolder);
            createWindowsShortcut(
                startMenuFolder + "\\GameCheck.lnk",
                gameCheckExe,
                targetDir,
                "GameCheck — PC Hardware & Game Compatibility Checker"
            );
            createWindowsShortcut(
                startMenuFolder + "\\Uninstall GameCheck.lnk",
                uninstallerExePath,
                targetDir,
                "Uninstall GameCheck"
            );
        }
    }

    std::cout << "{\"status\":\"INSTALLED\""
              << ",\"calver\":\"" << jsonEscape(calver) << "\""
              << ",\"installerType\":\"win32-native-cpp-exe\""
              << ",\"installDir\":\"" << jsonEscape(targetDir) << "\""
              << ",\"dependencies\":{"
              << "\"node\":" << (finalDeps.nodeInstalled ? "true" : "false")
              << ",\"electron\":" << (finalDeps.electronInstalled ? "true" : "false")
              << ",\"nativeProbe\":" << (finalDeps.nativeProbeInstalled ? "true" : "false")
              << "}}" << std::endl;
    return 0;
}
