// =============================================================================
// GameCheck — Pure C++17 Core Engine Unit & Integration Test Suite
// Compile:
//   C:\mingw64\bin\g++.exe -O2 -std=c++17 native/test_core.cpp -o bin/test-gamecheck-core.exe -luser32 -lgdi32 -ladvapi32 -lshell32 -static -s
// =============================================================================

#include "gamecheck_core.hpp"
#include <cassert>
#include <iostream>

static int g_passed = 0;
static int g_failed = 0;

static void check(bool condition, const std::string& label) {
    if (condition) {
        ++g_passed;
        std::cout << "  [PASS] " << label << "\n";
    } else {
        ++g_failed;
        std::cerr << "  [FAIL] " << label << "\n";
    }
}

int main() {
    std::cout << "================================================================\n";
    std::cout << "  GameCheck C++17 Core Engine Test Suite (v" << GameCheck::FULL_VERSION << ")\n";
    std::cout << "================================================================\n\n";

    // 1. Identity & CalVer Versioning
    std::cout << "[1/6] Testing Application Identity & CalVer Versioning...\n";
    check(std::string(GameCheck::APP_NAME) == "GameCheck", "APP_NAME == GameCheck");
    check(std::string(GameCheck::CALVER) == "2026.11.17", "CALVER == 2026.11.17");
    check(std::string(GameCheck::FULL_VERSION) == "2026.11.17.2", "FULL_VERSION == 2026.11.17.2");
    check(std::string(GameCheck::GIT_TAG) == "v2026.11.17.2", "GIT_TAG == v2026.11.17.2");
    check( std::string(GameCheck::ARCHITECTURE).find("Pure C++17 Native Desktop GUI") != std::string::npos, "ARCHITECTURE string verified" );

    // 2. Hardware & Display Telemetry + Benchmark Lookup Tables
    std::cout << "\n[2/6] Testing Pure C++17 Hardware & Display Telemetry...\n";
    GameCheck::SystemSpecs specs = GameCheck::detectSystemSpecs();
    std::cout << "  -> Detected CPU     : " << specs.cpu.name << " (" << specs.cpu.threads << " threads, Score " << specs.cpu.score << "/100)\n";
    std::cout << "  -> Detected GPU     : " << specs.gpu.name << " (" << specs.gpu.vramGB << " GB VRAM, Score " << specs.gpu.score << "/100)\n";
    std::cout << "  -> Detected RAM     : " << specs.ram.totalGB << " GB Total (" << specs.ram.freeGB << " GB Avail)\n";
    std::cout << "  -> Primary Storage  : " << specs.storage.label << " (" << specs.storage.freeGB << " GB Free / " << specs.storage.totalGB << " GB)\n";
    std::cout << "  -> Primary Display  : " << specs.display.name << " (" << specs.display.width << "x" << specs.display.height << " @ " << specs.display.refreshRateHz << "Hz)\n";
    std::cout << "  -> Telemetry Time   : " << specs.scanDurationMs << " ms\n";

    check(!specs.cpu.name.empty() && specs.cpu.threads >= 1 && specs.cpu.score >= 15, "CPU telemetry & score valid");
    check(!specs.gpu.name.empty() && specs.gpu.vramGB >= 1 && specs.gpu.score >= 8, "GPU telemetry & score valid");
    check(specs.ram.totalGB >= 2, "RAM telemetry valid");
    check(!specs.storage.drives.empty() && specs.storage.totalGB > 0, "Storage drives enumerated");
    check(!specs.displays.empty() && specs.display.width >= 640 && specs.display.refreshRateHz >= 30, "Display / Monitor telemetry valid");
    check(GameCheck::scoreCPU("AMD Ryzen 7 7800X3D") == 97, "scoreCPU(Ryzen 7 7800X3D) == 97");
    check(GameCheck::scoreCPU("Intel Core i5-12400F") == 74, "scoreCPU(Core i5-12400F) == 74");
    check(GameCheck::scoreGPU("NVIDIA GeForce RTX 4070 Super", 12) == 82, "scoreGPU(RTX 4070 Super) == 82");
    check(GameCheck::scoreGPU("AMD Radeon RX 7800 XT", 16) == 80, "scoreGPU(RX 7800 XT) == 80");
    check(GameCheck::scoreGPU("Intel Arc B580", 12) == 66, "scoreGPU(Intel Arc B580) == 66");

    // 3. 24 Catalog Games + Installed Game Scanner
    std::cout << "\n[3/6] Testing 24 Built-In Catalog Games & Non-Invasive Installed Scanner...\n";
    auto catalog = GameCheck::getCatalogGames();
    check(catalog.size() == 24, "Catalog contains exactly 24 games");
    check(catalog[0].title == "Cyberpunk 2077: Phantom Liberty" && catalog[0].steamAppId == "1091500", "Game #1 Cyberpunk 2077 verified");
    check(catalog[23].title == "Final Fantasy XVI" && catalog[23].steamAppId == "2515020", "Game #24 Final Fantasy XVI verified");

    auto installed = GameCheck::scanInstalledGames();
    auto merged = GameCheck::getMergedGameList(installed);
    std::cout << "  -> Installed Games Found: " << installed.size() << " | Merged List Total: " << merged.size() << "\n";
    check(merged.size() >= 24, "Merged game list has >= 24 games");
    if (!installed.empty()) {
        check(merged[0].installed || merged[0].playStatus != "CATALOG", "Installed/active games sorted to top of merged list");
    }

    // 4. 4 Screen-Aware Optimization Modes & Config Exporters
    std::cout << "\n[4/6] Testing 4 Screen-Aware Optimization Modes & Exporters...\n";
    const auto& cp2077 = catalog[0];
    auto aOptimal  = GameCheck::analyzeGame(specs, cp2077, GameCheck::OPT_MODE_OPTIMAL);
    auto aFullFps  = GameCheck::analyzeGame(specs, cp2077, GameCheck::OPT_MODE_FULL_FPS);
    auto aBalanced = GameCheck::analyzeGame(specs, cp2077, GameCheck::OPT_MODE_BALANCED);
    auto aQuality  = GameCheck::analyzeGame(specs, cp2077, GameCheck::OPT_MODE_QUALITY);

    check(aOptimal.modeId == "optimal" && aOptimal.settingImpacts.size() == 8, "Mode 0 (Optimal) produces 8 setting impacts");
    check(aFullFps.modeId == "full_fps" && aFullFps.estimatedScreenFps.avg >= aOptimal.estimatedScreenFps.avg, "Mode 1 (Full FPS) boosts predicted screen FPS");
    check(aBalanced.modeId == "balanced" && !aBalanced.syncAdvice.empty(), "Mode 2 (Balanced) produces VRR sync advice");
    check(aQuality.modeId == "quality_30_60" && aQuality.qualityScore >= aFullFps.qualityScore, "Mode 3 (Quality 30-60) maximizes visual quality score");

    std::string iniText  = GameCheck::exportConfigIni(specs, cp2077, aOptimal);
    std::string jsonText = GameCheck::exportConfigJson(specs, cp2077, aOptimal);
    std::string mdText   = GameCheck::exportConfigMd(specs, cp2077, aOptimal);
    check(iniText.find("[Graphics.OptimalSettings]") != std::string::npos, "exportConfigIni() valid");
    check(jsonText.find("\"appName\": \"GameCheck\"") != std::string::npos, "exportConfigJson() valid");
    check(mdText.find("8-Setting FPS Gain & VRAM Impact Breakdown") != std::string::npos, "exportConfigMd() valid");

    // 5. Raw Steam System Requirements Parser
    std::cout << "\n[5/6] Testing Raw Steam Requirements Parser...\n";
    std::string sampleSteam =
        "Minimum:\n"
        "Processor: Intel Core i5-8400 or AMD Ryzen 5 1600\n"
        "Memory: 16 GB RAM\n"
        "Graphics: NVIDIA GeForce GTX 1060 6GB\n"
        "Storage: 90 GB available space (SSD)\n"
        "Recommended:\n"
        "Processor: AMD Ryzen 7 5800X\n"
        "Memory: 32 GB RAM\n"
        "Graphics: NVIDIA GeForce RTX 4070 12GB with Ray Tracing\n";
    auto parsedGame = GameCheck::parseRawSteamReqs(sampleSteam, "Test UE5 Title", "Action RPG");
    check(parsedGame.minRamGB == 16 && parsedGame.recRamGB == 32 && parsedGame.storageGB == 90 && parsedGame.supportsRT, "parseRawSteamReqs() extracts CPU/GPU/RAM/Storage/RT");

    // 6. Country-Aware Price & Verified Deals Finder + Firewall Gate + Reputation Shield
    std::cout << "\n[6/6] Testing Price & Deals Finder, Firewall Gate & Reputation Shield...\n";
    GameCheck::setFirewallAuthorized(false);
    check(!GameCheck::isFirewallAuthorized(), "Firewall is unauthorized (blocked) by default");

    auto blockedRes = GameCheck::searchComponentDeals("NVIDIA GeForce RTX 4070 Super", "AR", false);
    check(blockedRes.firewallBlocked && blockedRes.deals.empty() && blockedRes.status == "FIREWALL_PERMISSION_REQUIRED", "Outbound deal search blocked when firewallAuthorized == false");

    GameCheck::setFirewallAuthorized(true);
    auto arRes = GameCheck::searchComponentDeals("NVIDIA GeForce RTX 4070 Super", "AR", false);
    check(!arRes.firewallBlocked && arRes.verifiedCount == 7 && arRes.blockedBadReputationCount == 3, "Argentina (AR) returns 7 verified stores and blocks 3 bad-reputation/mined/scam listings");
    check(arRes.deals[0].storeName == "HardGamers Argentina" && arRes.deals[1].storeName == "Compra Gamer", "HardGamers Argentina & Compra Gamer verified");

    for (const char* country : { "US", "BR", "CL", "MX", "ES" }) {
        auto cRes = GameCheck::searchComponentDeals("AMD Radeon RX 7800 XT", country, true);
        check(!cRes.deals.empty() && cRes.blockedBadReputationCount >= 3, std::string("Country ") + country + " verified deals & reputation audit");
    }

    // 7. GPU Driver Suite Detection & Driver App Configuration Advisor
    std::cout << "\n[7/7] Testing GPU Driver Suite Detection & Driver App Advisor...\n";
    auto findSetting = [](const GameCheck::DriverAdvisorResult& adv, const std::string& keySubstr) -> std::string {
        for (const auto& s : adv.settings) {
            if (s.setting.find(keySubstr) != std::string::npos) return s.recommendedValue;
        }
        return "";
    };

    // 7a. AMD Adrenalin (Ryzen 7 5800X + RX 7600 + 180Hz VRR)
    {
        GameCheck::SystemSpecs amdSpecs;
        amdSpecs.cpu.name = "AMD Ryzen 7 5800X";
        amdSpecs.gpu.name = "AMD Radeon RX 7600";
        amdSpecs.gpu.vendor = "amd";
        amdSpecs.gpu.vramGB = 8;
        amdSpecs.display.refreshRateHz = 180;
        amdSpecs.display.vrrCapable = true;
        amdSpecs.storage.drives = {
            { "C:", "System SSD", "NTFS", 250, 45, 205, 82 },
            { "D:", "Games NVMe", "NTFS", 1000, 520, 480, 48 }
        };
        amdSpecs.driverSuites = GameCheck::detectDriverSuites(amdSpecs);
        check(!amdSpecs.driverSuites.empty(), "AMD detectDriverSuites() detects Adrenalin/AMD driver");

        auto advAaa = GameCheck::getDriverAppRecommendations(amdSpecs, cp2077, GameCheck::OPT_MODE_OPTIMAL);
        check(advAaa.suiteName.find("Adrenalin") != std::string::npos, "AMD advisor returns Adrenalin suite");
        check(findSetting(advAaa, "Radeon Chill").find("177") != std::string::npos, "AMD Radeon Chill caps at 177 FPS (180Hz - 3)");
        check(findSetting(advAaa, "FreeSync").find("Enabled") != std::string::npos, "AMD FreeSync enabled for VRR display");
        check(findSetting(advAaa, "Smart Access Memory").find("Enabled") != std::string::npos, "AMD SAM enabled for Ryzen 5800X + RX 7600");
        check(findSetting(advAaa, "AFMF 2").find("Auto") != std::string::npos, "AFMF 2 set to Auto for AAA Optimal mode");
        check(advAaa.storageAdvice.find("D:") != std::string::npos, "Storage advice recommends D: drive with 520 GB free");

        GameCheck::GameSpec cs2 = cp2077;
        cs2.id = "cs2";
        cs2.title = "Counter-Strike 2";
        cs2.genre = "Tactical Shooter / FPS";
        auto advCs2 = GameCheck::getDriverAppRecommendations(amdSpecs, cs2, GameCheck::OPT_MODE_FULL_FPS);
        check(findSetting(advCs2, "Radeon Chill") == "Off", "AMD Radeon Chill Off in Full FPS mode");
        check(findSetting(advCs2, "AFMF 2") == "Off", "AFMF 2 Off for competitive shooter CS2");
    }

    // 7b. NVIDIA App / Control Panel (RTX 4070 + 165Hz VRR)
    {
        GameCheck::SystemSpecs nvSpecs;
        nvSpecs.cpu.name = "Intel Core i7-13700K";
        nvSpecs.gpu.name = "NVIDIA GeForce RTX 4070";
        nvSpecs.gpu.vendor = "nvidia";
        nvSpecs.gpu.vramGB = 12;
        nvSpecs.display.refreshRateHz = 165;
        nvSpecs.display.vrrCapable = true;
        auto advNv = GameCheck::getDriverAppRecommendations(nvSpecs, cp2077, GameCheck::OPT_MODE_OPTIMAL);
        check(advNv.suiteName.find("NVIDIA") != std::string::npos, "NVIDIA advisor returns NVIDIA App / Control Panel");
        check(findSetting(advNv, "Max Frame Rate").find("162") != std::string::npos, "NVIDIA Max Frame Rate caps at 162 FPS (165Hz - 3)");
        check(findSetting(advNv, "Shader Cache Size") == "10 GB", "NVIDIA Shader Cache Size set to 10 GB");
        check(findSetting(advNv, "G-Sync").find("Enabled") != std::string::npos, "NVIDIA G-Sync enabled for VRR display");
    }

    // 7c. Intel Arc Control / Graphics Software (Arc B580 + 144Hz)
    {
        GameCheck::SystemSpecs intelSpecs;
        intelSpecs.cpu.name = "Intel Core i5-12400F";
        intelSpecs.gpu.name = "Intel Arc B580";
        intelSpecs.gpu.vendor = "intel";
        intelSpecs.gpu.vramGB = 12;
        intelSpecs.display.refreshRateHz = 144;
        intelSpecs.display.vrrCapable = true;
        auto advIntel = GameCheck::getDriverAppRecommendations(intelSpecs, cp2077, GameCheck::OPT_MODE_OPTIMAL);
        check(advIntel.suiteName.find("Intel Arc") != std::string::npos, "Intel advisor returns Intel Arc Control / Graphics Software");
        check(findSetting(advIntel, "Resizable BAR").find("Enabled") != std::string::npos, "Intel Arc mandates Resizable BAR");
        check(findSetting(advIntel, "Adaptive Sync").find("141") != std::string::npos, "Intel Arc Adaptive Sync caps at 141 FPS (144Hz - 3)");
    }

    // 7d. Export integration check
    check(jsonText.find("\"driverAdvisor\"") != std::string::npos && jsonText.find("\"driverSuites\"") != std::string::npos, "exportConfigJson() includes driverSuites & driverAdvisor");
    check(mdText.find("GPU Driver App Configuration") != std::string::npos, "exportConfigMd() includes GPU Driver App Configuration section");

    // 8. CalVer Comparison & SHA-256 Auto-Updater Core
    std::cout << "\n[8/9] Testing CalVer Comparison & SHA-256 Auto-Updater Core...\n";
    check(GameCheck::compareCalVerStr("v2026.11.18.4", "2026.11.17.2") > 0, "compareCalVerStr('v2026.11.18.4', '2026.11.17.2') > 0");
    check(GameCheck::compareCalVerStr("2026.11.17.2", "2026.11.17.2") == 0, "compareCalVerStr('2026.11.17.2', '2026.11.17.2') == 0");
    check(GameCheck::compareCalVerStr("2026.11.17", "2026.11.17.1") < 0, "compareCalVerStr('2026.11.17', '2026.11.17.1') < 0");
    check(GameCheck::sha256Hex("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "sha256Hex('abc') matches NIST test vector");

    // 9. Persistent User Preferences (settings.json)
    std::cout << "\n[9/9] Testing Persistent User Preferences Roundtrip...\n";
    {
        std::filesystem::path tmpRoot = std::filesystem::temp_directory_path() / "gamecheck_test_prefs";
        std::error_code ec;
        std::filesystem::remove_all(tmpRoot, ec);
        std::filesystem::create_directories(tmpRoot, ec);
#ifdef _WIN32
        wchar_t oldAppData[MAX_PATH] = {};
        DWORD oldLen = GetEnvironmentVariableW(L"APPDATA", oldAppData, MAX_PATH);
        SetEnvironmentVariableW(L"APPDATA", tmpRoot.wstring().c_str());
#else
        const char* oldXdg = std::getenv("XDG_CONFIG_HOME");
        std::string oldXdgCopy = oldXdg ? oldXdg : "";
        setenv("XDG_CONFIG_HOME", tmpRoot.string().c_str(), 1);
#endif
        GameCheck::UserPreferences outPrefs;
        outPrefs.isSpanish = true;
        outPrefs.activeOptMode = GameCheck::OPT_MODE_FULL_FPS;
        outPrefs.detailedQuickView = true;
        outPrefs.activeCountry = "ES";
        outPrefs.windowX = 120;
        outPrefs.windowY = 85;
        outPrefs.windowW = 1440;
        outPrefs.windowH = 900;

        bool saved = GameCheck::saveUserPreferences(outPrefs);
        GameCheck::UserPreferences inPrefs = GameCheck::loadUserPreferences();

#ifdef _WIN32
        SetEnvironmentVariableW(L"APPDATA", oldLen > 0 ? oldAppData : nullptr);
#else
        if (!oldXdgCopy.empty()) setenv("XDG_CONFIG_HOME", oldXdgCopy.c_str(), 1);
        else unsetenv("XDG_CONFIG_HOME");
#endif
        std::filesystem::remove_all(tmpRoot, ec);

        check(saved, "saveUserPreferences() writes settings.json");
        check(inPrefs.isSpanish == true && inPrefs.activeOptMode == GameCheck::OPT_MODE_FULL_FPS, "loadUserPreferences() restores language & optMode");
        check(inPrefs.detailedQuickView == true && inPrefs.activeCountry == "ES", "loadUserPreferences() restores detailedQuickView & country");
        check(inPrefs.windowX == 120 && inPrefs.windowY == 85 && inPrefs.windowW == 1440 && inPrefs.windowH == 900, "loadUserPreferences() restores window geometry");
    }

    std::cout << "\n================================================================\n";
    std::cout << "  PASSED: " << g_passed << " | FAILED: " << g_failed << "\n";
    std::cout << "================================================================\n";
    return g_failed == 0 ? 0 : 1;
}
