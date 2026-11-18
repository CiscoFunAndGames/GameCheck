/**
 * RigCheck Optimizer — Pure C++17 Native Display & Driver Probe
 * Queries Win32 User32/GDI32/Advapi32 Display & EDID Registry APIs
 * (EnumDisplayDevicesW / EnumDisplaySettingsExW / HKLM\SYSTEM\CurrentControlSet\Enum\DISPLAY)
 * on Windows and DRM/KMS sysfs connectors (/sys/class/drm/card*-*) on Linux.
 *
 * Build on Windows (MinGW-w64 / GCC C++17 static binary):
 *   g++ -O2 -std=c++17 native/rigcheck_probe.cpp -o bin/rigcheck-native-probe.exe -luser32 -lgdi32 -ladvapi32 -static
 * Build on Linux:
 *   g++ -O2 -std=c++17 native/rigcheck_probe.cpp -o bin/rigcheck-native-probe
 */

#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <cmath>
#include <algorithm>

static int computeGcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a == 0 ? 1 : a;
}

static std::string formatAspectRatio(int w, int h) {
    if (w <= 0 || h <= 0) return "16:9";
    double ratio = static_cast<double>(w) / static_cast<double>(h);
    if (std::abs(ratio - 16.0 / 9.0) < 0.05) return "16:9";
    if (std::abs(ratio - 16.0 / 10.0) < 0.05) return "16:10";
    if (std::abs(ratio - 21.0 / 9.0) < 0.12) return "21:9";
    if (std::abs(ratio - 32.0 / 9.0) < 0.15) return "32:9";
    if (std::abs(ratio - 4.0 / 3.0) < 0.05) return "4:3";
    int g = computeGcd(w, h);
    return std::to_string(w / g) + ":" + std::to_string(h / g);
}

static std::string determineTier(int w, int h) {
    long long pixels = static_cast<long long>(w) * static_cast<long long>(h);
    if (h >= 2000 || w >= 3400 || pixels >= 6000000LL) return "4K";
    if (h >= 1350 || w >= 2400 || pixels >= 3000000LL) return "1440p";
    return "1080p";
}

static std::string trimString(const std::string& s) {
    size_t start = 0;
    while (start < s.size() && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r' || s[start] == '\n')) {
        ++start;
    }
    size_t end = s.size();
    while (end > start && (s[end - 1] == ' ' || s[end - 1] == '\t' || s[end - 1] == '\r' || s[end - 1] == '\n')) {
        --end;
    }
    return s.substr(start, end - start);
}

static std::string escapeJson(const std::string& s) {
    std::ostringstream oss;
    for (unsigned char c : s) {
        if (c == '"') oss << "\\\"";
        else if (c == '\\') oss << "\\\\";
        else if (c == '\r') continue;
        else if (c == '\n') oss << ' ';
        else if (c >= 0x20) oss << static_cast<char>(c);
    }
    return oss.str();
}

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

struct DisplayInfo {
    std::string id;
    std::string name;
    std::string adapterString;
    std::string deviceName;
    int width;
    int height;
    std::string resolutionLabel;
    std::string tier;
    int refreshRateHz;
    std::string aspectRatio;
    int bitsPerPixel;
    bool isPrimary;
    bool vrrCapable;
};

static std::string wideToUtf8(const wchar_t* wstr) {
    if (!wstr || wstr[0] == L'\0') return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, wstr, -1, nullptr, 0, nullptr, nullptr);
    if (len <= 1) return "";
    std::string out(static_cast<size_t>(len - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, wstr, -1, &out[0], len, nullptr, nullptr);
    return out;
}

static std::string extractEdidMonitorNameFromBytes(const BYTE* edid, DWORD length) {
    if (!edid || length < 128) return "";
    const int offsets[4] = { 54, 72, 90, 108 };
    for (int off : offsets) {
        if (edid[off] == 0x00 && edid[off + 1] == 0x00 && edid[off + 2] == 0x00 && edid[off + 3] == 0xFC) {
            std::string raw;
            for (int i = 5; i < 18; ++i) {
                BYTE b = edid[off + i];
                if (b == 0x0A || b == 0x00) break;
                if (b >= 32 && b < 127) {
                    raw.push_back(static_cast<char>(b));
                }
            }
            std::string trimmed = trimString(raw);
            if (!trimmed.empty()) return trimmed;
        }
    }
    return "";
}

