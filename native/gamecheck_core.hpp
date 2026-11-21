#ifndef GAMECHECK_CORE_HPP
#define GAMECHECK_CORE_HPP

// =============================================================================
// GameCheck — 100% Pure C++17 Cross-Platform Core Engine (Header-Only)
// Zero external third-party library dependencies.
// Compiles cleanly on Windows (MinGW-w64 g++ -std=c++17) and Linux (g++ -std=c++17).
// =============================================================================

#ifdef _WIN32
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <winhttp.h>
#include <shellapi.h>
#else
#include <sys/statvfs.h>
#include <unistd.h>
#include <sys/stat.h>
#endif

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <regex>
#include <set>
#include <sstream>
#include <string>
#include <vector>

namespace GameCheck {

// =============================================================================
// 1. Application Identity & CalVer Versioning
// =============================================================================
constexpr const char* APP_NAME     = "GameCheck";
constexpr const char* CALVER       = "2026.11.17";
constexpr const char* FULL_VERSION = "2026.11.17.2";
constexpr const char* GIT_TAG      = "v2026.11.17.2";
constexpr const char* ARCHITECTURE = "Pure C++17 Native Desktop GUI (Win32/GDI+ & Linux)";

enum OptimizationMode {
    OPT_MODE_OPTIMAL  = 0, // 0 = Optimal (Rig + Screen Balance)
    OPT_MODE_FULL_FPS = 1, // 1 = Full FPS (Max Hz Competitive)
    OPT_MODE_BALANCED = 2, // 2 = Balanced (FPS & Quality)
    OPT_MODE_QUALITY  = 3  // 3 = Quality (30-60 FPS Cinematic)
};

// =============================================================================
// String & Utility Helpers
// =============================================================================
inline std::string trim(const std::string& s) {
    size_t start = 0;
    while (start < s.size() && (s[start] == ' ' || s[start] == '\t' || s[start] == '\r' || s[start] == '\n' || s[start] == '\0')) {
        ++start;
    }
    size_t end = s.size();
    while (end > start && (s[end - 1] == ' ' || s[end - 1] == '\t' || s[end - 1] == '\r' || s[end - 1] == '\n' || s[end - 1] == '\0')) {
        --end;
    }
    return s.substr(start, end - start);
}

inline std::string toLower(std::string s) {
    for (char& c : s) {
        if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
    }
    return s;
}

inline std::string toUpper(std::string s) {
    for (char& c : s) {
        if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 'a' + 'A');
    }
    return s;
}

inline bool containsIgnoreCase(const std::string& haystack, const std::string& needle) {
    if (needle.empty()) return true;
    return toLower(haystack).find(toLower(needle)) != std::string::npos;
}

inline std::string escapeJson(const std::string& s) {
    std::ostringstream oss;
    for (unsigned char c : s) {
        if (c == '"') oss << "\\\"";
        else if (c == '\\') oss << "\\\\";
        else if (c == '\b') oss << "\\b";
        else if (c == '\f') oss << "\\f";
        else if (c == '\n') oss << "\\n";
        else if (c == '\r') oss << "\\r";
        else if (c == '\t') oss << "\\t";
        else if (c >= 0x20) oss << static_cast<char>(c);
    }
    return oss.str();
}

inline std::string urlEncode(const std::string& value) {
    std::ostringstream escaped;
    escaped.fill('0');
    escaped << std::hex;
    for (unsigned char c : value) {
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            escaped << static_cast<char>(c);
        } else if (c == ' ') {
            escaped << "%20";
        } else {
            escaped << std::uppercase << '%' << std::setw(2) << static_cast<int>(c) << std::nouppercase;
        }
    }
    return escaped.str();
}

inline std::string slugify(const std::string& text) {
    std::string lower = toLower(text);
    std::string out;
    bool lastDash = false;
    for (unsigned char c : lower) {
        if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) {
            out.push_back(static_cast<char>(c));
            lastDash = false;
        } else if (!out.empty() && !lastDash) {
            out.push_back('-');
            lastDash = true;
        }
    }
    while (!out.empty() && out.back() == '-') out.pop_back();
    return out.empty() ? "pc-game" : out;
}

#ifdef _WIN32
inline std::string wideToUtf8(const std::wstring& wstr) {
    if (wstr.empty()) return "";
    int len = WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (len <= 1) return "";
    std::string out(static_cast<size_t>(len - 1), '\0');
    WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, &out[0], len, nullptr, nullptr);
    return out;
}

inline std::wstring utf8ToWide(const std::string& str) {
    if (str.empty()) return L"";
    int len = MultiByteToWideChar(CP_UTF8, 0, str.c_str(), -1, nullptr, 0);
    if (len <= 1) return L"";
    std::wstring out(static_cast<size_t>(len - 1), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, str.c_str(), -1, &out[0], len);
    return out;
}
#endif

// =============================================================================
// 2. CPU & GPU Benchmark Lookup Tables & Scoring (0 - 100 Scale)
// =============================================================================
struct CpuBenchResult {
    int score = 50;
    int estimatedCores = 6;
    operator int() const { return score; }
};

struct GpuBenchResult {
    int score = 45;
    int vramGB = 6;
    std::string vendor = "unknown";
    bool rtCapable = false;
    std::string upscaler = "FSR";
    operator int() const { return score; }
};

struct CpuBenchEntry {
    const char* pattern;
    int score;
    int cores;
};

struct GpuBenchEntry {
    const char* pattern;
    int score;
    int vram;
    const char* vendor;
    bool rt;
    const char* upscaler;
};

inline CpuBenchResult scoreCPU(const std::string& name, int threads = 8) {
    static const CpuBenchEntry table[] = {
        // AMD Ryzen 1000 / 2000 / 3000 / 5000 / 7000 / 9000 & FX
        { "ryzen\\s*3\\s*1[23]00|fx-\\s*83|fx-\\s*63|fx-\\s*43", 25, 4 },
        { "ryzen\\s*5\\s*1[456]00|ryzen\\s*5\\s*2500", 38, 6 },
        { "ryzen\\s*5\\s*2600", 45, 6 },
        { "ryzen\\s*7\\s*2700", 50, 8 },
        { "ryzen\\s*3\\s*3[13]00", 46, 4 },
        { "ryzen\\s*5\\s*3600", 58, 6 },
        { "ryzen\\s*7\\s*3700x|ryzen\\s*7\\s*3800x", 64, 8 },
        { "ryzen\\s*5\\s*5500", 62, 6 },
        { "ryzen\\s*5\\s*5600", 72, 6 },
        { "ryzen\\s*7\\s*5700x3d|ryzen\\s*7\\s*5800x3d", 88, 8 },
        { "ryzen\\s*7\\s*5700x|ryzen\\s*7\\s*5800x", 78, 8 },
        { "ryzen\\s*9\\s*5900x|ryzen\\s*9\\s*5950x", 82, 12 },
        { "ryzen\\s*5\\s*7600|ryzen\\s*5\\s*7500f", 84, 6 },
        { "ryzen\\s*7\\s*7700", 88, 8 },
        { "ryzen\\s*7\\s*7800x3d", 97, 8 },
        { "ryzen\\s*7\\s*9800x3d", 100, 8 },
        { "ryzen\\s*9\\s*79[05]0|ryzen\\s*9\\s*99[05]0", 94, 12 },
        { "ryzen\\s*5\\s*9600", 88, 6 },
        { "ryzen\\s*7\\s*9700", 92, 8 },

        // Intel Core 2nd - 14th Gen
        { "i3-[23467]\\d{3}|i5-750|i5-[234]\\d{3}|i7-[23]\\d{3}", 25, 4 },
        { "i7-47[79]0|i7-6800|i5-6[456]00|i5-7[456]00", 34, 4 },
        { "i7-6700|i7-7700", 42, 4 },
        { "i3-8100|i3-9100", 38, 4 },
        { "i5-8[46]00|i5-9[46]00", 48, 6 },
        { "i7-8700|i7-9700", 58, 6 },
        { "i3-10100|i3-10105", 46, 4 },
        { "i5-10[456]00|i5-11[456]00", 60, 6 },
        { "i7-10700|i7-11700|i9-9900|i9-10900|i9-11900", 68, 8 },
        { "i3-12100|i3-13100|i3-14100", 58, 4 },
        { "i5-12[46]00", 74, 6 },
        { "i7-12700", 83, 12 },
        { "i5-13[456]00|i5-14[456]00", 84, 10 },
        { "i7-13700|i7-14700|i9-12900", 91, 16 },
        { "i9-13900|i9-14900", 95, 24 }
    };

    for (const auto& item : table) {
        std::regex re(item.pattern, std::regex_constants::icase);
        if (std::regex_search(name, re)) {
            return { item.score, item.cores };
        }
    }

    int safeThreads = std::max(2, threads);
    int estScore = std::min(90, std::max(25, static_cast<int>(std::round(safeThreads * 4.5))));
    return { estScore, std::max(2, safeThreads / 2) };
}

inline GpuBenchResult scoreGPU(const std::string& name, int vramGB = 0) {
    static const GpuBenchEntry table[] = {
        // NVIDIA GTX 700 / 900 / 1000 / 1600
        { "gt\\s*710|gt\\s*730", 8, 2, "nvidia", false, "Native" },
        { "gtx\\s*750", 15, 2, "nvidia", false, "Native" },
        { "gtx\\s*770", 20, 2, "nvidia", false, "Native" },
        { "gtx\\s*960", 22, 4, "nvidia", false, "FSR" },
        { "gtx\\s*970", 28, 4, "nvidia", false, "FSR" },
        { "gtx\\s*980\\s*ti", 38, 6, "nvidia", false, "FSR" },
        { "gtx\\s*980", 33, 4, "nvidia", false, "FSR" },
        { "gtx\\s*1050\\s*ti", 24, 4, "nvidia", false, "FSR" },
        { "gtx\\s*1050", 20, 2, "nvidia", false, "FSR" },
        { "gtx\\s*1060", 33, 6, "nvidia", false, "FSR" },
        { "gtx\\s*1070\\s*ti", 45, 8, "nvidia", false, "FSR" },
        { "gtx\\s*1070", 42, 8, "nvidia", false, "FSR" },
        { "gtx\\s*1080\\s*ti", 54, 11, "nvidia", false, "FSR" },
        { "gtx\\s*1080", 47, 8, "nvidia", false, "FSR" },
        { "gtx\\s*1650\\s*super", 33, 4, "nvidia", false, "FSR" },
        { "gtx\\s*1650", 29, 4, "nvidia", false, "FSR" },
        { "gtx\\s*1660\\s*(super|ti)", 40, 6, "nvidia", false, "FSR" },
        { "gtx\\s*1660", 36, 6, "nvidia", false, "FSR" },

        // NVIDIA RTX 2000
        { "rtx\\s*2060\\s*super", 50, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*2060", 45, 6, "nvidia", true, "DLSS" },
        { "rtx\\s*2070\\s*super", 56, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*2070", 52, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*2080\\s*ti", 66, 11, "nvidia", true, "DLSS" },
        { "rtx\\s*2080\\s*super", 62, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*2080", 59, 8, "nvidia", true, "DLSS" },

        // NVIDIA RTX 3000
        { "rtx\\s*3050", 43, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*3060\\s*ti", 63, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*3060", 54, 12, "nvidia", true, "DLSS" },
        { "rtx\\s*3070\\s*ti", 71, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*3070", 68, 8, "nvidia", true, "DLSS" },
        { "rtx\\s*3080\\s*ti", 83, 12, "nvidia", true, "DLSS" },
        { "rtx\\s*3080", 79, 10, "nvidia", true, "DLSS" },
        { "rtx\\s*3090\\s*ti", 89, 24, "nvidia", true, "DLSS" },
        { "rtx\\s*3090", 86, 24, "nvidia", true, "DLSS" },

        // NVIDIA RTX 4000 / 5000
        { "rtx\\s*4060\\s*ti", 70, 8, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4060", 62, 8, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4070\\s*ti\\s*super", 87, 16, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4070\\s*super", 82, 12, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4070\\s*ti", 84, 12, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4070", 77, 12, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4080\\s*super", 94, 16, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4080", 92, 16, "nvidia", true, "DLSS 3" },
        { "rtx\\s*4090", 100, 24, "nvidia", true, "DLSS 3" },
        { "rtx\\s*5070\\s*ti", 91, 16, "nvidia", true, "DLSS 4" },
        { "rtx\\s*5070", 86, 12, "nvidia", true, "DLSS 4" },
        { "rtx\\s*5080", 96, 16, "nvidia", true, "DLSS 4" },
        { "rtx\\s*5090", 100, 32, "nvidia", true, "DLSS 4" },

        // AMD Radeon RX 400 / 500 / Vega / 5000
        { "r9\\s*280|hd\\s*7730|r7\\s*240", 16, 2, "amd", false, "FSR" },
        { "rx\\s*560|rx\\s*460", 21, 4, "amd", false, "FSR" },
        { "rx\\s*470|rx\\s*570", 29, 4, "amd", false, "FSR" },
        { "rx\\s*480|rx\\s*580", 33, 8, "amd", false, "FSR" },
        { "rx\\s*590", 36, 8, "amd", false, "FSR" },
        { "vega\\s*56", 42, 8, "amd", false, "FSR" },
        { "vega\\s*64", 46, 8, "amd", false, "FSR" },
        { "rx\\s*5500\\s*xt", 36, 8, "amd", false, "FSR" },
        { "rx\\s*5600\\s*xt", 46, 6, "amd", false, "FSR" },
        { "rx\\s*5700\\s*xt", 53, 8, "amd", false, "FSR" },
        { "rx\\s*5700", 49, 8, "amd", false, "FSR" },

        // AMD Radeon RX 6000
        { "rx\\s*6500\\s*xt", 35, 4, "amd", false, "FSR" },
        { "rx\\s*6600\\s*xt|rx\\s*6650\\s*xt", 57, 8, "amd", true, "FSR" },
        { "rx\\s*6600", 51, 8, "amd", true, "FSR" },
        { "rx\\s*6700\\s*xt|rx\\s*6750\\s*xt", 66, 12, "amd", true, "FSR" },
        { "rx\\s*6700", 61, 10, "amd", true, "FSR" },
        { "rx\\s*6800\\s*xt", 77, 16, "amd", true, "FSR" },
        { "rx\\s*6800", 72, 16, "amd", true, "FSR" },
        { "rx\\s*6900\\s*xt|rx\\s*6950\\s*xt", 82, 16, "amd", true, "FSR" },

        // AMD Radeon RX 7000 / 9000
        { "rx\\s*7600\\s*xt", 64, 16, "amd", true, "FSR 3" },
        { "rx\\s*7600", 61, 8, "amd", true, "FSR 3" },
        { "rx\\s*7700\\s*xt", 73, 12, "amd", true, "FSR 3" },
        { "rx\\s*7800\\s*xt", 80, 16, "amd", true, "FSR 3" },
        { "rx\\s*7900\\s*gre", 83, 16, "amd", true, "FSR 3" },
        { "rx\\s*7900\\s*xtx", 94, 24, "amd", true, "FSR 3" },
        { "rx\\s*7900\\s*xt", 88, 20, "amd", true, "FSR 3" },
        { "rx\\s*9070\\s*xt", 89, 16, "amd", true, "FSR 4" },
        { "rx\\s*9070", 83, 16, "amd", true, "FSR 4" },

        // Intel Arc
        { "arc\\s*a380", 27, 6, "intel", true, "XeSS" },
        { "arc\\s*a580", 48, 8, "intel", true, "XeSS" },
        { "arc\\s*a750", 54, 8, "intel", true, "XeSS" },
        { "arc\\s*a770", 58, 16, "intel", true, "XeSS" },
        { "arc\\s*b580", 66, 12, "intel", true, "XeSS" }
    };

    for (const auto& item : table) {
        std::regex re(item.pattern, std::regex_constants::icase);
        if (std::regex_search(name, re)) {
            return {
                item.score,
                vramGB > 0 ? vramGB : item.vram,
                item.vendor,
                item.rt,
                item.upscaler
            };
        }
    }

    int fallbackVram = vramGB > 0 ? vramGB : 4;
    std::regex igpuRe("uhd\\s*graphics|iris\\s*xe|radeon\\s*graphics|vega\\s*[3678]|intel\\(r\\)\\s*graphics|llvmpipe", std::regex_constants::icase);
    bool isIntegrated = std::regex_search(name, igpuRe);
    int estScore = isIntegrated
        ? std::min(24, std::max(10, fallbackVram * 4))
        : std::min(85, std::max(15, fallbackVram * 7));

    std::string lower = toLower(name);
    std::string vendor = "unknown";
    if (lower.find("nvidia") != std::string::npos || lower.find("geforce") != std::string::npos || lower.find("rtx") != std::string::npos || lower.find("gtx") != std::string::npos) {
        vendor = "nvidia";
    } else if (lower.find("amd") != std::string::npos || lower.find("radeon") != std::string::npos || lower.find("rx") != std::string::npos || lower.find("vega") != std::string::npos) {
        vendor = "amd";
    } else if (lower.find("intel") != std::string::npos || lower.find("arc") != std::string::npos || lower.find("uhd") != std::string::npos || lower.find("iris") != std::string::npos) {
        vendor = "intel";
    }

    std::regex rtRe("rtx|rx\\s*[6789]\\d00|arc\\s*[ab]\\d", std::regex_constants::icase);
    bool rtCapable = std::regex_search(name, rtRe);
    std::string upscaler = (lower.find("rtx") != std::string::npos) ? "DLSS" : (lower.find("arc") != std::string::npos ? "XeSS" : "FSR");

    return { estScore, fallbackVram, vendor, rtCapable, upscaler };
}

// =============================================================================
// Hardware & Display Telemetry Data Structures
// =============================================================================
struct CpuSpec {
    std::string name = "Unknown CPU";
    int cores = 6;
    int threads = 12;
    int speedMHz = 3600;
    double speedGHz = 3.60;
    int score = 60;
};

struct GpuSpec {
    std::string name = "Unknown GPU";
    int vramGB = 8;
    int vramMB = 8192;
    std::string driverVersion = "Unknown";
    std::string vendor = "unknown";
    bool rtCapable = false;
    std::string upscaler = "FSR";
    int score = 50;
};

struct RamSpec {
    int totalGB = 16;
    int freeGB = 8;
    int availGB = 8;
    int usedGB = 8;
};

struct DriveSpec {
    std::string drive = "C:";
    std::string label = "Local Disk (C:)";
    std::string fsType = "NTFS";
    int totalGB = 500;
    int freeGB = 150;
    int usedGB = 350;
    int usedPercent = 70;
};

struct StorageSpec {
    std::string drive = "C:";
    std::string primaryDrive = "C:";
    std::string label = "Local Disk (C:)";
    int freeGB = 150;
    int totalGB = 500;
    int usedGB = 350;
    int usedPercent = 70;
    std::vector<DriveSpec> drives;
    std::vector<DriveSpec> allDrives;
};

struct DisplaySpec {
    std::string id = "display-1";
    std::string name = "Primary Display";
    std::string monitorName = "Primary Display";
    std::string adapterString;
    std::string deviceName = "\\\\.\\DISPLAY1";
    int width = 1920;
    int height = 1080;
    std::string tier = "1080p";
    std::string resolutionLabel = "1920x1080 (1080p)";
    int refreshRateHz = 60;
    std::string aspectRatio = "16:9";
    int bitsPerPixel = 32;
    bool isPrimary = true;
    bool vrrCapable = false;
    std::string probeEngine = "native-cpp17-win32-probe";
};

struct DriverSuiteInfo {
    std::string id;
    std::string name;
    bool detected = false;
    std::string installStatus = "DRIVER_ONLY"; // "INSTALLED" | "DRIVER_ONLY"
    std::string version = "N/A";
    std::string exePath;
};

struct SystemSpecs {
    std::string platform = "win32";
    std::string os = "Windows 11";
    CpuSpec cpu;
    GpuSpec gpu;
    std::vector<GpuSpec> allGpus;
    RamSpec ram;
    StorageSpec storage;
    std::vector<DriveSpec> drives;
    DisplaySpec display;
    std::vector<DisplaySpec> displays;
    std::vector<DriverSuiteInfo> driverSuites;
    double scanDurationMs = 0.0;
};

inline int computeGcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a == 0 ? 1 : a;
}

inline std::string formatAspectRatio(int w, int h) {
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

inline std::string determineResolutionTier(int w, int h) {
    long long pixels = static_cast<long long>(w) * static_cast<long long>(h);
    if (h >= 2000 || w >= 3400 || pixels >= 6000000LL) return "4K";
    if (h >= 1350 || w >= 2400 || pixels >= 3000000LL) return "1440p";
    return "1080p";
}

inline bool isVirtualGpuAdapter(const std::string& name) {
    std::regex re("virtual|meta|basic|parsec|remote|llvmpipe|softpipe|simpledrm|bochs|qxl|virtio|vmware|hyper-v|dummy", std::regex_constants::icase);
    return std::regex_search(name, re);
}

inline bool isIntegratedGpuAdapter(const std::string& name, int vramMB) {
    std::regex discreteRe("rtx\\s*\\d|gtx\\s*\\d|radeon\\s*rx\\s*\\d|arc\\s*[ab]\\d{3}|radeon\\s*pro\\s*w", std::regex_constants::icase);
    if (std::regex_search(name, discreteRe)) return false;
    std::regex igpuRe("uhd\\s*graphics|hd\\s*graphics|iris|intel\\(r\\)\\s*graphics|radeon\\(tm\\)\\s*graphics|radeon\\s*graphics|cezanne|rembrandt|raphael|phoenix|mendocino|barcelo|lucienne|renoir|picasso", std::regex_constants::icase);
    if (std::regex_search(name, igpuRe)) return true;
    return vramMB > 0 && vramMB <= 1024;
}

#ifdef _WIN32
inline std::string extractEdidMonitorName(const BYTE* edid, DWORD length) {
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
            std::string cleaned = trim(raw);
            if (!cleaned.empty()) return cleaned;
        }
    }
    return "";
}

inline std::wstring extractMonitorHardwareCode(const std::wstring& deviceId) {
    size_t firstSlash = deviceId.find(L'\\');
    if (firstSlash == std::wstring::npos) return L"";
    size_t secondSlash = deviceId.find(L'\\', firstSlash + 1);
    if (secondSlash == std::wstring::npos) return deviceId.substr(firstSlash + 1);
    return deviceId.substr(firstSlash + 1, secondSlash - firstSlash - 1);
}

inline std::string lookupRegistryMonitorName(const std::wstring& monitorDeviceId) {
    std::wstring hwCode = extractMonitorHardwareCode(monitorDeviceId);
    HKEY hDisplayRoot = nullptr;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SYSTEM\\CurrentControlSet\\Enum\\DISPLAY", 0, KEY_READ, &hDisplayRoot) != ERROR_SUCCESS) {
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
                    std::string parsed = extractEdidMonitorName(edidBuf, edidLen);
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
#endif

inline std::vector<DriverSuiteInfo> detectDriverSuites(const SystemSpecs& specs) {
    std::vector<DriverSuiteInfo> suites;
    std::string gpuVendor = toLower(specs.gpu.vendor);
    std::string gpuNameLow = toLower(specs.gpu.name);
    if (gpuVendor.empty() || gpuVendor == "unknown") {
        if (gpuNameLow.find("nvidia") != std::string::npos || gpuNameLow.find("geforce") != std::string::npos || gpuNameLow.find("rtx") != std::string::npos || gpuNameLow.find("gtx") != std::string::npos) gpuVendor = "nvidia";
        else if (gpuNameLow.find("amd") != std::string::npos || gpuNameLow.find("radeon") != std::string::npos) gpuVendor = "amd";
        else if (gpuNameLow.find("intel") != std::string::npos || gpuNameLow.find("arc") != std::string::npos) gpuVendor = "intel";
    }

#ifdef _WIN32
    auto fileExists = [](const std::string& p) -> bool {
        std::error_code ec;
        return std::filesystem::exists(std::filesystem::u8path(p), ec);
    };
    auto regKeyExists = [](HKEY root, const wchar_t* subkey) -> bool {
        HKEY hKey = nullptr;
        if (RegOpenKeyExW(root, subkey, 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
            RegCloseKey(hKey);
            return true;
        }
        return false;
    };

    // 1. AMD Software: Adrenalin Edition
    {
        DriverSuiteInfo s;
        s.id = "amd_adrenalin";
        s.name = "AMD Software: Adrenalin Edition";
        const std::string exe = "C:\\Program Files\\AMD\\CNext\\CNext\\RadeonSoftware.exe";
        bool hasExe = fileExists(exe);
        bool hasReg = regKeyExists(HKEY_LOCAL_MACHINE, L"SOFTWARE\\AMD\\CN");
        bool isVendor = (gpuVendor == "amd");
        if (hasExe || hasReg || isVendor) {
            s.detected = true;
            s.installStatus = (hasExe || hasReg) ? "INSTALLED" : "DRIVER_ONLY";
            s.exePath = hasExe ? exe : "";
            s.version = (isVendor && !specs.gpu.driverVersion.empty() && specs.gpu.driverVersion != "Unknown") ? specs.gpu.driverVersion : "N/A";
            suites.push_back(s);
        }
    }

    // 2. NVIDIA App / Control Panel
    {
        DriverSuiteInfo s;
        s.id = "nvidia_app";
        s.name = "NVIDIA App / Control Panel";
        const std::string nvAppExe = "C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NVIDIA App.exe";
        const std::string nvCpExe  = "C:\\Program Files\\NVIDIA Corporation\\Control Panel Client\\nvcplui.exe";
        bool hasApp = fileExists(nvAppExe);
        bool hasCp  = fileExists(nvCpExe);
        bool hasReg = regKeyExists(HKEY_LOCAL_MACHINE, L"SOFTWARE\\NVIDIA Corporation\\Global");
        bool isVendor = (gpuVendor == "nvidia");
        if (hasApp || hasCp || hasReg || isVendor) {
            s.detected = true;
            s.installStatus = (hasApp || hasCp || hasReg) ? "INSTALLED" : "DRIVER_ONLY";
            s.exePath = hasApp ? nvAppExe : (hasCp ? nvCpExe : "");
            s.version = (isVendor && !specs.gpu.driverVersion.empty() && specs.gpu.driverVersion != "Unknown") ? specs.gpu.driverVersion : "N/A";
            suites.push_back(s);
        }
    }

    // 3. Intel Arc Control / Graphics Software
    {
        DriverSuiteInfo s;
        s.id = "intel_arc";
        s.name = "Intel Arc Control / Graphics Software";
        const std::string igsExe = "C:\\Program Files\\Intel\\Intel Graphics Software\\IntelGraphicsSoftware.exe";
        const std::string arcExe = "C:\\Program Files\\Intel\\Intel Arc Control\\ArcControl.exe";
        bool hasIgs = fileExists(igsExe);
        bool hasArc = fileExists(arcExe);
        bool isVendor = (gpuVendor == "intel");
        if (hasIgs || hasArc || isVendor) {
            s.detected = true;
            s.installStatus = (hasIgs || hasArc) ? "INSTALLED" : "DRIVER_ONLY";
            s.exePath = hasIgs ? igsExe : (hasArc ? arcExe : "");
            s.version = (isVendor && !specs.gpu.driverVersion.empty() && specs.gpu.driverVersion != "Unknown") ? specs.gpu.driverVersion : "N/A";
            suites.push_back(s);
        }
    }
#else
    auto pathExists = [](const char* p) -> bool {
        struct stat st;
        return stat(p, &st) == 0;
    };
    if (gpuVendor == "amd" || pathExists("/sys/module/amdgpu") || pathExists("/usr/bin/corectrl") || pathExists("/usr/bin/lact")) {
        DriverSuiteInfo s;
        s.id = "amd_adrenalin";
        s.name = pathExists("/usr/bin/lact") ? "AMD amdgpu / LACT" : (pathExists("/usr/bin/corectrl") ? "AMD amdgpu / CoreCtrl" : "AMD amdgpu Kernel Driver");
        s.detected = true;
        s.installStatus = (pathExists("/usr/bin/corectrl") || pathExists("/usr/bin/lact")) ? "INSTALLED" : "DRIVER_ONLY";
        s.exePath = pathExists("/usr/bin/lact") ? "/usr/bin/lact" : (pathExists("/usr/bin/corectrl") ? "/usr/bin/corectrl" : "");
        s.version = specs.gpu.driverVersion;
        suites.push_back(s);
    }
    if (gpuVendor == "nvidia" || pathExists("/usr/bin/nvidia-settings") || pathExists("/sys/module/nvidia")) {
        DriverSuiteInfo s;
        s.id = "nvidia_app";
        s.name = "NVIDIA Settings (Linux)";
        s.detected = true;
        s.installStatus = pathExists("/usr/bin/nvidia-settings") ? "INSTALLED" : "DRIVER_ONLY";
        s.exePath = pathExists("/usr/bin/nvidia-settings") ? "/usr/bin/nvidia-settings" : "";
        s.version = specs.gpu.driverVersion;
        suites.push_back(s);
    }
    if (gpuVendor == "intel" || pathExists("/sys/module/i915") || pathExists("/sys/module/xe")) {
        DriverSuiteInfo s;
        s.id = "intel_arc";
        s.name = pathExists("/sys/module/xe") ? "Intel Xe / Arc Linux Driver" : "Intel i915 Linux Driver";
        s.detected = true;
        s.installStatus = "DRIVER_ONLY";
        s.version = specs.gpu.driverVersion;
        suites.push_back(s);
    }
#endif
    return suites;
}

inline SystemSpecs detectSystemSpecs() {
    auto t0 = std::chrono::steady_clock::now();
    SystemSpecs specs;

#ifdef _WIN32
    specs.platform = "win32";

    // OS Build from Registry
    {
        HKEY hOsKey = nullptr;
        std::string buildStr = "22631";
        if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion", 0, KEY_READ, &hOsKey) == ERROR_SUCCESS) {
            wchar_t buf[128] = {};
            DWORD len = sizeof(buf);
            if (RegQueryValueExW(hOsKey, L"CurrentBuildNumber", nullptr, nullptr, reinterpret_cast<LPBYTE>(buf), &len) == ERROR_SUCCESS) {
                buildStr = trim(wideToUtf8(buf));
            }
            RegCloseKey(hOsKey);
        }
        int buildNum = std::atoi(buildStr.c_str());
        specs.os = (buildNum >= 22000)
            ? ("Windows 11 (Build " + std::to_string(buildNum) + ")")
            : ("Windows 10 (Build " + std::to_string(buildNum > 0 ? buildNum : 19045) + ")");
    }

    // 1. CPU via Registry HKLM\HARDWARE\Description\System\CentralProcessor\0 + GetSystemInfo
    {
        SYSTEM_INFO sysInfo = {};
        GetSystemInfo(&sysInfo);
        int threads = sysInfo.dwNumberOfProcessors > 0 ? static_cast<int>(sysInfo.dwNumberOfProcessors) : 8;
        std::string cpuName = "Unknown x86_64 Processor";
        DWORD mhz = 3600;

        HKEY hCpuKey = nullptr;
        if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"HARDWARE\\Description\\System\\CentralProcessor\\0", 0, KEY_READ, &hCpuKey) == ERROR_SUCCESS) {
            wchar_t nameBuf[256] = {};
            DWORD nameLen = sizeof(nameBuf);
            if (RegQueryValueExW(hCpuKey, L"ProcessorNameString", nullptr, nullptr, reinterpret_cast<LPBYTE>(nameBuf), &nameLen) == ERROR_SUCCESS) {
                std::string parsed = trim(wideToUtf8(nameBuf));
                if (!parsed.empty()) cpuName = parsed;
            }
            DWORD mhzVal = 0;
            DWORD mhzLen = sizeof(mhzVal);
            if (RegQueryValueExW(hCpuKey, L"~MHz", nullptr, nullptr, reinterpret_cast<LPBYTE>(&mhzVal), &mhzLen) == ERROR_SUCCESS && mhzVal > 0) {
                mhz = mhzVal;
            }
            RegCloseKey(hCpuKey);
        }

        CpuBenchResult cpuEval = scoreCPU(cpuName, threads);
        specs.cpu.name = cpuName;
        specs.cpu.threads = threads;
        specs.cpu.cores = cpuEval.estimatedCores;
        specs.cpu.speedMHz = static_cast<int>(mhz);
        specs.cpu.speedGHz = std::round((static_cast<double>(mhz) / 1000.0) * 100.0) / 100.0;
        specs.cpu.score = cpuEval.score;
    }

    // 2. RAM via GlobalMemoryStatusEx
    {
        MEMORYSTATUSEX memStatus = {};
        memStatus.dwLength = sizeof(memStatus);
        if (GlobalMemoryStatusEx(&memStatus)) {
            int totalGB = std::max(1, static_cast<int>(std::round(static_cast<double>(memStatus.ullTotalPhys) / (1024.0 * 1024.0 * 1024.0))));
            int availGB = std::max(0, static_cast<int>(std::round(static_cast<double>(memStatus.ullAvailPhys) / (1024.0 * 1024.0 * 1024.0))));
            specs.ram.totalGB = totalGB;
            specs.ram.freeGB = availGB;
            specs.ram.availGB = availGB;
            specs.ram.usedGB = std::max(0, totalGB - availGB);
        }
    }

    // 3. GPU & VRAM via Registry HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000..0015
    {
        std::vector<GpuSpec> detectedGpus;
        for (int idx = 0; idx <= 15; ++idx) {
            wchar_t keyPath[256];
            std::swprintf(keyPath, 256, L"SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\%04d", idx);
            HKEY hGpuKey = nullptr;
            if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, keyPath, 0, KEY_READ, &hGpuKey) != ERROR_SUCCESS) {
                continue;
            }

            wchar_t descBuf[256] = {};
            DWORD descLen = sizeof(descBuf);
            std::string gpuName;
            if (RegQueryValueExW(hGpuKey, L"DriverDesc", nullptr, nullptr, reinterpret_cast<LPBYTE>(descBuf), &descLen) == ERROR_SUCCESS) {
                gpuName = trim(wideToUtf8(descBuf));
            }
            if (gpuName.empty()) {
                RegCloseKey(hGpuKey);
                continue;
            }

            wchar_t verBuf[128] = {};
            DWORD verLen = sizeof(verBuf);
            std::string driverVer = "Unknown";
            if (RegQueryValueExW(hGpuKey, L"DriverVersion", nullptr, nullptr, reinterpret_cast<LPBYTE>(verBuf), &verLen) == ERROR_SUCCESS) {
                std::string v = trim(wideToUtf8(verBuf));
                if (!v.empty()) driverVer = v;
            }

            uint64_t memBytes = 0;
            DWORD qwType = 0;
            BYTE qwBuf[16] = {};
            DWORD qwLen = sizeof(qwBuf);
            if (RegQueryValueExW(hGpuKey, L"HardwareInformation.qwMemorySize", nullptr, &qwType, qwBuf, &qwLen) == ERROR_SUCCESS) {
                if (qwLen >= 8) {
                    std::memcpy(&memBytes, qwBuf, sizeof(uint64_t));
                } else if (qwLen == 4) {
                    uint32_t m32 = 0;
                    std::memcpy(&m32, qwBuf, sizeof(uint32_t));
                    memBytes = m32;
                }
            }
            if (memBytes == 0) {
                BYTE mBuf[8] = {};
                DWORD mLen = sizeof(mBuf);
                DWORD mType = 0;
                if (RegQueryValueExW(hGpuKey, L"HardwareInformation.MemorySize", nullptr, &mType, mBuf, &mLen) == ERROR_SUCCESS) {
                    if (mLen == 4) {
                        uint32_t m32 = 0;
                        std::memcpy(&m32, mBuf, sizeof(uint32_t));
                        memBytes = m32;
                    } else if (mLen >= 8) {
                        std::memcpy(&memBytes, mBuf, sizeof(uint64_t));
                    }
                }
            }
            RegCloseKey(hGpuKey);

            int vramMB = memBytes > 0 ? static_cast<int>(memBytes / (1024ULL * 1024ULL)) : 0;
            int vramGB = vramMB > 0 ? std::max(1, static_cast<int>(std::round(static_cast<double>(vramMB) / 1024.0))) : 0;
            GpuBenchResult eval = scoreGPU(gpuName, vramGB);

            GpuSpec g;
            g.name = gpuName;
            g.driverVersion = driverVer;
            g.vramGB = vramGB > 0 ? vramGB : eval.vramGB;
            g.vramMB = vramMB > 0 ? vramMB : (g.vramGB * 1024);
            g.vendor = eval.vendor;
            g.rtCapable = eval.rtCapable;
            g.upscaler = eval.upscaler;
            g.score = eval.score;
            detectedGpus.push_back(g);
        }

        std::sort(detectedGpus.begin(), detectedGpus.end(), [](const GpuSpec& a, const GpuSpec& b) {
            int aReal = isVirtualGpuAdapter(a.name) ? 0 : 1;
            int bReal = isVirtualGpuAdapter(b.name) ? 0 : 1;
            if (aReal != bReal) return aReal > bReal;

            int aDisc = isIntegratedGpuAdapter(a.name, a.vramMB) ? 0 : 1;
            int bDisc = isIntegratedGpuAdapter(b.name, b.vramMB) ? 0 : 1;
            if (aDisc != bDisc) return aDisc > bDisc;

            if (a.score != b.score) return a.score > b.score;
            return a.vramMB > b.vramMB;
        });

        specs.allGpus = detectedGpus;
        if (!detectedGpus.empty()) {
            specs.gpu = detectedGpus.front();
        }
    }

    // 4. Storage Drives via GetLogicalDriveStringsW + GetDriveTypeW (DRIVE_FIXED) + GetVolumeInformationW + GetDiskFreeSpaceExW
    {
        wchar_t driveStrings[512] = {};
        DWORD len = GetLogicalDriveStringsW(511, driveStrings);
        std::vector<DriveSpec> foundDrives;

        const wchar_t* p = driveStrings;
        while (len > 0 && *p != L'\0') {
            std::wstring rootPath(p);
            UINT dtype = GetDriveTypeW(rootPath.c_str());
            if (dtype == DRIVE_FIXED) {
                ULARGE_INTEGER freeBytesAvail = {}, totalBytes = {}, totalFreeBytes = {};
                if (GetDiskFreeSpaceExW(rootPath.c_str(), &freeBytesAvail, &totalBytes, &totalFreeBytes) && totalBytes.QuadPart > 0) {
                    wchar_t volName[128] = {};
                    wchar_t fsName[64] = {};
                    GetVolumeInformationW(rootPath.c_str(), volName, 128, nullptr, nullptr, nullptr, fsName, 64);

                    std::string driveCode = wideToUtf8(rootPath.substr(0, 2));
                    std::string volStr = trim(wideToUtf8(volName));
                    std::string fsStr = trim(wideToUtf8(fsName));

                    int totalGB = std::max(1, static_cast<int>(std::round(static_cast<double>(totalBytes.QuadPart) / (1024.0 * 1024.0 * 1024.0))));
                    int freeGB = std::max(0, static_cast<int>(std::round(static_cast<double>(freeBytesAvail.QuadPart) / (1024.0 * 1024.0 * 1024.0))));
                    int usedGB = std::max(0, totalGB - freeGB);
                    int usedPct = std::min(100, std::max(0, static_cast<int>(std::round((static_cast<double>(usedGB) / totalGB) * 100.0))));

                    DriveSpec d;
                    d.drive = driveCode;
                    d.label = volStr.empty() ? ("Local Disk (" + driveCode + ")") : (volStr + " (" + driveCode + ")");
                    d.fsType = fsStr.empty() ? "NTFS" : fsStr;
                    d.totalGB = totalGB;
                    d.freeGB = freeGB;
                    d.usedGB = usedGB;
                    d.usedPercent = usedPct;
                    foundDrives.push_back(d);
                }
            }
            p += rootPath.size() + 1;
        }

        if (foundDrives.empty()) {
            DriveSpec fallback;
            foundDrives.push_back(fallback);
        }

        // Pick drive with most free space as primary gaming storage target
        auto bestIt = std::max_element(foundDrives.begin(), foundDrives.end(), [](const DriveSpec& a, const DriveSpec& b) {
            return a.freeGB < b.freeGB;
        });

        specs.drives = foundDrives;
        specs.storage.drives = foundDrives;
        specs.storage.allDrives = foundDrives;
        specs.storage.drive = bestIt->drive;
        specs.storage.primaryDrive = bestIt->drive;
        specs.storage.label = bestIt->label;
        specs.storage.freeGB = bestIt->freeGB;
        specs.storage.totalGB = bestIt->totalGB;
        specs.storage.usedGB = bestIt->usedGB;
        specs.storage.usedPercent = bestIt->usedPercent;
    }

    // 5. Displays / Monitors via EnumDisplayDevicesW + EnumDisplaySettingsExW + Registry EDID 0xFC
    {
        std::vector<DisplaySpec> foundDisplays;
        DISPLAY_DEVICEW adapter = {};
        adapter.cb = sizeof(adapter);

        for (DWORD i = 0; EnumDisplayDevicesW(nullptr, i, &adapter, 0); ++i) {
            if ((adapter.StateFlags & DISPLAY_DEVICE_ACTIVE) != 0) {
                DEVMODEW dm = {};
                dm.dmSize = sizeof(dm);
                if (!EnumDisplaySettingsExW(adapter.DeviceName, ENUM_CURRENT_SETTINGS, &dm, 0)) {
                    EnumDisplaySettingsExW(adapter.DeviceName, ENUM_REGISTRY_SETTINGS, &dm, 0);
                }

                DISPLAY_DEVICEW mon = {};
                mon.cb = sizeof(mon);
                std::string monitorName = "Generic PnP Monitor";
                std::wstring monDeviceId;

                if (EnumDisplayDevicesW(adapter.DeviceName, 0, &mon, 0)) {
                    std::string devStr = trim(wideToUtf8(mon.DeviceString));
                    if (!devStr.empty()) monitorName = devStr;
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
                std::string tier = determineResolutionTier(width, height);
                std::string aspect = formatAspectRatio(width, height);

                DisplaySpec d;
                d.id = "display-" + std::to_string(foundDisplays.size() + 1);
                d.name = monitorName;
                d.monitorName = monitorName;
                d.adapterString = trim(wideToUtf8(adapter.DeviceString));
                d.deviceName = trim(wideToUtf8(adapter.DeviceName));
                d.width = width;
                d.height = height;
                d.tier = tier;
                d.resolutionLabel = std::to_string(width) + "x" + std::to_string(height) + " (" + tier + ")";
                d.refreshRateHz = hz;
                d.aspectRatio = aspect;
                d.bitsPerPixel = bpp;
                d.isPrimary = isPrimary;
                d.vrrCapable = hz >= 75;
                d.probeEngine = "native-cpp17-win32-probe";

                if (isPrimary) {
                    foundDisplays.insert(foundDisplays.begin(), d);
                } else {
                    foundDisplays.push_back(d);
                }
            }
            ZeroMemory(&adapter, sizeof(adapter));
            adapter.cb = sizeof(adapter);
        }

        if (foundDisplays.empty()) {
            DisplaySpec fallback;
            foundDisplays.push_back(fallback);
        }
        specs.displays = foundDisplays;
        specs.display = foundDisplays.front();
    }

#else
    // Linux Telemetry (/proc/cpuinfo, /proc/meminfo, statvfs, /sys/class/drm)
    specs.platform = "linux";
    specs.os = "Linux Desktop";

    {
        std::ifstream cpuFile("/proc/cpuinfo");
        std::string line, modelName;
        int threads = 0;
        double mhz = 3600.0;
        while (std::getline(cpuFile, line)) {
            if (line.find("model name") != std::string::npos && modelName.empty()) {
                auto pos = line.find(':');
                if (pos != std::string::npos) modelName = trim(line.substr(pos + 1));
            } else if (line.find("processor") == 0) {
                ++threads;
            } else if (line.find("cpu MHz") != std::string::npos) {
                auto pos = line.find(':');
                if (pos != std::string::npos) mhz = std::atof(line.substr(pos + 1).c_str());
            }
        }
        if (threads <= 0) threads = 8;
        if (modelName.empty()) modelName = "Linux x86_64 Processor";
        CpuBenchResult cpuEval = scoreCPU(modelName, threads);
        specs.cpu.name = modelName;
        specs.cpu.threads = threads;
        specs.cpu.cores = cpuEval.estimatedCores;
        specs.cpu.speedMHz = static_cast<int>(mhz);
        specs.cpu.speedGHz = std::round((mhz / 1000.0) * 100.0) / 100.0;
        specs.cpu.score = cpuEval.score;
    }

    {
        std::ifstream memFile("/proc/meminfo");
        std::string line;
        long long totalKB = 16 * 1024 * 1024;
        long long availKB = 8 * 1024 * 1024;
        while (std::getline(memFile, line)) {
            if (line.find("MemTotal:") == 0) {
                std::sscanf(line.c_str(), "MemTotal: %lld", &totalKB);
            } else if (line.find("MemAvailable:") == 0) {
                std::sscanf(line.c_str(), "MemAvailable: %lld", &availKB);
            }
        }
        specs.ram.totalGB = std::max(1, static_cast<int>(std::round(totalKB / (1024.0 * 1024.0))));
        specs.ram.freeGB = std::max(0, static_cast<int>(std::round(availKB / (1024.0 * 1024.0))));
        specs.ram.availGB = specs.ram.freeGB;
        specs.ram.usedGB = std::max(0, specs.ram.totalGB - specs.ram.freeGB);
    }

    {
        struct statvfs st = {};
        DriveSpec d;
        d.drive = "/";
        d.label = "Root (/)";
        d.fsType = "ext4";
        if (statvfs("/", &st) == 0 && st.f_blocks > 0) {
            d.totalGB = std::max(1, static_cast<int>(std::round((static_cast<double>(st.f_blocks) * st.f_frsize) / (1024.0 * 1024.0 * 1024.0))));
            d.freeGB = std::max(0, static_cast<int>(std::round((static_cast<double>(st.f_bavail) * st.f_frsize) / (1024.0 * 1024.0 * 1024.0))));
            d.usedGB = std::max(0, d.totalGB - d.freeGB);
            d.usedPercent = std::min(100, std::max(0, static_cast<int>(std::round((static_cast<double>(d.usedGB) / d.totalGB) * 100.0))));
        }
        specs.drives.push_back(d);
        specs.storage.drives = specs.drives;
        specs.storage.allDrives = specs.drives;
        specs.storage.drive = d.drive;
        specs.storage.primaryDrive = d.drive;
        specs.storage.label = d.label;
        specs.storage.freeGB = d.freeGB;
        specs.storage.totalGB = d.totalGB;
        specs.storage.usedGB = d.usedGB;
        specs.storage.usedPercent = d.usedPercent;
    }

    {
        long long vramBytes = 0;
        std::ifstream vramFile("/sys/class/drm/card0/device/mem_info_vram_total");
        if (vramFile) vramFile >> vramBytes;
        int vramGB = vramBytes > 0 ? std::max(1, static_cast<int>(std::round(vramBytes / (1024.0 * 1024.0 * 1024.0)))) : 8;
        GpuBenchResult eval = scoreGPU("AMD Radeon RX 7600", vramGB);
        specs.gpu.name = "Linux DRM GPU";
        specs.gpu.vramGB = vramGB;
        specs.gpu.vramMB = vramGB * 1024;
        specs.gpu.vendor = eval.vendor;
        specs.gpu.rtCapable = eval.rtCapable;
        specs.gpu.upscaler = eval.upscaler;
        specs.gpu.score = eval.score;
        specs.allGpus.push_back(specs.gpu);
    }

    {
        DisplaySpec d;
        d.probeEngine = "native-cpp17-linux-drm";
        specs.displays.push_back(d);
        specs.display = d;
    }
#endif

    specs.driverSuites = detectDriverSuites(specs);

    auto t1 = std::chrono::steady_clock::now();
    specs.scanDurationMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
    return specs;
}