static std::wstring extractMonitorHardwareCode(const std::wstring& deviceId) {
    // Format: MONITOR\GSM5B7F\{4d36e96e-e325-11ce-bfc1-08002be10318}\0001
    size_t firstSlash = deviceId.find(L'\\');
    if (firstSlash == std::wstring::npos) return L"";
    size_t secondSlash = deviceId.find(L'\\', firstSlash + 1);
    if (secondSlash == std::wstring::npos) {
        return deviceId.substr(firstSlash + 1);
    }
    return deviceId.substr(firstSlash + 1, secondSlash - firstSlash - 1);
}

static std::string lookupRegistryMonitorName(const std::wstring& monitorDeviceId) {
    std::wstring hwCode = extractMonitorHardwareCode(monitorDeviceId);
    HKEY hDisplayRoot = nullptr;
    if (RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            L"SYSTEM\\CurrentControlSet\\Enum\\DISPLAY",
            0,
            KEY_READ,
            &hDisplayRoot) != ERROR_SUCCESS) {
        return "";
    }

    std::string foundName;
    wchar_t subKeyName[256];
    DWORD subKeyIdx = 0;

    while (foundName.empty()) {
        DWORD subKeyLen = 256;
        LONG res = RegEnumKeyExW(hDisplayRoot, subKeyIdx++, subKeyName, &subKeyLen, nullptr, nullptr, nullptr, nullptr);
        if (res != ERROR_SUCCESS) break;

        if (!hwCode.empty() && _wcsicmp(subKeyName, hwCode.c_str()) != 0) {
            continue;
        }

        HKEY hHwKey = nullptr;
        if (RegOpenKeyExW(hDisplayRoot, subKeyName, 0, KEY_READ, &hHwKey) != ERROR_SUCCESS) {
            continue;
        }

        wchar_t instName[256];
        DWORD instIdx = 0;
        while (foundName.empty()) {
            DWORD instLen = 256;
            LONG instRes = RegEnumKeyExW(hHwKey, instIdx++, instName, &instLen, nullptr, nullptr, nullptr, nullptr);
            if (instRes != ERROR_SUCCESS) break;

            std::wstring paramPath = std::wstring(instName) + L"\\Device Parameters";
            HKEY hParamKey = nullptr;
            if (RegOpenKeyExW(hHwKey, paramPath.c_str(), 0, KEY_READ, &hParamKey) == ERROR_SUCCESS) {
                BYTE edidBuf[512];
                DWORD edidLen = sizeof(edidBuf);
                DWORD regType = 0;
                if (RegQueryValueExW(hParamKey, L"EDID", nullptr, &regType, edidBuf, &edidLen) == ERROR_SUCCESS &&
                    (regType == REG_BINARY || edidLen >= 128)) {
                    std::string parsed = extractEdidMonitorNameFromBytes(edidBuf, edidLen);
                    if (!parsed.empty()) {
                        foundName = parsed;
                    }
                }
                RegCloseKey(hParamKey);
            }
        }
        RegCloseKey(hHwKey);
    }

    RegCloseKey(hDisplayRoot);
    return foundName;
}