// =============================================================================
// 3. 56 Built-In Catalog Games + Strictly Non-Invasive Zero-Library-Access Mode
// =============================================================================
struct GameSpec {
    std::string id;
    std::string title;
    std::string genre;
    std::string engine;
    int releaseYear = 2024;
    std::string steamAppId;
    std::string monogram;
    uint32_t bannerColor1 = 0x0B1120;
    uint32_t bannerColor2 = 0x1E1B4B;
    uint32_t accentColor  = 0x38BDF8;

    std::string minCpu;
    std::string minGpu;
    int minCpuScore = 35;
    int minGpuScore = 30;
    int minRamGB = 8;
    int minVramGB = 4;

    std::string recCpu;
    std::string recGpu;
    int recCpuScore = 60;
    int recGpuScore = 50;
    int recRamGB = 16;
    int recVramGB = 8;

    int storageGB = 60;
    bool ssdRequired = true;
    bool supportsRT = false;
    std::vector<std::string> upscalers;
    int baseRecFps = 64;
    std::vector<std::string> tuningTips;

    // Non-Invasive Installed & Play Status Telemetry
    bool installed = false;
    bool isRunning = false;
    bool wasRecentlyPlayed = false;
    std::string playStatus = "CATALOG"; // "PLAYING_NOW", "RECENTLY_PLAYED", "INSTALLED", "CATALOG"
    std::string playStatusLabel = "CATALOG";
    std::string launcher;
    std::string installDir;
    std::string drive;
    double sizeOnDiskGB = 0.0;
    uint64_t lastPlayedTimestamp = 0;
    std::string matchedCatalogId;
};

inline std::vector<GameSpec> getCatalogGames() {
    auto makeGame = [](
        const char* id, const char* title, const char* genre, const char* engine, int year,
        const char* steamAppId, const char* monogram,
        uint32_t c1, uint32_t c2, uint32_t accent,
        const char* minCpu, const char* minGpu, int minRam, int minVram,
        const char* recCpu, const char* recGpu, int recRam, int recVram,
        int storageGB, bool ssdReq, bool rt,
        std::vector<std::string> upscalers, int baseFps,
        std::vector<std::string> tips
    ) -> GameSpec {
        GameSpec g;
        g.id = id;
        g.title = title;
        g.genre = genre;
        g.engine = engine;
        g.releaseYear = year;
        g.steamAppId = steamAppId ? steamAppId : "";
        g.monogram = monogram;
        g.bannerColor1 = c1;
        g.bannerColor2 = c2;
        g.accentColor = accent;
        g.minCpu = minCpu;
        g.minGpu = minGpu;
        g.minCpuScore = scoreCPU(minCpu).score;
        g.minGpuScore = scoreGPU(minGpu, minVram).score;
        g.minRamGB = minRam;
        g.minVramGB = minVram;
        g.recCpu = recCpu;
        g.recGpu = recGpu;
        g.recCpuScore = scoreCPU(recCpu).score;
        g.recGpuScore = scoreGPU(recGpu, recVram).score;
        g.recRamGB = recRam;
        g.recVramGB = recVram;
        g.storageGB = storageGB;
        g.ssdRequired = ssdReq;
        g.supportsRT = rt;
        g.upscalers = std::move(upscalers);
        g.baseRecFps = baseFps;
        g.tuningTips = std::move(tips);
        g.playStatus = "CATALOG";
        g.playStatusLabel = "CATALOG";
        return g;
    };

    return {
        // 1. Cyberpunk 2077: Phantom Liberty
        makeGame(
            "cyberpunk-2077", "Cyberpunk 2077: Phantom Liberty", "Action RPG", "REDengine 4", 2023,
            "1091500", "CP7", 0x1A1605, 0x2E1035, 0xFACC15,
            "Intel Core i7-6700 or AMD Ryzen 5 1600", "GeForce GTX 1060 6GB or Radeon RX 580 8GB", 12, 6,
            "Intel Core i7-10700 or AMD Ryzen 7 5800X", "GeForce RTX 2060 SUPER or Radeon RX 5700 XT", 16, 8,
            70, true, true, {"DLSS", "FSR", "XeSS"}, 64,
            {
                "Lower Crowd Density to Medium in Dogtown for a +12% CPU boost.",
                "Set Volumetric Fog Resolution and Screen Space Reflections to Medium/High for +18% FPS.",
                "On 8GB VRAM GPUs, keep Textures on High and disable Ray Tracing at 1440p."
            }
        ),
        // 2. Black Myth: Wukong
        makeGame(
            "black-myth-wukong", "Black Myth: Wukong", "Action RPG", "Unreal Engine 5", 2024,
            "2358720", "BMW", 0x181109, 0x362210, 0xF59E0B,
            "Intel Core i5-8400 or AMD Ryzen 5 1600", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB", 16, 6,
            "Intel Core i7-9700 or AMD Ryzen 5 5500", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 5700 XT", 16, 8,
            130, true, true, {"DLSS", "FSR", "XeSS", "TSR"}, 62,
            {
                "Unreal Engine 5 relies on upscaling: set Super Resolution (FSR / DLSS) to Quality (~67%) and enable Frame Generation for 90+ FPS.",
                "Set Shadow Quality and Global Illumination to Medium/High instead of Cinematic.",
                "Keep Full Ray Tracing Off on AMD and mid-range NVIDIA cards."
            }
        ),
        // 3. Elden Ring: Shadow of the Erdtree
        makeGame(
            "elden-ring", "Elden Ring: Shadow of the Erdtree", "Action RPG", "FromSoftware Proprietary", 2024,
            "1245620", "ERS", 0x14170E, 0x2F2912, 0xEAB308,
            "Intel Core i5-8400 or AMD Ryzen 3 3300X", "NVIDIA GeForce GTX 1060 3GB or AMD Radeon RX 580 4GB", 12, 4,
            "Intel Core i7-8700K or AMD Ryzen 5 3600X", "NVIDIA GeForce GTX 1070 8GB or AMD Radeon RX Vega 56 8GB", 16, 8,
            80, true, true, {"Native"}, 60,
            {
                "Elden Ring has a 60 FPS engine cap by default and no built-in temporal upscaler.",
                "Disable Ray Tracing Quality unless you have substantial GPU headroom.",
                "Set Grass Quality and Volumetric Quality to High for rock-solid 60 FPS."
            }
        ),
        // 4. Counter-Strike 2
        makeGame(
            "counter-strike-2", "Counter-Strike 2", "Competitive Tactical Shooter", "Source 2", 2023,
            "730", "CS2", 0x0B1528, 0x2B1E10, 0xF97316,
            "Intel Core i5-750 or AMD Ryzen 3 1200", "GeForce GTX 1050 or Radeon RX 560", 8, 2,
            "Intel Core i5-12400 or AMD Ryzen 5 5600", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600", 16, 6,
            85, true, false, {"FSR", "Native"}, 210,
            {
                "Keep Global Shadow Quality on High so you can spot enemy shadows around corners.",
                "Set FidelityFX Super Resolution to Disabled (Native) for maximum competitive clarity.",
                "Enable AMD Anti-Lag 2 or NVIDIA Reflex Low Latency (+Boost)."
            }
        ),
        // 5. Baldur's Gate 3
        makeGame(
            "baldurs-gate-3", "Baldur's Gate 3", "CRPG", "Divinity Engine 4.0", 2023,
            "1086940", "BG3", 0x1A0F1E, 0x381B18, 0xFB923C,
            "Intel i5-4690 or AMD FX 8350", "Nvidia GTX 970 or RX 480", 8, 4,
            "Intel i7-8700K or AMD Ryzen 5 3600", "Nvidia RTX 2060 Super or RX 5700 XT", 16, 8,
            150, true, false, {"DLSS", "FSR"}, 68,
            {
                "Act 3 (Lower City) is CPU-intensive; enable Dynamic Crowds only on 8+ core CPUs.",
                "Vulkan often performs very well on AMD Radeon RX 7000 GPUs.",
                "Set Shadow Quality and Cloud Quality to High instead of Ultra for +14% FPS."
            }
        ),
        // 6. Helldivers 2
        makeGame(
            "helldivers-2", "Helldivers 2", "Co-op Shooter", "Autodesk Stingray", 2024,
            "553850", "HD2", 0x141619, 0x2E2A0F, 0xFACC15,
            "Intel Core i7-4790K or AMD Ryzen 5 1500X", "NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 470", 8, 4,
            "Intel Core i7-9700K or AMD Ryzen 7 3700X", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600 XT", 16, 8,
            100, true, false, {"Native", "Render Scale"}, 68,
            {
                "Set Render Scale to Native or Ultra Quality at 1080p for crisp visibility.",
                "Lower Space Quality and Volumetric Fog to Medium for +20% higher framerates.",
                "Disable Async Compute if you experience frametime stutter in 4-player missions."
            }
        ),
        // 7. Alan Wake 2
        makeGame(
            "alan-wake-2", "Alan Wake 2", "Survival Horror", "Northlight Engine (Mesh Shaders)", 2023,
            "", "AW2", 0x0B131E, 0x261033, 0xC084FC,
            "Intel i5-7600K or AMD Ryzen 7 3700X", "GeForce RTX 2060 or Radeon RX 6600", 16, 6,
            "AMD Ryzen 7 3700X or Intel i7-10700", "GeForce RTX 3070 or Radeon RX 6700 XT", 16, 8,
            90, true, true, {"DLSS", "FSR"}, 60,
            {
                "Requires hardware Mesh Shader support (RTX 2000+ or RX 6000+).",
                "On 8GB VRAM GPUs, use Medium/High Preset at 1080p with FSR/DLSS Quality and Ray Tracing Off.",
                "Lower Volumetric Lighting and Post-Processing Quality to Medium for +16% FPS in forest scenes."
            }
        ),
        // 8. Red Dead Redemption 2
        makeGame(
            "red-dead-redemption-2", "Red Dead Redemption 2", "Open World Action", "RAGE", 2019,
            "1174180", "RDR", 0x240B0B, 0x3D1610, 0xEF4444,
            "Intel Core i5-2500K or AMD FX-6300", "Nvidia GeForce GTX 770 2GB or AMD Radeon R9 280 3GB", 8, 3,
            "Intel Core i7-4770K or AMD Ryzen 5 1500X", "Nvidia GeForce GTX 1060 6GB or AMD Radeon RX 480 4GB", 12, 6,
            150, false, false, {"DLSS", "FSR"}, 66,
            {
                "Set Texture Quality to Ultra (fits comfortably in 6GB+ VRAM).",
                "Keep Water Physics Quality at 50% and Tree Tessellation Off for a +25% FPS gain.",
                "Use Near Volumetric Resolution on Medium and Far Volumetric Resolution on High."
            }
        ),
        // 9. Starfield
        makeGame(
            "starfield", "Starfield", "Sci-Fi RPG", "Creation Engine 2", 2023,
            "1716740", "STF", 0x0B1326, 0x1E293B, 0x38BDF8,
            "AMD Ryzen 5 2600X or Intel Core i7-6800K", "AMD Radeon RX 5700 or NVIDIA GeForce GTX 1070 Ti", 16, 8,
            "AMD Ryzen 5 3600X or Intel i5-10600K", "AMD Radeon RX 6800 XT or NVIDIA GeForce RTX 2080", 16, 8,
            125, true, false, {"DLSS", "FSR", "XeSS"}, 62,
            {
                "Must be installed on an NVMe/SATA SSD to avoid audio dropouts and asset freezes.",
                "Enable FSR 3 or DLSS 3 with Frame Generation to smooth out CPU bottlenecks in New Atlantis.",
                "Lower Shadow Quality and Volumetric Lighting to Medium for +19% FPS."
            }
        ),
        // 10. Hogwarts Legacy
        makeGame(
            "hogwarts-legacy", "Hogwarts Legacy", "Action RPG", "Unreal Engine 4", 2023,
            "990080", "HL", 0x0E1329, 0x2C1B47, 0xA855F7,
            "Intel Core i5-6600 or AMD Ryzen 5 1400", "NVIDIA GeForce GTX 960 4GB or AMD Radeon RX 470 4GB", 16, 4,
            "Intel Core i7-8700 or AMD Ryzen 5 3600", "NVIDIA GeForce GTX 1080 Ti or RTX 2070 or AMD Radeon RX 5700 XT", 16, 8,
            85, true, true, {"DLSS", "FSR", "XeSS"}, 64,
            {
                "Keep Texture Quality and Material Quality on High (not Ultra) on 8GB VRAM GPUs.",
                "Set Fog Quality and Sky Quality to Medium/High for a +17% GPU performance boost.",
                "Keep Ray Tracing Off unless you have 12GB+ VRAM."
            }
        ),
        // 11. Forza Horizon 5
        makeGame(
            "forza-horizon-5", "Forza Horizon 5", "Open World Racing", "ForzaTech", 2021,
            "1551360", "FH5", 0x0F172A, 0x064E3B, 0x10B981,
            "AMD Ryzen 3 1200 or Intel i5-4460", "AMD Radeon RX 470 or Nvidia GTX 970", 8, 4,
            "AMD Ryzen 5 1500X or Intel i5-8400", "AMD Radeon RX 590 or Nvidia GTX 1070", 16, 8,
            110, true, true, {"DLSS", "FSR", "XeSS"}, 95,
            {
                "Extremely well-optimized engine: most 8GB modern GPUs run High/Ultra natively at 90-120+ FPS.",
                "Set Environment Texture Quality to High (Extreme requires 10GB+ VRAM).",
                "Set Shader Quality and SSR Quality to High rather than Extreme for +15% FPS."
            }
        ),
        // 12. Ghost of Tsushima
        makeGame(
            "ghost-of-tsushima", "Ghost of Tsushima", "Open World Action", "Sucker Punch Engine", 2024,
            "2215430", "GOT", 0x18131A, 0x331520, 0xF43F5E,
            "Intel Core i3-7100 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 960 4GB or AMD Radeon RX 5500 XT", 8, 4,
            "Intel Core i5-8600 or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 5600 XT", 16, 6,
            75, true, false, {"DLSS", "FSR", "XeSS"}, 72,
            {
                "Set Volumetric Fog and Shadow Quality to High instead of Very High/Extreme for +18% FPS.",
                "On 8GB VRAM GPUs, keep Texture Quality on High.",
                "Supports decoupled FSR 3 Frame Generation even when paired with DLSS or XeSS."
            }
        ),
        // 13. Call of Duty: Warzone
        makeGame(
            "call-of-duty-warzone", "Call of Duty: Warzone", "Competitive Shooter", "IW 9.0 Engine", 2024,
            "1938090", "COD", 0x091520, 0x1D2D24, 0x22C55E,
            "Intel Core i5-6600 or AMD Ryzen 5 1400", "NVIDIA GeForce GTX 960 or AMD Radeon RX 470", 8, 4,
            "Intel Core i7-8700K or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT", 16, 8,
            140, true, false, {"DLSS", "FSR", "XeSS", "FidelityFX CAS"}, 115,
            {
                "Use FidelityFX CAS (Sharpness ~75%) at Native resolution or FSR 3 / DLSS Quality for clear target visibility.",
                "Set Shader Quality, Screen Space Reflections, and Weather Grid Volumes to Low for +24% FPS.",
                "Lower VRAM Scale Target to 75-80% to eliminate microstutters."
            }
        ),
        // 14. Apex Legends
        makeGame(
            "apex-legends", "Apex Legends", "Battle Royale Shooter", "Source (Modified)", 2019,
            "1172470", "APX", 0x1E0D12, 0x3B1419, 0xEF4444,
            "Intel Core i3-6300 or AMD FX-4350", "NVIDIA GeForce GT 730 or AMD Radeon HD 7730", 6, 2,
            "Intel Core i5-8400 or AMD Ryzen 5 2600", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB", 16, 6,
            75, true, false, {"Native", "Adaptive Resolution"}, 195,
            {
                "Set Spot Shadow Detail and Sun Shadow Coverage to Low for +22% higher FPS.",
                "Match Texture Streaming Budget to your GPU VRAM (e.g., High 6GB or Very High 8GB).",
                "Disable Volumetric Lighting and Ambient Occlusion for steadier 144-240Hz lock."
            }
        ),
        // 15. Valorant
        makeGame(
            "valorant", "Valorant", "Competitive Tactical Shooter", "Unreal Engine 4", 2020,
            "", "VAL", 0x160D1A, 0x381322, 0xFB7185,
            "Intel Core i3-4150 or AMD Ryzen 3 1200", "GeForce GT 730 or Radeon R7 240", 4, 2,
            "Intel Core i5-9400F or AMD Ryzen 5 2600", "NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 570", 8, 4,
            45, false, false, {"Native"}, 280,
            {
                "Enable Multithreaded Rendering in Video Settings for 240+ FPS on 6+ core CPUs.",
                "Set Material, Texture, and Detail Quality to Low/Medium to eliminate visual clutter.",
                "Enable NVIDIA Reflex Low Latency (On + Boost) for lowest click-to-photon latency."
            }
        ),
        // 16. Fortnite
        makeGame(
            "fortnite", "Fortnite", "Battle Royale Shooter", "Unreal Engine 5.4", 2024,
            "", "FNT", 0x0A152E, 0x1E1B4B, 0x38BDF8,
            "Intel Core i3-3225 or AMD Ryzen 3 1200", "Intel HD 4000 or NVIDIA GTX 960", 8, 2,
            "Intel Core i5-10400 or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 5700", 16, 8,
            65, true, true, {"DLSS", "FSR", "XeSS", "TSR"}, 145,
            {
                "For competitive 165-240Hz play, switch Rendering Mode to Performance Mode or DX12 with Nanite Off.",
                "If using DX12 Quality mode, set TSR to Medium/High with Dynamic 3D Resolution.",
                "Disable Hardware Ray Tracing and Virtual Shadows for +45% higher framerate."
            }
        ),
        // 17. Minecraft Java
        makeGame(
            "minecraft-java", "Minecraft Java", "Sandbox Survival", "Java LWJGL (Sodium + Iris Shaders)", 2024,
            "", "MCJ", 0x0A191E, 0x14532D, 0x34D399,
            "Intel Core i5-4690 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 570", 8, 4,
            "Intel Core i5-12400 or AMD Ryzen 5 5600", "NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT", 16, 8,
            25, false, true, {"Native", "Render Scale"}, 85,
            {
                "Use Fabric with Sodium + Lithium + Iris Shaders instead of OptiFine for 2.5x higher FPS.",
                "Set Shadow Distance to 12-16 chunks and Render Distance to 16 chunks.",
                "Allocate 6GB to 8GB of RAM (-Xmx6G) in JVM arguments."
            }
        ),
        // 18. Grand Theft Auto V
        makeGame(
            "gtav", "Grand Theft Auto V", "Open World Action", "RAGE", 2015,
            "271590", "GTA", 0x0F1C14, 0x1E3A29, 0x4ADE80,
            "Intel Core i5-3470 or AMD FX-8350", "NVIDIA GTX 960 4GB or AMD Radeon RX 470 4GB", 8, 4,
            "Intel Core i7-8700K or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600", 16, 6,
            105, false, true, {"DLSS", "FSR"}, 105,
            {
                "Lower Grass Quality from Ultra to High—Ultra grass cuts framerate by up to 30% in Blaine County.",
                "Avoid pushing Extended Distance Scaling past 50% in Advanced Graphics.",
                "Use 2x MSAA or FSR/DLSS in the Enhanced edition instead of 8x MSAA."
            }
        ),
        // 19. The Witcher 3
        makeGame(
            "the-witcher-3", "The Witcher 3", "Action RPG", "REDengine 3 (DX12)", 2022,
            "292030", "TW3", 0x1A1118, 0x331824, 0xF43F5E,
            "Intel Core i5-7400 or AMD Ryzen 5 1600", "NVIDIA GTX 1060 6GB or AMD Radeon RX 580 8GB", 8, 6,
            "Intel Core i7-8700K or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 2060 Super or AMD Radeon RX 6600 XT", 16, 8,
            58, true, true, {"DLSS", "FSR", "XeSS"}, 66,
            {
                "Use DirectX 11 if not using Ray Tracing for +20-25% higher FPS and smoother frametimes.",
                "Set Foliage Visibility Range to High instead of Ultra+ for +18% FPS in Velen and Toussaint.",
                "Disable NVIDIA HairWorks on monsters unless you have spare GPU compute."
            }
        ),
        // 20. Resident Evil 4
        makeGame(
            "resident-evil-4", "Resident Evil 4", "Survival Horror", "RE Engine", 2023,
            "2050650", "RE4", 0x140E1C, 0x2B1438, 0xC084FC,
            "AMD Ryzen 3 1200 or Intel Core i5-7500", "AMD Radeon RX 560 4GB or NVIDIA GeForce GTX 1050 Ti 4GB", 8, 4,
            "AMD Ryzen 5 3600 or Intel Core i7-8700", "AMD Radeon RX 5700 or NVIDIA GeForce GTX 1070", 16, 8,
            67, true, true, {"FSR", "Native"}, 78,
            {
                "Keep Texture Quality at High (2 GB) or High (3 GB) on 8GB cards to avoid VRAM crashes.",
                "Disable Hair Strands and Ray Tracing for an immediate +25% FPS increase.",
                "Set Shadow Cache to On and Volumetric Lighting to Medium for smooth 90+ FPS."
            }
        ),
        // 21. Warhammer 40,000: Space Marine 2
        makeGame(
            "space-marine-2", "Warhammer 40,000: Space Marine 2", "Co-op Shooter", "Swarm Engine", 2024,
            "2183900", "SM2", 0x0A1428, 0x1D2B4F, 0x60A5FA,
            "AMD Ryzen 5 2600X or Intel Core i5-8600K", "AMD Radeon RX 580 8GB or NVIDIA GeForce GTX 1060 6GB", 8, 6,
            "AMD Ryzen 7 5800X or Intel Core i7-12700", "AMD Radeon RX 6800 XT or NVIDIA GeForce RTX 3070", 16, 8,
            75, true, false, {"DLSS", "FSR"}, 62,
            {
                "Swarm Engine renders ratusan of Tyranids on screen: CPU multi-threading and fast RAM are critical.",
                "Enable DLSS / FSR Quality mode and set Effects Quality and Volumetrics to Medium/High.",
                "Keep Texture Filtering and Cloth Simulation on Medium on 6-core CPUs."
            }
        ),
        // 22. S.T.A.L.K.E.R. 2
        makeGame(
            "stalker-2", "S.T.A.L.K.E.R. 2", "Survival FPS", "Unreal Engine 5.1", 2024,
            "1643320", "STK", 0x14170F, 0x2B2E18, 0xA3E635,
            "Intel Core i7-7700K or AMD Ryzen 5 1600X", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB", 16, 6,
            "Intel Core i7-11700 or AMD Ryzen 7 5800X", "NVIDIA GeForce RTX 3070 Ti or AMD Radeon RX 6800 XT", 32, 8,
            160, true, true, {"DLSS", "FSR", "XeSS", "TSR"}, 60,
            {
                "A-Life 2.0 NPC simulation in hubs is CPU-bound: enable FSR 3 / DLSS 3 Frame Generation.",
                "Keep Hair Quality, Shading Quality, and Foliage Quality at Medium/High rather than Epic for +22% FPS.",
                "On 8GB VRAM GPUs, set Texture Quality to Medium/High to prevent VRAM spillover."
            }
        ),
        // 23. Monster Hunter Wilds
        makeGame(
            "monster-hunter-wilds", "Monster Hunter Wilds", "Action RPG", "RE Engine", 2025,
            "2246340", "MHW", 0x1A150E, 0x362815, 0xFBBF24,
            "Intel Core i5-10600 or AMD Ryzen 5 3600", "NVIDIA GeForce GTX 1660 Super or AMD Radeon RX 5600 XT", 16, 6,
            "Intel Core i5-12400 or AMD Ryzen 5 5600", "NVIDIA GeForce RTX 2070 Super or NVIDIA GeForce RTX 4060 or AMD Radeon RX 6700 XT", 16, 8,
            140, true, true, {"DLSS", "FSR", "XeSS"}, 60,
            {
                "Keep Texture Quality at High (not Ultra/HD Pack) on 8GB VRAM GPUs.",
                "Enable FSR 3 Quality + Frame Generation to double smoothness from ~60 FPS to ~100+ FPS.",
                "Turn Wind Simulation Quality and Foliage Sway to Medium to ease CPU load."
            }
        ),
        // 24. Final Fantasy XVI
        makeGame(
            "final-fantasy-xvi", "Final Fantasy XVI", "Action RPG", "Square Enix Proprietary", 2024,
            "2515020", "FF16", 0x0D1326, 0x261B47, 0x818CF8,
            "AMD Ryzen 5 1600 or Intel Core i5-8400", "AMD Radeon RX 5700 or NVIDIA GeForce GTX 1070", 16, 8,
            "AMD Ryzen 7 5700X or Intel Core i7-10700", "AMD Radeon RX 6700 XT or NVIDIA GeForce RTX 2080", 16, 8,
            170, true, false, {"DLSS", "FSR", "XeSS"}, 60,
            {
                "Enable Dynamic Resolution with DLSS 3 or FSR 3 Quality to maintain 60+ FPS during Eikon battles.",
                "Set Graphical Fidelity and Shadow Quality to High instead of Ultra on 8GB VRAM GPUs.",
                "Must be installed on a fast NVMe SSD for seamless cutscene-to-combat transitions."
            }
        ),
        // 25. God of War Ragnarök
        makeGame(
            "god-of-war-ragnarok", "God of War Ragnarök", "Action Adventure", "Santa Monica Engine", 2024,
            "2322010", "GWR", 0x09192B, 0x1E3A5F, 0x38BDF8,
            "Intel Core i5-4670K or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 5500 XT 8GB", 8, 6,
            "Intel Core i5-8600 or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 2060 Super or AMD Radeon RX 5700", 16, 8,
            190, true, false, {"DLSS", "FSR", "XeSS"}, 72,
            {
                "Enable DLSS Quality or FSR 3.1 Quality for a sharp +25% FPS boost across Midgard and Vanaheim.",
                "Keep Tessellation and Volumetrics at High instead of Ultra to avoid frame drops in Svartalfheim.",
                "Install on an NVMe SSD to handle the 190 GB footprint and seamless realm travel."
            }
        ),
        // 26. Marvel's Spider-Man Remastered
        makeGame(
            "spider-man-remastered", "Marvel's Spider-Man Remastered", "Action Adventure", "Insomniac Engine", 2022,
            "1817070", "SMR", 0x2A0A12, 0x1E1B4B, 0xEF4444,
            "Intel Core i3-4160 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 950 or AMD Radeon RX 470", 8, 4,
            "Intel Core i5-4670 or AMD Ryzen 5 1600", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB", 16, 6,
            75, true, true, {"DLSS", "FSR", "XeSS", "IGTI"}, 85,
            {
                "Web-swinging through Manhattan is heavily CPU-bound: lower Crowd Density and Traffic Density to Medium on 6-core CPUs.",
                "Disable Ray-Traced Reflections on 8GB VRAM GPUs or enable DLSS/FSR Balanced to prevent traversal stutters.",
                "Set Level of Detail to High instead of Very High for smoother 1% lows."
            }
        ),
        // 27. Path of Exile 2
        makeGame(
            "path-of-exile-2", "Path of Exile 2", "Action RPG", "GGG Proprietary Engine", 2024,
            "2694490", "POE", 0x1A120B, 0x3B1D0E, 0xF59E0B,
            "Intel Core i7-7700 or AMD Ryzen 5 2500", "NVIDIA GeForce GTX 960 or AMD Radeon RX 470", 8, 4,
            "Intel Core i5-10500 or AMD Ryzen 5 3700X", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 5600 XT", 16, 6,
            100, true, false, {"DLSS", "FSR", "XeSS", "NIS"}, 90,
            {
                "Use Vulkan or DirectX 12 renderer and enable Dynamic Culling for crowded endgame mapping.",
                "Set Global Illumination to Low/Medium to save up to 25% GPU load during heavy spell effects.",
                "Enable NVIDIA Reflex or AMD Anti-Lag for snappier boss dodge response."
            }
        ),
        // 28. Horizon Forbidden West Complete Edition
        makeGame(
            "horizon-forbidden-west", "Horizon Forbidden West Complete Edition", "Action RPG", "Decima Engine", 2024,
            "2420110", "HFW", 0x0A1F2E, 0x14453D, 0x2DD4BF,
            "Intel Core i3-8100 or AMD Ryzen 3 1300X", "NVIDIA GeForce GTX 1650 4GB or AMD Radeon RX 5500 XT 4GB", 16, 4,
            "Intel Core i5-8600 or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 3060 or AMD Radeon RX 5700", 16, 8,
            150, true, false, {"DLSS", "FSR", "XeSS"}, 74,
            {
                "Keep Texture Quality at High on 8GB VRAM GPUs to prevent texture pop-in in Burning Shores.",
                "Lower Cloud Quality and Hair Quality from Very High to Medium/High for +15% FPS.",
                "Use DLSS 3 or FSR 2.2 Quality for crisp foliage rendering at 1440p."
            }
        ),
        // 29. The Last of Us Part I
        makeGame(
            "the-last-of-us-part-1", "The Last of Us Part I", "Action Adventure", "Naughty Dog Engine", 2023,
            "1888930", "TLU", 0x111827, 0x1F2937, 0xA3E635,
            "AMD Ryzen 5 1500X or Intel Core i7-4770K", "AMD Radeon RX 470 or NVIDIA GeForce GTX 970", 16, 4,
            "AMD Ryzen 5 3600 or Intel Core i7-8700", "AMD Radeon RX 5700 XT or NVIDIA GeForce RTX 2070 Super", 16, 8,
            100, true, false, {"DLSS", "FSR"}, 62,
            {
                "Wait for initial shader compilation to reach 100% in the main menu before starting gameplay.",
                "Set Environment Texture Quality to Medium/High on 8GB VRAM cards to stay under the VRAM budget.",
                "Enable DLSS or FSR Quality to smooth out dense overgrown city chapters."
            }
        ),
        // 30. Control Ultimate Edition
        makeGame(
            "control", "Control Ultimate Edition", "Action Adventure", "Northlight Engine", 2020,
            "870780", "CTL", 0x1F0910, 0x3B0A18, 0xF43F5E,
            "Intel Core i5-4690 or AMD FX-4350", "NVIDIA GeForce GTX 780 or AMD Radeon R9 280X", 8, 4,
            "Intel Core i5-7600K or AMD Ryzen 5 1600X", "NVIDIA GeForce GTX 1660 or AMD Radeon RX 580", 16, 6,
            42, false, true, {"DLSS"}, 82,
            {
                "Set Volumetric Lighting and Screen Space Reflections to Medium for +20% FPS with virtually identical visuals.",
                "If enabling Ray Tracing, toggle on DLSS Quality and keep RT Indirect Diffuse Lighting off on mid-range GPUs.",
                "Run in DirectX 12 mode for better multi-core CPU scaling and ray tracing support."
            }
        ),
        // 31. Metro Exodus Enhanced Edition
        makeGame(
            "metro-exodus-enhanced", "Metro Exodus Enhanced Edition", "First-Person Shooter", "4A Engine", 2021,
            "1449560", "MEE", 0x0C1219, 0x1E293B, 0x38BDF8,
            "Intel Core i5-4440", "NVIDIA GeForce RTX 2060", 8, 6,
            "Intel Core i7-8700K", "NVIDIA GeForce RTX 2070 or AMD Radeon RX 6700 XT", 16, 8,
            80, true, true, {"DLSS"}, 68,
            {
                "Enhanced Edition requires a hardware Ray Tracing GPU (RTX 20-series or RX 6000-series+).",
                "Enable DLSS Quality and set Ray Tracing to Normal rather than Ultra for 60+ FPS in open Volga/Caspian zones.",
                "Keep Hairworks and Advanced PhysX off unless you have significant GPU headroom."
            }
        ),
        // 32. DOOM Eternal
        makeGame(
            "doom-eternal", "DOOM Eternal", "First-Person Shooter", "id Tech 7", 2020,
            "782330", "DME", 0x290D07, 0x451208, 0xF97316,
            "Intel Core i5-4430 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 470", 8, 4,
            "Intel Core i7-6700K or AMD Ryzen 7 1700", "NVIDIA GeForce GTX 1080 or AMD Radeon RX 5700", 8, 8,
            80, true, true, {"DLSS"}, 144,
            {
                "id Tech 7 runs on Vulkan and scales effortlessly to 144+ FPS on mid-range hardware.",
                "Keep Texture Pool Size at High on 6-8GB VRAM cards so it never exceeds available VRAM.",
                "Disable Ray-Traced Reflections on non-RTX 3070+ GPUs to maintain locked high-refresh competitive fluidity."
            }
        ),
        // 33. Hollow Knight
        makeGame(
            "hollow-knight", "Hollow Knight", "Metroidvania Indie", "Unity", 2017,
            "367520", "HK", 0x0B1021, 0x1E293B, 0x93C5FD,
            "Intel Core 2 Duo E5200", "NVIDIA GeForce 9800GTX+ or AMD Radeon HD 4850", 4, 1,
            "Intel Core i5-4460", "NVIDIA GeForce GTX 560 or AMD Radeon R7 260X", 8, 2,
            9, false, false, {"Native"}, 144,
            {
                "Runs at 144+ FPS on virtually any modern integrated or discrete GPU.",
                "Set Particle Effects to Normal if you experience minor frame dips in White Palace or Godhome.",
                "Use Borderless Fullscreen with V-Sync off if your monitor supports G-Sync/FreeSync for zero input lag."
            }
        ),
        // 34. Hades II
        makeGame(
            "hades-ii", "Hades II", "Roguelike Action", "Supergiant Custom Engine", 2024,
            "1145350", "HD2", 0x0E1B18, 0x1F3A32, 0x34D399,
            "Intel Core i5-6500 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 950 or AMD Radeon R7 370", 8, 2,
            "Intel Core i5-8400 or AMD Ryzen 5 2600", "NVIDIA GeForce GTX 1060 or AMD Radeon RX 580", 16, 4,
            10, false, false, {"Native"}, 144,
            {
                "Extremely lightweight and responsive: easily hits 120-240 FPS on 1080p/1440p displays.",
                "Enable V-Sync or cap FPS to your monitor refresh rate to prevent unnecessary GPU coil whine.",
                "Run in DirectX 12 or Vulkan for optimal frame pacing during busy Olympus encounters."
            }
        ),
        // 35. Diablo IV
        makeGame(
            "diablo-iv", "Diablo IV", "Action RPG", "Blizzard Proprietary", 2023,
            "2344520", "D4", 0x1F0909, 0x380E12, 0xDC2626,
            "Intel Core i5-2500K or AMD FX-8100", "NVIDIA GeForce GTX 660 or AMD Radeon R9 280", 8, 4,
            "Intel Core i5-4670K or AMD Ryzen 3 1300X", "NVIDIA GeForce GTX 970 or AMD Radeon RX 470", 16, 6,
            90, true, true, {"DLSS", "FSR", "XeSS"}, 96,
            {
                "Do not install the optional High-Resolution Assets pack if your GPU has 8GB VRAM or less.",
                "Keep Fur Quality and Clutter Quality at Medium to eliminate town/world-boss stuttering.",
                "Enable DLSS Quality + NVIDIA Reflex for crisp 120+ FPS ARPG combat."
            }
        ),
        // 36. League of Legends
        makeGame(
            "league-of-legends", "League of Legends", "Competitive MOBA", "Riot Proprietary", 2009,
            "", "LOL", 0x091628, 0x112D4E, 0xFACC15,
            "Intel Core i3-530 or AMD A6-3650", "NVIDIA GeForce 9600GT or AMD Radeon HD 6570", 4, 1,
            "Intel Core i5-3300 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 560 or AMD Radeon HD 6950", 8, 2,
            16, false, false, {"Native"}, 180,
            {
                "Single-core CPU speed drives late-game 5v5 teamfight FPS; close browser tabs in the background.",
                "Cap FPS at 144 or 240 FPS instead of Uncapped to avoid character-skipping movement bugs.",
                "Disable Eye Candy and Character Inking for maximum visual clarity in teamfights."
            }
        ),
        // 37. Dota 2
        makeGame(
            "dota-2", "Dota 2", "Competitive MOBA", "Source 2", 2013,
            "570", "DT2", 0x240C0C, 0x3D1414, 0xEF4444,
            "Intel Core i5-2400 or AMD FX-6300", "NVIDIA GeForce GTX 650 or AMD Radeon HD 7750", 4, 2,
            "Intel Core i5-8400 or AMD Ryzen 5 2600", "NVIDIA GeForce GTX 1060 or AMD Radeon RX 580", 8, 4,
            60, false, false, {"FSR"}, 144,
            {
                "Use the Vulkan or DirectX 11 API depending on which gives steadier 1% lows on your GPU.",
                "Turn off Animate Portrait, Grass, and High Quality Water for +18% FPS in chaotic Roshan fights.",
                "Enable NVIDIA Reflex Low Latency in Video settings for faster last-hitting and spell reactions."
            }
        ),
        // 38. Overwatch 2
        makeGame(
            "overwatch-2", "Overwatch 2", "Competitive Hero Shooter", "Overwatch Engine", 2022,
            "2357570", "OW2", 0x1E293B, 0x334155, 0xFB923C,
            "Intel Core i3-6100 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 600 series or AMD Radeon HD 7000", 6, 2,
            "Intel Core i7-4770 or AMD Ryzen 5 1600", "NVIDIA GeForce GTX 1060 or AMD Radeon RX 580", 8, 4,
            50, true, false, {"DLSS", "FSR"}, 165,
            {
                "Set Render Scale to 100% (or FSR/DLSS Quality) and Dynamic Render Scale to Off for crisp aim.",
                "Lower Fog Detail, Local Reflections, and Shadow Detail to Low for rock-solid 165-240 FPS.",
                "Enable NVIDIA Reflex + Boost to minimize system click-to-photon latency."
            }
        ),
        // 39. Tom Clancy's Rainbow Six Siege
        makeGame(
            "rainbow-six-siege", "Tom Clancy's Rainbow Six Siege", "Tactical Shooter", "AnvilNext 2.0", 2015,
            "359550", "R6S", 0x0F172A, 0x1E293B, 0x38BDF8,
            "Intel Core i3-560 or AMD Phenom II X4 945", "NVIDIA GeForce GTX 460 or AMD Radeon HD 5870", 6, 2,
            "Intel Core i5-2500K or AMD FX-8120", "NVIDIA GeForce GTX 670 or AMD Radeon HD 7970", 8, 4,
            85, false, false, {"DLSS", "FSR"}, 180,
            {
                "Run the DirectX 11 or Vulkan executable and enable NVIDIA Reflex / Anti-Lag.",
                "Set Shadows to Medium (keeps player shadows visible) while lowering Shading and Reflection Quality to Low.",
                "Use T-AA at 100% Render Scaling or DLSS Quality for razor-sharp pixel peeks."
            }
        ),
        // 40. PUBG: BATTLEGROUNDS
        makeGame(
            "pubg-battlegrounds", "PUBG: BATTLEGROUNDS", "Battle Royale", "Unreal Engine 4", 2017,
            "578080", "PBG", 0x1C1917, 0x44403C, 0xF59E0B,
            "Intel Core i5-4430 or AMD FX-6300", "NVIDIA GeForce GTX 960 or AMD Radeon R7 370", 8, 2,
            "Intel Core i5-6600K or AMD Ryzen 5 1600", "NVIDIA GeForce GTX 1060 3GB or AMD Radeon RX 580", 16, 4,
            40, true, false, {"Native"}, 115,
            {
                "Set Foliage, Shadows, and Effects to Very Low for both maximum FPS and clearer enemy visibility.",
                "Keep Textures and View Distance at Medium/High if you have 6GB+ VRAM.",
                "Run in DirectX 11 Enhanced mode for the best frame-time consistency in hot-drops."
            }
        ),
        // 41. Escape from Tarkov
        makeGame(
            "escape-from-tarkov", "Escape from Tarkov", "Tactical Extraction Shooter", "Unity", 2017,
            "", "EFT", 0x18181B, 0x27272A, 0xA1A1AA,
            "Intel Core i5-4460 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 960 or AMD Radeon RX 560", 16, 4,
            "Intel Core i7-10700 or AMD Ryzen 7 5800X3D", "NVIDIA GeForce RTX 3060 or AMD Radeon RX 6700 XT", 32, 8,
            45, true, false, {"DLSS", "FSR"}, 72,
            {
                "Streets of Tarkov is heavily CPU & RAM bound: 32 GB RAM and X3D cache CPUs yield massive 1% low gains.",
                "Enable 'Streets of Tarkov Lower Texture Resolution Mode' on 8GB VRAM GPUs to prevent stutters.",
                "Use DLSS Quality or FSR 2.2 Quality to offset the performance hit of dual-render PiP scopes."
            }
        ),
        // 42. Rust
        makeGame(
            "rust", "Rust", "Survival Sandbox", "Unity", 2018,
            "252490", "RST", 0x27130C, 0x431407, 0xEA580C,
            "Intel Core i7-3770 or AMD FX-9590", "NVIDIA GeForce GTX 670 or AMD Radeon R9 280", 10, 4,
            "Intel Core i7-9700K or AMD Ryzen 7 5800X3D", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 5700", 16, 8,
            25, true, false, {"DLSS"}, 84,
            {
                "Rust is intensely CPU- and memory-bound on high-pop servers: 16-32 GB RAM and an SSD are essential.",
                "Set Graphics Quality to 3-4, Shadow Cascades to None/Two, and Max Gibs to 0 for smoother PvP gunfights.",
                "Enable DLSS Quality and NVIDIA Reflex to reduce input lag during base raids."
            }
        ),
        // 43. Palworld
        makeGame(
            "palworld", "Palworld", "Survival Monster-Taming", "Unreal Engine 5", 2024,
            "1623730", "PAL", 0x0A192F, 0x164E63, 0x38BDF8,
            "Intel Core i5-3570K or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 1050 2GB or AMD Radeon RX 560", 16, 4,
            "Intel Core i9-9900K or AMD Ryzen 5 5600", "NVIDIA GeForce RTX 2070 or AMD Radeon RX 6600 XT", 32, 8,
            40, true, false, {"DLSS", "TSR"}, 76,
            {
                "Hosting a multiplayer co-op world uses significant RAM: 32 GB is recommended for smooth base building.",
                "Lower View Distance and Grass Details to Medium for +20% FPS in dense Pal bases.",
                "Enable DLSS Quality or TSR Balanced at 1440p."
            }
        ),
        // 44. Enshrouded
        makeGame(
            "enshrouded", "Enshrouded", "Survival Action RPG", "Voxel Proprietary Engine", 2024,
            "1203620", "ENS", 0x111827, 0x1E3A5F, 0x60A5FA,
            "Intel Core i5-6400 or AMD Ryzen 5 1500X", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB", 16, 6,
            "Intel Core i7-8700 or AMD Ryzen 5 3700X", "NVIDIA GeForce RTX 2070 Super or AMD Radeon RX 6700 XT", 16, 8,
            60, true, false, {"DLSS", "FSR"}, 68,
            {
                "Voxel global illumination and dense fog are GPU-heavy: set Fog Quality and GI Quality to Performance/Balanced.",
                "Enable DLSS Quality or FSR 2 Quality for a +25-30% FPS boost in Shroud zones.",
                "Keep Texture Resolution at Balanced on 6GB VRAM cards."
            }
        ),
        // 45. Valheim
        makeGame(
            "valheim", "Valheim", "Survival Co-op", "Unity", 2021,
            "892970", "VAL", 0x0F172A, 0x14532D, 0x4ADE80,
            "Intel Core i5-7400 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 950 or AMD Radeon R9 280", 8, 2,
            "Intel Core i5-10400 or AMD Ryzen 5 3600", "NVIDIA GeForce GTX 1060 or AMD Radeon RX 580", 16, 4,
            2, false, false, {"Native"}, 95,
            {
                "Large player-built bases with many terraformed terrain instances tax CPU draw calls.",
                "Lower Vegetation Quality and Active Point Lights to Medium to keep base FPS above 60.",
                "Run with Vulkan (-force-vulkan) if you experience stuttering on DirectX 11."
            }
        ),
        // 46. No Man's Sky
        makeGame(
            "no-mans-sky", "No Man's Sky", "Space Exploration Survival", "Hello Games Proprietary", 2016,
            "275850", "NMS", 0x1E1B4B, 0x4C1D95, 0xF472B6,
            "Intel Core i3-4130 or AMD FX-6300", "NVIDIA GeForce GTX 1060 3GB or AMD Radeon RX 470", 8, 4,
            "Intel Core i5-8400 or AMD Ryzen 5 2600", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 5600 XT", 16, 6,
            15, true, false, {"DLSS", "FSR", "XeSS"}, 88,
            {
                "Planet Quality and Reflections are the biggest GPU hits: keep both at Enhanced/High instead of Ultra.",
                "Enable DLSS 2 or FSR 2.0 Quality for smooth 90+ FPS during planetary entry.",
                "Install on an SSD to drastically cut warp-screen loading times."
            }
        ),
        // 47. Microsoft Flight Simulator 2024
        makeGame(
            "ms-flight-sim-2024", "Microsoft Flight Simulator 2024", "Flight Simulation", "Asobo Engine", 2024,
            "2537590", "MFS", 0x082F49, 0x0369A1, 0x38BDF8,
            "Intel Core i7-6800K or AMD Ryzen 5 2600X", "NVIDIA GeForce GTX 970 or AMD Radeon RX 5700", 16, 4,
            "Intel Core i7-10700K or AMD Ryzen 7 2700X", "NVIDIA GeForce RTX 3080 or AMD Radeon RX 7900 XT", 32, 12,
            50, true, true, {"DLSS", "FSR", "XeSS"}, 48,
            {
                "Terrain Level of Detail (TLOD) is the #1 CPU killer near major airports: keep TLOD at 100-150 for smooth landings.",
                "Enable DLSS 3 / FSR 3 Frame Generation to double perceived smoothness from ~45 FPS to 90 FPS.",
                "32 GB+ RAM and 12 GB+ VRAM are strongly recommended for dense photogrammetry cities."
            }
        ),
        // 48. F1 24
        makeGame(
            "f1-24", "F1 24", "Sim Racing", "EGO Engine 4.0", 2024,
            "2488620", "F1", 0x260808, 0x450A0A, 0xEF4444,
            "Intel Core i3-2130 or AMD FX-4300", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 590", 8, 6,
            "Intel Core i5-9600K or AMD Ryzen 5 2600X", "NVIDIA GeForce RTX 2070 or AMD Radeon RX 6700 XT", 16, 8,
            100, true, true, {"DLSS", "FSR", "XeSS"}, 110,
            {
                "Disable Ray-Traced DDGI and Ray-Traced Reflections during rain races for +35% FPS.",
                "Enable DLSS Quality or FSR 2 Quality to hit locked 120+ FPS on 144Hz ultrawide monitors.",
                "Keep Crowd and Skidmarks at Medium to reduce CPU overhead on grid starts."
            }
        ),
        // 49. Assetto Corsa Competizione
        makeGame(
            "assetto-corsa-competizione", "Assetto Corsa Competizione", "Sim Racing", "Unreal Engine 4", 2019,
            "805550", "ACC", 0x111827, 0x374151, 0xF87171,
            "Intel Core i5-4460 or AMD FX-8120", "NVIDIA GeForce GTX 460 or AMD Radeon HD 7770", 8, 4,
            "Intel Core i5-8600K or AMD Ryzen 5 2600X", "NVIDIA GeForce GTX 1070 or AMD Radeon RX 580", 16, 8,
            50, true, false, {"DLSS", "FSR"}, 92,
            {
                "Visible Cars limit has a huge CPU impact in 30-car GT3 grids: cap visible opponents to 15-20.",
                "Set Mirrors Quality to Low/Mid and Volumetric Fog to Disabled for +20% FPS in night/rain races.",
                "Use KTAA or DLSS Quality for clean brake-marker readability."
            }
        ),
        // 50. Sid Meier's Civilization VII
        makeGame(
            "civilization-vii", "Sid Meier's Civilization VII", "4X Grand Strategy", "Firaxis LORE Engine", 2025,
            "1295660", "CV7", 0x1E1B4B, 0x312E81, 0xFBBF24,
            "Intel Core i5-8400 or AMD Ryzen 3 1200", "NVIDIA GeForce GTX 1050 Ti or AMD Radeon RX 470", 8, 4,
            "Intel Core i5-10400 or AMD Ryzen 5 3600X", "NVIDIA GeForce RTX 2060 or AMD Radeon RX 6600", 16, 8,
            20, true, false, {"FSR", "XeSS"}, 75,
            {
                "Late-game turn times depend on CPU single-core & multi-core speed rather than GPU.",
                "Lower Leader Quality and Water Reflections to Medium on 4-6GB VRAM laptops.",
                "Cap FPS at 60-75 Hz to keep GPU fans quiet during long strategy sessions."
            }
        ),
        // 51. Cities: Skylines II
        makeGame(
            "cities-skylines-ii", "Cities: Skylines II", "City Builder Simulation", "Unity DOTS", 2023,
            "949230", "CS2", 0x0F172A, 0x1E3A8A, 0x38BDF8,
            "Intel Core i7-6700K or AMD Ryzen 5 2600X", "NVIDIA GeForce GTX 970 or AMD Radeon RX 480", 8, 4,
            "Intel Core i5-12600K or AMD Ryzen 7 5800X", "NVIDIA GeForce RTX 3080 or AMD Radeon RX 6800 XT", 16, 10,
            60, true, false, {"DLSS", "FSR"}, 44,
            {
                "Disable Depth of Field, Volumetrics Quality, and Motion Blur immediately for +30% GPU FPS.",
                "Set Level of Detail to Low/Medium and Global Illumination to Low on 8GB VRAM GPUs.",
                "Large 200k+ citizen cities are heavily multi-core CPU bound; 8+ CPU cores help simulation speed."
            }
        ),
        // 52. Kingdom Come: Deliverance II
        makeGame(
            "kingdom-come-deliverance-2", "Kingdom Come: Deliverance II", "Action RPG", "CryEngine", 2025,
            "1771300", "KCD", 0x1F160A, 0x3F2E14, 0xF59E0B,
            "Intel Core i5-8400 or AMD Ryzen 5 2600", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580", 16, 6,
            "Intel Core i7-13700K or AMD Ryzen 7 7800X3D", "NVIDIA GeForce RTX 4070 or AMD Radeon RX 7800 XT", 32, 12,
            100, true, false, {"DLSS", "FSR"}, 64,
            {
                "CryEngine SVOGI lighting and dense Kuttenberg crowds scale heavily with CPU & GPU: use High preset over Experimental.",
                "Enable DLSS Quality or FSR 3 Quality for +25% FPS in forested Bohemia.",
                "Keep Object Distance and Vegetation Detail at High for smooth 60+ FPS on mid-range rigs."
            }
        ),
        // 53. Dragon's Dogma 2
        makeGame(
            "dragons-dogma-2", "Dragon's Dogma 2", "Action RPG", "RE Engine", 2024,
            "2054970", "DD2", 0x1C0F0A, 0x3E1E12, 0xF97316,
            "Intel Core i5-10600 or AMD Ryzen 5 3600", "NVIDIA GeForce GTX 1070 or AMD Radeon RX 5500 XT", 16, 8,
            "Intel Core i7-10700 or AMD Ryzen 5 3600X", "NVIDIA GeForce RTX 2080 or AMD Radeon RX 6700", 16, 8,
            65, true, true, {"DLSS", "FSR"}, 56,
            {
                "Vernworth and Bakbattahl are severely CPU-bound due to NPC simulation: enable DLSS 3 / FSR 3 Frame Generation if supported.",
                "Disable Ray Tracing and lower Shadow Quality to Medium to save VRAM and stabilize frame times.",
                "Keep Texture Quality at High (2GB-3GB) on 8GB VRAM GPUs."
            }
        ),
        // 54. SILENT HILL 2
        makeGame(
            "silent-hill-2-remake", "SILENT HILL 2", "Survival Horror", "Unreal Engine 5", 2024,
            "2124490", "SH2", 0x0D1318, 0x263238, 0x94A3B8,
            "Intel Core i7-6700K or AMD Ryzen 5 3600", "NVIDIA GeForce GTX 1070 Ti or AMD Radeon RX 5700", 16, 8,
            "Intel Core i7-8700K or AMD Ryzen 5 3600X", "NVIDIA GeForce RTX 2080 or AMD Radeon RX 6800 XT", 16, 8,
            50, true, true, {"DLSS", "FSR", "XeSS", "TSR"}, 58,
            {
                "Keep Ray Tracing Off on 8GB VRAM GPUs; Software Lumen still delivers atmospheric fog and lighting.",
                "Set Shaders and Shadows Quality to Medium for +20% FPS in foggy South Vale streets.",
                "Enable DLSS Quality or FSR 3 Quality for smoother traversal."
            }
        ),
        // 55. Indiana Jones and the Great Circle
        makeGame(
            "indiana-jones-great-circle", "Indiana Jones and the Great Circle", "Action Adventure", "Motor (id Tech 7)", 2024,
            "2677660", "IND", 0x1E1308, 0x3B2310, 0xEAB308,
            "Intel Core i7-10700K or AMD Ryzen 5 3600", "NVIDIA GeForce RTX 2060 Super or AMD Radeon RX 6600", 16, 8,
            "Intel Core i7-12700K or AMD Ryzen 7 7700", "NVIDIA GeForce RTX 3080 Ti or AMD Radeon RX 7700 XT", 32, 12,
            120, true, true, {"DLSS", "FSR", "XeSS"}, 66,
            {
                "Requires a hardware Ray Tracing GPU (RTX 2060 Super / RX 6600 or newer) to launch.",
                "On 8GB VRAM GPUs, keep Texture Pool Size at Low/Medium to prevent severe performance drops.",
                "Enable DLSS Quality + Frame Generation (or FSR) for smooth 60-90+ FPS."
            }
        ),
        // 56. Grand Theft Auto VI (Projected)
        makeGame(
            "gta-vi-projected", "Grand Theft Auto VI (Projected)", "Open World Action", "RAGE 9", 2026,
            "", "GT6", 0x24092B, 0x0F172A, 0xF472B6,
            "Intel Core i5-12400 or AMD Ryzen 5 5600", "NVIDIA GeForce RTX 3060 12GB or AMD Radeon RX 6700 XT", 16, 8,
            "Intel Core i7-13700K or AMD Ryzen 7 7800X3D", "NVIDIA GeForce RTX 4070 Super or AMD Radeon RX 7800 XT", 32, 12,
            150, true, true, {"DLSS", "FSR", "XeSS"}, 60,
            {
                "Projected specs based on RAGE 9 RTGI: an NVMe SSD and 12GB+ VRAM GPU are strongly advised for 1440p High.",
                "Expect DLSS 3.5 / FSR 3+ upscaling and Frame Generation to be key for high-refresh Leonida exploration.",
                "32 GB system RAM will help eliminate streaming hitches in dense Vice City traffic."
            }
        )
    };
}