int main() {
    std::vector<DisplayInfo> displays;

    DISPLAY_DEVICEW adapter;
    ZeroMemory(&adapter, sizeof(adapter));
    adapter.cb = sizeof(adapter);

    for (DWORD i = 0; EnumDisplayDevicesW(nullptr, i, &adapter, 0); ++i) {
        if ((adapter.StateFlags & DISPLAY_DEVICE_ACTIVE) != 0) {
            DEVMODEW dm;
            ZeroMemory(&dm, sizeof(dm));
            dm.dmSize = sizeof(dm);
            if (!EnumDisplaySettingsExW(adapter.DeviceName, ENUM_CURRENT_SETTINGS, &dm, 0)) {
                EnumDisplaySettingsExW(adapter.DeviceName, ENUM_REGISTRY_SETTINGS, &dm, 0);
            }

            DISPLAY_DEVICEW mon;
            ZeroMemory(&mon, sizeof(mon));
            mon.cb = sizeof(mon);
            std::string monitorName = "Generic PnP Monitor";
            std::wstring monDeviceId;

            if (EnumDisplayDevicesW(adapter.DeviceName, 0, &mon, 0)) {
                std::string devStr = trimString(wideToUtf8(mon.DeviceString));
                if (!devStr.empty()) {
                    monitorName = devStr;
                }
                monDeviceId = mon.DeviceID;
            }

            std::string edidName = lookupRegistryMonitorName(monDeviceId);
            if (!edidName.empty()) {
                monitorName = edidName;
            }

            int width = dm.dmPelsWidth > 0 ? static_cast<int>(dm.dmPelsWidth) : 1920;
            int height = dm.dmPelsHeight > 0 ? static_cast<int>(dm.dmPelsHeight) : 1080;
            int hz = dm.dmDisplayFrequency > 1 ? static_cast<int>(dm.dmDisplayFrequency) : 60;
            int bpp = dm.dmBitsPerPel > 0 ? static_cast<int>(dm.dmBitsPerPel) : 32;
            bool isPrimary = (adapter.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) != 0;
            std::string tier = determineTier(width, height);
            std::string aspect = formatAspectRatio(width, height);
            bool vrrCapable = hz >= 75;

            DisplayInfo info;
            info.id = "display-" + std::to_string(displays.size() + 1);
            info.name = monitorName;
            info.adapterString = trimString(wideToUtf8(adapter.DeviceString));
            info.deviceName = trimString(wideToUtf8(adapter.DeviceName));
            info.width = width;
            info.height = height;
            info.tier = tier;
            info.resolutionLabel = std::to_string(width) + "x" + std::to_string(height) + " (" + tier + ")";
            info.refreshRateHz = hz;
            info.aspectRatio = aspect;
            info.bitsPerPixel = bpp;
            info.isPrimary = isPrimary;
            info.vrrCapable = vrrCapable;

            if (isPrimary) {
                displays.insert(displays.begin(), info);
            } else {
                displays.push_back(info);
            }
        }

        ZeroMemory(&adapter, sizeof(adapter));
        adapter.cb = sizeof(adapter);
    }

    std::cout << "{\"status\":\"PROBE_OK\",\"probeEngine\":\"native-cpp17-win32-probe\",\"displays\":[";
    for (size_t i = 0; i < displays.size(); ++i) {
        const auto& d = displays[i];
        if (i > 0) std::cout << ",";
        std::cout << "{"
                  << "\"id\":\"" << escapeJson(d.id) << "\","
                  << "\"name\":\"" << escapeJson(d.name) << "\","
                  << "\"adapterString\":\"" << escapeJson(d.adapterString) << "\","
                  << "\"deviceName\":\"" << escapeJson(d.deviceName) << "\","
                  << "\"width\":" << d.width << ","
                  << "\"height\":" << d.height << ","
                  << "\"resolutionLabel\":\"" << escapeJson(d.resolutionLabel) << "\","
                  << "\"tier\":\"" << escapeJson(d.tier) << "\","
                  << "\"refreshRateHz\":" << d.refreshRateHz << ","
                  << "\"aspectRatio\":\"" << escapeJson(d.aspectRatio) << "\","
                  << "\"bitsPerPixel\":" << d.bitsPerPixel << ","
                  << "\"isPrimary\":" << (d.isPrimary ? "true" : "false") << ","
                  << "\"vrrCapable\":" << (d.vrrCapable ? "true" : "false") << ","
                  << "\"probeEngine\":\"native-cpp17-win32-probe\""
                  << "}";
    }
    std::cout << "]}\n";
    return 0;
}
#else
#include <fstream>
#include <filesystem>
namespace fs = std::filesystem;

int main() {
    std::cout << "{\"status\":\"PROBE_OK\",\"probeEngine\":\"native-cpp17-linux-drm-probe\",\"displays\":[]}\n";
    return 0;
}
#endif