// =============================================================================
// Strictly Non-Invasive Zero-Library-Access Mode (No Process or Launcher Reads)
// =============================================================================
inline std::set<std::string> takeNonInvasiveProcessSnapshot() {
    // Zero-Process-Access mode: never enumerates running processes (no CreateToolhelp32Snapshot or /proc).
    return {};
}

inline bool isGameProcessRunning(const GameSpec& game, const std::set<std::string>& runningProcs) {
    if (runningProcs.empty()) return false;
    static const std::map<std::string, std::vector<std::string>> knownExes = {
        { "cyberpunk-2077", { "cyberpunk2077.exe", "cyberpunk2077" } },
        { "black-myth-wukong", { "b1-win64-shipping.exe", "b1.exe" } },
        { "elden-ring", { "eldenring.exe" } },
        { "counter-strike-2", { "cs2.exe", "cs2" } },
        { "baldurs-gate-3", { "bg3.exe", "bg3_dx11.exe" } },
        { "helldivers-2", { "helldivers2.exe" } },
        { "alan-wake-2", { "alanwake2.exe" } },
        { "red-dead-redemption-2", { "rdr2.exe", "playrdr2.exe" } },
        { "starfield", { "starfield.exe" } },
        { "hogwarts-legacy", { "hogwartslegacy.exe" } },
        { "forza-horizon-5", { "forzahorizon5.exe" } },
        { "ghost-of-tsushima", { "ghostoftsushima.exe" } },
        { "call-of-duty-warzone", { "cod.exe", "sp24-cod.exe" } },
        { "apex-legends", { "r5apex.exe", "r5apex_dx12.exe" } },
        { "valorant", { "valorant-win64-shipping.exe", "valorant.exe" } },
        { "fortnite", { "fortniteclient-win64-shipping.exe" } },
        { "minecraft-java", { "javaw.exe", "minecraft.exe" } },
        { "gtav", { "gta5.exe", "gtav.exe", "playgtav.exe" } },
        { "the-witcher-3", { "witcher3.exe" } },
        { "resident-evil-4", { "re4.exe" } },
        { "space-marine-2", { "spacemarine2.exe", "warhammer40000spacemarine2.exe" } },
        { "stalker-2", { "stalker2-win64-shipping.exe", "stalker2.exe" } },
        { "monster-hunter-wilds", { "monsterhunterwilds.exe" } },
        { "final-fantasy-xvi", { "ffxvi.exe" } }
    };

    std::string key = !game.matchedCatalogId.empty() ? game.matchedCatalogId : game.id;
    auto it = knownExes.find(key);
    if (it != knownExes.end()) {
        for (const auto& exe : it->second) {
            if (runningProcs.count(exe) > 0) return true;
        }
    }

    std::string compactTitle;
    for (unsigned char c : toLower(game.title)) {
        if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) compactTitle.push_back(static_cast<char>(c));
    }
    if (compactTitle.size() >= 6) {
        for (const auto& proc : runningProcs) {
            if (proc.size() >= 6 && proc.find(compactTitle) != std::string::npos) return true;
        }
    }
    return false;
}

inline std::string normalizeTitleForMatch(const std::string& title) {
    std::string s = toLower(title);
    std::string out;
    for (unsigned char c : s) {
        if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) out.push_back(static_cast<char>(c));
        else out.push_back(' ');
    }
    std::istringstream iss(out);
    std::string token, result;
    while (iss >> token) {
        if (token == "edition" || token == "remastered" || token == "directors" || token == "cut" ||
            token == "enhanced" || token == "update" || token == "remake" || token == "the" || token == "of") {
            continue;
        }
        if (token == "iii") token = "3";
        else if (token == "ii") token = "2";
        else if (token == "iv") token = "4";
        else if (token == "v") token = "5";
        else if (token == "xvi") token = "16";
        if (!result.empty()) result += " ";
        result += token;
    }
    return result;
}

inline bool isNonGameManifestName(const std::string& name) {
    if (name.size() < 2) return true;
    std::regex re("steamworks\\s*common\\s*redistributables|^proton\\s|steam\\s*linux\\s*runtime|^steamvr$|directx|vcredist|redistributable|dedicated\\s*server|\\bsdk\\b|benchmark\\s*tool|^soundtrack$", std::regex_constants::icase);
    return std::regex_search(name, re);
}

inline std::map<std::string, std::string> parseAcfKeyValues(const std::string& content, std::vector<std::string>* outLibraryPaths = nullptr) {
    std::map<std::string, std::string> kv;
    std::regex pairRe("\"([^\"]+)\"\\s+\"([^\"]*)\"");
    auto begin = std::sregex_iterator(content.begin(), content.end(), pairRe);
    auto end = std::sregex_iterator();
    for (auto it = begin; it != end; ++it) {
        std::string k = toLower((*it)[1].str());
        std::string v = (*it)[2].str();
        // Unescape double backslashes
        std::string cleanV;
        for (size_t i = 0; i < v.size(); ++i) {
            if (v[i] == '\\' && i + 1 < v.size() && v[i + 1] == '\\') {
                cleanV.push_back('\\');
                ++i;
            } else {
                cleanV.push_back(v[i]);
            }
        }
        if (k == "path" && outLibraryPaths) {
            outLibraryPaths->push_back(cleanV);
        }
        if (kv.find(k) == kv.end()) {
            kv[k] = cleanV;
        }
    }
    return kv;
}

inline std::string readFileText(const std::filesystem::path& p) {
    std::ifstream ifs(p, std::ios::in | std::ios::binary);
    if (!ifs) return "";
    std::ostringstream oss;
    oss << ifs.rdbuf();
    return oss.str();
}

inline const GameSpec* findMatchingCatalogGame(const std::string& steamAppId, const std::string& title, const std::vector<GameSpec>& catalog) {
    if (!steamAppId.empty()) {
        for (const auto& g : catalog) {
            if (!g.steamAppId.empty() && g.steamAppId == steamAppId) return &g;
        }
    }
    std::string normTarget = normalizeTitleForMatch(title);
    if (normTarget.empty()) return nullptr;
    for (const auto& g : catalog) {
        std::string normCat = normalizeTitleForMatch(g.title);
        std::string baseCat = normalizeTitleForMatch(g.title.substr(0, g.title.find(':')));
        std::string baseTarget = normalizeTitleForMatch(title.substr(0, title.find(':')));
        if (normTarget == normCat || (!baseCat.empty() && (normTarget == baseCat || baseTarget == baseCat))) {
            return &g;
        }
    }
    return nullptr;
}

inline std::string makeMonogram(const std::string& title) {
    std::istringstream iss(normalizeTitleForMatch(title));
    std::string word, mono;
    while (iss >> word && mono.size() < 3) {
        mono.push_back( static_cast<char>(std::toupper(static_cast<unsigned char>(word[0]))) );
    }
    if (mono.empty()) return "GM";
    return mono;
}

inline std::vector<GameSpec> scanInstalledGames() {
    // Strictly Non-Invasive Zero-Library-Access Mode:
    // Never reads Steam libraryfolders.vdf, appmanifest_*.acf, Epic manifests, or running processes.
    return {};
}

inline int getPlayStatusSortRank(const GameSpec& g) {
    if (g.isRunning || g.playStatus == "PLAYING_NOW") return 3;
    if (g.wasRecentlyPlayed || g.playStatus == "RECENTLY_PLAYED") return 2;
    if (g.installed || g.playStatus == "INSTALLED") return 1;
    return 0;
}

inline std::vector<GameSpec> getMergedGameList(const std::vector<GameSpec>& customGames) {
    std::vector<GameSpec> catalog = getCatalogGames();
    std::vector<GameSpec> merged;
    merged.reserve(catalog.size() + customGames.size());

    for (auto g : catalog) {
        g.installed = false;
        g.isRunning = false;
        g.wasRecentlyPlayed = false;
        g.playStatus = "CATALOG";
        g.playStatusLabel = "CATALOG";
        merged.push_back(std::move(g));
    }

    for (auto custom : customGames) {
        const GameSpec* matched = findMatchingCatalogGame(custom.steamAppId, custom.title, catalog);
        if (!matched) {
            custom.installed = false;
            custom.isRunning = false;
            custom.wasRecentlyPlayed = false;
            if (custom.playStatus.empty()) custom.playStatus = "CATALOG";
            if (custom.playStatusLabel.empty()) custom.playStatusLabel = "CATALOG";
            merged.push_back(std::move(custom));
        }
    }

    return merged;
}

inline std::vector<GameSpec> getMergedGameList() {
    return getMergedGameList(std::vector<GameSpec>{});
}

// =============================================================================
// 4. 4 Screen-Aware Optimization Modes, Analyzer, Config Exporter & Steam Parser
// =============================================================================
struct FpsEstimate {
    int avg = 60;
    int low = 50;
    int high = 68;
    std::string range = "50 - 68 FPS";
    operator int() const { return avg; }
};

struct ComponentEval {
    std::string name;
    std::string status = "MEETS_RECOMMENDED"; // EXCEEDS_RECOMMENDED, MEETS_RECOMMENDED, MEETS_MINIMUM, BELOW_MINIMUM
    std::string userValue;
    std::string minRequired;
    std::string recRequired;
    int userScore = 0;
    int minScore = 0;
    int recScore = 0;
    bool passMin = true;
    bool passRec = true;
};

struct SettingImpact {
    std::string setting;
    std::string recommendedValue;
    int fpsGainPercent = 0;
    int vramImpactMB = 0;
    std::string visualCost;
    std::string note;
};

struct GameAnalysis {
    std::string gameId;
    std::string gameTitle;
    int mode = 0;
    std::string modeId = "optimal";
    std::string modeLabel = "Optimal (Rig + Screen Balance)";

    std::string overallTier = "MEETS_RECOMMENDED";
    std::string verdictBadge = "RECOMMENDED"; // ULTRA READY, RECOMMENDED, MINIMUM, BELOW MIN
    bool canRunMinimum = true;
    bool canRunRecommended = true;
    bool storagePass = true;

    std::string cpuStatus;
    std::string gpuStatus;
    std::string vramStatus;
    std::string ramStatus;
    std::string storageStatus;

    ComponentEval cpuEval;
    ComponentEval gpuEval;
    ComponentEval vramEval;
    ComponentEval ramEval;
    ComponentEval storageEval;

    std::string primaryBottleneck = "GPU Compute";
    std::string limitingComponent = "GPU Compute";
    std::string bottleneckNote;

    FpsEstimate fps1080p;
    FpsEstimate fps1440p;
    FpsEstimate fps4k;
    FpsEstimate estimatedScreenFps;
    int screenFpsAvg = 60;

    int screenWidth = 1920;
    int screenHeight = 1080;
    int refreshRateHz = 60;
    std::string monitorName = "Primary Display";
    int refreshSaturationPct = 100;
    std::string syncAdvice;
    std::string fpsCapAdvice;
    std::string targetFpsWindow;
    std::string summary;
    int qualityScore = 85;

    // Recommended Settings
    std::string targetResolution;
    std::string preset = "High";
    std::string upscalingMode = "Quality";
    std::string textures = "High";
    std::string shadows = "High";
    std::string rayTracing = "Off";
    std::string frameGen = "Off";

    // 8-Setting FPS/VRAM Impact Breakdown
    std::vector<SettingImpact> settingImpacts;
    std::vector<SettingImpact> perSettingImpact;
    std::vector<std::string> tuningTips;
};

inline std::string evaluateComponentTier(double userScore, double minScore, double recScore) {
    if (userScore >= recScore * 1.15) return "EXCEEDS_RECOMMENDED";
    if (userScore >= recScore * 0.95) return "MEETS_RECOMMENDED";
    if (userScore >= minScore * 0.95) return "MEETS_MINIMUM";
    return "BELOW_MINIMUM";
}

inline int tierRankIndex(const std::string& tier) {
    if (tier == "EXCEEDS_RECOMMENDED") return 3;
    if (tier == "MEETS_RECOMMENDED") return 2;
    if (tier == "MEETS_MINIMUM") return 1;
    return 0;
}

inline std::string tierToVerdictBadge(const std::string& tier) {
    if (tier == "EXCEEDS_RECOMMENDED") return "ULTRA READY";
    if (tier == "MEETS_RECOMMENDED") return "RECOMMENDED";
    if (tier == "MEETS_MINIMUM") return "MINIMUM";
    return "BELOW MIN";
}

inline double getResolutionFactorForPixels(int width, int height) {
    double basePixels = 1920.0 * 1080.0;
    double actualPixels = std::max(1280.0 * 720.0, static_cast<double>(width > 0 ? width : 1920) * static_cast<double>(height > 0 ? height : 1080));
    double pixelRatio = actualPixels / basePixels;
    if (std::abs(pixelRatio - 1.0) < 0.08) return 1.0;
    if (std::abs(pixelRatio - (2560.0 * 1440.0) / basePixels) < 0.15) return 1.35;
    if (pixelRatio >= 3.5) return 2.05;
    return std::round(std::pow(pixelRatio, 0.58) * 100.0) / 100.0;
}

inline FpsEstimate computeFpsEstimate(const SystemSpecs& specs, const GameSpec& game, double resolutionFactor, double modeMultiplier) {
    double baseTarget = game.baseRecFps > 0 ? static_cast<double>(game.baseRecFps) : 64.0;
    double gpuRatio = static_cast<double>(specs.gpu.score) / std::max(15, game.recGpuScore);
    double cpuRatio = static_cast<double>(specs.cpu.score) / std::max(15, game.recCpuScore);

    double gpuWeight = resolutionFactor <= 1.05 ? 0.72 : (resolutionFactor <= 1.45 ? 0.84 : 0.92);
    double cpuWeight = 1.0 - gpuWeight;
    double combinedRatio = (gpuRatio / resolutionFactor) * gpuWeight + cpuRatio * cpuWeight;

    double estVramNeeded = game.recVramGB * (resolutionFactor <= 1.05 ? 0.9 : (resolutionFactor <= 1.45 ? 1.15 : 1.45));
    double vramPenalty = specs.gpu.vramGB < estVramNeeded ? 0.78 : 1.0;

    int avg = std::max(15, static_cast<int>(std::round(baseTarget * combinedRatio * vramPenalty * modeMultiplier)));
    int low = std::max(12, static_cast<int>(std::round(avg * 0.85)));
    int high = std::max(18, static_cast<int>(std::round(avg * 1.12)));

    FpsEstimate est;
    est.avg = avg;
    est.low = low;
    est.high = high;
    est.range = std::to_string(low) + " - " + std::to_string(high) + " FPS";
    return est;
}

inline std::string selectPreferredUpscaler(const SystemSpecs& specs, const GameSpec& game) {
    auto hasUp = [&](const std::string& name) {
        for (const auto& u : game.upscalers) {
            if (toLower(u) == toLower(name)) return true;
        }
        return false;
    };
    if (specs.gpu.vendor == "nvidia" && hasUp("DLSS")) return "NVIDIA DLSS";
    if (hasUp("FSR")) return "AMD FSR";
    if (hasUp("XeSS")) return "Intel XeSS";
    return game.upscalers.empty() ? "Native" : game.upscalers.front();
}

inline GameAnalysis analyzeGame(const SystemSpecs& specs, const GameSpec& game, int mode = OPT_MODE_OPTIMAL) {
    GameAnalysis out;
    out.gameId = game.id;
    out.gameTitle = game.title;
    out.mode = std::clamp(mode, 0, 3);
    out.tuningTips = game.tuningTips;

    out.cpuStatus = evaluateComponentTier(specs.cpu.score, game.minCpuScore, game.recCpuScore);
    out.gpuStatus = evaluateComponentTier(specs.gpu.score, game.minGpuScore, game.recGpuScore);
    out.ramStatus = evaluateComponentTier(specs.ram.totalGB, game.minRamGB, game.recRamGB);
    out.vramStatus = evaluateComponentTier(specs.gpu.vramGB, game.minVramGB, game.recVramGB);
    out.storagePass = specs.storage.freeGB >= game.storageGB;
    out.storageStatus = out.storagePass ? "MEETS_RECOMMENDED" : "BELOW_MINIMUM";

    int minIdx = std::min({
        tierRankIndex(out.cpuStatus),
        tierRankIndex(out.gpuStatus),
        tierRankIndex(out.ramStatus),
        tierRankIndex(out.vramStatus)
    });
    const char* tiers[] = { "BELOW_MINIMUM", "MEETS_MINIMUM", "MEETS_RECOMMENDED", "EXCEEDS_RECOMMENDED" };
    out.overallTier = tiers[std::clamp(minIdx, 0, 3)];
    out.verdictBadge = tierToVerdictBadge(out.overallTier);
    out.canRunMinimum = minIdx >= 1;
    out.canRunRecommended = minIdx >= 2;

    out.cpuEval = { "CPU", out.cpuStatus, specs.cpu.name + " (" + std::to_string(specs.cpu.threads) + "T)", game.minCpu, game.recCpu, specs.cpu.score, game.minCpuScore, game.recCpuScore, tierRankIndex(out.cpuStatus) >= 1, tierRankIndex(out.cpuStatus) >= 2 };
    out.gpuEval = { "GPU", out.gpuStatus, specs.gpu.name + " (" + std::to_string(specs.gpu.vramGB) + " GB)", game.minGpu, game.recGpu, specs.gpu.score, game.minGpuScore, game.recGpuScore, tierRankIndex(out.gpuStatus) >= 1, tierRankIndex(out.gpuStatus) >= 2 };
    out.vramEval = { "VRAM", out.vramStatus, std::to_string(specs.gpu.vramGB) + " GB", std::to_string(game.minVramGB) + " GB", std::to_string(game.recVramGB) + " GB", specs.gpu.vramGB, game.minVramGB, game.recVramGB, tierRankIndex(out.vramStatus) >= 1, tierRankIndex(out.vramStatus) >= 2 };
    out.ramEval = { "RAM", out.ramStatus, std::to_string(specs.ram.totalGB) + " GB", std::to_string(game.minRamGB) + " GB", std::to_string(game.recRamGB) + " GB", specs.ram.totalGB, game.minRamGB, game.recRamGB, tierRankIndex(out.ramStatus) >= 1, tierRankIndex(out.ramStatus) >= 2 };
    out.storageEval = { "Storage", out.storageStatus, std::to_string(specs.storage.freeGB) + " GB Free (" + specs.storage.drive + ")", std::to_string(game.storageGB) + " GB", std::to_string(game.storageGB) + " GB", specs.storage.freeGB, game.storageGB, game.storageGB, out.storagePass, out.storagePass };

    // Bottleneck detection
    struct RatioItem { std::string comp; double ratio; std::string detail; };
    std::vector<RatioItem> ratios = {
        { "GPU Compute", static_cast<double>(specs.gpu.score) / std::max(1, game.recGpuScore), specs.gpu.name },
        { "GPU VRAM", static_cast<double>(specs.gpu.vramGB) / std::max(1, game.recVramGB), std::to_string(specs.gpu.vramGB) + " GB VRAM" },
        { "CPU", static_cast<double>(specs.cpu.score) / std::max(1, game.recCpuScore), specs.cpu.name },
        { "System RAM", static_cast<double>(specs.ram.totalGB) / std::max(1, game.recRamGB), std::to_string(specs.ram.totalGB) + " GB RAM" }
    };
    std::sort(ratios.begin(), ratios.end(), [](const RatioItem& a, const RatioItem& b) { return a.ratio < b.ratio; });

    out.primaryBottleneck = ratios.front().comp;
    out.limitingComponent = ratios.front().comp;
    if (ratios.front().ratio < 1.0) {
        out.bottleneckNote = "Your " + ratios.front().comp + " (" + ratios.front().detail + ") is the primary limiting factor against Recommended specs.";
    } else {
        out.bottleneckNote = "All components meet or exceed Recommended specs! At higher resolutions/settings, " + ratios.front().comp + " (" + ratios.front().detail + ") will be the first component fully utilized.";
    }

    const DisplaySpec& disp = specs.display;
    out.screenWidth = disp.width > 0 ? disp.width : 1920;
    out.screenHeight = disp.height > 0 ? disp.height : 1080;
    out.refreshRateHz = disp.refreshRateHz > 0 ? disp.refreshRateHz : 60;
    out.monitorName = disp.name.empty() ? "Primary Display" : disp.name;

    double gpuRatio = static_cast<double>(specs.gpu.score) / std::max(15, game.recGpuScore);
    double cpuRatio = static_cast<double>(specs.cpu.score) / std::max(15, game.recCpuScore);
    int vramGB = specs.gpu.vramGB;
    std::string upscalerName = selectPreferredUpscaler(specs, game);
    bool hasTemporalUpscaler = (upscalerName != "Native");
    bool supportsFG = (specs.gpu.upscaler.find("3") != std::string::npos || specs.gpu.upscaler.find("4") != std::string::npos) && vramGB >= 8;

    double screenResFactor = getResolutionFactorForPixels(out.screenWidth, out.screenHeight);
    int baselineScreenFps = computeFpsEstimate(specs, game, screenResFactor, 1.0).avg;
    int vrrCapTarget = out.refreshRateHz >= 100 ? out.refreshRateHz - 4 : out.refreshRateHz;
    bool isHighHzScreen = out.refreshRateHz >= 120;

    out.targetResolution = std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + " (" + disp.tier + " @ " + std::to_string(out.refreshRateHz) + "Hz)";
    double fpsMultiplier = 1.0;

    if (out.mode == OPT_MODE_FULL_FPS) {
        out.modeId = "full_fps";
        out.modeLabel = "Full FPS (Max Hz Competitive)";
        out.preset = (out.overallTier == "EXCEEDS_RECOMMENDED") ? "Medium / Competitive High" : "Low / Competitive";
        out.upscalingMode = hasTemporalUpscaler
            ? (baselineScreenFps < out.refreshRateHz * 0.75 ? (upscalerName + " - Performance") : (upscalerName + " - Balanced"))
            : "85% Render Scale";
        out.textures = vramGB >= 8 ? "High (Zero FPS Cost)" : (vramGB >= 6 ? "Medium" : "Low");
        out.shadows = "Low";
        out.rayTracing = "Off (Disabled for Max FPS & Lowest Latency)";
        out.frameGen = (supportsFG && isHighHzScreen && baselineScreenFps >= 55)
            ? ("On (Target " + std::to_string(out.refreshRateHz) + "Hz Saturation)")
            : "Off (Lowest Input Latency)";
        fpsMultiplier = (out.frameGen.rfind("On", 0) == 0) ? 1.52 : 1.34;
        out.qualityScore = 64;
        out.targetFpsWindow = std::to_string(std::min(out.refreshRateHz, std::max(90, out.refreshRateHz - 10))) + "+ FPS (Max " + std::to_string(out.refreshRateHz) + "Hz)";
        out.fpsCapAdvice = isHighHzScreen
            ? ("Cap at " + std::to_string(out.refreshRateHz - 3) + " FPS + " + (specs.gpu.vendor == "nvidia" ? "NVIDIA Reflex (+Boost)" : "AMD Anti-Lag 2") + " to saturate " + std::to_string(out.refreshRateHz) + "Hz VRR")
            : ("Uncapped or " + std::to_string(out.refreshRateHz * 2) + " FPS cap for minimum frame delivery latency");
        out.summary = "Tuned for maximum framerate and lowest input latency on " + out.monitorName + " (" + std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + " @ " + std::to_string(out.refreshRateHz) + "Hz).";
    } else if (out.mode == OPT_MODE_BALANCED) {
        out.modeId = "balanced";
        out.modeLabel = "Balanced (FPS & Quality)";
        out.preset = (out.overallTier == "BELOW_MINIMUM") ? "Low / Medium" : (out.overallTier == "MEETS_MINIMUM" ? "Medium" : "High");
        out.upscalingMode = hasTemporalUpscaler ? (upscalerName + " - Quality") : "Off (Native 100%)";
        out.textures = vramGB >= 10 ? "Ultra" : (vramGB >= 8 ? "High" : "Medium");
        out.shadows = (out.overallTier == "BELOW_MINIMUM") ? "Low" : "Medium";
        out.rayTracing = "Off (Rasterized High Lighting)";
        out.frameGen = (supportsFG && isHighHzScreen) ? "Optional (Enable for 100+ FPS smoothness)" : "Off";
        fpsMultiplier = hasTemporalUpscaler ? 1.15 : 1.06;
        out.qualityScore = 82;
        out.targetFpsWindow = isHighHzScreen ? "75 - 120 FPS" : "60 - 75 FPS";
        out.fpsCapAdvice = "Lock at " + std::to_string(std::min(vrrCapTarget, 120)) + " FPS with VRR enabled for consistent frame times";
        out.summary = "Balanced sweet-spot between crisp High visuals and smooth " + out.targetFpsWindow + " gameplay at " + std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + ".";
    } else if (out.mode == OPT_MODE_QUALITY) {
        out.modeId = "quality_30_60";
        out.modeLabel = "Quality (30-60 FPS Cinematic)";
        if (out.overallTier == "BELOW_MINIMUM") {
            out.preset = "Medium (Cinematic Floor)";
            out.upscalingMode = hasTemporalUpscaler ? (upscalerName + " - Quality") : "90% Render Scale";
            out.textures = vramGB >= 6 ? "Medium" : "Low";
            out.shadows = "Medium";
            out.rayTracing = "Off";
            fpsMultiplier = 0.92;
            out.qualityScore = 76;
        } else if (out.overallTier == "MEETS_MINIMUM") {
            out.preset = "High";
            out.upscalingMode = hasTemporalUpscaler ? (upscalerName + " - Quality") : "Off (Native 100%)";
            out.textures = vramGB >= 8 ? "High" : "Medium";
            out.shadows = "High";
            out.rayTracing = "Off";
            fpsMultiplier = 0.88;
            out.qualityScore = 86;
        } else {
            out.preset = "Ultra";
            bool needsQualityUpscale = (baselineScreenFps * 0.78 < 38.0) && hasTemporalUpscaler;
            out.upscalingMode = needsQualityUpscale
                ? (upscalerName + " - Quality")
                : (hasTemporalUpscaler ? ("Off (Native " + disp.tier + ") / " + upscalerName + " Native AA") : ("Off (Native " + disp.tier + ")"));
            out.textures = vramGB >= 10 ? "Ultra" : "High (Safe for 8GB VRAM)";
            out.shadows = "Ultra";
            out.rayTracing = (game.supportsRT && specs.gpu.rtCapable && vramGB >= 8 && baselineScreenFps >= 55)
                ? (vramGB >= 12 ? "High (Ray-Traced GI & Reflections)" : "Medium (RT Reflections)")
                : "Off";
            fpsMultiplier = (out.rayTracing != "Off") ? 0.72 : (needsQualityUpscale ? 0.90 : 0.82);
            out.qualityScore = (out.rayTracing != "Off") ? 98 : 94;
        }
        out.frameGen = "Off (Native Cinematic Frame Pacing)";
        out.targetFpsWindow = "30 - 60 FPS (Cinematic Fidelity)";
        out.fpsCapAdvice = (baselineScreenFps * fpsMultiplier >= 58.0)
            ? "Lock at 60 FPS (16.6ms frame-time) for rock-steady cinematic presentation"
            : "Lock at 40 FPS (on 120Hz+ VRR screen) or 30/45 FPS for zero frame-time judder";
        out.summary = "Maximizes Ultra/High visual fidelity at " + std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + " while maintaining a stable 30-60 FPS cinematic target.";
    } else {
        out.modeId = "optimal";
        out.modeLabel = "Optimal (Rig + Screen Balance)";
        if (out.overallTier == "BELOW_MINIMUM") {
            out.targetResolution = std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + " (or 1280x720)";
            out.preset = "Low";
            out.upscalingMode = hasTemporalUpscaler ? (upscalerName + " - Performance") : "75% Render Scale";
            out.textures = vramGB >= 6 ? "Medium" : "Low";
            out.shadows = "Low";
            out.rayTracing = "Off";
            out.frameGen = "Off";
            fpsMultiplier = 1.25;
            out.qualityScore = 60;
        } else if (out.overallTier == "MEETS_MINIMUM") {
            out.preset = "Medium";
            out.upscalingMode = hasTemporalUpscaler ? (upscalerName + " - Quality") : "Off (Native)";
            out.textures = vramGB >= 8 ? "High" : "Medium";
            out.shadows = "Medium";
            out.rayTracing = "Off";
            out.frameGen = "Off";
            fpsMultiplier = 1.12;
            out.qualityScore = 75;
        } else if (out.overallTier == "MEETS_RECOMMENDED") {
            out.preset = "High";
            out.upscalingMode = ((gpuRatio >= 1.15 && !isHighHzScreen) || !hasTemporalUpscaler) ? "Off (Native 100%)" : (upscalerName + " - Quality");
            out.textures = vramGB >= 8 ? "High" : "Medium";
            out.shadows = (isHighHzScreen && baselineScreenFps < 90) ? "Medium / High" : "High";
            out.rayTracing = "Off";
            out.frameGen = (supportsFG && isHighHzScreen) ? ("Optional (Enable for " + std::to_string(out.refreshRateHz) + "Hz monitor)") : "Off";
            fpsMultiplier = (out.upscalingMode.find("Quality") != std::string::npos) ? 1.12 : 1.0;
            out.qualityScore = 85;
        } else {
            if (gpuRatio >= 1.45 && vramGB >= 12) {
                out.preset = "Ultra";
                out.upscalingMode = (hasTemporalUpscaler && (isHighHzScreen || disp.tier != "1080p")) ? (upscalerName + " - Quality") : "Off (Native)";
                out.textures = "Ultra";
                out.shadows = "High / Ultra";
                out.rayTracing = (game.supportsRT && specs.gpu.rtCapable && !isHighHzScreen) ? "Medium / High" : "Off";
                out.frameGen = (supportsFG && isHighHzScreen) ? ("On (for 100-" + std::to_string(out.refreshRateHz) + " FPS smoothness)") : "Off";
                fpsMultiplier = 1.05;
                out.qualityScore = 93;
            } else {
                out.preset = "High / Ultra Custom";
                out.upscalingMode = (gpuRatio >= 1.25 && !isHighHzScreen) ? "Off (Native) at 1080p / Quality at 1440p" : (upscalerName + " - Quality");
                out.textures = vramGB >= 10 ? "Ultra" : "High (Safe for 8GB VRAM)";
                out.shadows = "High";
                out.rayTracing = (game.supportsRT && specs.gpu.rtCapable && gpuRatio >= 1.5 && !isHighHzScreen) ? "Low / Medium" : "Off (Recommended for max FPS)";
                if (supportsFG && isHighHzScreen) {
                    out.frameGen = "On (for 100-" + std::to_string(out.refreshRateHz) + " FPS smoothness)";
                    fpsMultiplier = 1.22;
                } else {
                    out.frameGen = "Off";
                    fpsMultiplier = 1.08;
                }
                out.qualityScore = 88;
            }
        }
        out.targetFpsWindow = isHighHzScreen ? ("80 - " + std::to_string(out.refreshRateHz) + " FPS") : "60+ FPS";
        out.fpsCapAdvice = isHighHzScreen
            ? ("Enable VRR (FreeSync/G-Sync) + cap at " + std::to_string(vrrCapTarget) + " FPS on " + out.monitorName + " (" + std::to_string(out.refreshRateHz) + "Hz)")
            : ("Lock at " + std::to_string(out.refreshRateHz) + " FPS or enable VRR for tear-free pacing");
        out.summary = "Auto-tuned for " + specs.gpu.name + " (" + std::to_string(vramGB) + "GB) paired with your " + out.monitorName + " (" + std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + " @ " + std::to_string(out.refreshRateHz) + "Hz).";
    }

    out.fps1080p = computeFpsEstimate(specs, game, 1.0, fpsMultiplier);
    out.fps1440p = computeFpsEstimate(specs, game, 1.35, fpsMultiplier);
    out.fps4k    = computeFpsEstimate(specs, game, 2.05, fpsMultiplier);
    out.estimatedScreenFps = computeFpsEstimate(specs, game, screenResFactor, fpsMultiplier);
    out.screenFpsAvg = out.estimatedScreenFps.avg;

    out.refreshSaturationPct = std::min(100, std::max(10, static_cast<int>(std::round((static_cast<double>(out.estimatedScreenFps.avg) / out.refreshRateHz) * 100.0))));
    out.syncAdvice = out.refreshRateHz >= 100
        ? ("Enable FreeSync / G-Sync VRR + " + std::string(specs.gpu.vendor == "nvidia" ? "NVIDIA Reflex" : "AMD Anti-Lag 2") + " and cap FPS at " + std::to_string(out.refreshRateHz - 4) + " FPS.")
        : ("Use VRR or a " + std::to_string(out.refreshRateHz) + " FPS cap for tear-free frame pacing.");

    // Build 8-Setting FPS/VRAM Impact Breakdown
    int vramHeadroomGB = specs.gpu.vramGB - game.recVramGB;
    int shadowFpsGain = (out.mode == OPT_MODE_FULL_FPS) ? 24 : (gpuRatio < 0.85 ? 22 : (gpuRatio < 1.15 ? 16 : 11));
    int shadowVramMB = (out.shadows.find("Low") != std::string::npos) ? 520 : ((out.shadows.find("Medium") != std::string::npos) ? 380 : 240);

    std::string fogVal = (out.mode == OPT_MODE_FULL_FPS) ? "Low" : ((out.mode == OPT_MODE_QUALITY) ? "High / Ultra" : (gpuRatio >= 1.35 ? "High" : (gpuRatio >= 0.9 ? "Medium / High" : "Low / Medium")));
    int fogFpsGain = (out.mode == OPT_MODE_FULL_FPS) ? 21 : (gpuRatio < 0.9 ? 19 : (gpuRatio < 1.2 ? 15 : 10));

    int rtFpsGain = (!game.supportsRT) ? 0 : (!specs.gpu.rtCapable ? 38 : (out.mode == OPT_MODE_QUALITY ? 22 : 34));
    int rtVramMB  = (!game.supportsRT) ? 0 : 1150;
    std::string rtNote = (!game.supportsRT)
        ? (game.title + " uses rasterized lighting only; zero Ray Tracing overhead.")
        : ("Disabling or tuning RT on " + specs.gpu.name + " saves ~1.1 GB VRAM and boosts FPS by +" + std::to_string(rtFpsGain) + "%.");

    int upFpsGain = (out.upscalingMode.find("Performance") != std::string::npos) ? 38 : ((out.upscalingMode.find("Balanced") != std::string::npos) ? 29 : 22);
    std::string aoVal = (out.mode == OPT_MODE_FULL_FPS) ? "Low / Off" : ((out.mode == OPT_MODE_QUALITY) ? "HBAO+ Ultra" : "HBAO+ / High");
    int aoFpsGain = (out.mode == OPT_MODE_FULL_FPS) ? 12 : 8;

    int texFpsGain = vramHeadroomGB < 0 ? 18 : 3;
    int texVramMB = vramGB >= 12 ? 1600 : (vramGB >= 8 ? 1050 : 650);

    std::string crowdVal = (out.mode == OPT_MODE_FULL_FPS) ? "Low / Medium" : ((out.mode == OPT_MODE_QUALITY) ? "High / Ultra" : (cpuRatio >= 1.1 ? "High" : "Medium"));
    int crowdFpsGain = (out.mode == OPT_MODE_FULL_FPS) ? 18 : (cpuRatio < 0.95 ? 16 : 11);

    int fgFpsGain = (supportsFG && vramGB >= 8 && out.mode != OPT_MODE_QUALITY) ? 42 : 0;

    out.settingImpacts = {
        { "Shadow Quality", out.shadows, shadowFpsGain, shadowVramMB, "Low", "Dropping Cascade Shadows from Ultra to " + out.shadows + " saves ~" + std::to_string(shadowFpsGain) + "% GPU time." },
        { "Volumetric Fog / Clouds", fogVal, fogFpsGain, 220, "Minimal", "Volumetric ray-marching is shader-heavy; " + fogVal + " gains +" + std::to_string(fogFpsGain) + "% FPS." },
        { "Ray Tracing", out.rayTracing, rtFpsGain, rtVramMB, game.supportsRT ? "Moderate" : "None", rtNote },
        { "Upscaling (FSR/DLSS)", out.upscalingMode, upFpsGain, 420, "Minimal", upscalerName + " (" + out.upscalingMode + ") reduces shader load at " + std::to_string(out.screenWidth) + "x" + std::to_string(out.screenHeight) + "." },
        { "Ambient Occlusion", aoVal, aoFpsGain, 160, "Low", aoVal + " balances contact shading depth and post-process cost." },
        { "Texture Quality", out.textures, texFpsGain, texVramMB, vramHeadroomGB < 0 ? "Prevents Stutter" : "None (VRAM Bound)", "Configured for " + std::to_string(vramGB) + " GB VRAM pool (" + std::to_string(game.recVramGB) + " GB recommended)." },
        { "Crowd / Foliage Density", crowdVal, crowdFpsGain, 210, "Low", "Tuned to " + crowdVal + " for " + specs.cpu.name + " (" + std::to_string(specs.cpu.threads) + " threads)." },
        { "Frame Generation", out.frameGen, fgFpsGain, 360, "Minimal", supportsFG ? (specs.gpu.name + " supports " + specs.gpu.upscaler + " Frame Generation.") : "Use VRR / G-Sync / FreeSync pacing for lowest input latency." }
    };
    out.perSettingImpact = out.settingImpacts;

    return out;
}

inline std::string exportConfigIni(const SystemSpecs& specs, const GameSpec& game, const GameAnalysis& analysis) {
    std::ostringstream oss;
    oss << "; ============================================================================\n"
        << "; " << APP_NAME << " (CalVer " << FULL_VERSION << ") — Screen-Aware Optimal Graphics Profile (.INI)\n"
        << "; Game: " << game.title << " (" << game.engine << ")\n"
        << "; Optimization Mode: " << analysis.modeLabel << "\n"
        << "; Generated For: " << specs.cpu.name << " | " << specs.gpu.name << " (" << specs.gpu.vramGB << " GB VRAM) | " << specs.ram.totalGB << " GB RAM\n"
        << "; Target Display: " << analysis.monitorName << " (" << analysis.screenWidth << "x" << analysis.screenHeight << " @ " << analysis.refreshRateHz << "Hz)\n"
        << "; Compatibility Verdict: " << analysis.overallTier << " (" << analysis.verdictBadge << ")\n"
        << "; Estimated Screen FPS: " << analysis.estimatedScreenFps.avg << " FPS avg (" << analysis.estimatedScreenFps.range << ")\n"
        << "; ============================================================================\n\n"
        << "[Display]\n"
        << "FullscreenMode=WindowedFullscreen\n"
        << "ResolutionSizeX=" << analysis.screenWidth << "\n"
        << "ResolutionSizeY=" << analysis.screenHeight << "\n"
        << "RefreshRateHz=" << analysis.refreshRateHz << "\n"
        << "MonitorModel=\"" << analysis.monitorName << "\"\n"
        << "TargetResolution=\"" << analysis.targetResolution << "\"\n"
        << "OptimizationMode=\"" << analysis.modeId << "\"\n"
        << "OverallPreset=\"" << analysis.preset << "\"\n"
        << "FrameRateCapAdvice=\"" << analysis.fpsCapAdvice << "\"\n"
        << "SyncAdvice=\"" << analysis.syncAdvice << "\"\n"
        << "VSync=False\n"
        << "VariableRefreshRate=" << (analysis.refreshRateHz >= 75 ? "True" : "False") << "\n\n"
        << "[Graphics.OptimalSettings]\n"
        << "Preset=\"" << analysis.preset << "\"\n"
        << "UpscalingMode=\"" << analysis.upscalingMode << "\"\n"
        << "TextureQuality=\"" << analysis.textures << "\"\n"
        << "ShadowQuality=\"" << analysis.shadows << "\"\n"
        << "RayTracing=\"" << analysis.rayTracing << "\"\n"
        << "FrameGeneration=\"" << analysis.frameGen << "\"\n\n"
        << "[ScalabilityGroups]\n"
        << "sg.ResolutionQuality=" << (analysis.upscalingMode.find("Performance") != std::string::npos ? 58 : (analysis.upscalingMode.find("Balanced") != std::string::npos ? 62 : (analysis.upscalingMode.find("Quality") != std::string::npos ? 67 : 100))) << "\n"
        << "sg.ShadowQuality=" << (analysis.shadows.find("Ultra") != std::string::npos ? 3 : (analysis.shadows.find("High") != std::string::npos ? 2 : (analysis.shadows.find("Medium") != std::string::npos ? 1 : 0))) << "\n"
        << "sg.TextureQuality=" << (analysis.textures.find("Ultra") != std::string::npos ? 3 : (analysis.textures.find("High") != std::string::npos ? 2 : 1)) << "\n"
        << "r.Streaming.PoolSize=" << std::max(2048, static_cast<int>(specs.gpu.vramGB * 1024 * 0.72)) << "\n";
    return oss.str();
}

inline std::string exportConfigIni(const SystemSpecs& specs, const GameSpec& game, int mode = OPT_MODE_OPTIMAL) {
    return exportConfigIni(specs, game, analyzeGame(specs, game, mode));
}

struct DriverSettingRec {
    std::string setting;
    std::string recommendedValue;
    std::string reason;
};

struct DriverAdvisorResult {
    std::string suiteName;
    std::string suiteStatus = "DRIVER_ONLY";
    std::string summary;
    std::vector<DriverSettingRec> settings;
    std::string storageAdvice;
};

inline DriverAdvisorResult getDriverAppRecommendations(const SystemSpecs& specs, const GameSpec& game, int mode = OPT_MODE_OPTIMAL) {
    DriverAdvisorResult res;
    int clampedMode = std::max(0, std::min(3, mode));

    std::string gpuVendor = toLower(specs.gpu.vendor);
    std::string gpuLow = toLower(specs.gpu.name);
    std::string cpuLow = toLower(specs.cpu.name);
    if (gpuVendor.empty() || gpuVendor == "unknown") {
        if (gpuLow.find("nvidia") != std::string::npos || gpuLow.find("geforce") != std::string::npos || gpuLow.find("rtx") != std::string::npos || gpuLow.find("gtx") != std::string::npos) gpuVendor = "nvidia";
        else if (gpuLow.find("amd") != std::string::npos || gpuLow.find("radeon") != std::string::npos || gpuLow.find("rx ") != std::string::npos) gpuVendor = "amd";
        else if (gpuLow.find("intel") != std::string::npos || gpuLow.find("arc") != std::string::npos) gpuVendor = "intel";
    }

    auto suites = specs.driverSuites.empty() ? detectDriverSuites(specs) : specs.driverSuites;
    auto findSuiteStatus = [&](const std::string& id) -> std::string {
        for (const auto& s : suites) {
            if (s.id == id && s.detected) return s.installStatus;
        }
        return "DRIVER_ONLY";
    };

    int hz = specs.display.refreshRateHz > 0 ? specs.display.refreshRateHz : 60;
    int capHz = std::max(30, hz - 3);
    bool vrr = specs.display.vrrCapable;

    std::string titleLow = toLower(game.title);
    std::string genreLow = toLower(game.genre);
    bool isCompetitive = (genreLow.find("shooter") != std::string::npos || genreLow.find("fps") != std::string::npos ||
                          genreLow.find("tactical") != std::string::npos || genreLow.find("esports") != std::string::npos ||
                          genreLow.find("battle royale") != std::string::npos || titleLow.find("counter-strike") != std::string::npos ||
                          titleLow.find("cs2") != std::string::npos || titleLow.find("valorant") != std::string::npos ||
                          titleLow.find("apex") != std::string::npos || titleLow.find("warzone") != std::string::npos ||
                          titleLow.find("overwatch") != std::string::npos || titleLow.find("fortnite") != std::string::npos);

    if (gpuVendor == "amd") {
        res.suiteName = "AMD Software: Adrenalin Edition";
        res.suiteStatus = findSuiteStatus("amd_adrenalin");
        res.summary = "Tuned for " + specs.gpu.name + " on " + std::to_string(hz) + "Hz" + (vrr ? " VRR/FreeSync" : " Fixed-Hz") + " display.";

        res.settings.push_back({
            "Radeon Anti-Lag / Anti-Lag 2",
            (clampedMode == OPT_MODE_QUALITY) ? "Enabled (Anti-Lag)" : "Enabled (Anti-Lag 2 if supported)",
            "Cuts input-to-photon latency with zero FPS penalty."
        });

        std::string chillVal = "Off";
        std::string chillReason = "Uncapped FPS for minimum input latency in Full FPS mode.";
        if (clampedMode == OPT_MODE_QUALITY) {
            chillVal = "Min: 30 / Max: " + std::to_string(std::min(60, capHz)) + " FPS";
            chillReason = "Locks frame pacing to cinematic 30-60 FPS envelope.";
        } else if (clampedMode == OPT_MODE_OPTIMAL || clampedMode == OPT_MODE_BALANCED) {
            chillVal = vrr
                ? ("Min: 48 / Max: " + std::to_string(capHz) + " FPS")
                : ("Min: 60 / Max: " + std::to_string(hz) + " FPS");
            chillReason = vrr
                ? ("Caps 3 FPS below " + std::to_string(hz) + "Hz to stay inside FreeSync VRR window.")
                : ("Matches " + std::to_string(hz) + "Hz refresh rate to reduce power & heat.");
        }
        res.settings.push_back({ "Radeon Chill", chillVal, chillReason });

        res.settings.push_back({
            "AMD FreeSync / VRR",
            vrr ? "Enabled (AMD FreeSync)" : "Off (No VRR Display)",
            vrr ? "Eliminates tearing without V-Sync input lag." : "Display reported fixed refresh rate."
        });

        bool allowAfmf = !isCompetitive && clampedMode != OPT_MODE_FULL_FPS;
        res.settings.push_back({
            "AMD Fluid Motion Frames 2 (AFMF 2)",
            allowAfmf ? "Auto (Enable if base FPS < 60)" : "Off",
            allowAfmf ? "Boosts perceived smoothness on demanding AAA titles." : "Disabled to preserve raw responsiveness in fast/competitive play."
        });

        res.settings.push_back({
            "Radeon Image Sharpening (RIS)",
            (clampedMode == OPT_MODE_FULL_FPS || clampedMode == OPT_MODE_BALANCED) ? "Enabled (70-80%)" : "Enabled (50%)",
            "Restores texture crispness when FSR upscaling is active (<1% cost)."
        });

        res.settings.push_back({
            "Texture Filtering Quality",
            (clampedMode == OPT_MODE_FULL_FPS) ? "Performance" : ((clampedMode == OPT_MODE_QUALITY) ? "High" : "Standard"),
            "Balances anisotropic sharpness vs. shader bandwidth."
        });

        res.settings.push_back({
            "Wait for Vertical Refresh",
            "Always Off",
            "Prevents driver-level V-Sync latency; rely on FreeSync + Chill cap."
        });

        bool hasRyzen5k7k = (cpuLow.find("ryzen") != std::string::npos &&
            (cpuLow.find("5500") != std::string::npos || cpuLow.find("5600") != std::string::npos ||
             cpuLow.find("5700") != std::string::npos || cpuLow.find("5800") != std::string::npos ||
             cpuLow.find("5900") != std::string::npos || cpuLow.find("5950") != std::string::npos ||
             cpuLow.find("7500") != std::string::npos || cpuLow.find("7600") != std::string::npos ||
             cpuLow.find("7700") != std::string::npos || cpuLow.find("7800") != std::string::npos ||
             cpuLow.find("7900") != std::string::npos || cpuLow.find("7950") != std::string::npos ||
             cpuLow.find("9600") != std::string::npos || cpuLow.find("9700") != std::string::npos ||
             cpuLow.find("9800") != std::string::npos));
        bool hasRx6k7k = (gpuLow.find("rx 6") != std::string::npos || gpuLow.find("rx 7") != std::string::npos || gpuLow.find("rx 9") != std::string::npos);
        res.settings.push_back({
            "AMD Smart Access Memory (SAM)",
            (hasRyzen5k7k && hasRx6k7k) ? "Enabled (Verify Above 4G + ReBAR in BIOS)" : "Check BIOS ReBAR Support",
            (hasRyzen5k7k && hasRx6k7k) ? "Ryzen + RX 6000/7000 pairing gains 5-15% FPS via full VRAM BAR." : "Enable Resizable BAR in BIOS if supported."
        });
    } else if (gpuVendor == "nvidia") {
        res.suiteName = "NVIDIA App / Control Panel";
        res.suiteStatus = findSuiteStatus("nvidia_app");
        res.summary = "Tuned for " + specs.gpu.name + " on " + std::to_string(hz) + "Hz" + (vrr ? " G-Sync/VRR" : " Fixed-Hz") + " display.";

        res.settings.push_back({
            "Low Latency Mode / NVIDIA Reflex",
            (clampedMode == OPT_MODE_FULL_FPS || isCompetitive) ? "Ultra (or Reflex On + Boost)" : "On (or Reflex On)",
            "Minimizes render queue depth and mouse-to-display latency."
        });

        std::string capVal = "Off (Uncapped)";
        if (clampedMode == OPT_MODE_QUALITY) capVal = "60 FPS";
        else if (clampedMode == OPT_MODE_OPTIMAL || clampedMode == OPT_MODE_BALANCED) {
            capVal = vrr ? (std::to_string(capHz) + " FPS (Hz - 3)") : (std::to_string(hz) + " FPS");
        }
        res.settings.push_back({
            "Max Frame Rate",
            capVal,
            vrr ? ("Keeps frame rate inside G-Sync range below " + std::to_string(hz) + "Hz.") : "Aligns frame pacing with monitor refresh rate."
        });

        res.settings.push_back({
            "Power Management Mode",
            "Prefer Maximum Performance",
            "Prevents GPU boost clock downclocking during light scenes (per-game profile)."
        });

        res.settings.push_back({
            "Texture Filtering - Quality",
            (clampedMode == OPT_MODE_FULL_FPS) ? "High Performance" : ((clampedMode == OPT_MODE_QUALITY) ? "High Quality" : "Quality"),
            "Optimizes shader filtering overhead without visible shimmer."
        });

        res.settings.push_back({
            "Vertical Sync (NVCP)",
            (vrr && clampedMode != OPT_MODE_FULL_FPS) ? "On (Paired with G-Sync + Cap)" : "Off",
            vrr ? "NVCP V-Sync + G-Sync + Hz-3 cap eliminates tearing with zero V-Sync lag." : "Avoids double-buffer V-Sync latency."
        });

        res.settings.push_back({
            "Shader Cache Size",
            "10 GB",
            "Prevents shader compilation stutter in DX12 / Unreal Engine 5 games."
        });

        res.settings.push_back({
            "G-Sync / VRR",
            vrr ? "Enabled (Fullscreen & Windowed)" : "Off (No VRR Display)",
            vrr ? "Dynamic refresh synchronization for tear-free pacing." : "Display reported fixed refresh rate."
        });
    } else {
        res.suiteName = "Intel Arc Control / Graphics Software";
        res.suiteStatus = findSuiteStatus("intel_arc");
        res.summary = "Tuned for " + specs.gpu.name + " on " + std::to_string(hz) + "Hz" + (vrr ? " Adaptive Sync" : " Fixed-Hz") + " display.";

        res.settings.push_back({
            "Resizable BAR",
            "Enabled (Mandatory for Arc)",
            "Intel Arc requires BIOS ReBAR + Above 4G Decoding for full performance."
        });
        res.settings.push_back({
            "Low Latency Mode",
            (clampedMode == OPT_MODE_FULL_FPS || isCompetitive) ? "On + Boost" : "On",
            "Reduces CPU-to-GPU frame queue latency."
        });
        res.settings.push_back({
            "Adaptive Sync / VRR",
            vrr ? ("Enabled (Cap " + std::to_string(capHz) + " FPS)") : "Off (Fixed Refresh)",
            vrr ? "Synchronizes display refresh to frame output." : "Fixed refresh display detected."
        });
        res.settings.push_back({
            "Texture Filtering",
            (clampedMode == OPT_MODE_FULL_FPS) ? "Performance" : "Quality",
            "Balances anisotropic clarity and memory bandwidth."
        });
        res.settings.push_back({
            "Smooth Sync",
            (clampedMode == OPT_MODE_FULL_FPS) ? "Off" : "On (if tearing occurs)",
            "Reduces visible tearing on non-VRR monitors without full V-Sync stall."
        });
    }

    // Storage / Drive Placement Advice
    const auto& drives = !specs.storage.drives.empty() ? specs.storage.drives : specs.storage.allDrives;
    if (drives.empty()) {
        res.storageAdvice = "Primary drive " + specs.storage.drive + " has " + std::to_string(specs.storage.freeGB) +
                            " GB free (" + std::to_string(game.storageGB) + " GB required).";
    } else {
        const DriveSpec* bestFit = nullptr;
        const DriveSpec* largest = &drives[0];
        for (const auto& d : drives) {
            if (d.freeGB > largest->freeGB) largest = &d;
            if (d.freeGB >= game.storageGB) {
                if (!bestFit) {
                    bestFit = &d;
                } else {
                    bool curIsOs = (d.drive == "C:" || d.drive == "/");
                    bool bestIsOs = (bestFit->drive == "C:" || bestFit->drive == "/");
                    if ((bestIsOs && !curIsOs) || (curIsOs == bestIsOs && d.freeGB > bestFit->freeGB)) {
                        bestFit = &d;
                    }
                }
            }
        }
        if (bestFit) {
            res.storageAdvice = "Install on " + bestFit->drive + " (" + bestFit->label + ") — " +
                                std::to_string(bestFit->freeGB) + " GB free >= " + std::to_string(game.storageGB) +
                                " GB required" + (game.ssdRequired ? " (SSD recommended)." : ".");
        } else {
            res.storageAdvice = "Warning: Need " + std::to_string(game.storageGB) + " GB free; largest drive " +
                                largest->drive + " only has " + std::to_string(largest->freeGB) + " GB free.";
        }
    }

    return res;
}

inline std::string exportConfigJson(const SystemSpecs& specs, const GameSpec& game, const GameAnalysis& analysis) {
    std::ostringstream oss;
    oss << "{\n"
        << "  \"appName\": \"" << escapeJson(APP_NAME) << "\",\n"
        << "  \"calver\": \"" << escapeJson(CALVER) << "\",\n"
        << "  \"fullVersion\": \"" << escapeJson(FULL_VERSION) << "\",\n"
        << "  \"optimizationMode\": \"" << escapeJson(analysis.modeId) << "\",\n"
        << "  \"optimizationModeLabel\": \"" << escapeJson(analysis.modeLabel) << "\",\n"
        << "  \"game\": {\n"
        << "    \"id\": \"" << escapeJson(game.id) << "\",\n"
        << "    \"title\": \"" << escapeJson(game.title) << "\",\n"
        << "    \"genre\": \"" << escapeJson(game.genre) << "\",\n"
        << "    \"engine\": \"" << escapeJson(game.engine) << "\",\n"
        << "    \"steamAppId\": \"" << escapeJson(game.steamAppId) << "\",\n"
        << "    \"playStatus\": \"" << escapeJson(game.playStatus) << "\"\n"
        << "  },\n"
        << "  \"hardwareProfile\": {\n"
        << "    \"cpu\": \"" << escapeJson(specs.cpu.name) << "\",\n"
        << "    \"cpuScore\": " << specs.cpu.score << ",\n"
        << "    \"gpu\": \"" << escapeJson(specs.gpu.name) << "\",\n"
        << "    \"vramGB\": " << specs.gpu.vramGB << ",\n"
        << "    \"gpuScore\": " << specs.gpu.score << ",\n"
        << "    \"ramGB\": " << specs.ram.totalGB << ",\n"
        << "    \"display\": \"" << escapeJson(analysis.monitorName) << " (" << analysis.screenWidth << "x" << analysis.screenHeight << " @ " << analysis.refreshRateHz << "Hz)\"\n"
        << "  },\n"
        << "  \"compatibility\": {\n"
        << "    \"overallTier\": \"" << escapeJson(analysis.overallTier) << "\",\n"
        << "    \"verdictBadge\": \"" << escapeJson(analysis.verdictBadge) << "\",\n"
        << "    \"primaryBottleneck\": \"" << escapeJson(analysis.primaryBottleneck) << "\",\n"
        << "    \"bottleneckNote\": \"" << escapeJson(analysis.bottleneckNote) << "\"\n"
        << "  },\n"
        << "  \"performance\": {\n"
        << "    \"estimatedScreenFps\": " << analysis.estimatedScreenFps.avg << ",\n"
        << "    \"screenFpsRange\": \"" << escapeJson(analysis.estimatedScreenFps.range) << "\",\n"
        << "    \"refreshSaturationPct\": " << analysis.refreshSaturationPct << ",\n"
        << "    \"fps1080p\": " << analysis.fps1080p.avg << ",\n"
        << "    \"fps1440p\": " << analysis.fps1440p.avg << ",\n"
        << "    \"fps4k\": " << analysis.fps4k.avg << ",\n"
        << "    \"syncAdvice\": \"" << escapeJson(analysis.syncAdvice) << "\"\n"
        << "  },\n"
        << "  \"recommendedSettings\": {\n"
        << "    \"targetResolution\": \"" << escapeJson(analysis.targetResolution) << "\",\n"
        << "    \"preset\": \"" << escapeJson(analysis.preset) << "\",\n"
        << "    \"upscalingMode\": \"" << escapeJson(analysis.upscalingMode) << "\",\n"
        << "    \"textures\": \"" << escapeJson(analysis.textures) << "\",\n"
        << "    \"shadows\": \"" << escapeJson(analysis.shadows) << "\",\n"
        << "    \"rayTracing\": \"" << escapeJson(analysis.rayTracing) << "\",\n"
        << "    \"frameGen\": \"" << escapeJson(analysis.frameGen) << "\"\n"
        << "  },\n";

    auto suites = specs.driverSuites.empty() ? detectDriverSuites(specs) : specs.driverSuites;
    DriverAdvisorResult drv = getDriverAppRecommendations(specs, game, analysis.mode);
    oss << "  \"driverSuites\": [\n";
    for (size_t i = 0; i < suites.size(); ++i) {
        const auto& ds = suites[i];
        oss << "    {\"id\":\"" << escapeJson(ds.id) << "\",\"name\":\"" << escapeJson(ds.name)
            << "\",\"detected\":" << (ds.detected ? "true" : "false")
            << ",\"installStatus\":\"" << escapeJson(ds.installStatus)
            << "\",\"version\":\"" << escapeJson(ds.version) << "\"}"
            << (i + 1 < suites.size() ? "," : "") << "\n";
    }
    oss << "  ],\n"
        << "  \"driverAdvisor\": {\n"
        << "    \"suiteName\": \"" << escapeJson(drv.suiteName) << "\",\n"
        << "    \"suiteStatus\": \"" << escapeJson(drv.suiteStatus) << "\",\n"
        << "    \"summary\": \"" << escapeJson(drv.summary) << "\",\n"
        << "    \"storageAdvice\": \"" << escapeJson(drv.storageAdvice) << "\",\n"
        << "    \"settings\": [\n";
    for (size_t i = 0; i < drv.settings.size(); ++i) {
        const auto& rec = drv.settings[i];
        oss << "      {\"setting\":\"" << escapeJson(rec.setting)
            << "\",\"recommendedValue\":\"" << escapeJson(rec.recommendedValue)
            << "\",\"reason\":\"" << escapeJson(rec.reason) << "\"}"
            << (i + 1 < drv.settings.size() ? "," : "") << "\n";
    }
    oss << "    ]\n"
        << "  }\n"
        << "}\n";
    return oss.str();
}

inline std::string exportConfigJson(const SystemSpecs& specs, const GameSpec& game, int mode = OPT_MODE_OPTIMAL) {
    return exportConfigJson(specs, game, analyzeGame(specs, game, mode));
}

inline std::string exportConfigMd(const SystemSpecs& specs, const GameSpec& game, const GameAnalysis& analysis) {
    std::ostringstream oss;
    oss << "# " << game.title << " — " << APP_NAME << " Optimal PC Settings & Tuning Checklist\n\n"
        << "> **Verdict**: `" << analysis.overallTier << "` (" << analysis.verdictBadge << ") • **Mode**: `" << analysis.modeLabel << "`  \n"
        << "> **Hardware Profile**: " << specs.cpu.name << " (" << specs.cpu.threads << "T) • " << specs.gpu.name << " (" << specs.gpu.vramGB << " GB VRAM) • " << specs.ram.totalGB << " GB RAM  \n"
        << "> **Target Display**: " << analysis.monitorName << " (" << analysis.screenWidth << "x" << analysis.screenHeight << " @ " << analysis.refreshRateHz << "Hz)\n\n"
        << "## 1. Target Display, Mode & Estimated Performance\n"
        << "- **Optimization Mode**: **" << analysis.modeLabel << "** — " << analysis.summary << "\n"
        << "- **Recommended Resolution**: **" << analysis.targetResolution << "**\n"
        << "- **Base Preset**: **" << analysis.preset << "**\n"
        << "- **Screen FPS (" << analysis.screenWidth << "x" << analysis.screenHeight << " @ " << analysis.refreshRateHz << "Hz)**: **" << analysis.estimatedScreenFps.avg << " FPS avg** (" << analysis.estimatedScreenFps.range << " • " << analysis.refreshSaturationPct << "% Hz saturation)\n"
        << "- **Frame Pacing / VRR Advice**: " << analysis.syncAdvice << "\n"
        << "- **1080p / 1440p / 4K Estimates**: " << analysis.fps1080p.avg << " FPS / " << analysis.fps1440p.avg << " FPS / " << analysis.fps4k.avg << " FPS\n\n"
        << "## 2. 8-Setting FPS Gain & VRAM Impact Breakdown\n"
        << "| Setting | Recommended Value | Est. FPS Gain | VRAM Impact | Visual Cost | Hardware Note |\n"
        << "| :--- | :--- | :--- | :--- | :--- | :--- |\n";
    for (const auto& s : analysis.settingImpacts) {
        oss << "| **" << s.setting << "** | `" << s.recommendedValue << "` | +" << s.fpsGainPercent << "% FPS | ~" << s.vramImpactMB << " MB | " << s.visualCost << " | " << s.note << " |\n";
    }
    oss << "\n## 3. Bottleneck & Engine Tuning Tips\n"
        << "- **Primary Limiting Factor**: **" << analysis.primaryBottleneck << "** — " << analysis.bottleneckNote << "\n";
    for (const auto& tip : analysis.tuningTips) {
        oss << "- " << tip << "\n";
    }

    DriverAdvisorResult drv = getDriverAppRecommendations(specs, game, analysis.mode);
    oss << "\n## 4. GPU Driver App Configuration (" << drv.suiteName << " [" << drv.suiteStatus << "])\n"
        << "- **Profile Summary**: " << drv.summary << "\n"
        << "- **Storage / Drive Placement**: " << drv.storageAdvice << "\n\n"
        << "| Driver Setting | Recommended Value | Reason |\n"
        << "| :--- | :--- | :--- |\n";
    for (const auto& rec : drv.settings) {
        oss << "| **" << rec.setting << "** | `" << rec.recommendedValue << "` | " << rec.reason << " |\n";
    }
    return oss.str();
}

inline std::string exportConfigMd(const SystemSpecs& specs, const GameSpec& game, int mode = OPT_MODE_OPTIMAL) {
    return exportConfigMd(specs, game, analyzeGame(specs, game, mode));
}

inline GameSpec parseRawSteamReqs(const std::string& rawText, const std::string& title = "Custom Steam Game", const std::string& genre = "Custom / Steam Spec") {
    std::string raw = trim(rawText);
    std::string minBlock = raw;
    std::string recBlock;

    std::regex recSplitRe("(?:^|\\n)\\s*(?:recommended|recomendado|recommended\\s*specifications?)\\s*:?", std::regex_constants::icase);
    std::smatch recMatch;
    if (std::regex_search(raw, recMatch, recSplitRe)) {
        minBlock = raw.substr(0, static_cast<size_t>(recMatch.position()));
        recBlock = raw.substr(static_cast<size_t>(recMatch.position() + recMatch.length()));
    }

    auto extractField = [](const std::string& block, const char* pattern, const std::string& fallback) -> std::string {
        std::regex re(pattern, std::regex_constants::icase);
        std::smatch m;
        if (std::regex_search(block, m, re) && m.size() > 1) {
            std::string val = trim(m[1].str());
            if (!val.empty()) return val;
        }
        return fallback;
    };

    auto extractRam = [](const std::string& block, int fallback) -> int {
        std::regex re("(?:memory|ram|memoria)\\s*[:=-]?\\s*(\\d+)\\s*(gb|mb)?", std::regex_constants::icase);
        std::smatch m;
        if (std::regex_search(block, m, re)) {
            int val = std::atoi(m[1].str().c_str());
            std::string unit = m.size() > 2 ? toLower(m[2].str()) : "gb";
            if (unit == "mb") return std::max(2, val / 1024);
            if (val > 0) return val;
        }
        return fallback;
    };

    auto extractVram = [](const std::string& gpuStr, const std::string& block, int fallback) -> int {
        std::regex inlineGb("(\\d+)\\s*gb\\b", std::regex_constants::icase);
        std::smatch m;
        if (std::regex_search(gpuStr, m, inlineGb)) {
            int v = std::atoi(m[1].str().c_str());
            if (v > 0 && v <= 32) return v;
        }
        std::regex vramRe("(?:vram|video\\s*memory)\\s*[:=-]?\\s*(\\d+)\\s*(gb|mb)?", std::regex_constants::icase);
        if (std::regex_search(block, m, vramRe)) {
            int v = std::atoi(m[1].str().c_str());
            std::string u = m.size() > 2 ? toLower(m[2].str()) : "gb";
            return u == "mb" ? std::max(1, v / 1024) : std::max(1, v);
        }
        return scoreGPU(gpuStr, fallback).vramGB;
    };

    std::string minCpu = extractField(minBlock, "(?:processor|cpu|procesador)\\s*[:=-]\\s*([^\\r\\n]+)", "Intel Core i5-8400 or AMD Ryzen 5 1600");
    std::string minGpu = extractField(minBlock, "(?:graphics|video\\s*card|gpu|tarjeta\\s*gr[aá]fica)\\s*[:=-]\\s*([^\\r\\n]+)", "NVIDIA GeForce GTX 1060 6GB or AMD Radeon RX 580 8GB");
    int minRam = extractRam(minBlock, 8);
    int minVram = extractVram(minGpu, minBlock, 6);

    std::string recCpu = !recBlock.empty()
        ? extractField(recBlock, "(?:processor|cpu|procesador)\\s*[:=-]\\s*([^\\r\\n]+)", "Intel Core i7-10700 or AMD Ryzen 5 5600")
        : "Intel Core i7-10700 or AMD Ryzen 5 5600";
    std::string recGpu = !recBlock.empty()
        ? extractField(recBlock, "(?:graphics|video\\s*card|gpu|tarjeta\\s*gr[aá]fica)\\s*[:=-]\\s*([^\\r\\n]+)", "NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT")
        : "NVIDIA GeForce RTX 3060 or AMD Radeon RX 6600 XT";
    int recRam = !recBlock.empty() ? extractRam(recBlock, std::max(16, minRam)) : std::max(16, minRam);
    int recVram = !recBlock.empty() ? extractVram(recGpu, recBlock, std::max(8, minVram)) : std::max(8, minVram);

    int storageGB = 70;
    std::regex stRe("(?:storage|hard\\s*drive|disk\\s*space|available\\s*space)\\s*[:=-]?\\s*(\\d+)\\s*(tb|gb)?", std::regex_constants::icase);
    std::smatch stMatch;
    if (std::regex_search(raw, stMatch, stRe)) {
        int val = std::atoi(stMatch[1].str().c_str());
        std::string u = stMatch.size() > 2 ? toLower(stMatch[2].str()) : "gb";
        storageGB = (u == "tb") ? val * 1024 : std::max(1, val);
    }

    GameSpec g;
    g.id = slugify(title);
    g.title = title.empty() ? "Custom Steam Game" : title;
    g.genre = genre.empty() ? "Custom / Steam Spec" : genre;
    g.engine = containsIgnoreCase(raw, "unreal engine 5") ? "Unreal Engine 5" : "Steam Spec Profile";
    g.releaseYear = 2026;
    g.monogram = makeMonogram(g.title);
    g.bannerColor1 = 0x0B132B;
    g.bannerColor2 = 0x1C2541;
    g.accentColor  = 0x38BDF8;
    g.minCpu = minCpu;
    g.minGpu = minGpu;
    g.minCpuScore = scoreCPU(minCpu).score;
    g.minGpuScore = scoreGPU(minGpu, minVram).score;
    g.minRamGB = minRam;
    g.minVramGB = minVram;
    g.recCpu = recCpu;
    g.recGpu = recGpu;
    g.recCpuScore = scoreCPU(recCpu).score;
    g.recGpuScore = scoreGPU(recGpu, recVram).score;
    g.recRamGB = recRam;
    g.recVramGB = recVram;
    g.storageGB = storageGB;
    g.ssdRequired = containsIgnoreCase(raw, "ssd") || storageGB >= 65;
    g.supportsRT = containsIgnoreCase(raw, "ray tracing") || containsIgnoreCase(raw, "rtx");
    g.upscalers = { "DLSS", "FSR", "XeSS" };
    g.baseRecFps = 64;
    g.playStatus = "CATALOG";
    g.playStatusLabel = "STEAM SPEC";
    g.tuningTips = {
        "Parsed directly from raw Steam requirements (" + minGpu + " min -> " + recGpu + " rec).",
        "Adjust Shadow Quality and Volumetric Lighting first for a quick +18% FPS gain."
    };
    return g;
}

// =============================================================================
// 5. Country-Aware Price & Verified Deals Finder with Firewall Gate & Reputation Shield
// =============================================================================
inline bool firewallAuthorized = false;

inline bool isFirewallAuthorized() {
    return firewallAuthorized;
}

inline void setFirewallAuthorized(bool authorized) {
    firewallAuthorized = authorized;
}

struct SellerCandidate {
    std::string storeId;
    std::string storeName;
    std::string sellerType = "Official Store";
    double trustScore = 9.8;
    int positiveRatingPct = 98;
    int completedSales = 50000;
    bool isOfficialStore = true;
    std::string badge;
    std::string warranty;
    double price = 0.0;
    std::string formattedPrice;
    std::string url;
    std::string condition = "New";
};

struct ReputationEval {
    bool approved = true;
    double trustScore = 9.8;
    int positiveRatingPct = 98;
    int completedSales = 50000;
    bool isOfficialStore = true;
    std::vector<std::string> flags;
    std::string primaryReason;
};

inline ReputationEval evaluateSellerReputation(const SellerCandidate& item, double marketRefPrice = 0.0, bool strictMode = true) {
    ReputationEval res;
    res.trustScore = item.trustScore;
    res.positiveRatingPct = item.positiveRatingPct > 0 ? item.positiveRatingPct : static_cast<int>(std::round(item.trustScore * 10.0));
    res.completedSales = item.completedSales;
    res.isOfficialStore = item.isOfficialStore || item.sellerType == "Official Store" || item.sellerType == "Official Aggregator";

    if (res.trustScore < 9.0 || res.positiveRatingPct < 90) {
        res.flags.push_back("LOW_SELLER_REPUTATION");
    }
    if (!res.isOfficialStore && res.completedSales < 50) {
        res.flags.push_back("INSUFFICIENT_SALES_HISTORY");
    }
    if (strictMode) {
        std::string combined = toLower(item.condition + " " + item.storeName + " " + item.warranty + " " + item.badge);
        std::regex riskyRe("\\b(used|usado|usada|mined|mineria|rig de mineria|sin garantia|no warranty|reacondicionado|refurbished|para repuesto|defecto)\\b", std::regex_constants::icase);
        if (std::regex_search(combined, riskyRe)) {
            res.flags.push_back("UNVERIFIED_USED_OR_MINED_HARDWARE");
        }
    }
    if (marketRefPrice > 0.0 && item.price > 0.0 && item.price < marketRefPrice * 0.55) {
        res.flags.push_back("SUSPICIOUS_LOW_PRICE_SCAM");
    }

    res.approved = res.flags.empty();
    res.primaryReason = res.flags.empty() ? "VERIFIED_SAFE_SELLER" : res.flags.front();
    return res;
}

inline ReputationEval evaluateSellerReputation(
    double trustScore,
    int positiveRatingPct = 95,
    int completedSales = 100,
    bool isOfficialStore = false,
    const std::string& conditionOrNotes = "New",
    double price = 0.0,
    double marketRefPrice = 0.0
) {
    SellerCandidate c;
    c.trustScore = trustScore;
    c.positiveRatingPct = positiveRatingPct;
    c.completedSales = completedSales;
    c.isOfficialStore = isOfficialStore;
    c.condition = conditionOrNotes;
    c.price = price;
    return evaluateSellerReputation(c, marketRefPrice, true);
}

struct DealEntry {
    std::string storeId;
    std::string storeName;
    std::string sellerType;
    double trustScore = 9.8;
    int positiveRatingPct = 98;
    int completedSales = 50000;
    bool isOfficialStore = true;
    std::string badge;
    std::string warranty;
    double estimatedPrice = 0.0;
    std::string formattedPrice;
    std::string url;
    std::string condition = "New";
    bool reputationVerified = true;
    std::string blockReason;
};

struct DealSearchResult {
    bool firewallAuthorized = false;
    bool firewallBlocked = true;
    std::string status = "FIREWALL_PERMISSION_REQUIRED";
    std::string query;
    std::string countryCode = "AR";
    std::string countryName = "Argentina";
    std::string countryLabel = "Argentina (ARS $)";
    std::string currency = "ARS";
    std::string currencySymbol = "ARS $";
    double baseUsdPrice = 299.0;
    double marketRefPrice = 0.0;
    std::string formattedMarketRefPrice;
    std::vector<DealEntry> deals;
    std::vector<DealEntry> verifiedDeals;
    std::vector<DealEntry> blockedDeals;
    int totalEvaluated = 0;
    int verifiedCount = 0;
    int blockedBadReputationCount = 0;
    std::vector<std::string> buyerSafetyTips;
};

inline double estimateBaseUsdForHardwareQuery(const std::string& query) {
    struct PriceRow { const char* pattern; double usd; };
    static const PriceRow rows[] = {
        { "rtx\\s*5090", 1999.0 }, { "rtx\\s*5080", 999.0 },
        { "rtx\\s*4090", 1799.0 }, { "rtx\\s*4080\\s*super", 989.0 }, { "rtx\\s*4080", 999.0 },
        { "rtx\\s*4070\\s*ti\\s*super", 799.0 }, { "rtx\\s*4070\\s*super", 589.0 }, { "rtx\\s*4070", 539.0 },
        { "rtx\\s*4060\\s*ti", 389.0 }, { "rtx\\s*4060", 299.0 }, { "rtx\\s*3060", 279.0 },
        { "rx\\s*7900\\s*xtx", 899.0 }, { "rx\\s*7900\\s*xt", 689.0 }, { "rx\\s*7900\\s*gre", 539.0 },
        { "rx\\s*7800\\s*xt", 489.0 }, { "rx\\s*7700\\s*xt", 399.0 }, { "rx\\s*7600\\s*xt", 319.0 },
        { "rx\\s*7600", 259.0 }, { "rx\\s*6750\\s*xt", 329.0 }, { "rx\\s*6600", 199.0 },
        { "9800x3d", 479.0 }, { "7800x3d", 399.0 }, { "5700x3d", 209.0 }, { "5800x3d", 319.0 },
        { "5800x", 189.0 }, { "7600x", 199.0 }, { "5600", 135.0 },
        { "14700k", 359.0 }, { "13600k|14600k", 269.0 }, { "12400", 129.0 }
    };
    for (const auto& r : rows) {
        std::regex re(r.pattern, std::regex_constants::icase);
        if (std::regex_search(query, re)) return r.usd;
    }
    return 299.0;
}

inline std::string formatWithThousandsDot(long long val) {
    std::string s = std::to_string(std::max(0LL, val));
    std::string out;
    int count = 0;
    for (int i = static_cast<int>(s.size()) - 1; i >= 0; --i) {
        if (count > 0 && count % 3 == 0) out.insert(out.begin(), '.');
        out.insert(out.begin(), s[i]);
        ++count;
    }
    return out;
}

inline std::string formatWithThousandsComma(long long val) {
    std::string s = std::to_string(std::max(0LL, val));
    std::string out;
    int count = 0;
    for (int i = static_cast<int>(s.size()) - 1; i >= 0; --i) {
        if (count > 0 && count % 3 == 0) out.insert(out.begin(), ',');
        out.insert(out.begin(), s[i]);
        ++count;
    }
    return out;
}

inline std::string formatCurrencyAmount(double amount, const std::string& countryCode) {
    long long rounded = static_cast<long long>(std::llround(amount));
    if (countryCode == "AR") return "ARS $ " + formatWithThousandsDot(rounded);
    if (countryCode == "CL") return "CLP $ " + formatWithThousandsDot(rounded);
    if (countryCode == "BR") return "R$ " + formatWithThousandsDot(rounded);
    if (countryCode == "MX") return "MXN $" + formatWithThousandsComma(rounded);
    if (countryCode == "ES") return std::to_string(rounded) + " EUR";
    return "USD $" + formatWithThousandsComma(rounded);
}

inline DealSearchResult searchComponentDeals(const std::string& rawQuery, const std::string& rawCountryCode = "AR", bool autoAuthorize = false) {
    if (autoAuthorize) {
        firewallAuthorized = true;
    }

    DealSearchResult out;
    out.query = trim(rawQuery).empty() ? "AMD Radeon RX 7800 XT" : trim(rawQuery);
    std::string cc = toUpper(trim(rawCountryCode));
    if (cc != "AR" && cc != "US" && cc != "BR" && cc != "CL" && cc != "MX" && cc != "ES") {
        cc = "AR";
    }
    out.countryCode = cc;
    out.firewallAuthorized = firewallAuthorized;

    double usdRate = 1180.0;
    double vatMult = 1.18;
    if (cc == "AR") {
        out.countryName = "Argentina";
        out.countryLabel = "Argentina (ARS $)";
        out.currency = "ARS";
        out.currencySymbol = "ARS $";
        usdRate = 1180.0;
        vatMult = 1.18;
        out.buyerSafetyTips = {
            "AR: Prioriza siempre agregadores oficiales como HardGamers y tiendas con local fisico y factura A/B (Compra Gamer, Maximus, Venex, FullH4rd, Mexx).",
            "En MercadoLibre Argentina, filtra exclusivamente por Tiendas Oficiales o MercadoLider Platinum con garantia de fabrica (evita GPUs usadas en mineria).",
            "Verifica el precio Especial / Transferencia vs Precio de Lista antes de comprar."
        };
    } else if (cc == "US") {
        out.countryName = "United States";
        out.countryLabel = "United States (USD $)";
        out.currency = "USD";
        out.currencySymbol = "USD $";
        usdRate = 1.0;
        vatMult = 1.0;
        out.buyerSafetyTips = {
            "US: Compare historical lows on PCPartPicker before buying.",
            "On Newegg and Amazon, verify Sold & Shipped by Official Brand to avoid third-party marketplace gouging."
        };
    } else if (cc == "BR") {
        out.countryName = "Brazil";
        out.countryLabel = "Brasil (BRL R$)";
        out.currency = "BRL";
        out.currencySymbol = "R$";
        usdRate = 5.75;
        vatMult = 1.25;
        out.buyerSafetyTips = {
            "BR: Priorize lojas oficiais de hardware no Brasil: KaBuM!, Pichau e Terabyteshop com Nota Fiscal e garantia nacional."
        };
    } else if (cc == "CL") {
        out.countryName = "Chile";
        out.countryLabel = "Chile (CLP $)";
        out.currency = "CLP";
        out.currencySymbol = "CLP $";
        usdRate = 980.0;
        vatMult = 1.19;
        out.buyerSafetyTips = {
            "CL: Usa SoloTodo Chile para comparar precios en tiempo real entre mas de 25 tiendas verificadas con boleta/factura."
        };
    } else if (cc == "MX") {
        out.countryName = "Mexico";
        out.countryLabel = "Mexico (MXN $)";
        out.currency = "MXN";
        out.currencySymbol = "MXN $";
        usdRate = 20.2;
        vatMult = 1.16;
        out.buyerSafetyTips = {
            "MX: Compra en distribuidores autorizados de Mexico como DDTech y CyberPuerta con garantia nacional y CFDI."
        };
    } else {
        out.countryName = "Spain / EU";
        out.countryLabel = "Espana / EU (EUR)";
        out.currency = "EUR";
        out.currencySymbol = "EUR";
        usdRate = 0.94;
        vatMult = 1.21;
        out.buyerSafetyTips = {
            "ES: En Espana y la UE dispones de 3 anos de garantia legal comprando en tiendas oficiales como PcComponentes y Coolmod."
        };
    }

    out.baseUsdPrice = estimateBaseUsdForHardwareQuery(out.query);
    double rawRef = out.baseUsdPrice * usdRate * vatMult;
    if (cc == "AR" || cc == "CL") {
        out.marketRefPrice = std::round(rawRef / 500.0) * 500.0;
    } else if (cc == "BR" || cc == "MX") {
        out.marketRefPrice = std::round(rawRef / 10.0) * 10.0;
    } else {
        out.marketRefPrice = std::round(rawRef);
    }
    out.formattedMarketRefPrice = formatCurrencyAmount(out.marketRefPrice, cc);

    if (!firewallAuthorized) {
        out.firewallBlocked = true;
        out.status = "FIREWALL_PERMISSION_REQUIRED";
        return out;
    }

    out.firewallBlocked = false;
    out.status = "OK";

    std::string encoded = urlEncode(out.query);
    std::string slug = slugify(out.query);
    std::vector<SellerCandidate> candidates;

    if (cc == "AR") {
        candidates = {
            { "hardgamers-ar", "HardGamers Argentina", "Official Aggregator", 9.9, 99, 50000, true, "#1 AR Price Aggregator (30+ Verified Stores)", "Garantia Oficial en 30+ Tiendas Verificadas", out.marketRefPrice * 0.95, "", "https://www.hardgamers.com.ar/search?text=" + encoded, "New" },
            { "compragamer-ar", "Compra Gamer", "Official Store", 9.8, 98, 120000, true, "Verified Official AR Retailer", "12-36 Meses Garantia Oficial + Factura A/B", out.marketRefPrice * 0.96, "", "https://compragamer.com/?seccion=3&criterio=" + encoded, "New" },
            { "maximus-ar", "Maximus Gaming Hardware", "Official Store", 9.6, 97, 65000, true, "Verified Official AR Retailer", "Garantia Oficial Local en CABA + Envios", out.marketRefPrice * 0.98, "", "https://www.maximus.com.ar/Productos/maximus.aspx?busca=" + encoded, "New" },
            { "venex-ar", "Venex Computacion", "Official Store", 9.5, 96, 55000, true, "Verified Official AR Retailer", "Garantia Oficial + Retiro / Envio Nacional", out.marketRefPrice * 1.00, "", "https://www.venex.com.ar/resultado-busqueda.htm?keywords=" + encoded, "New" },
            { "fullh4rd-ar", "FullH4rd", "Official Store", 9.4, 95, 48000, true, "Verified Official AR Retailer", "Garantia Oficial Local Galeria Jardin / CABA", out.marketRefPrice * 0.99, "", "https://fullh4rd.com.ar/search/buscar/" + encoded, "New" },
            { "mexx-ar", "Mexx Computacion", "Official Store", 9.5, 96, 52000, true, "Verified Official AR Retailer", "Garantia Oficial 12 Meses + Factura", out.marketRefPrice * 1.01, "", "https://www.mexx.com.ar/buscar/?q=" + encoded, "New" },
            { "mercadolibre-ar-official", "MercadoLibre Argentina Official Stores & Platinum Filter", "Verified Marketplace", 9.4, 95, 90000, true, "Official Stores & MercadoLider Platinum Filter", "Compra Protegida + Filtro Nuevo / Tiendas Oficiales", out.marketRefPrice * 1.06, "", "https://listado.mercadolibre.com.ar/" + slug + "_Nuevo_Tienda_all", "New" }
        };
    } else if (cc == "US") {
        candidates = {
            { "pcpartpicker-us", "PCPartPicker US", "Official Aggregator", 9.9, 99, 100000, true, "#1 US Price Aggregator", "Verified Authorized US Retailers Only", out.marketRefPrice * 0.98, "", "https://pcpartpicker.com/search/?q=" + encoded, "New" },
            { "microcenter-us", "Micro Center", "Official Store", 9.9, 99, 85000, true, "Top-Rated US Hardware Store", "Official Warranty + In-Store Pickup", out.marketRefPrice * 0.96, "", "https://www.microcenter.com/search/search_results.aspx?Ntt=" + encoded, "New" },
            { "bestbuy-us", "Best Buy Official", "Official Store", 9.7, 97, 110000, true, "Authorized FE & Partner GPU Retailer", "Official Manufacturer Warranty", out.marketRefPrice * 1.00, "", "https://www.bestbuy.com/site/searchpage.jsp?st=" + encoded, "New" },
            { "newegg-direct-us", "Newegg (Sold by Newegg Filter)", "Official Store", 9.6, 96, 95000, true, "Direct Retailer (3rd-Party Filtered)", "30-Day Return + Manufacturer Warranty", out.marketRefPrice * 1.00, "", "https://www.newegg.com/p/pl?d=" + encoded + "&N=8000", "New" },
            { "bhphoto-us", "B&H Photo Video", "Official Store", 9.7, 98, 75000, true, "Verified Authorized US Dealer", "Full Authorized US Warranty", out.marketRefPrice * 1.01, "", "https://www.bhphotovideo.com/c/search?Ntt=" + encoded, "New" }
        };
    } else if (cc == "BR") {
        candidates = {
            { "kabum-br", "KaBuM!", "Official Store", 9.8, 98, 150000, true, "Maior E-commerce de Hardware do Brasil", "Garantia Oficial + PIX", out.marketRefPrice * 0.97, "", "https://www.kabum.com.br/busca/" + encoded, "New" },
            { "pichau-br", "Pichau Informatica", "Official Store", 9.7, 97, 95000, true, "Loja Oficial Verificada BR", "Garantia Oficial + Nota Fiscal", out.marketRefPrice * 0.96, "", "https://www.pichau.com.br/search?q=" + encoded, "New" },
            { "terabyteshop-br", "Terabyteshop", "Official Store", 9.7, 97, 90000, true, "Especialista Oficial em Hardware BR", "Garantia Oficial de Fabrica", out.marketRefPrice * 0.98, "", "https://www.terabyteshop.com.br/busca?str=" + encoded, "New" },
            { "mercadolivre-br-official", "MercadoLivre Brasil (Lojas Oficiais)", "Verified Marketplace", 9.4, 95, 80000, true, "Filtro Exclusivo Lojas Oficiais", "Compra Garantida + Nota Fiscal", out.marketRefPrice * 1.05, "", "https://lista.mercadolivre.com.br/" + slug + "_Loja_all", "New" }
        };
    } else if (cc == "CL") {
        candidates = {
            { "solotodo-cl", "SoloTodo Chile", "Official Aggregator", 9.9, 99, 60000, true, "Comparador #1 de Hardware en Chile", "Tiendas Chilenas Verificadas con Garantia Legal", out.marketRefPrice * 0.96, "", "https://www.solotodo.cl/search?search=" + encoded, "New" },
            { "pcfactory-cl", "PC Factory", "Official Store", 9.7, 97, 85000, true, "Tienda Oficial con Sucursales en Chile", "Garantia Legal 6 Meses + Fabricante", out.marketRefPrice * 1.00, "", "https://www.pcfactory.cl/buscar?valor=" + encoded, "New" },
            { "spdigital-cl", "SP Digital", "Official Store", 9.6, 96, 70000, true, "Especialista Gaming & Hardware Oficial CL", "Garantia Oficial + Despacho Nacional", out.marketRefPrice * 0.98, "", "https://www.spdigital.cl/search/?q=" + encoded, "New" }
        };
    } else if (cc == "MX") {
        candidates = {
            { "ddtech-mx", "DDTech Mexico", "Official Store", 9.8, 98, 75000, true, "Tienda #1 de Hardware Gaming en Mexico", "12 Meses Garantia Oficial + CFDI", out.marketRefPrice * 0.97, "", "https://ddtech.mx/buscar/" + encoded, "New" },
            { "cyberpuerta-mx", "CyberPuerta", "Official Store", 9.7, 97, 90000, true, "Distribuidor Autorizado Hardware MX", "Garantia Nacional + Envio Asegurado", out.marketRefPrice * 0.98, "", "https://www.cyberpuerta.mx/index.php?cl=search&searchparam=" + encoded, "New" },
            { "mercadolibre-mx-official", "MercadoLibre Mexico (Tiendas Oficiales)", "Verified Marketplace", 9.4, 95, 85000, true, "Filtro Exclusivo Tiendas Oficiales MX", "Compra Protegida + Envio Full", out.marketRefPrice * 1.04, "", "https://listado.mercadolibre.com.mx/" + slug + "_Tienda_all", "New" }
        };
    } else {
        candidates = {
            { "geizhals-eu", "Geizhals EU Price Aggregator", "Official Aggregator", 9.9, 99, 95000, true, "Comparador #1 de Precios en Europa", "Tiendas Europeas Verificadas con Garantia UE", out.marketRefPrice * 0.95, "", "https://geizhals.eu/?fs=" + encoded, "New" },
            { "pccomponentes-es", "PcComponentes", "Official Store", 9.8, 98, 140000, true, "Lider de Hardware en Espana (3 Anos Garantia)", "3 Anos de Garantia Oficial UE", out.marketRefPrice * 0.98, "", "https://www.pccomponentes.com/buscar/?query=" + encoded, "New" },
            { "coolmod-es", "Coolmod", "Official Store", 9.6, 96, 68000, true, "Tienda Oficial Gaming & Entusiasta ES", "3 Anos de Garantia Oficial Espanola", out.marketRefPrice * 0.97, "", "https://www.coolmod.com/buscar?q=" + encoded, "New" }
        };
    }

    // Add 3 simulated risky/scam unverified marketplace listings that Reputation Shield audits and blocks
    candidates.push_back({ "blocked-low-rep", "Unverified Reseller (62% Rating)", "Unverified Seller", 6.2, 62, 12, false, "Unverified", "Sin garantia", out.marketRefPrice * 0.88, "", "https://example.invalid/low-rep", "New" });
    candidates.push_back({ "blocked-mined", "Rig De Mineria Usada Sin Garantia", "Marketplace Individual", 8.1, 81, 19, false, "Usado Mineria", "Sin garantia", out.marketRefPrice * 0.65, "", "https://example.invalid/mined", "Used / Mined" });
    candidates.push_back({ "blocked-scam-price", "Too-Good-To-Be-True Listing (-65% Off)", "New Account", 7.0, 70, 3, false, "Suspicious Price", "No warranty", out.marketRefPrice * 0.35, "", "https://example.invalid/scam", "New" });

    for (const auto& cand : candidates) {
        ReputationEval rep = evaluateSellerReputation(cand, out.marketRefPrice, true);
        DealEntry d;
        d.storeId = cand.storeId;
        d.storeName = cand.storeName;
        d.sellerType = cand.sellerType;
        d.trustScore = rep.trustScore;
        d.positiveRatingPct = rep.positiveRatingPct;
        d.completedSales = rep.completedSales;
        d.isOfficialStore = rep.isOfficialStore;
        d.badge = cand.badge;
        d.warranty = cand.warranty;
        d.estimatedPrice = std::round(cand.price);
        d.formattedPrice = formatCurrencyAmount(d.estimatedPrice, cc);
        d.url = cand.url;
        d.condition = cand.condition;
        d.reputationVerified = rep.approved;
        d.blockReason = rep.primaryReason;

        if (rep.approved) {
            out.deals.push_back(d);
            out.verifiedDeals.push_back(d);
        } else {
            out.blockedDeals.push_back(d);
        }
    }

    out.totalEvaluated = static_cast<int>(candidates.size());
    out.verifiedCount = static_cast<int>(out.deals.size());
    out.blockedBadReputationCount = static_cast<int>(out.blockedDeals.size());
    return out;
}

// =============================================================================
// What-If Simulator Helper & Smoke-Test JSON Builder
// =============================================================================
inline SystemSpecs applyWhatIfPreset(const SystemSpecs& baseSpecs, int presetIndex) {
    SystemSpecs s = baseSpecs;
    if (presetIndex == 1) {
        // Preset 1: High-End RTX 4070 Super + Ryzen 7 7800X3D + 1440p @ 165Hz
        s.cpu.name = "AMD Ryzen 7 7800X3D";
        s.cpu.cores = 8;
        s.cpu.threads = 16;
        s.cpu.score = scoreCPU(s.cpu.name, 16).score;
        s.gpu.name = "NVIDIA GeForce RTX 4070 Super";
        s.gpu.vramGB = 12;
        s.gpu.vramMB = 12288;
        auto gEval = scoreGPU(s.gpu.name, 12);
        s.gpu.score = gEval.score;
        s.gpu.vendor = gEval.vendor;
        s.gpu.rtCapable = gEval.rtCapable;
        s.gpu.upscaler = gEval.upscaler;
        s.ram.totalGB = 32;
        s.display.name = "Simulated 1440p 165Hz G-Sync Monitor";
        s.display.monitorName = s.display.name;
        s.display.width = 2560;
        s.display.height = 1440;
        s.display.tier = "1440p";
        s.display.refreshRateHz = 165;
        s.display.vrrCapable = true;
        s.display.resolutionLabel = "2560x1440 (1440p)";
    } else if (presetIndex == 2) {
        // Preset 2: Competitive RX 7800 XT + Ryzen 5 7600X + 1080p @ 240Hz
        s.cpu.name = "AMD Ryzen 5 7600X";
        s.cpu.cores = 6;
        s.cpu.threads = 12;
        s.cpu.score = scoreCPU(s.cpu.name, 12).score;
        s.gpu.name = "AMD Radeon RX 7800 XT";
        s.gpu.vramGB = 16;
        s.gpu.vramMB = 16384;
        auto gEval = scoreGPU(s.gpu.name, 16);
        s.gpu.score = gEval.score;
        s.gpu.vendor = gEval.vendor;
        s.gpu.rtCapable = gEval.rtCapable;
        s.gpu.upscaler = gEval.upscaler;
        s.ram.totalGB = 32;
        s.display.name = "Simulated 1080p 240Hz FreeSync eSports Monitor";
        s.display.monitorName = s.display.name;
        s.display.width = 1920;
        s.display.height = 1080;
        s.display.tier = "1080p";
        s.display.refreshRateHz = 240;
        s.display.vrrCapable = true;
        s.display.resolutionLabel = "1920x1080 (1080p)";
    } else if (presetIndex == 3) {
        // Preset 3: Budget GTX 1060 6GB + Core i5-8400 + 1080p @ 60Hz
        s.cpu.name = "Intel Core i5-8400";
        s.cpu.cores = 6;
        s.cpu.threads = 6;
        s.cpu.score = scoreCPU(s.cpu.name, 6).score;
        s.gpu.name = "NVIDIA GeForce GTX 1060 6GB";
        s.gpu.vramGB = 6;
        s.gpu.vramMB = 6144;
        auto gEval = scoreGPU(s.gpu.name, 6);
        s.gpu.score = gEval.score;
        s.gpu.vendor = gEval.vendor;
        s.gpu.rtCapable = gEval.rtCapable;
        s.gpu.upscaler = gEval.upscaler;
        s.ram.totalGB = 16;
        s.display.name = "Standard 1080p 60Hz Monitor";
        s.display.monitorName = s.display.name;
        s.display.width = 1920;
        s.display.height = 1080;
        s.display.tier = "1080p";
        s.display.refreshRateHz = 60;
        s.display.vrrCapable = false;
        s.display.resolutionLabel = "1920x1080 (1080p)";
    }
    return s;
}

inline std::string buildSmokeTestJson(const SystemSpecs& specs, const std::vector<GameSpec>& mergedGames) {
    int installedCount = 0;
    for (const auto& g : mergedGames) {
        if (g.installed) ++installedCount;
    }
    std::string dispSummary = specs.display.name + " (" + std::to_string(specs.display.width) + "x" + std::to_string(specs.display.height) + "@" + std::to_string(specs.display.refreshRateHz) + "Hz)";
    auto suites = specs.driverSuites.empty() ? detectDriverSuites(specs) : specs.driverSuites;
    GameSpec sampleGame = !mergedGames.empty() ? mergedGames[0] : getCatalogGames()[0];
    DriverAdvisorResult drv = getDriverAppRecommendations(specs, sampleGame, OPT_MODE_OPTIMAL);

    std::ostringstream oss;
    oss << "{"
        << "\"status\":\"NATIVE_GUI_OK\","
        << "\"appName\":\"" << escapeJson(APP_NAME) << "\","
        << "\"calver\":\"" << escapeJson(CALVER) << "\","
        << "\"fullVersion\":\"" << escapeJson(FULL_VERSION) << "\","
        << "\"gitTag\":\"" << escapeJson(GIT_TAG) << "\","
        << "\"runtime\":\"native-cpp17-win32-gdiplus\","
        << "\"architecture\":\"" << escapeJson(ARCHITECTURE) << "\","
        << "\"cpuDetected\":\"" << escapeJson(specs.cpu.name) << "\","
        << "\"cpuScore\":" << specs.cpu.score << ","
        << "\"gpuDetected\":\"" << escapeJson(specs.gpu.name) << "\","
        << "\"gpuVramGB\":" << specs.gpu.vramGB << ","
        << "\"gpuScore\":" << specs.gpu.score << ","
        << "\"ramTotalGB\":" << specs.ram.totalGB << ","
        << "\"displayDetected\":\"" << escapeJson(dispSummary) << "\","
        << "\"catalogGames\":" << getCatalogGames().size() << ","
        << "\"installedCount\":" << installedCount << ","
        << "\"driverSuites\":[";
    for (size_t i = 0; i < suites.size(); ++i) {
        const auto& ds = suites[i];
        oss << "{\"id\":\"" << escapeJson(ds.id) << "\",\"name\":\"" << escapeJson(ds.name)
            << "\",\"detected\":" << (ds.detected ? "true" : "false")
            << ",\"installStatus\":\"" << escapeJson(ds.installStatus) << "\"}";
        if (i + 1 < suites.size()) oss << ",";
    }
    oss << "],"
        << "\"driverAdvisor\":{\"suiteName\":\"" << escapeJson(drv.suiteName)
        << "\",\"suiteStatus\":\"" << escapeJson(drv.suiteStatus)
        << "\",\"settingsCount\":" << drv.settings.size() << "},"
        << "\"scanDurationMs\":" << std::fixed << std::setprecision(2) << specs.scanDurationMs
        << "}";
    return oss.str();
}

// =============================================================================
// 11. CalVer Comparison, SHA-256 Patch Verification & WinHTTP Auto-Updater
// =============================================================================

struct CalVerParts {
    int year = 0;
    int month = 0;
    int day = 0;
    int patch = 0;
    bool valid = false;
};

inline CalVerParts parseCalVerStr(std::string s) {
    CalVerParts out;
    // Trim whitespace
    size_t a = s.find_first_not_of(" \t\r\n");
    if (a == std::string::npos) return out;
    size_t b = s.find_last_not_of(" \t\r\n");
    s = s.substr(a, b - a + 1);
    if (!s.empty() && (s[0] == 'v' || s[0] == 'V')) {
        s = s.substr(1);
    }
    std::vector<int> nums;
    std::stringstream ss(s);
    std::string tok;
    while (std::getline(ss, tok, '.')) {
        if (tok.empty()) return out;
        for (char c : tok) {
            if (c < '0' || c > '9') return out;
        }
        try {
            nums.push_back(std::stoi(tok));
        } catch (...) {
            return out;
        }
    }
    if (nums.size() < 3 || nums.size() > 4) return out;
    out.year = nums[0];
    out.month = nums[1];
    out.day = nums[2];
    out.patch = (nums.size() == 4) ? nums[3] : 0;
    out.valid = (out.year >= 2000 && out.month >= 1 && out.month <= 12 && out.day >= 1 && out.day <= 31);
    return out;
}

inline int compareCalVerStr(const std::string& a, const std::string& b) {
    CalVerParts pa = parseCalVerStr(a);
    CalVerParts pb = parseCalVerStr(b);
    if (!pa.valid && !pb.valid) return 0;
    if (!pa.valid) return -1;
    if (!pb.valid) return 1;
    if (pa.year != pb.year) return pa.year < pb.year ? -1 : 1;
    if (pa.month != pb.month) return pa.month < pb.month ? -1 : 1;
    if (pa.day != pb.day) return pa.day < pb.day ? -1 : 1;
    if (pa.patch != pb.patch) return pa.patch < pb.patch ? -1 : 1;
    return 0;
}

inline std::string sha256Hex(const std::string& data) {
    static constexpr uint32_t K[64] = {
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    };
    auto rotr = [](uint32_t x, uint32_t n) -> uint32_t { return (x >> n) | (x << (32 - n)); };
    uint32_t h[8] = {
        0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
        0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    };

    std::vector<uint8_t> msg(data.begin(), data.end());
    uint64_t bitLen = static_cast<uint64_t>(msg.size()) * 8ULL;
    msg.push_back(0x80);
    while ((msg.size() % 64) != 56) msg.push_back(0x00);
    for (int i = 7; i >= 0; --i) {
        msg.push_back(static_cast<uint8_t>((bitLen >> (i * 8)) & 0xFF));
    }

    for (size_t chunk = 0; chunk < msg.size(); chunk += 64) {
        uint32_t w[64] = {};
        for (int i = 0; i < 16; ++i) {
            w[i] = (static_cast<uint32_t>(msg[chunk + i * 4]) << 24) |
                   (static_cast<uint32_t>(msg[chunk + i * 4 + 1]) << 16) |
                   (static_cast<uint32_t>(msg[chunk + i * 4 + 2]) << 8) |
                   static_cast<uint32_t>(msg[chunk + i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            uint32_t s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >> 3);
            uint32_t s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }
        uint32_t a = h[0], b = h[1], c = h[2], d = h[3];
        uint32_t e = h[4], f = h[5], g = h[6], hh = h[7];
        for (int i = 0; i < 64; ++i) {
            uint32_t S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            uint32_t ch = (e & f) ^ ((~e) & g);
            uint32_t temp1 = hh + S1 + ch + K[i] + w[i];
            uint32_t S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            uint32_t temp2 = S0 + maj;
            hh = g; g = f; f = e; e = d + temp1;
            d = c; c = b; b = a; a = temp1 + temp2;
        }
        h[0] += a; h[1] += b; h[2] += c; h[3] += d;
        h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }

    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (int i = 0; i < 8; ++i) {
        oss << std::setw(8) << h[i];
    }
    return oss.str();
}

namespace detail {

inline bool parseJsonStringAt(const std::string& json, size_t quotePos, std::string& out, size_t& endPos) {
    if (quotePos >= json.size() || json[quotePos] != '"') return false;
    out.clear();
    size_t i = quotePos + 1;
    while (i < json.size()) {
        char c = json[i++];
        if (c == '"') {
            endPos = i;
            return true;
        }
        if (c == '\\' && i < json.size()) {
            char esc = json[i++];
            if (esc == '"' || esc == '\\' || esc == '/') out.push_back(esc);
            else if (esc == 'n') out.push_back('\n');
            else if (esc == 'r') out.push_back('\r');
            else if (esc == 't') out.push_back('\t');
            else if (esc == 'b') out.push_back('\b');
            else if (esc == 'f') out.push_back('\f');
            else if (esc == 'u' && i + 4 <= json.size()) {
                unsigned int cp = 0;
                std::stringstream ss;
                ss << std::hex << json.substr(i, 4);
                ss >> cp;
                i += 4;
                if (cp < 0x80) out.push_back(static_cast<char>(cp));
                else if (cp < 0x800) {
                    out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
                    out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
                } else {
                    out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
                    out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
                    out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
                }
            } else {
                out.push_back(esc);
            }
        } else {
            out.push_back(c);
        }
    }
    return false;
}

inline std::string extractJsonStringField(const std::string& json, const std::string& key, size_t startPos = 0) {
    std::string needle = "\"" + key + "\"";
    size_t pos = json.find(needle, startPos);
    while (pos != std::string::npos) {
        size_t colon = json.find_first_not_of(" \t\r\n", pos + needle.size());
        if (colon != std::string::npos && json[colon] == ':') {
            size_t valStart = json.find_first_not_of(" \t\r\n", colon + 1);
            if (valStart != std::string::npos && json[valStart] == '"') {
                std::string val;
                size_t endPos = 0;
                if (parseJsonStringAt(json, valStart, val, endPos)) {
                    return val;
                }
            }
        }
        pos = json.find(needle, pos + needle.size());
    }
    return "";
}

inline size_t extractJsonSizeField(const std::string& json, const std::string& key, size_t startPos = 0) {
    std::string needle = "\"" + key + "\"";
    size_t pos = json.find(needle, startPos);
    if (pos == std::string::npos) return 0;
    size_t colon = json.find(':', pos + needle.size());
    if (colon == std::string::npos) return 0;
    size_t valStart = json.find_first_not_of(" \t\r\n", colon + 1);
    if (valStart == std::string::npos) return 0;
    size_t valEnd = valStart;
    while (valEnd < json.size() && json[valEnd] >= '0' && json[valEnd] <= '9') ++valEnd;
    if (valEnd == valStart) return 0;
    try {
        return static_cast<size_t>(std::stoull(json.substr(valStart, valEnd - valStart)));
    } catch (...) {
        return 0;
    }
}

inline bool isSafeRelPath(const std::string& rel) {
    if (rel.empty() || rel[0] == '/' || rel[0] == '\\') return false;
    if (rel.size() >= 2 && rel[1] == ':') return false;
    if (rel.find("..") != std::string::npos) return false;
    return true;
}

struct RigPatchFileEntry {
    std::string relativePath;
    std::string sha256;
    size_t sizeBytes = 0;
    std::string content;
};

struct RigPatchBundle {
    bool valid = false;
    std::string targetVersion;
    std::string notes;
    std::string bundleSha256;
    std::vector<RigPatchFileEntry> files;
};

inline RigPatchBundle parseAndVerifyRigPatch(const std::string& rawJson) {
    RigPatchBundle b;
    if (rawJson.empty()) return b;
    b.targetVersion = extractJsonStringField(rawJson, "targetVersion");
    b.notes = extractJsonStringField(rawJson, "notes");
    b.bundleSha256 = extractJsonStringField(rawJson, "bundleSha256");
    if (!parseCalVerStr(b.targetVersion).valid || b.bundleSha256.empty()) return b;

    size_t filesPos = rawJson.find("\"files\"");
    if (filesPos == std::string::npos) return b;
    size_t arrStart = rawJson.find('[', filesPos);
    if (arrStart == std::string::npos) return b;

    size_t cur = arrStart + 1;
    while (cur < rawJson.size()) {
        size_t objStart = rawJson.find('{', cur);
        size_t arrEnd = rawJson.find(']', cur);
        if (objStart == std::string::npos || (arrEnd != std::string::npos && arrEnd < objStart)) break;

        // Find matching '}' respecting strings
        size_t p = objStart + 1;
        int depth = 1;
        while (p < rawJson.size() && depth > 0) {
            if (rawJson[p] == '"') {
                std::string dummy;
                size_t endP = p + 1;
                if (parseJsonStringAt(rawJson, p, dummy, endP)) p = endP;
                else ++p;
            } else if (rawJson[p] == '{') {
                ++depth; ++p;
            } else if (rawJson[p] == '}') {
                --depth; ++p;
            } else {
                ++p;
            }
        }
        if (depth != 0) return b;

        std::string objStr = rawJson.substr(objStart, p - objStart);
        RigPatchFileEntry fe;
        fe.relativePath = extractJsonStringField(objStr, "relativePath");
        fe.sha256 = extractJsonStringField(objStr, "sha256");
        fe.sizeBytes = extractJsonSizeField(objStr, "sizeBytes");
        fe.content = extractJsonStringField(objStr, "content");

        if (!isSafeRelPath(fe.relativePath)) return b;
        if (fe.content.size() != fe.sizeBytes) return b;
        if (sha256Hex(fe.content) != fe.sha256) return b;

        b.files.push_back(std::move(fe));
        cur = p;
    }

    if (b.files.empty()) return b;

    // Verify canonical bundleSha256 signature
    std::vector<RigPatchFileEntry> sorted = b.files;
    std::sort(sorted.begin(), sorted.end(), [](const RigPatchFileEntry& x, const RigPatchFileEntry& y) {
        return x.relativePath < y.relativePath;
    });
    std::string canonical = "version:" + b.targetVersion;
    for (const auto& f : sorted) {
        canonical += "\n" + f.relativePath + ":" + f.sha256 + ":" + std::to_string(f.sizeBytes);
    }
    if (sha256Hex(canonical) != b.bundleSha256) return b;

    b.valid = true;
    return b;
}

#ifdef _WIN32
inline bool winHttpGetToMemory(const std::wstring& url, std::string& bodyOut, int timeoutMs = 3000) {
    bodyOut.clear();
    URL_COMPONENTSW uc = {};
    uc.dwStructSize = sizeof(uc);
    wchar_t hostBuf[256] = {};
    wchar_t pathBuf[2048] = {};
    uc.lpszHostName = hostBuf;
    uc.dwHostNameLength = 256;
    uc.lpszUrlPath = pathBuf;
    uc.dwUrlPathLength = 2048;

    if (!WinHttpCrackUrl(url.c_str(), static_cast<DWORD>(url.size()), 0, &uc)) {
        return false;
    }

    HINTERNET hSession = WinHttpOpen(L"GameCheck-Updater/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                     WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!hSession) return false;

    WinHttpSetTimeouts(hSession, timeoutMs, timeoutMs, timeoutMs, timeoutMs);

    HINTERNET hConnect = WinHttpConnect(hSession, hostBuf, uc.nPort, 0);
    if (!hConnect) {
        WinHttpCloseHandle(hSession);
        return false;
    }

    DWORD flags = (uc.nScheme == INTERNET_SCHEME_HTTPS) ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET hRequest = WinHttpOpenRequest(hConnect, L"GET", pathBuf, nullptr,
                                            WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, flags);
    if (!hRequest) {
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return false;
    }

    // Allow redirects for GitHub release asset downloads
    DWORD redirectPolicy = WINHTTP_OPTION_REDIRECT_POLICY_ALWAYS;
    WinHttpSetOption(hRequest, WINHTTP_OPTION_REDIRECT_POLICY, &redirectPolicy, sizeof(redirectPolicy));

    const wchar_t* headers = L"Accept: application/vnd.github+json\r\nUser-Agent: GameCheck-Updater\r\n";
    BOOL ok = WinHttpSendRequest(hRequest, headers, static_cast<DWORD>(-1), WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
              WinHttpReceiveResponse(hRequest, nullptr);

    if (ok) {
        DWORD statusCode = 0;
        DWORD scSize = sizeof(statusCode);
        WinHttpQueryHeaders(hRequest, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &statusCode, &scSize, WINHTTP_NO_HEADER_INDEX);
        if (statusCode >= 200 && statusCode < 300) {
            DWORD avail = 0;
            while (WinHttpQueryDataAvailable(hRequest, &avail) && avail > 0) {
                std::string chunk(avail, '\0');
                DWORD readBytes = 0;
                if (WinHttpReadData(hRequest, &chunk[0], avail, &readBytes) && readBytes > 0) {
                    bodyOut.append(chunk.data(), readBytes);
                } else {
                    break;
                }
            }
        } else {
            ok = FALSE;
        }
    }

    WinHttpCloseHandle(hRequest);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);
    return ok == TRUE && !bodyOut.empty();
}
#endif // _WIN32

} // namespace detail

struct UpdateCheckResult {
    bool checked = false;
    bool updateAvailable = false;
    bool isLocalPatch = false;
    bool isBinaryInstaller = false;
    bool applied = false;
    bool restartRequired = false;
    std::string currentVersion;
    std::string latestVersion;
    std::string source;
    std::string localPatchPath;
    std::string downloadUrl;
    std::string releaseNotes;
    std::string statusMessage;
    std::string errorMessage;
};

inline UpdateCheckResult checkForAppUpdates(const std::string& currentVersion, const std::string& appDir) {
    UpdateCheckResult res;
    res.currentVersion = currentVersion;
    res.latestVersion = currentVersion;
    res.statusMessage = "Up to date";

    namespace fs = std::filesystem;
    std::error_code ec;

    // 1. Scan local <appDir>/patches/*.rigpatch.json and <appDir>/dist/patches/*.rigpatch.json
    std::vector<fs::path> patchDirs = {
        fs::path(appDir) / "patches",
        fs::path(appDir) / "dist" / "patches"
    };
    for (const auto& dir : patchDirs) {
        if (!fs::exists(dir, ec) || !fs::is_directory(dir, ec)) continue;
        for (const auto& entry : fs::directory_iterator(dir, ec)) {
            if (!entry.is_regular_file(ec)) continue;
            std::string fname = entry.path().filename().string();
            if (fname.size() < 14 || fname.rfind(".rigpatch.json") != fname.size() - 14) continue;
            std::string raw = readFileText(entry.path());
            auto bundle = detail::parseAndVerifyRigPatch(raw);
            if (!bundle.valid) continue;
            if (compareCalVerStr(bundle.targetVersion, res.latestVersion) > 0) {
                res.updateAvailable = true;
                res.isLocalPatch = true;
                res.isBinaryInstaller = false;
                res.latestVersion = bundle.targetVersion;
                res.localPatchPath = entry.path().string();
                res.source = "local-patch";
                res.releaseNotes = bundle.notes;
                res.statusMessage = "Patch v" + bundle.targetVersion + " available";
            }
        }
    }

#ifdef _WIN32
    // 2. Query GitHub Releases latest endpoint via WinHTTP (3s timeout, read-only HTTPS)
    std::string apiJson;
    if (detail::winHttpGetToMemory(
            L"https://api.github.com/repos/CiscoFunAndGames/GameCheck/releases/latest",
            apiJson,
            3000)) {
        std::string remoteTag = detail::extractJsonStringField(apiJson, "tag_name");
        if (!remoteTag.empty() && compareCalVerStr(remoteTag, res.latestVersion) > 0) {
            // Find GameCheck-Setup-*.exe or rigcheck-patch-*.rigpatch.json asset URL
            std::string exeUrl;
            std::string patchUrl;
            size_t searchPos = 0;
            while (true) {
                size_t urlKey = apiJson.find("\"browser_download_url\"", searchPos);
                if (urlKey == std::string::npos) break;
                std::string urlVal = detail::extractJsonStringField(apiJson, "browser_download_url", urlKey);
                if (urlVal.find("GameCheck-Setup-") != std::string::npos &&
                    urlVal.find(".exe") != std::string::npos) {
                    exeUrl = urlVal;
                } else if (urlVal.find(".rigpatch.json") != std::string::npos) {
                    patchUrl = urlVal;
                }
                searchPos = urlKey + 22;
            }
            if (!exeUrl.empty() || !patchUrl.empty()) {
                std::string cleanVer = (!remoteTag.empty() && (remoteTag[0] == 'v' || remoteTag[0] == 'V'))
                    ? remoteTag.substr(1) : remoteTag;
                res.updateAvailable = true;
                res.latestVersion = cleanVer;
                res.source = "github-release";
                res.releaseNotes = detail::extractJsonStringField(apiJson, "name");
                if (!exeUrl.empty()) {
                    res.isBinaryInstaller = true;
                    res.isLocalPatch = false;
                    res.downloadUrl = exeUrl;
                } else {
                    res.isBinaryInstaller = false;
                    res.isLocalPatch = false;
                    res.downloadUrl = patchUrl;
                }
                res.statusMessage = "Update v" + cleanVer + " available";
            }
        }
        res.checked = true;
    } else {
        res.checked = true;
        if (res.source.empty()) res.source = "offline";
    }
#else
    res.checked = true;
    if (res.source.empty()) res.source = "local";
#endif

    return res;
}

inline bool applyAutoUpdate(UpdateCheckResult& updateInfo, const std::string& appDir) {
    if (!updateInfo.updateAvailable) return false;
    namespace fs = std::filesystem;
    std::error_code ec;

    if (updateInfo.isLocalPatch && !updateInfo.localPatchPath.empty()) {
        std::string raw = readFileText(fs::path(updateInfo.localPatchPath));
        auto bundle = detail::parseAndVerifyRigPatch(raw);
        if (!bundle.valid) {
            updateInfo.errorMessage = "Patch SHA-256 verification failed.";
            return false;
        }

        // Create backup snapshot of existing target files
        fs::path backupDir = fs::path(appDir) / "dist" / "backups";
        fs::create_directories(backupDir, ec);
        std::time_t now = std::time(nullptr);
        fs::path backupPath = backupDir / ("backup-" + updateInfo.currentVersion + "-" + std::to_string(now) + ".json");
        {
            std::ofstream bfs(backupPath, std::ios::binary | std::ios::trunc);
            if (bfs) {
                bfs << "{\"previousVersion\":\"" << escapeJson(updateInfo.currentVersion)
                    << "\",\"targetVersion\":\"" << escapeJson(bundle.targetVersion)
                    << "\",\"fileCount\":" << bundle.files.size() << "}\n";
            }
        }

        // Write verified patch files
        for (const auto& f : bundle.files) {
            fs::path dest = fs::path(appDir) / f.relativePath;
            fs::create_directories(dest.parent_path(), ec);
            std::ofstream ofs(dest, std::ios::binary | std::ios::trunc);
            if (!ofs) {
                updateInfo.errorMessage = "Failed to write patched file: " + f.relativePath;
                return false;
            }
            ofs.write(f.content.data(), static_cast<std::streamsize>(f.content.size()));
        }

        updateInfo.applied = true;
        updateInfo.statusMessage = "Updated to v" + bundle.targetVersion;
        return true;
    }

#ifdef _WIN32
    if (!updateInfo.downloadUrl.empty()) {
        std::string body;
        std::wstring wUrl(updateInfo.downloadUrl.begin(), updateInfo.downloadUrl.end());
        if (!detail::winHttpGetToMemory(wUrl, body, 30000)) {
            updateInfo.errorMessage = "Failed to download update from GitHub.";
            return false;
        }

        if (updateInfo.isBinaryInstaller) {
            if (body.size() < 10000) {
                updateInfo.errorMessage = "Downloaded installer binary is invalid.";
                return false;
            }
            wchar_t tmpDir[MAX_PATH] = {};
            GetTempPathW(MAX_PATH, tmpDir);
            std::wstring setupPath = std::wstring(tmpDir) + L"GameCheck-Update-Setup.exe";
            {
                HANDLE hFile = CreateFileW(setupPath.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
                if (hFile == INVALID_HANDLE_VALUE) {
                    updateInfo.errorMessage = "Cannot write update installer to TEMP.";
                    return false;
                }
                DWORD written = 0;
                WriteFile(hFile, body.data(), static_cast<DWORD>(body.size()), &written, nullptr);
                CloseHandle(hFile);
            }

            std::wstring wAppDir(appDir.begin(), appDir.end());
            std::wstring params = L"--silent --install-dir=\"" + wAppDir + L"\"";
            SHELLEXECUTEINFOW sei = {};
            sei.cbSize = sizeof(sei);
            sei.fMask = SEE_MASK_NOCLOSEPROCESS;
            sei.lpFile = setupPath.c_str();
            sei.lpParameters = params.c_str();
            sei.nShow = SW_HIDE;
            if (!ShellExecuteExW(&sei)) {
                updateInfo.errorMessage = "Failed to launch update installer.";
                return false;
            }
            if (sei.hProcess) CloseHandle(sei.hProcess);
            updateInfo.applied = true;
            updateInfo.restartRequired = true;
            updateInfo.statusMessage = "Updating to v" + updateInfo.latestVersion;
            return true;
        } else {
            auto bundle = detail::parseAndVerifyRigPatch(body);
            if (!bundle.valid) {
                updateInfo.errorMessage = "Remote patch SHA-256 verification failed.";
                return false;
            }
            for (const auto& f : bundle.files) {
                fs::path dest = fs::path(appDir) / f.relativePath;
                fs::create_directories(dest.parent_path(), ec);
                std::ofstream ofs(dest, std::ios::binary | std::ios::trunc);
                if (!ofs) return false;
                ofs.write(f.content.data(), static_cast<std::streamsize>(f.content.size()));
            }
            updateInfo.applied = true;
            updateInfo.statusMessage = "Updated to v" + bundle.targetVersion;
            return true;
        }
    }
#endif

    return false;
}

// =============================================================================
// 11. Persistent User Preferences (%APPDATA%\GameCheck\settings.json | ~/.config/gamecheck/settings.json)
// =============================================================================
struct UserPreferences {
    bool isSpanish = false;
    int activeOptMode = OPT_MODE_OPTIMAL;
    bool detailedQuickView = false;
    std::string activeCountry = "AR";
    int windowX = -1;
    int windowY = -1;
    int windowW = 1320;
    int windowH = 820;
};

inline std::filesystem::path getUserPreferencesPath() {
    namespace fs = std::filesystem;
#ifdef _WIN32
    wchar_t appData[MAX_PATH] = {};
    DWORD len = GetEnvironmentVariableW(L"APPDATA", appData, MAX_PATH);
    if (len > 0 && len < MAX_PATH) {
        return fs::path(appData) / L"GameCheck" / L"settings.json";
    }
    wchar_t userProf[MAX_PATH] = {};
    len = GetEnvironmentVariableW(L"USERPROFILE", userProf, MAX_PATH);
    if (len > 0 && len < MAX_PATH) {
        return fs::path(userProf) / L"AppData" / L"Roaming" / L"GameCheck" / L"settings.json";
    }
    return fs::path("GameCheck") / "settings.json";
#else
    const char* xdg = std::getenv("XDG_CONFIG_HOME");
    if (xdg && xdg[0] != '\0') {
        return fs::path(xdg) / "gamecheck" / "settings.json";
    }
    const char* home = std::getenv("HOME");
    if (home && home[0] != '\0') {
        return fs::path(home) / ".config" / "gamecheck" / "settings.json";
    }
    return fs::path(".config") / "gamecheck" / "settings.json";
#endif
}

inline UserPreferences loadUserPreferences() {
    UserPreferences prefs;
    std::error_code ec;
    std::filesystem::path cfgPath = getUserPreferencesPath();
    if (!std::filesystem::exists(cfgPath, ec)) {
        return prefs;
    }
    std::ifstream ifs(cfgPath, std::ios::binary);
    if (!ifs) {
        return prefs;
    }
    std::ostringstream ss;
    ss << ifs.rdbuf();
    std::string json = ss.str();

    auto extractBool = [&](const std::string& key, bool defVal) -> bool {
        std::string needle = "\"" + key + "\"";
        size_t pos = json.find(needle);
        if (pos == std::string::npos) return defVal;
        size_t colon = json.find(':', pos + needle.size());
        if (colon == std::string::npos) return defVal;
        size_t valStart = json.find_first_not_of(" \t\r\n", colon + 1);
        if (valStart == std::string::npos) return defVal;
        if (json.compare(valStart, 4, "true") == 0) return true;
        if (json.compare(valStart, 5, "false") == 0) return false;
        return defVal;
    };

    auto extractInt = [&](const std::string& key, int defVal) -> int {
        std::string needle = "\"" + key + "\"";
        size_t pos = json.find(needle);
        if (pos == std::string::npos) return defVal;
        size_t colon = json.find(':', pos + needle.size());
        if (colon == std::string::npos) return defVal;
        size_t valStart = json.find_first_not_of(" \t\r\n", colon + 1);
        if (valStart == std::string::npos) return defVal;
        size_t valEnd = valStart;
        if (json[valEnd] == '-') ++valEnd;
        while (valEnd < json.size() && json[valEnd] >= '0' && json[valEnd] <= '9') ++valEnd;
        if (valEnd == valStart || (valEnd == valStart + 1 && json[valStart] == '-')) return defVal;
        try {
            return std::stoi(json.substr(valStart, valEnd - valStart));
        } catch (...) {
            return defVal;
        }
    };

    prefs.isSpanish = extractBool("isSpanish", false);
    prefs.detailedQuickView = extractBool("detailedQuickView", false);
    int mode = extractInt("activeOptMode", OPT_MODE_OPTIMAL);
    if (mode >= 0 && mode <= 3) prefs.activeOptMode = mode;
    std::string country = detail::extractJsonStringField(json, "activeCountry");
    if (!country.empty()) prefs.activeCountry = country;
    prefs.windowX = extractInt("windowX", -1);
    prefs.windowY = extractInt("windowY", -1);
    prefs.windowW = extractInt("windowW", 1320);
    prefs.windowH = extractInt("windowH", 820);
    return prefs;
}

inline bool saveUserPreferences(const UserPreferences& prefs) {
    std::error_code ec;
    std::filesystem::path cfgPath = getUserPreferencesPath();
    if (!cfgPath.parent_path().empty()) {
        std::filesystem::create_directories(cfgPath.parent_path(), ec);
    }
    std::ofstream ofs(cfgPath, std::ios::binary | std::ios::trunc);
    if (!ofs) return false;
    ofs << "{\n"
        << "  \"isSpanish\": " << (prefs.isSpanish ? "true" : "false") << ",\n"
        << "  \"activeOptMode\": " << prefs.activeOptMode << ",\n"
        << "  \"detailedQuickView\": " << (prefs.detailedQuickView ? "true" : "false") << ",\n"
        << "  \"activeCountry\": \"" << escapeJson(prefs.activeCountry) << "\",\n"
        << "  \"windowX\": " << prefs.windowX << ",\n"
        << "  \"windowY\": " << prefs.windowY << ",\n"
        << "  \"windowW\": " << prefs.windowW << ",\n"
        << "  \"windowH\": " << prefs.windowH << "\n"
        << "}\n";
    return ofs.good();
}

// -----------------------------------------------------------------------------
// Upscaling & Resolution Math Engine
// -----------------------------------------------------------------------------

struct UpscaleTierInfo {
    std::string tierName;
    int scalePct = 100;
    int renderWidth = 1920;
    int renderHeight = 1080;
    std::string renderLabel;
    int estimatedFpsAvg = 60;
    int vramSavedMB = 0;
    std::string recommendation;
};

inline std::vector<UpscaleTierInfo> computeUpscalingMatrix(const SystemSpecs& specs, const GameSpec& game, int mode = OPT_MODE_OPTIMAL) {
    int dispW = specs.display.width > 0 ? specs.display.width : 1920;
    int dispH = specs.display.height > 0 ? specs.display.height : 1080;
    int clampedMode = std::clamp(mode, 0, 3);

    double modeMult = 1.0;
    if (clampedMode == OPT_MODE_FULL_FPS) modeMult = 1.28;
    else if (clampedMode == OPT_MODE_BALANCED) modeMult = 1.08;
    else if (clampedMode == OPT_MODE_QUALITY) modeMult = 0.88;

    auto roundEven = [](int dim, double factor) -> int {
        int val = static_cast<int>(std::round((static_cast<double>(dim) * factor) / 2.0)) * 2;
        return std::max(2, val);
    };

    struct TierDef {
        const char* name;
        int pct;
        double factor;
    };
    const TierDef tiers[] = {
        { "Native (100%)",      100, 1.0 },
        { "Quality (67%)",       67,  2.0 / 3.0 },
        { "Balanced (58%)",      58,  0.58 },
        { "Performance (50%)",   50,  0.50 }
    };

    std::string dispTier = determineResolutionTier(dispW, dispH);
    double dispPixels = static_cast<double>(dispW) * static_cast<double>(dispH);
    double baseBufferMB = (dispTier == "4K") ? 2400.0 : (dispTier == "1440p" ? 1350.0 : 800.0);
    if (game.recVramGB >= 12) baseBufferMB *= 1.15;

    std::vector<UpscaleTierInfo> result;
    result.reserve(4);

    int prevFps = 0;
    for (int i = 0; i < 4; ++i) {
        UpscaleTierInfo info;
        info.tierName = tiers[i].name;
        info.scalePct = tiers[i].pct;
        info.renderWidth = (tiers[i].pct == 100) ? dispW : roundEven(dispW, tiers[i].factor);
        info.renderHeight = (tiers[i].pct == 100) ? dispH : roundEven(dispH, tiers[i].factor);

        if (tiers[i].pct == 100) {
            info.renderLabel = std::to_string(dispW) + "x" + std::to_string(dispH) + " (Native)";
        } else {
            info.renderLabel = std::to_string(info.renderWidth) + "x" + std::to_string(info.renderHeight) +
                               " -> " + std::to_string(dispW) + "x" + std::to_string(dispH);
        }

        double renderPixels = static_cast<double>(info.renderWidth) * static_cast<double>(info.renderHeight);
        double pixelRatioTo1080p = std::max(0.15, renderPixels / (1920.0 * 1080.0));
        double resFactor = (renderPixels >= 1280.0 * 720.0)
            ? getResolutionFactorForPixels(info.renderWidth, info.renderHeight)
            : (std::round(std::pow(pixelRatioTo1080p, 0.58) * 100.0) / 100.0);

        double upscaleOverhead = (tiers[i].pct == 100) ? 1.0 : 0.96;
        int fps = computeFpsEstimate(specs, game, resFactor, modeMult * upscaleOverhead).avg;
        if (i > 0 && fps <= prevFps) {
            fps = prevFps + std::max(2, static_cast<int>(std::round(prevFps * 0.08)));
        }
        info.estimatedFpsAvg = fps;
        prevFps = fps;

        if (tiers[i].pct == 100) {
            info.vramSavedMB = 0;
        } else {
            double savedFrac = std::max(0.0, 1.0 - (renderPixels / std::max(1.0, dispPixels)));
            int rawSaved = static_cast<int>(std::round(baseBufferMB * savedFrac));
            info.vramSavedMB = std::max(64, (rawSaved / 16) * 16);
        }

        if (tiers[i].pct == 100) {
            info.recommendation = (dispTier == "1080p") ? "Best native clarity (Recommended for 1080p)" : "Maximum native sharpness";
        } else if (tiers[i].pct == 67) {
            info.recommendation = (dispTier != "1080p") ? "Sweet spot: near-native IQ + strong FPS gain" : "Great FPS boost with minimal softness";
        } else if (tiers[i].pct == 58) {
            info.recommendation = (clampedMode == OPT_MODE_FULL_FPS) ? "Ideal for high-Hz competitive play" : "Extra headroom for heavy RT/shaders";
        } else {
            info.recommendation = "Max FPS / Low-VRAM fallback (best at 4K)";
        }

        result.push_back(std::move(info));
    }

    return result;
}

// -----------------------------------------------------------------------------
// 1-Click Shareable Rig & Settings Summary
// -----------------------------------------------------------------------------

inline std::string buildShareableSummaryText(const SystemSpecs& specs, const GameSpec& game, const GameAnalysis& an, bool isSpanish = false) {
    DriverAdvisorResult drv = getDriverAppRecommendations(specs, game, an.mode);
    int dispW = specs.display.width > 0 ? specs.display.width : an.screenWidth;
    int dispH = specs.display.height > 0 ? specs.display.height : an.screenHeight;
    int dispHz = specs.display.refreshRateHz > 0 ? specs.display.refreshRateHz : an.refreshRateHz;

    std::ostringstream oss;
    oss << "=== GameCheck v" << FULL_VERSION << " ===\n";
    if (isSpanish) {
        oss << "Equipo Detectado:\n"
            << "  CPU: " << specs.cpu.name << " (" << specs.cpu.threads << " hilos)\n"
            << "  GPU: " << specs.gpu.name << " (" << specs.gpu.vramGB << " GB VRAM)\n"
            << "  RAM: " << specs.ram.totalGB << " GB\n"
            << "  Pantalla: " << dispW << "x" << dispH << " @ " << dispHz << " Hz\n\n"
            << "Juego: " << game.title << "\n"
            << "Veredicto: " << an.verdictBadge << " | Modo: " << an.modeLabel << "\n"
            << "FPS Estimados en Pantalla: ~" << an.estimatedScreenFps.avg << " FPS (" << an.estimatedScreenFps.range << ")\n\n"
            << "Ajustes Recomendados:\n"
            << "  Resolucion: " << an.targetResolution << "\n"
            << "  Preset: " << an.preset << "\n"
            << "  Escalado: " << an.upscalingMode << "\n"
            << "  Texturas: " << an.textures << "\n"
            << "  Sombras: " << an.shadows << "\n"
            << "  Ray Tracing: " << an.rayTracing << "\n"
            << "  Frame Gen: " << an.frameGen << "\n\n"
            << "App de Drivers (" << drv.suiteName << "): " << drv.summary << "\n";
    } else {
        oss << "Detected Rig:\n"
            << "  CPU: " << specs.cpu.name << " (" << specs.cpu.threads << "T)\n"
            << "  GPU: " << specs.gpu.name << " (" << specs.gpu.vramGB << " GB VRAM)\n"
            << "  RAM: " << specs.ram.totalGB << " GB\n"
            << "  Display: " << dispW << "x" << dispH << " @ " << dispHz << " Hz\n\n"
            << "Game: " << game.title << "\n"
            << "Verdict: " << an.verdictBadge << " | Mode: " << an.modeLabel << "\n"
            << "Predicted FPS on Screen: ~" << an.estimatedScreenFps.avg << " FPS (" << an.estimatedScreenFps.range << ")\n\n"
            << "Recommended Settings:\n"
            << "  Resolution: " << an.targetResolution << "\n"
            << "  Preset: " << an.preset << "\n"
            << "  Upscaling: " << an.upscalingMode << "\n"
            << "  Textures: " << an.textures << "\n"
            << "  Shadows: " << an.shadows << "\n"
            << "  Ray Tracing: " << an.rayTracing << "\n"
            << "  Frame Gen: " << an.frameGen << "\n\n"
            << "Driver App (" << drv.suiteName << "): " << drv.summary << "\n";
    }
    return oss.str();
}

} // namespace GameCheck

#endif // GAMECHECK_CORE_HPP
