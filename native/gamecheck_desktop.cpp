// =============================================================================
// GameCheck — 100% Pure C++17 Native Desktop GUI Application
// Style: Fluent Minimalist Cyberpunk HUD (Obsidian Dark + Cyber Yellow/Cyan)
// Windows: Native Win32 API + GDI+ Chamfered Vector HUD + Owner-Drawn Controls
// Linux:   Native C++17 CLI / JSON Smoke-Test Interface
// Zero Electron / Web-Wrapper Overhead (0% Idle CPU, Read-Only Non-Invasive)
// =============================================================================

#ifdef _WIN32
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <objidl.h>
#include <algorithm>
using std::min;
using std::max;
#include <gdiplus.h>
#include <commctrl.h>
#include <commdlg.h>
#include <shellapi.h>
#include <uxtheme.h>
#include <tlhelp32.h>
#include <unordered_map>
#include <cmath>
#include <thread>
#endif

#include "gamecheck_core.hpp"

#ifdef _WIN32

using namespace Gdiplus;

// =============================================================================
// Modern Dark Slate Palette (Fluent / Linear-Inspired)
// =============================================================================
namespace CyberPalette {
    static const Color VoidCanvas(255, 13, 17, 23);      // #0D1117 Deep Slate Canvas
    static const Color PanelSurface(255, 22, 27, 34);    // #161B22 Elevated Card Surface
    static const Color PanelElevated(255, 31, 38, 49);   // #1F2631 Hover / Active Surface
    static const Color BorderSubtle(255, 45, 54, 68);    // #2D3644 Subtle 1px Border
    static const Color CyberYellow(255, 59, 130, 246);   // #3B82F6 Primary Brand Blue
    static const Color NeonCrimson(255, 244, 63, 94);    // #F43F5E Soft Rose / Warning
    static const Color NeuralCyan(255, 56, 189, 248);    // #38BDF8 Soft Sky Accent
    static const Color AcidGreen(255, 16, 185, 129);     // #10B981 Modern Emerald / Ready
    static const Color AmberWarm(255, 245, 158, 11);     // #F59E0B Warm Amber / Medium
    static const Color IndigoSoft(255, 129, 140, 248);   // #818CF8 Soft Indigo / Display
    static const Color TextMain(255, 241, 245, 249);     // #F1F5F9 Crisp Slate White
    static const Color TextMuted(255, 148, 163, 184);    // #94A3B8 Balanced Muted Gray
}

// Control IDs
enum ControlId {
    IDC_BTN_RESCAN       = 1001,
    IDC_BTN_WHATIF       = 1002,
    IDC_BTN_PARSE_STEAM  = 1003,
    IDC_BTN_DEALS_TOP    = 1004,
    IDC_BTN_DRIVER_CFG   = 1005,
    IDC_BTN_PATCH_INFO   = 1006,

    IDC_EDIT_SEARCH      = 1010,
    IDC_COMBO_FILTER     = 1011,
    IDC_LIST_GAMES       = 1012,
    IDC_COMBO_LANG       = 1013,

    IDC_BTN_MODE_OPTIMAL = 1020,
    IDC_BTN_MODE_FULLFPS = 1021,
    IDC_BTN_MODE_BALANCED= 1022,
    IDC_BTN_MODE_QUALITY = 1023,

    IDC_BTN_TAB_QUICK    = 1025,
    IDC_BTN_TAB_MATCH    = 1026,
    IDC_BTN_TAB_DRIVER   = 1027,
    IDC_BTN_TAB_TIPS     = 1028,
    IDC_BTN_SAVE_DRV_MD  = 1029,

    IDC_BTN_SAVE_INI     = 1030,
    IDC_BTN_SAVE_JSON    = 1031,
    IDC_BTN_SAVE_MD      = 1032,
    IDC_BTN_COPY_SUMMARY = 1033,
    IDC_BTN_FIND_DEALS   = 1034,
    IDC_BTN_TOGGLE_DETAIL= 1036,
    IDC_LIST_DETAIL      = 1037,

    // Modal Dialog Control IDs
    IDC_DLG_OK           = 2001,
    IDC_DLG_CANCEL       = 2002,
    IDC_DLG_RESET        = 2003,
    IDC_DLG_PASTE_CLIP   = 2004,
    IDC_DLG_OPEN_BROWSER = 2005,
    IDC_DLG_SEARCH_DEALS = 2006,
    IDC_DLG_CHECK_UPDATES = 2007,
    IDC_DLG_PICK_1       = 2010,
    IDC_DLG_PICK_2       = 2011,
    IDC_DLG_PICK_3       = 2012,
    IDC_DLG_PICK_4       = 2013,
    IDC_DLG_PICK_5       = 2014,
    IDC_DLG_COMBO_1      = 2020,
    IDC_DLG_COMBO_2      = 2021,
    IDC_DLG_COMBO_3      = 2022,
    IDC_DLG_COMBO_4      = 2023,
    IDC_DLG_EDIT_1       = 2030,
    IDC_DLG_EDIT_2       = 2031,
    IDC_DLG_LIST_1       = 2040,
    IDC_DLG_STATUS_LBL   = 2050,
    IDC_DLG_FW_LBL       = 2051
};

struct AppState {
    HWND hwndMain = nullptr;
    HWND hwndSearch = nullptr;
    HWND hwndFilter = nullptr;
    HWND hwndList = nullptr;
    HWND hwndLang = nullptr;
    HIMAGELIST hListImg = nullptr;

    HWND btnRescan = nullptr;
    HWND btnWhatIf = nullptr;
    HWND btnParseSteam = nullptr;
    HWND btnDealsTop = nullptr;
    HWND btnDriverCfg = nullptr;
    HWND btnPatchInfo = nullptr;

    HWND btnModeOptimal = nullptr;
    HWND btnModeFullFps = nullptr;
    HWND btnModeBalanced = nullptr;
    HWND btnModeQuality = nullptr;

    HWND btnTabQuick = nullptr;
    HWND btnTabMatch = nullptr;
    HWND btnTabDriver = nullptr;
    HWND btnTabTips = nullptr;
    HWND btnSaveDrvMd = nullptr;
    HWND btnToggleDetail = nullptr;
    HWND hwndDetailList = nullptr;

    HWND btnSaveIni = nullptr;
    HWND btnSaveJson = nullptr;
    HWND btnSaveMd = nullptr;
    HWND btnCopySummary = nullptr;
    HWND btnFindDeals = nullptr;

    HFONT hFontUi = nullptr;
    HFONT hFontUiBold = nullptr;
    HFONT hFontTitle = nullptr;
    HBRUSH hBrushDarkEdit = nullptr;
    HBRUSH hBrushDlgBg = nullptr;

    GameCheck::SystemSpecs detectedSpecs;
    GameCheck::SystemSpecs activeSpecs;
    bool isSimulated = false;
    bool isSpanish = false;
    bool detailedQuickView = false;
    int simCpuIdx = 0;
    int simGpuIdx = 0;
    int simRamIdx = 0;
    int simMonIdx = 0;

    std::vector<GameCheck::GameSpec> allGames;
    std::vector<int> filteredIndices;
    int selectedGameIdx = 0;
    int activeOptMode = GameCheck::OPT_MODE_OPTIMAL;
    int activeTab = 0; // 0 = Quick Settings, 1 = PC Match & Impact, 2 = Driver App, 3 = Upscaling & Tips
    std::string activeCountry = "AR";

    GameCheck::GameAnalysis currentAnalysis;
    bool hasCustomParsedGame = false;
    GameCheck::GameSpec customParsedGame;

    // 60fps UI Animation State (0% idle CPU: KillTimer when settled)
    static constexpr UINT_PTR TIMER_UI_ANIM = 1;
    static constexpr UINT_PTR TIMER_COPY_CONFIRM = 3003;
    bool uiAnimTimerActive = false;
    float tabAnimT = 1.0f;
    float barAnimT = 1.0f;
    float tabIndicatorX = 0.0f;
    float tabIndicatorTargetX = 0.0f;
    bool tabIndicatorInit = false;
    std::unordered_map<HWND, float> btnHoverCurrent;
    std::unordered_map<HWND, float> btnHoverTarget;
    std::unordered_map<HWND, bool> btnHoverTracked;

    // Auto-Updater State
    static constexpr UINT WM_APP_UPDATE_RESULT = WM_APP + 10;
    GameCheck::UpdateCheckResult updateState;
    bool updateCheckInProgress = false;
    std::wstring updatePillText = L"Checking updates...";
    Color updatePillColor = CyberPalette::TextMuted;
    HWND hwndUpdatesDlgLabel = nullptr;
};

static AppState g_app;
static WNDPROC g_origCyberBtnProc = nullptr;

static std::string getAppRootDir() {
    wchar_t exeBuf[MAX_PATH] = {};
    DWORD len = GetModuleFileNameW(nullptr, exeBuf, MAX_PATH);
    if (len == 0 || len >= MAX_PATH) return ".";
    std::filesystem::path exePath(exeBuf);
    std::filesystem::path exeDir = exePath.parent_path();
    std::string dirName = exeDir.filename().string();
    for (char& c : dirName) {
        if (c >= 'A' && c <= 'Z') c = static_cast<char>(c - 'A' + 'a');
    }
    if (dirName == "bin" && exeDir.has_parent_path()) {
        return exeDir.parent_path().string();
    }
    return exeDir.string();
}

static void startAsyncUpdateCheck(HWND hwndNotify, bool autoApply) {
    if (!hwndNotify || !IsWindow(hwndNotify)) return;
    g_app.updateCheckInProgress = true;
    g_app.updatePillText = g_app.isSpanish ? L"Buscando..." : L"Checking...";
    g_app.updatePillColor = CyberPalette::TextMuted;
    InvalidateRect(hwndNotify, nullptr, FALSE);

    std::string appDir = getAppRootDir();
    std::thread([hwndNotify, autoApply, appDir]() {
        GameCheck::UpdateCheckResult res = GameCheck::checkForAppUpdates(GameCheck::FULL_VERSION, appDir);
        if (autoApply && res.updateAvailable) {
            GameCheck::applyAutoUpdate(res, appDir);
        }
        if (IsWindow(hwndNotify)) {
            PostMessageW(hwndNotify, AppState::WM_APP_UPDATE_RESULT, 0,
                         reinterpret_cast<LPARAM>(new GameCheck::UpdateCheckResult(res)));
        }
    }).detach();
}

static Color lerpColor(Color a, Color b, float t) {
    t = std::clamp(t, 0.0f, 1.0f);
    BYTE ca = static_cast<BYTE>(a.GetA() + (b.GetA() - a.GetA()) * t);
    BYTE cr = static_cast<BYTE>(a.GetR() + (b.GetR() - a.GetR()) * t);
    BYTE cg = static_cast<BYTE>(a.GetG() + (b.GetG() - a.GetG()) * t);
    BYTE cb = static_cast<BYTE>(a.GetB() + (b.GetB() - a.GetB()) * t);
    return Color(ca, cr, cg, cb);
}

static void computeTabIndicatorBounds(int tabIndex, float& outX, float& outW) {
    outX = 0.0f;
    outW = 100.0f;
    if (!g_app.hwndMain) return;
    RECT rc;
    GetClientRect(g_app.hwndMain, &rc);
    int w = rc.right - rc.left;
    int margin = 14;
    int leftW = std::max(380, std::min(500, static_cast<int>(w * 0.36)));
    int rightPaneX = margin + leftW + 16;
    int rightPaneW = std::max(380, w - rightPaneX - margin);
    int tabGap = 8;
    int tabW = (rightPaneW - tabGap * 3) / 4;
    int idx = std::clamp(tabIndex, 0, 3);
    outX = static_cast<float>(rightPaneX + (tabW + tabGap) * idx);
    outW = (idx == 3) ? static_cast<float>(rightPaneW - (tabW + tabGap) * 3) : static_cast<float>(tabW);
}

static void ensureUiAnimTimer() {
    if (!g_app.uiAnimTimerActive && g_app.hwndMain) {
        SetTimer(g_app.hwndMain, AppState::TIMER_UI_ANIM, 16, nullptr);
        g_app.uiAnimTimerActive = true;
    }
}

static void startUiAnimation(bool animateTab, bool animateBars) {
    if (animateTab) g_app.tabAnimT = 0.0f;
    if (animateBars) g_app.barAnimT = 0.0f;
    float tx = 0.0f, tw = 0.0f;
    computeTabIndicatorBounds(g_app.activeTab, tx, tw);
    g_app.tabIndicatorTargetX = tx;
    if (!g_app.tabIndicatorInit) {
        g_app.tabIndicatorX = tx;
        g_app.tabIndicatorInit = true;
    }
    ensureUiAnimTimer();
}

static LRESULT CALLBACK CyberButtonSubclassProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_MOUSEMOVE: {
            if (!g_app.btnHoverTracked[hwnd]) {
                TRACKMOUSEEVENT tme = {};
                tme.cbSize = sizeof(tme);
                tme.dwFlags = TME_LEAVE;
                tme.hwndTrack = hwnd;
                if (TrackMouseEvent(&tme)) {
                    g_app.btnHoverTracked[hwnd] = true;
                }
            }
            auto it = g_app.btnHoverTarget.find(hwnd);
            if (it == g_app.btnHoverTarget.end() || it->second < 1.0f) {
                g_app.btnHoverTarget[hwnd] = 1.0f;
                if (g_app.btnHoverCurrent.find(hwnd) == g_app.btnHoverCurrent.end()) {
                    g_app.btnHoverCurrent[hwnd] = 0.0f;
                }
                ensureUiAnimTimer();
            }
            break;
        }
        case WM_MOUSELEAVE: {
            g_app.btnHoverTracked[hwnd] = false;
            g_app.btnHoverTarget[hwnd] = 0.0f;
            ensureUiAnimTimer();
            break;
        }
        case WM_NCDESTROY: {
            g_app.btnHoverCurrent.erase(hwnd);
            g_app.btnHoverTarget.erase(hwnd);
            g_app.btnHoverTracked.erase(hwnd);
            break;
        }
    }
    return CallWindowProcW(g_origCyberBtnProc, hwnd, msg, wParam, lParam);
}

static void attachCyberButtonHover(HWND btn) {
    if (!btn) return;
    g_app.btnHoverCurrent[btn] = 0.0f;
    g_app.btnHoverTarget[btn] = 0.0f;
    g_app.btnHoverTracked[btn] = false;
    WNDPROC prev = reinterpret_cast<WNDPROC>(
        SetWindowLongPtrW(btn, GWLP_WNDPROC, reinterpret_cast<LONG_PTR>(CyberButtonSubclassProc))
    );
    if (!g_origCyberBtnProc && prev && prev != CyberButtonSubclassProc) {
        g_origCyberBtnProc = prev;
    }
}

static const wchar_t* tr(const wchar_t* en, const wchar_t* es) {
    return g_app.isSpanish ? es : en;
}

static Color colorFromHex(uint32_t hex, BYTE alpha = 255) {
    BYTE r = static_cast<BYTE>((hex >> 16) & 0xFF);
    BYTE g = static_cast<BYTE>((hex >> 8) & 0xFF);
    BYTE b = static_cast<BYTE>(hex & 0xFF);
    return Color(alpha, r, g, b);
}

// =============================================================================
// Modern Rounded Card & Smooth Pill Progress Bar Renderers
// =============================================================================
static void BuildChamferPath(GraphicsPath& path, RectF r, REAL radius, REAL /*unused1*/ = 0.0f, REAL /*unused2*/ = 0.0f, REAL /*unused3*/ = 0.0f) {
    REAL rad = std::max(0.0f, std::min(radius, std::min(r.Width * 0.5f, r.Height * 0.5f)));
    if (rad < 1.0f) {
        path.AddRectangle(r);
        return;
    }
    REAL d = rad * 2.0f;
    path.AddArc(r.X, r.Y, d, d, 180.0f, 90.0f);
    path.AddArc(r.X + r.Width - d, r.Y, d, d, 270.0f, 90.0f);
    path.AddArc(r.X + r.Width - d, r.Y + r.Height - d, d, d, 0.0f, 90.0f);
    path.AddArc(r.X, r.Y + r.Height - d, d, d, 90.0f, 90.0f);
    path.CloseFigure();
}

static void DrawCyberPanel(Graphics& g, RectF r, Color fill, Color border, Color /*accentSlash*/, REAL radius = 8.0f, bool /*drawCornerTicks*/ = false, REAL borderThickness = 1.0f) {
    GraphicsPath path;
    BuildChamferPath(path, r, std::min(radius, 10.0f));

    SolidBrush fillBrush(fill);
    g.FillPath(&fillBrush, &path);

    if (border.GetAlpha() > 0 && borderThickness > 0.0f) {
        Pen borderPen(border, borderThickness);
        g.DrawPath(&borderPen, &path);
    }
}

static void DrawSegmentedCyberBar(Graphics& g, RectF r, int pct, Color activeColor, int /*segments*/ = 20) {
    int clamped = std::clamp(pct, 0, 100);
    REAL rad = r.Height * 0.5f;

    GraphicsPath trackPath;
    BuildChamferPath(trackPath, r, rad);
    SolidBrush trackBrush(Color(255, 30, 37, 49));
    g.FillPath(&trackBrush, &trackPath);

    if (clamped > 0) {
        REAL fillW = std::max(r.Height, r.Width * (static_cast<REAL>(clamped) / 100.0f));
        fillW = std::min(r.Width, fillW);
        RectF fillRect(r.X, r.Y, fillW, r.Height);
        GraphicsPath fillPath;
        BuildChamferPath(fillPath, fillRect, rad);
        SolidBrush fillBrush(activeColor);
        g.FillPath(&fillBrush, &fillPath);
    }
}

static std::wstring playStatusDisplayBadge(const GameCheck::GameSpec& game) {
    if (game.playStatus == "PLAYING_NOW")     return tr(L"Playing Now", L"Jugando");
    if (game.playStatus == "RECENTLY_PLAYED") return tr(L"Recently Played", L"Jugado Reciente");
    if (game.playStatus == "INSTALLED")       return tr(L"Installed", L"Instalado");
    return tr(L"Catalog", L"Cat\x00E1logo");
}

static std::wstring playStatusShortLabel(const GameCheck::GameSpec& game) {
    if (game.playStatus == "PLAYING_NOW")     return tr(L"Playing", L"Jugando");
    if (game.playStatus == "RECENTLY_PLAYED") return tr(L"Recent", L"Reciente");
    if (game.playStatus == "INSTALLED")       return tr(L"Installed", L"Instalado");
    return tr(L"Catalog", L"Cat\x00E1logo");
}

static std::wstring translateVerdict(const std::string& verdict) {
    if (verdict == "ULTRA READY") return tr(L"ULTRA READY", L"ULTRA LISTO");
    if (verdict == "RECOMMENDED") return tr(L"RECOMMENDED", L"RECOMENDADO");
    if (verdict == "MINIMUM")     return tr(L"MINIMUM", L"M\x00CDNIMO");
    return tr(L"BELOW MIN", L"BAJO M\x00CDNIMO");
}

static void rebuildGameImageList() {
    if (!g_app.hwndList) return;
    if (g_app.hListImg) {
        ImageList_Destroy(g_app.hListImg);
        g_app.hListImg = nullptr;
    }

    int count = static_cast<int>(g_app.allGames.size());
    g_app.hListImg = ImageList_Create(60, 30, ILC_COLOR32 | ILC_MASK, std::max(32, count), 16);
    if (!g_app.hListImg) return;

    FontFamily fontSans(L"Segoe UI");
    Font fontMono(&fontSans, 9.0f, FontStyleBold, UnitPoint);
    StringFormat centerFmt;
    centerFmt.SetAlignment(StringAlignmentCenter);
    centerFmt.SetLineAlignment(StringAlignmentCenter);
    centerFmt.SetFormatFlags(StringFormatFlagsNoWrap);

    for (const auto& gm : g_app.allGames) {
        Bitmap bmp(60, 30, PixelFormat32bppARGB);
        Graphics g(&bmp);
        g.SetSmoothingMode(SmoothingModeAntiAlias);
        g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);

        RectF r(0.0f, 0.0f, 60.0f, 30.0f);
        LinearGradientBrush grad(
            PointF(0.0f, 0.0f),
            PointF(60.0f, 30.0f),
            colorFromHex(gm.bannerColor1, 255),
            colorFromHex(gm.bannerColor2, 255)
        );
        g.FillRectangle(&grad, r);

        // Diagonal accent stripe
        Color acc = colorFromHex(gm.accentColor, 220);
        SolidBrush stripeBrush(Color(95, acc.GetR(), acc.GetG(), acc.GetB()));
        PointF stripePts[4] = {
            PointF(34.0f, 0.0f),
            PointF(50.0f, 0.0f),
            PointF(38.0f, 30.0f),
            PointF(22.0f, 30.0f)
        };
        g.FillPolygon(&stripeBrush, stripePts, 4);

        // Left accent bar & crisp border
        SolidBrush leftBar(acc);
        g.FillRectangle(&leftBar, 0.0f, 0.0f, 3.0f, 30.0f);
        Pen borderPen(Color(160, acc.GetR(), acc.GetG(), acc.GetB()), 1.0f);
        g.DrawRectangle(&borderPen, 0.5f, 0.5f, 59.0f, 29.0f);

        // Monogram text with subtle shadow
        std::wstring wMono = GameCheck::utf8ToWide(gm.monogram);
        SolidBrush shadowBrush(Color(190, 6, 6, 12));
        SolidBrush textBrush(Color(255, 248, 250, 255));
        g.DrawString(wMono.c_str(), -1, &fontMono, RectF(3.0f, 1.0f, 57.0f, 30.0f), &centerFmt, &shadowBrush);
        g.DrawString(wMono.c_str(), -1, &fontMono, RectF(2.0f, 0.0f, 57.0f, 30.0f), &centerFmt, &textBrush);

        HBITMAP hBmp = nullptr;
        if (bmp.GetHBITMAP(Color(255, 8, 8, 14), &hBmp) == Ok && hBmp) {
            ImageList_Add(g_app.hListImg, hBmp, nullptr);
            DeleteObject(hBmp);
        }
    }

    ListView_SetImageList(g_app.hwndList, g_app.hListImg, LVSIL_SMALL);
}

static Color verdictColor(const std::string& verdict) {
    if (verdict == "ULTRA READY") return CyberPalette::AcidGreen;
    if (verdict == "RECOMMENDED") return CyberPalette::NeuralCyan;
    if (verdict == "MINIMUM")     return CyberPalette::AmberWarm;
    return CyberPalette::NeonCrimson;
}

static Color tierStatusColor(const std::string& status) {
    if (status == "EXCEEDS_RECOMMENDED") return CyberPalette::AcidGreen;
    if (status == "MEETS_RECOMMENDED")   return CyberPalette::NeuralCyan;
    if (status == "MEETS_MINIMUM")       return CyberPalette::AmberWarm;
    return CyberPalette::NeonCrimson;
}

static void populateDetailListView() {
    if (!g_app.hwndDetailList) return;
    SendMessageW(g_app.hwndDetailList, WM_SETREDRAW, FALSE, 0);
    ListView_DeleteAllItems(g_app.hwndDetailList);

    const auto& an = g_app.currentAnalysis;
    int row = 0;

    auto addRow = [&](const std::wstring& c0, const std::wstring& c1, const std::wstring& c2, const std::wstring& c3, const std::wstring& c4) {
        LVITEMW lvi = {};
        lvi.mask = LVIF_TEXT;
        lvi.iItem = row;
        lvi.pszText = const_cast<LPWSTR>(c0.c_str());
        ListView_InsertItem(g_app.hwndDetailList, &lvi);
        ListView_SetItemText(g_app.hwndDetailList, row, 1, const_cast<LPWSTR>(c1.c_str()));
        ListView_SetItemText(g_app.hwndDetailList, row, 2, const_cast<LPWSTR>(c2.c_str()));
        ListView_SetItemText(g_app.hwndDetailList, row, 3, const_cast<LPWSTR>(c3.c_str()));
        ListView_SetItemText(g_app.hwndDetailList, row, 4, const_cast<LPWSTR>(c4.c_str()));
        ++row;
    };

    for (const auto& imp : an.settingImpacts) {
        addRow(
            GameCheck::utf8ToWide(imp.setting),
            GameCheck::utf8ToWide(imp.recommendedValue),
            GameCheck::utf8ToWide("+" + std::to_string(imp.fpsGainPercent) + "% FPS"),
            GameCheck::utf8ToWide("~" + std::to_string(imp.vramImpactMB) + " MB"),
            GameCheck::utf8ToWide(imp.note)
        );
    }

    if (!g_app.allGames.empty() && g_app.selectedGameIdx >= 0 && g_app.selectedGameIdx < static_cast<int>(g_app.allGames.size())) {
        auto drv = GameCheck::getDriverAppRecommendations(g_app.activeSpecs, g_app.allGames[g_app.selectedGameIdx], g_app.activeOptMode);
        std::wstring drvTag = GameCheck::utf8ToWide(drv.suiteName);
        for (const auto& ds : drv.settings) {
            addRow(
                L"[Driver] " + GameCheck::utf8ToWide(ds.setting),
                GameCheck::utf8ToWide(ds.recommendedValue),
                L"Driver",
                L"-",
                drvTag + L": " + GameCheck::utf8ToWide(ds.reason)
            );
        }
    }

    SendMessageW(g_app.hwndDetailList, WM_SETREDRAW, TRUE, 0);
    InvalidateRect(g_app.hwndDetailList, nullptr, FALSE);
}

static void updateSelectedGameAnalysis() {
    if (g_app.allGames.empty()) return;
    if (g_app.selectedGameIdx < 0 || g_app.selectedGameIdx >= static_cast<int>(g_app.allGames.size())) {
        g_app.selectedGameIdx = 0;
    }
    const auto& game = g_app.allGames[g_app.selectedGameIdx];
    g_app.currentAnalysis = GameCheck::analyzeGame(g_app.activeSpecs, game, g_app.activeOptMode);

    if (g_app.btnModeOptimal) {
        std::wstring maxFpsLbl = std::wstring(tr(L"Max FPS (", L"M\x00E1x FPS (")) + std::to_wstring(g_app.currentAnalysis.refreshRateHz) + L"Hz)";
        SetWindowTextW(g_app.btnModeOptimal,  tr(L"Optimal (Auto)", L"\x00D3ptimo (Auto)"));
        SetWindowTextW(g_app.btnModeFullFps,  maxFpsLbl.c_str());
        SetWindowTextW(g_app.btnModeBalanced, tr(L"Balanced", L"Balanceado"));
        SetWindowTextW(g_app.btnModeQuality,  tr(L"Quality (30-60 FPS)", L"Calidad (30-60 FPS)"));
        InvalidateRect(g_app.btnModeOptimal, nullptr, FALSE);
        InvalidateRect(g_app.btnModeFullFps, nullptr, FALSE);
        InvalidateRect(g_app.btnModeBalanced, nullptr, FALSE);
        InvalidateRect(g_app.btnModeQuality, nullptr, FALSE);
    }
    populateDetailListView();
}

static void updateDetailButtonText() {
    if (!g_app.btnToggleDetail) return;
    if (g_app.detailedQuickView) {
        SetWindowTextW(g_app.btnToggleDetail, g_app.isSpanish ? L"Ver Solo Top 3" : L"Show Top 3 Only");
    } else {
        SetWindowTextW(g_app.btnToggleDetail, g_app.isSpanish ? L"Vista Detallada (Todo)" : L"Detailed View (All)");
    }
}

static void updateTabVisibility() {
    if (g_app.btnSaveDrvMd) {
        ShowWindow(g_app.btnSaveDrvMd, g_app.activeTab == 2 ? SW_SHOW : SW_HIDE);
    }
    if (g_app.btnToggleDetail) {
        ShowWindow(g_app.btnToggleDetail, g_app.activeTab == 0 ? SW_SHOW : SW_HIDE);
    }
    if (g_app.hwndDetailList) {
        ShowWindow(g_app.hwndDetailList, (g_app.activeTab == 0 && g_app.detailedQuickView) ? SW_SHOW : SW_HIDE);
    }
    if (g_app.btnTabQuick)  InvalidateRect(g_app.btnTabQuick, nullptr, FALSE);
    if (g_app.btnTabMatch)  InvalidateRect(g_app.btnTabMatch, nullptr, FALSE);
    if (g_app.btnTabDriver) InvalidateRect(g_app.btnTabDriver, nullptr, FALSE);
    if (g_app.btnTabTips)   InvalidateRect(g_app.btnTabTips, nullptr, FALSE);
}

static void populateGameListView();
static void layoutChildControls(HWND hwnd);

static void applyLanguageToUi() {
    if (g_app.hwndMain) {
        std::wstring winTitle = std::wstring(tr(
            L"GameCheck \x2014 PC Game & Hardware Advisor (v",
            L"GameCheck \x2014 Asesor de Juegos y Hardware PC (v"
        )) + GameCheck::utf8ToWide(GameCheck::FULL_VERSION) + L")";
        SetWindowTextW(g_app.hwndMain, winTitle.c_str());
    }

    if (g_app.btnRescan)     SetWindowTextW(g_app.btnRescan,     tr(L"Rescan PC", L"Reescanear PC"));
    if (g_app.btnWhatIf)     SetWindowTextW(g_app.btnWhatIf,     tr(L"Upgrade Simulator", L"Simulador"));
    if (g_app.btnParseSteam) SetWindowTextW(g_app.btnParseSteam, tr(L"Paste Steam Specs", L"Pegar Req. Steam"));
    if (g_app.btnDealsTop)   SetWindowTextW(g_app.btnDealsTop,   tr(L"Find Component Deals", L"Buscar Precios"));
    if (g_app.btnDriverCfg)  SetWindowTextW(g_app.btnDriverCfg,  tr(L"Driver App Settings", L"App de Drivers"));
    if (g_app.btnPatchInfo)  SetWindowTextW(g_app.btnPatchInfo,  tr(L"Updates & Info", L"Actualizaciones"));
    updateDetailButtonText();

    if (g_app.hwndSearch) {
        SendMessageW(g_app.hwndSearch, EM_SETCUEBANNER, FALSE, reinterpret_cast<LPARAM>(
            tr(L"Search 50+ games, genres, engines...", L"Buscar 50+ juegos, g\x00E9neros, motores...")));
    }

    if (g_app.hwndFilter) {
        int curSel = static_cast<int>(SendMessageW(g_app.hwndFilter, CB_GETCURSEL, 0, 0));
        if (curSel < 0) curSel = 0;
        SendMessageW(g_app.hwndFilter, CB_RESETCONTENT, 0, 0);
        SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(tr(L"Installed Games", L"Juegos Instalados")));
        SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(tr(L"All Games (Installed First)", L"Todos (Instalados Primero)")));
        SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(tr(L"Ultra / Recommended", L"Ultra / Recomendado")));
        SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(tr(L"Competitive / High FPS", L"Competitivo / Altos FPS")));
        SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(tr(L"Story / AAA", L"Historia / AAA")));
        if (curSel > 4) curSel = 0;
        SendMessageW(g_app.hwndFilter, CB_SETCURSEL, curSel, 0);
    }

    if (g_app.hwndList) {
        const wchar_t* colNames[3] = {
            tr(L"Game", L"Juego"),
            tr(L"Status", L"Estado"),
            tr(L"Est. FPS", L"FPS Est.")
        };
        for (int c = 0; c < 3; ++c) {
            LVCOLUMNW lvc = {};
            lvc.mask = LVCF_TEXT;
            lvc.pszText = const_cast<LPWSTR>(colNames[c]);
            ListView_SetColumn(g_app.hwndList, c, &lvc);
        }
    }

    if (g_app.btnTabQuick)  SetWindowTextW(g_app.btnTabQuick,  tr(L"Quick Settings", L"Ajustes R\x00E1pidos"));
    if (g_app.btnTabMatch)  SetWindowTextW(g_app.btnTabMatch,  tr(L"PC Match & Impact", L"Hardware e Impacto"));
    if (g_app.btnTabDriver) SetWindowTextW(g_app.btnTabDriver, tr(L"Driver App", L"App de Drivers"));
    if (g_app.btnTabTips)   SetWindowTextW(g_app.btnTabTips,   tr(L"Upscaling & Tips", L"Escalado y Consejos"));
    if (g_app.btnSaveDrvMd) SetWindowTextW(g_app.btnSaveDrvMd, tr(L"Save Driver Guide (.MD)", L"Guardar Gu\x00EDa Drivers (.MD)"));

    if (g_app.btnSaveIni)     SetWindowTextW(g_app.btnSaveIni,     tr(L"Save .INI", L"Guardar .INI"));
    if (g_app.btnSaveJson)    SetWindowTextW(g_app.btnSaveJson,    tr(L"Save .JSON", L"Guardar .JSON"));
    if (g_app.btnSaveMd)      SetWindowTextW(g_app.btnSaveMd,      tr(L"Save Guide (.MD)", L"Guardar Gu\x00EDa (.MD)"));
    if (g_app.btnCopySummary) SetWindowTextW(g_app.btnCopySummary, tr(L"Copy Summary", L"Copiar Resumen"));

    populateGameListView();
    if (g_app.hwndMain) {
        layoutChildControls(g_app.hwndMain);
        InvalidateRect(g_app.hwndMain, nullptr, TRUE);
    }
}

static void populateGameListView() {
    if (!g_app.hwndList) return;

    wchar_t searchBuf[256] = {};
    if (g_app.hwndSearch) {
        GetWindowTextW(g_app.hwndSearch, searchBuf, 255);
    }
    std::string query = GameCheck::trim(GameCheck::wideToUtf8(searchBuf));

    int filterMode = 0;
    if (g_app.hwndFilter) {
        filterMode = static_cast<int>(SendMessageW(g_app.hwndFilter, CB_GETCURSEL, 0, 0));
        if (filterMode < 0) filterMode = 0;
    }

    // Check if any installed games exist; if 0 installed games on a clean machine and filter is "Installed Games",
    // gracefully fall back to "All Games (Installed First)" so the list is never empty on first launch.
    bool hasAnyInstalled = false;
    for (const auto& g : g_app.allGames) {
        if (g.installed) {
            hasAnyInstalled = true;
            break;
        }
    }
    if (filterMode == 0 && !hasAnyInstalled && query.empty()) {
        filterMode = 1;
        if (g_app.hwndFilter) {
            SendMessageW(g_app.hwndFilter, CB_SETCURSEL, 1, 0);
        }
    }

    SendMessageW(g_app.hwndList, WM_SETREDRAW, FALSE, 0);
    ListView_DeleteAllItems(g_app.hwndList);
    g_app.filteredIndices.clear();

    int listRow = 0;
    int rowToSelect = 0;

    for (size_t i = 0; i < g_app.allGames.size(); ++i) {
        const auto& game = g_app.allGames[i];
        GameCheck::GameAnalysis ga = GameCheck::analyzeGame(g_app.activeSpecs, game, g_app.activeOptMode);

        if (!query.empty()) {
            if (!GameCheck::containsIgnoreCase(game.title, query) &&
                !GameCheck::containsIgnoreCase(game.genre, query) &&
                !GameCheck::containsIgnoreCase(game.engine, query)) {
                continue;
            }
        }
        bool isCompetitive = (game.baseRecFps >= 100) ||
            GameCheck::containsIgnoreCase(game.genre, "Competitive") ||
            GameCheck::containsIgnoreCase(game.genre, "Tactical") ||
            GameCheck::containsIgnoreCase(game.genre, "Battle Royale") ||
            GameCheck::containsIgnoreCase(game.genre, "MOBA") ||
            GameCheck::containsIgnoreCase(game.genre, "Hero Shooter") ||
            GameCheck::containsIgnoreCase(game.genre, "Esports");
        if (filterMode == 0) {
            // Installed Games only (also keep custom parsed game if user just pasted Steam reqs)
            bool isCustom = g_app.hasCustomParsedGame && (i == 0);
            if (!game.installed && !isCustom) continue;
        } else if (filterMode == 2) {
            if (!ga.canRunRecommended) continue;
        } else if (filterMode == 3) {
            if (!isCompetitive) continue;
        } else if (filterMode == 4) {
            if (isCompetitive) continue;
        }

        g_app.filteredIndices.push_back(static_cast<int>(i));
        if (static_cast<int>(i) == g_app.selectedGameIdx) {
            rowToSelect = listRow;
        }

        std::wstring colTitle  = GameCheck::utf8ToWide(game.title);
        std::wstring colStatus = playStatusShortLabel(game);
        std::wstring colFps    = GameCheck::utf8ToWide(std::to_string(ga.estimatedScreenFps.avg) + " FPS");

        LVITEMW lvi = {};
        lvi.mask = LVIF_TEXT | LVIF_PARAM | LVIF_IMAGE;
        lvi.iItem = listRow;
        lvi.iSubItem = 0;
        lvi.iImage = static_cast<int>(i);
        lvi.pszText = const_cast<LPWSTR>(colTitle.c_str());
        lvi.lParam = static_cast<LPARAM>(i);
        ListView_InsertItem(g_app.hwndList, &lvi);

        ListView_SetItemText(g_app.hwndList, listRow, 1, const_cast<LPWSTR>(colStatus.c_str()));
        ListView_SetItemText(g_app.hwndList, listRow, 2, const_cast<LPWSTR>(colFps.c_str()));

        ++listRow;
    }

    if (!g_app.filteredIndices.empty()) {
        g_app.selectedGameIdx = g_app.filteredIndices[rowToSelect];
        ListView_SetItemState(g_app.hwndList, rowToSelect, LVIS_SELECTED | LVIS_FOCUSED, LVIS_SELECTED | LVIS_FOCUSED);
        ListView_EnsureVisible(g_app.hwndList, rowToSelect, FALSE);
    }

    SendMessageW(g_app.hwndList, WM_SETREDRAW, TRUE, 0);
    InvalidateRect(g_app.hwndList, nullptr, TRUE);

    updateSelectedGameAnalysis();
    if (g_app.hwndMain) {
        InvalidateRect(g_app.hwndMain, nullptr, FALSE);
    }
}

static void refreshHardwareAndGames() {
    g_app.detectedSpecs = GameCheck::detectSystemSpecs();
    if (!g_app.isSimulated) {
        g_app.activeSpecs = g_app.detectedSpecs;
    }
    g_app.allGames = GameCheck::getMergedGameList();
    if (g_app.hasCustomParsedGame) {
        g_app.allGames.insert(g_app.allGames.begin(), g_app.customParsedGame);
    }
    rebuildGameImageList();
    populateGameListView();
}

static void layoutChildControls(HWND hwnd) {
    RECT rc;
    GetClientRect(hwnd, &rc);
    int w = rc.right - rc.left;
    int h = rc.bottom - rc.top;

    int topBarH = 136;
    int margin = 14;

    // Language selector next to update pill in header (generous width so EN | English / ES | Español + arrow never clip)
    int langX = 452;
    int langW = 136;
    if (g_app.hwndLang) {
        MoveWindow(g_app.hwndLang, langX, 9, langW, 120, TRUE);
    }

    // Top-right action buttons (6 clear, friendly buttons — dynamically sized to text so zero labels truncate)
    int btnY = 10;
    int btnH = 28;
    int btnGap = 8;
    HWND topBtns[6] = {
        g_app.btnPatchInfo,
        g_app.btnDriverCfg,
        g_app.btnDealsTop,
        g_app.btnParseSteam,
        g_app.btnWhatIf,
        g_app.btnRescan
    };
    int naturalW[6] = { 124, 152, 168, 146, 146, 106 };

    HDC hdcMeasure = GetDC(hwnd);
    if (hdcMeasure) {
        HFONT hOldFont = reinterpret_cast<HFONT>(SelectObject(hdcMeasure, g_app.hFontUiBold ? g_app.hFontUiBold : g_app.hFontUi));
        for (int i = 0; i < 6; ++i) {
            if (!topBtns[i]) continue;
            wchar_t txt[128] = {};
            int len = GetWindowTextW(topBtns[i], txt, 127);
            if (len > 0) {
                SIZE sz = {};
                if (GetTextExtentPoint32W(hdcMeasure, txt, len, &sz)) {
                    naturalW[i] = std::max(100, static_cast<int>(sz.cx) + 28);
                }
            }
        }
        SelectObject(hdcMeasure, hOldFont);
        ReleaseDC(hwnd, hdcMeasure);
    }

    int totalNaturalW = 0;
    for (int i = 0; i < 6; ++i) totalNaturalW += naturalW[i];
    int totalGaps = btnGap * 5;
    int availTopBtnW = std::max(420, (w - margin) - (langX + langW + 14) - totalGaps);
    double scale = (totalNaturalW > availTopBtnW) ? (static_cast<double>(availTopBtnW) / static_cast<double>(totalNaturalW)) : 1.0;

    int rightX = w - margin;
    for (int i = 0; i < 6; ++i) {
        int bw = std::max(72, static_cast<int>(std::round(naturalW[i] * scale)));
        rightX -= bw;
        if (topBtns[i]) MoveWindow(topBtns[i], rightX, btnY, bw, btnH, TRUE);
        rightX -= btnGap;
    }

    // Left column (Search, Filter, Game List)
    int leftW = std::max(380, std::min(500, static_cast<int>(w * 0.36)));
    int contentY = topBarH + 10;
    int contentH = h - contentY - margin;

    int filterW = 205;
    int searchW = std::max(120, leftW - filterW - 8);
    if (g_app.hwndSearch) MoveWindow(g_app.hwndSearch, margin, contentY, searchW, 28, TRUE);
    if (g_app.hwndFilter) MoveWindow(g_app.hwndFilter, margin + searchW + 8, contentY, filterW, 220, TRUE);

    int listY = contentY + 36;
    int listH = std::max(180, contentH - 36);
    if (g_app.hwndList) {
        MoveWindow(g_app.hwndList, margin, listY, leftW, listH, TRUE);
        int col1W = 92;
        int col2W = 86;
        int col0W = std::max(175, leftW - col1W - col2W - 22);
        ListView_SetColumnWidth(g_app.hwndList, 0, col0W);
        ListView_SetColumnWidth(g_app.hwndList, 1, col1W);
        ListView_SetColumnWidth(g_app.hwndList, 2, col2W);
    }

    // Right Pane controls
    int rightPaneX = margin + leftW + 16;
    int rightPaneW = std::max(380, w - rightPaneX - margin);

    // 4-Mode Selector Buttons below Hero Banner
    int modeBtnY = contentY + 114;
    int modeGap = 8;
    int modeBtnW = (rightPaneW - modeGap * 3) / 4;
    if (g_app.btnModeOptimal)  MoveWindow(g_app.btnModeOptimal,  rightPaneX + (modeBtnW + modeGap) * 0, modeBtnY, modeBtnW, 32, TRUE);
    if (g_app.btnModeFullFps)  MoveWindow(g_app.btnModeFullFps,  rightPaneX + (modeBtnW + modeGap) * 1, modeBtnY, modeBtnW, 32, TRUE);
    if (g_app.btnModeBalanced) MoveWindow(g_app.btnModeBalanced, rightPaneX + (modeBtnW + modeGap) * 2, modeBtnY, modeBtnW, 32, TRUE);
    if (g_app.btnModeQuality)  MoveWindow(g_app.btnModeQuality,  rightPaneX + (modeBtnW + modeGap) * 3, modeBtnY, rightPaneW - (modeBtnW + modeGap) * 3, 32, TRUE);

    // 4 Sub-View Tab Buttons
    int tabY = modeBtnY + 40;
    int tabGap = 8;
    int tabW = (rightPaneW - tabGap * 3) / 4;
    if (g_app.btnTabQuick)  MoveWindow(g_app.btnTabQuick,  rightPaneX + (tabW + tabGap) * 0, tabY, tabW, 30, TRUE);
    if (g_app.btnTabMatch)  MoveWindow(g_app.btnTabMatch,  rightPaneX + (tabW + tabGap) * 1, tabY, tabW, 30, TRUE);
    if (g_app.btnTabDriver) MoveWindow(g_app.btnTabDriver, rightPaneX + (tabW + tabGap) * 2, tabY, tabW, 30, TRUE);
    if (g_app.btnTabTips)   MoveWindow(g_app.btnTabTips,   rightPaneX + (tabW + tabGap) * 3, tabY, rightPaneW - (tabW + tabGap) * 3, 30, TRUE);

    // Save Driver Guide button inside Tab 2 (Driver App) & Detailed Toggle inside Tab 0
    int botBtnY = h - margin - 34;
    if (g_app.btnSaveDrvMd) {
        MoveWindow(g_app.btnSaveDrvMd, rightPaneX + rightPaneW - 210, botBtnY - 46, 198, 32, TRUE);
    }
    if (g_app.btnToggleDetail) {
        MoveWindow(g_app.btnToggleDetail, rightPaneX + rightPaneW - 196, tabY + 190, 184, 24, TRUE);
    }
    if (g_app.hwndDetailList) {
        int listTop = tabY + 220;
        int listHeight = std::max(80, (botBtnY - 12) - listTop - 6);
        int listW = std::max(240, rightPaneW - 20);
        MoveWindow(g_app.hwndDetailList, rightPaneX + 10, listTop, listW, listHeight, TRUE);
        int c0 = 165, c1 = 135, c2 = 75, c3 = 72;
        int c4 = std::max(140, listW - c0 - c1 - c2 - c3 - 22);
        ListView_SetColumnWidth(g_app.hwndDetailList, 0, c0);
        ListView_SetColumnWidth(g_app.hwndDetailList, 1, c1);
        ListView_SetColumnWidth(g_app.hwndDetailList, 2, c2);
        ListView_SetColumnWidth(g_app.hwndDetailList, 3, c3);
        ListView_SetColumnWidth(g_app.hwndDetailList, 4, c4);
    }

    // Bottom Action Bar on Right Pane
    int gap = 8;
    int curX = rightPaneX;
    if (g_app.btnSaveIni && g_app.btnSaveJson && g_app.btnSaveMd && g_app.btnCopySummary) {
        int btnW = std::max(100, (rightPaneW - gap * 3) / 4);
        MoveWindow(g_app.btnSaveIni,     curX, botBtnY, btnW, 34, TRUE); curX += btnW + gap;
        MoveWindow(g_app.btnSaveJson,    curX, botBtnY, btnW, 34, TRUE); curX += btnW + gap;
        MoveWindow(g_app.btnSaveMd,      curX, botBtnY, btnW, 34, TRUE); curX += btnW + gap;
        int lastW = std::max(btnW, (rightPaneX + rightPaneW) - curX);
        MoveWindow(g_app.btnCopySummary, curX, botBtnY, lastW, 34, TRUE);
    }

    float tx = 0.0f, tw = 0.0f;
    computeTabIndicatorBounds(g_app.activeTab, tx, tw);
    g_app.tabIndicatorTargetX = tx;
    if (!g_app.tabIndicatorInit || !g_app.uiAnimTimerActive) {
        g_app.tabIndicatorX = tx;
        g_app.tabIndicatorInit = true;
    }
}

// =============================================================================
// Custom Owner-Drawn Cyberpunk Button Renderer (WM_DRAWITEM)
// =============================================================================
static void drawCyberOwnerButton(const DRAWITEMSTRUCT* dis, Color parentBgColor = CyberPalette::VoidCanvas) {
    if (!dis || dis->CtlType != ODT_BUTTON) return;

    int w = dis->rcItem.right - dis->rcItem.left;
    int h = dis->rcItem.bottom - dis->rcItem.top;
    if (w <= 0 || h <= 0) return;

    HDC memDC = CreateCompatibleDC(dis->hDC);
    HBITMAP memBmp = CreateCompatibleBitmap(dis->hDC, w, h);
    HBITMAP oldBmp = static_cast<HBITMAP>(SelectObject(memDC, memBmp));

    Graphics g(memDC);
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);

    SolidBrush parentBg(parentBgColor);
    g.FillRectangle(&parentBg, 0, 0, w, h);

    UINT id = dis->CtlID;
    bool isPressed = (dis->itemState & ODS_SELECTED) != 0;

    float hoverT = 0.0f;
    auto hIt = g_app.btnHoverCurrent.find(dis->hwndItem);
    if (hIt != g_app.btnHoverCurrent.end()) {
        hoverT = std::clamp(hIt->second, 0.0f, 1.0f);
    }

    bool isModeBtn = (id >= IDC_BTN_MODE_OPTIMAL && id <= IDC_BTN_MODE_QUALITY);
    bool isActiveMode = isModeBtn && (static_cast<int>(id - IDC_BTN_MODE_OPTIMAL) == g_app.activeOptMode);

    bool isTabBtn = (id >= IDC_BTN_TAB_QUICK && id <= IDC_BTN_TAB_TIPS);
    bool isActiveTab = isTabBtn && (static_cast<int>(id - IDC_BTN_TAB_QUICK) == g_app.activeTab);

    bool isPrimaryCta = (id == IDC_BTN_RESCAN || id == IDC_BTN_FIND_DEALS || id == IDC_DLG_OK || id == IDC_DLG_SEARCH_DEALS || id == IDC_BTN_SAVE_DRV_MD);
    bool isAccentReset = ((id == IDC_BTN_WHATIF && g_app.isSimulated) || id == IDC_DLG_RESET);

    Color fillCol = Color(255, 26, 32, 44);
    Color borderCol = CyberPalette::BorderSubtle;
    Color textCol = CyberPalette::TextMain;

    if (isPrimaryCta) {
        fillCol = Color(255, 37, 99, 235);     // #2563EB Modern Electric Blue
        borderCol = Color(255, 59, 130, 246);  // #3B82F6
        textCol = Color(255, 255, 255, 255);
    } else if (isActiveMode || isActiveTab) {
        fillCol = Color(255, 29, 41, 63);      // Soft Indigo-Slate active fill
        borderCol = CyberPalette::CyberYellow; // #3B82F6
        textCol = Color(255, 248, 250, 252);
    } else if (isAccentReset) {
        fillCol = Color(255, 42, 23, 32);
        borderCol = Color(255, 190, 56, 84);
        textCol = Color(255, 253, 164, 175);
    } else if (isModeBtn || isTabBtn) {
        fillCol = CyberPalette::PanelSurface;
        borderCol = Color(255, 38, 46, 58);
        textCol = CyberPalette::TextMuted;
    }

    if (hoverT > 0.001f) {
        if (isPrimaryCta) {
            fillCol = lerpColor(fillCol, Color(255, 59, 130, 246), hoverT);
            borderCol = lerpColor(borderCol, Color(255, 96, 165, 250), hoverT);
        } else if (isActiveMode || isActiveTab) {
            fillCol = lerpColor(fillCol, Color(255, 36, 52, 78), hoverT);
            borderCol = lerpColor(borderCol, Color(255, 96, 165, 250), hoverT);
        } else {
            fillCol = lerpColor(fillCol, CyberPalette::PanelElevated, hoverT);
            borderCol = lerpColor(borderCol, Color(255, 71, 85, 105), hoverT);
            if (isModeBtn || isTabBtn) {
                textCol = lerpColor(textCol, CyberPalette::TextMain, hoverT);
            }
        }
    }

    REAL borderThickness = 1.0f;
    if (isPressed) {
        fillCol = isPrimaryCta ? Color(255, 29, 78, 216) : Color(255, 36, 44, 58);
        borderCol = CyberPalette::CyberYellow;
    }

    REAL pressOff = isPressed ? 0.5f : 0.0f;
    RectF btnRect(1.0f + pressOff, 1.0f + pressOff, static_cast<REAL>(w - 2 - (isPressed ? 1 : 0)), static_cast<REAL>(h - 2 - (isPressed ? 1 : 0)));
    DrawCyberPanel(g, btnRect, fillCol, borderCol, Color(0, 0, 0, 0), 6.0f, false, borderThickness);

    if (isActiveTab) {
        SolidBrush tabBarBrush(CyberPalette::CyberYellow);
        g.FillRectangle(&tabBarBrush, btnRect.X + 10.0f, btnRect.Y + btnRect.Height - 2.5f, std::max(0.0f, btnRect.Width - 20.0f), 2.5f);
    }

    wchar_t textBuf[256] = {};
    GetWindowTextW(dis->hwndItem, textBuf, 255);

    FontFamily fontFam(L"Segoe UI");
    Font fontBtn(&fontFam, 8.8f, FontStyleBold, UnitPoint);
    SolidBrush textBrush(textCol);

    StringFormat centerFmt;
    centerFmt.SetAlignment(StringAlignmentCenter);
    centerFmt.SetLineAlignment(StringAlignmentCenter);
    centerFmt.SetFormatFlags(StringFormatFlagsNoWrap);
    centerFmt.SetTrimming(StringTrimmingEllipsisCharacter);

    RectF textRect(6.0f + pressOff, 1.0f + pressOff, static_cast<REAL>(w - 12), static_cast<REAL>(h - 2));
    g.DrawString(textBuf, -1, &fontBtn, textRect, &centerFmt, &textBrush);

    BitBlt(dis->hDC, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
    SelectObject(memDC, oldBmp);
    DeleteObject(memBmp);
    DeleteDC(memDC);
}

// =============================================================================
// Cyberpunk Dashboard Canvas (WM_PAINT)
// =============================================================================
static void paintDashboard(HWND hwnd, HDC hdc) {
    RECT rcClient;
    GetClientRect(hwnd, &rcClient);
    int w = rcClient.right - rcClient.left;
    int h = rcClient.bottom - rcClient.top;
    if (w <= 0 || h <= 0) return;

    HDC memDC = CreateCompatibleDC(hdc);
    HBITMAP memBmp = CreateCompatibleBitmap(hdc, w, h);
    HBITMAP oldBmp = static_cast<HBITMAP>(SelectObject(memDC, memBmp));

    Graphics g(memDC);
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);

    SolidBrush bgBrush(CyberPalette::VoidCanvas);
    g.FillRectangle(&bgBrush, 0, 0, w, h);

    float rawTabT = std::clamp(g_app.tabAnimT, 0.0f, 1.0f);
    float rawBarT = std::clamp(g_app.barAnimT, 0.0f, 1.0f);
    float easedTab = 1.0f - std::pow(1.0f - rawTabT, 3.0f);
    float easedBar = 1.0f - std::pow(1.0f - rawBarT, 3.0f);

    FontFamily fontSans(L"Segoe UI");

    Font fontTitle(&fontSans, 14.5f, FontStyleBold, UnitPoint);
    Font fontPill(&fontSans, 8.2f, FontStyleBold, UnitPoint);
    Font fontCardHdr(&fontSans, 8.2f, FontStyleBold, UnitPoint);
    Font fontCardVal(&fontSans, 9.6f, FontStyleBold, UnitPoint);
    Font fontCardSub(&fontSans, 8.0f, FontStyleRegular, UnitPoint);
    Font fontHeroTitle(&fontSans, 16.0f, FontStyleBold, UnitPoint);
    Font fontMonogram(&fontSans, 17.0f, FontStyleBold, UnitPoint);
    Font fontSection(&fontSans, 9.5f, FontStyleBold, UnitPoint);
    Font fontTable(&fontSans, 8.6f, FontStyleRegular, UnitPoint);
    Font fontTableBold(&fontSans, 8.6f, FontStyleBold, UnitPoint);

    SolidBrush whiteBrush(CyberPalette::TextMain);
    SolidBrush mutedBrush(CyberPalette::TextMuted);
    SolidBrush yellowBrush(CyberPalette::CyberYellow);
    SolidBrush cyanBrush(CyberPalette::NeuralCyan);
    SolidBrush greenBrush(CyberPalette::AcidGreen);
    SolidBrush crimsonBrush(CyberPalette::NeonCrimson);

    StringFormat ellipsisFmt;
    ellipsisFmt.SetTrimming(StringTrimmingEllipsisCharacter);
    ellipsisFmt.SetFormatFlags(StringFormatFlagsNoWrap);

    StringFormat wrapFmt;
    wrapFmt.SetTrimming(StringTrimmingEllipsisCharacter);

    StringFormat centerFmt;
    centerFmt.SetAlignment(StringAlignmentCenter);
    centerFmt.SetLineAlignment(StringAlignmentCenter);

    // =========================================================================
    // 1. HEADER & 4 HARDWARE SUMMARY CARDS
    // =========================================================================
    SolidBrush topBarBg(Color(255, 17, 22, 31));
    g.FillRectangle(&topBarBg, 0, 0, w, 134);

    Pen headerLinePen(CyberPalette::BorderSubtle, 1.0f);
    g.DrawLine(&headerLinePen, 0, 134, w, 134);

    // Brand Title (crisp white modern wordmark)
    g.DrawString(L"GameCheck", -1, &fontTitle, PointF(14.0f, 8.0f), &whiteBrush);

    // Version Pill
    RectF verRect(120.0f, 11.0f, 96.0f, 22.0f);
    DrawCyberPanel(g, verRect, Color(255, 24, 34, 52), Color(255, 48, 72, 112), Color(0, 0, 0, 0), 11.0f, false);
    std::wstring wVer = L"v" + GameCheck::utf8ToWide(GameCheck::FULL_VERSION);
    SolidBrush verTextBrush(Color(255, 147, 197, 253));
    g.DrawString(wVer.c_str(), -1, &fontPill, verRect, &centerFmt, &verTextBrush);

    // Status Pill
    RectF safeRect(222.0f, 11.0f, 116.0f, 22.0f);
    DrawCyberPanel(g, safeRect, Color(255, 19, 35, 38), Color(255, 34, 84, 78), Color(0, 0, 0, 0), 11.0f, false);
    g.DrawString(tr(L"Read-Only \x2022 Safe", L"Solo Lectura \x2022 Seguro"), -1, &fontPill, safeRect, &centerFmt, &greenBrush);

    // Live Auto-Update Status Pill
    RectF updRect(344.0f, 11.0f, 102.0f, 22.0f);
    DrawCyberPanel(g, updRect, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, Color(0, 0, 0, 0), 11.0f, false);
    SolidBrush updBrush(g_app.updatePillColor);
    g.DrawString(g_app.updatePillText.c_str(), -1, &fontPill, updRect, &centerFmt, &updBrush);

    // 4 Hardware Cards
    int cardY = 46;
    int cardH = 80;
    int cardGap = 10;
    int cardW = (w - 28 - cardGap * 3) / 4;
    const auto& sp = g_app.activeSpecs;

    struct HwCard {
        std::wstring label;
        std::wstring mainVal;
        std::wstring subVal;
        int score;
        Color barCol;
    };

    std::wstring simTag = g_app.isSimulated ? tr(L" (Simulated)", L" (Simulado)") : L"";
    std::wstring vrrText = sp.display.vrrCapable
        ? tr(L"FreeSync / G-Sync Ready", L"FreeSync / G-Sync Listo")
        : tr(L"Fixed Refresh Rate", L"Frecuencia Fija");

    std::wstring cpuSub = std::to_wstring(sp.cpu.cores) + tr(L" Cores / ", L" N\x00FAcleos / ") +
                          std::to_wstring(sp.cpu.threads) + tr(L" Threads \x2022 Score: ", L" Hilos \x2022 Puntaje: ") +
                          std::to_wstring(sp.cpu.score) + L"/100";
    std::wstring gpuSub = std::to_wstring(sp.gpu.vramGB) + L" GB VRAM \x2022 " +
                          GameCheck::utf8ToWide(sp.gpu.upscaler) + tr(L" \x2022 Score: ", L" \x2022 Puntaje: ") +
                          std::to_wstring(sp.gpu.score) + L"/100";
    std::wstring ramSub = GameCheck::utf8ToWide(sp.storage.drive) + L" " + std::to_wstring(sp.storage.freeGB) +
                          tr(L" GB Free of ", L" GB Libres de ") + std::to_wstring(sp.storage.totalGB) +
                          L" GB (" + std::to_wstring(sp.storage.allDrives.size()) + tr(L" Drives)", L" Discos)");

    HwCard cards[4] = {
        {
            tr(L"Processor (CPU)", L"Procesador (CPU)"),
            GameCheck::utf8ToWide(sp.cpu.name) + simTag,
            cpuSub,
            sp.cpu.score,
            CyberPalette::NeuralCyan
        },
        {
            tr(L"Graphics Card (GPU)", L"Tarjeta Gr\x00E1fica (GPU)"),
            GameCheck::utf8ToWide(sp.gpu.name) + simTag,
            gpuSub,
            sp.gpu.score,
            CyberPalette::CyberYellow
        },
        {
            tr(L"Memory & Storage", L"Memoria y Almacenamiento"),
            std::to_wstring(sp.ram.totalGB) + tr(L" GB System RAM", L" GB RAM del Sistema") + simTag,
            ramSub,
            std::min(100, (sp.ram.totalGB * 100) / 32),
            CyberPalette::AcidGreen
        },
        {
            tr(L"Main Display", L"Pantalla Principal"),
            GameCheck::utf8ToWide(std::to_string(sp.display.width) + "x" + std::to_string(sp.display.height) + " @ " + std::to_string(sp.display.refreshRateHz) + "Hz (" + sp.display.tier + ")") + simTag,
            GameCheck::utf8ToWide(sp.display.name) + L" \x2022 " + vrrText,
            std::min(100, (sp.display.refreshRateHz * 100) / 180),
            CyberPalette::IndigoSoft
        }
    };

    for (int i = 0; i < 4; ++i) {
        REAL cx = static_cast<REAL>(14 + i * (cardW + cardGap));
        RectF cRect(cx, static_cast<REAL>(cardY), static_cast<REAL>(cardW), static_cast<REAL>(cardH));
        DrawCyberPanel(g, cRect, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, Color(0, 0, 0, 0), 8.0f, false);

        g.DrawString(cards[i].label.c_str(), -1, &fontCardHdr, PointF(cx + 12.0f, cardY + 7.0f), &mutedBrush);

        RectF valBox(cx + 12.0f, cardY + 25.0f, cardW - 24.0f, 19.0f);
        g.DrawString(cards[i].mainVal.c_str(), -1, &fontCardVal, valBox, &ellipsisFmt, &whiteBrush);

        RectF subBox(cx + 12.0f, cardY + 46.0f, cardW - 24.0f, 16.0f);
        g.DrawString(cards[i].subVal.c_str(), -1, &fontCardSub, subBox, &ellipsisFmt, &mutedBrush);

        RectF barRect(cx + 12.0f, cardY + 66.0f, cardW - 24.0f, 5.0f);
        int animCardScore = static_cast<int>(std::round(cards[i].score * easedBar));
        DrawSegmentedCyberBar(g, barRect, animCardScore, cards[i].barCol, 18);
    }

    // =========================================================================
    // 2. RIGHT PANE — HERO BANNER + 4 CLEAN SUB-VIEW TABS
    // =========================================================================
    int leftW = std::max(380, std::min(500, static_cast<int>(w * 0.36)));
    REAL rx = static_cast<REAL>(14 + leftW + 16);
    REAL rw = static_cast<REAL>(std::max(380, w - static_cast<int>(rx) - 14));
    REAL ry = 146.0f;

    if (g_app.allGames.empty()) {
        BitBlt(hdc, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
        SelectObject(memDC, oldBmp);
        DeleteObject(memBmp);
        DeleteDC(memDC);
        return;
    }

    const auto& game = g_app.allGames[g_app.selectedGameIdx];
    const auto& an = g_app.currentAnalysis;

    // 2A. Hero Game Banner (clean modern rounded card with subtle gradient)
    RectF bannerRect(rx, ry, rw, 106.0f);
    GraphicsPath heroPath;
    BuildChamferPath(heroPath, bannerRect, 10.0f);

    Color tintRaw = colorFromHex(game.bannerColor2, 255);
    Color heroRightCol(
        255,
        static_cast<BYTE>(20 + tintRaw.GetR() / 6),
        static_cast<BYTE>(26 + tintRaw.GetG() / 6),
        static_cast<BYTE>(38 + tintRaw.GetB() / 5)
    );
    LinearGradientBrush heroGrad(
        PointF(rx, ry),
        PointF(rx + rw, ry + 106.0f),
        CyberPalette::PanelSurface,
        heroRightCol
    );
    g.FillPath(&heroGrad, &heroPath);

    Pen heroBorder(CyberPalette::BorderSubtle, 1.0f);
    g.DrawPath(&heroBorder, &heroPath);

    // Monogram Emblem
    RectF emblemRect(rx + 16.0f, ry + 13.0f, 80.0f, 80.0f);
    Color emblemBg(
        255,
        static_cast<BYTE>(22 + tintRaw.GetR() / 5),
        static_cast<BYTE>(28 + tintRaw.GetG() / 5),
        static_cast<BYTE>(40 + tintRaw.GetB() / 4)
    );
    DrawCyberPanel(g, emblemRect, emblemBg, CyberPalette::BorderSubtle, Color(0, 0, 0, 0), 10.0f, false);
    std::wstring wMono = GameCheck::utf8ToWide(game.monogram);
    g.DrawString(wMono.c_str(), -1, &fontMonogram, emblemRect, &centerFmt, &whiteBrush);

    // Game Title & Metadata
    std::wstring wTitle = GameCheck::utf8ToWide(game.title);
    RectF titleBox(rx + 110.0f, ry + 10.0f, rw - 310.0f, 28.0f);
    g.DrawString(wTitle.c_str(), -1, &fontHeroTitle, titleBox, &ellipsisFmt, &whiteBrush);

    std::string upscalerList;
    for (size_t u = 0; u < game.upscalers.size(); ++u) {
        if (u > 0) upscalerList += " / ";
        upscalerList += game.upscalers[u];
    }
    std::wstring wMeta = GameCheck::utf8ToWide(
        game.genre + " \xE2\x80\xA2 " + game.engine + " (" + std::to_string(game.releaseYear) + ") \xE2\x80\xA2 " + upscalerList +
        (game.supportsRT ? " \xE2\x80\xA2 Ray Tracing" : "")
    );
    RectF metaBox(rx + 110.0f, ry + 41.0f, rw - 320.0f, 18.0f);
    g.DrawString(wMeta.c_str(), -1, &fontCardSub, metaBox, &ellipsisFmt, &mutedBrush);

    // Play Status Pill
    RectF statusPill(rx + 110.0f, ry + 66.0f, 152.0f, 24.0f);
    Color stAccent = (game.playStatus == "PLAYING_NOW" || game.installed) ? CyberPalette::AcidGreen : CyberPalette::TextMuted;
    Color stBg = game.installed ? Color(255, 18, 38, 34) : Color(255, 24, 30, 40);
    Color stBorder = game.installed ? Color(255, 30, 92, 76) : CyberPalette::BorderSubtle;
    DrawCyberPanel(g, statusPill, stBg, stBorder, Color(0, 0, 0, 0), 12.0f, false);
    std::wstring wPlayBadge = playStatusDisplayBadge(game);
    SolidBrush stTextBrush(stAccent);
    g.DrawString(wPlayBadge.c_str(), -1, &fontPill, statusPill, &centerFmt, &stTextBrush);

    // Can I Run It? Verdict Badge
    StringFormat rightFmt;
    rightFmt.SetAlignment(StringAlignmentFar);
    g.DrawString(tr(L"Can I Run It?", L"\x00BFPuedo Correrlo?"), -1, &fontCardSub, RectF(rx + rw - 190.0f, ry + 6.0f, 176.0f, 15.0f), &rightFmt, &mutedBrush);

    RectF verdictPill(rx + rw - 186.0f, ry + 22.0f, 172.0f, 28.0f);
    Color vCol = verdictColor(an.verdictBadge);
    Color vBg(255, static_cast<BYTE>(18 + vCol.GetR() / 10), static_cast<BYTE>(22 + vCol.GetG() / 10), static_cast<BYTE>(30 + vCol.GetB() / 10));
    Color vBorder(160, vCol.GetR(), vCol.GetG(), vCol.GetB());
    DrawCyberPanel(g, verdictPill, vBg, vBorder, Color(0, 0, 0, 0), 8.0f, false);
    SolidBrush vTextBrush(vCol);
    std::wstring wVerdict = translateVerdict(an.verdictBadge);
    g.DrawString(wVerdict.c_str(), -1, &fontSection, verdictPill, &centerFmt, &vTextBrush);

    std::wstring wHeroFps = GameCheck::utf8ToWide(
        std::to_string(an.estimatedScreenFps.avg) + " FPS (" + an.estimatedScreenFps.range + ")"
    );
    g.DrawString(wHeroFps.c_str(), -1, &fontSection, RectF(rx + rw - 240.0f, ry + 56.0f, 226.0f, 20.0f), &rightFmt, &yellowBrush);

    std::wstring wResMulti = GameCheck::utf8ToWide(
        "1080p: " + std::to_string(an.fps1080p.avg) + " FPS  \xE2\x80\xA2  1440p: " + std::to_string(an.fps1440p.avg) + " FPS  \xE2\x80\xA2  4K: " + std::to_string(an.fps4k.avg) + " FPS"
    );
    g.DrawString(wResMulti.c_str(), -1, &fontCardSub, RectF(rx + rw - 280.0f, ry + 78.0f, 266.0f, 18.0f), &rightFmt, &mutedBrush);

    // (4 Mode Buttons sit at ry + 114..146, 4 Tab Buttons sit at ry + 154..184)
    // Glowing sliding active-tab indicator bar below the 4 tab buttons
    {
        float indX = 0.0f, indW = 0.0f;
        computeTabIndicatorBounds(g_app.activeTab, indX, indW);
        float drawX = g_app.tabIndicatorInit ? g_app.tabIndicatorX : indX;
        REAL indY = ry + 186.0f;
        SolidBrush glowTrack(Color(35, 0, 240, 255));
        g.FillRectangle(&glowTrack, rx, indY + 1.0f, rw, 1.0f);
        SolidBrush indGlow(Color(80, 0, 240, 255));
        g.FillRectangle(&indGlow, static_cast<REAL>(drawX) - 2.0f, indY - 1.0f, indW + 4.0f, 5.0f);
        SolidBrush indCore(CyberPalette::NeuralCyan);
        g.FillRectangle(&indCore, static_cast<REAL>(drawX), indY, indW, 3.0f);
    }

    REAL curY = ry + 196.0f;
    REAL botBtnTop = static_cast<REAL>(h - 14 - 34 - 10);
    REAL tabClipTop = ry + 192.0f;
    REAL tabClipH = std::max(0.0f, botBtnTop - tabClipTop);

    GraphicsState tabState = g.Save();
    g.SetClip(RectF(rx - 2.0f, tabClipTop, rw + 4.0f, tabClipH + 2.0f));
    REAL slideY = 14.0f * (1.0f - easedTab);
    if (slideY > 0.05f) {
        g.TranslateTransform(0.0f, slideY);
    }

    // =========================================================================
    // TAB 0: QUICK SETTINGS (Calm Default View)
    // =========================================================================
    if (g_app.activeTab == 0) {
        // 1. Clean Screen Refresh Match Card
        RectF screenCard(rx, curY, rw, 74.0f);
        DrawCyberPanel(g, screenCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeuralCyan, 8.0f, true);

        std::wstring wScreenTitle = std::wstring(tr(L"Screen Refresh Match \x2022 ", L"Ajuste a Pantalla \x2022 ")) +
            GameCheck::utf8ToWide(an.monitorName + " (" + std::to_string(an.screenWidth) + "x" + std::to_string(an.screenHeight) +
            " @ " + std::to_string(an.refreshRateHz) + "Hz)");
        g.DrawString(wScreenTitle.c_str(), -1, &fontCardHdr, RectF(rx + 14.0f, curY + 10.0f, rw - 28.0f, 18.0f), &ellipsisFmt, &cyanBrush);

        REAL satBarX = rx + 14.0f;
        REAL satBarY = curY + 34.0f;
        REAL satBarW = rw * 0.40f;
        Color satCol = an.refreshSaturationPct >= 85 ? CyberPalette::AcidGreen : (an.refreshSaturationPct >= 55 ? CyberPalette::NeuralCyan : CyberPalette::CyberYellow);
        int animSatPct = static_cast<int>(std::round(an.refreshSaturationPct * easedBar));
        DrawSegmentedCyberBar(g, RectF(satBarX, satBarY, satBarW, 9.0f), animSatPct, satCol, 20);

        std::wstring wSatPct = std::wstring(tr(L"Refresh Match: ", L"Uso de Hz: ")) +
            std::to_wstring(an.refreshSaturationPct) + L"% (" + std::to_wstring(an.estimatedScreenFps.avg) + L" / " +
            std::to_wstring(an.refreshRateHz) + L" Hz)";
        g.DrawString(wSatPct.c_str(), -1, &fontCardSub, PointF(satBarX, curY + 48.0f), &whiteBrush);

        std::wstring wSync = std::wstring(tr(L"Tip: ", L"Consejo: ")) + GameCheck::utf8ToWide(an.fpsCapAdvice);
        RectF syncBox(satBarX + satBarW + 18.0f, curY + 30.0f, rw - satBarW - 40.0f, 36.0f);
        g.DrawString(wSync.c_str(), -1, &fontCardSub, syncBox, &wrapFmt, &greenBrush);

        curY += 86.0f;

        // 2. Clean Recommended Settings Grid
        RectF recCard(rx, curY, rw, 66.0f);
        DrawCyberPanel(g, recCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::CyberYellow, 8.0f, true);

        struct SettingPill { const wchar_t* name; std::string val; };
        SettingPill pills[7] = {
            { tr(L"Resolution", L"Resoluci\x00F3n"),  an.targetResolution },
            { tr(L"Preset", L"Calidad"),              an.preset },
            { tr(L"Upscaling", L"Escalado"),          an.upscalingMode },
            { tr(L"Textures", L"Texturas"),           an.textures },
            { tr(L"Shadows", L"Sombras"),             an.shadows },
            { L"Ray Tracing",                         an.rayTracing },
            { L"Frame Gen",                           an.frameGen }
        };

        REAL pillW = (rw - 20.0f) / 7.0f;
        for (int p = 0; p < 7; ++p) {
            REAL px = rx + 10.0f + p * pillW;
            if (p > 0) {
                Pen sepPen(CyberPalette::BorderSubtle, 1.0f);
                g.DrawLine(&sepPen, px, curY + 10.0f, px, curY + 56.0f);
            }
            g.DrawString(pills[p].name, -1, &fontCardHdr, PointF(px + 8.0f, curY + 10.0f), &mutedBrush);
            std::wstring wVal = GameCheck::utf8ToWide(pills[p].val);
            g.DrawString(wVal.c_str(), -1, &fontTableBold, RectF(px + 8.0f, curY + 32.0f, pillW - 12.0f, 22.0f), &ellipsisFmt, (p < 2) ? &yellowBrush : &cyanBrush);
        }

        curY += 78.0f;

        // 3. Top 3 Key FPS Boosts (Compact) OR Scrollable Detailed ListView (All Settings)
        REAL boostH = std::max(120.0f, botBtnTop - curY);
        RectF boostCard(rx, curY, rw, boostH);
        DrawCyberPanel(g, boostCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::AcidGreen, 9.0f, true);

        const wchar_t* boostHeader = g_app.detailedQuickView
            ? tr(L"All Configuration Recommendations (Scrollable)", L"Todas las Recomendaciones de Configuraci\x00F3n")
            : tr(L"Top 3 Key FPS Boosts (Biggest Gains)", L"Top 3 Mejoras de FPS (Mayor Impacto)");
        g.DrawString(boostHeader, -1, &fontSection,
                     RectF(rx + 14.0f, curY + 10.0f, rw - 220.0f, 22.0f), &ellipsisFmt, &greenBrush);

        if (!g_app.detailedQuickView) {
            REAL rowStartY = curY + 44.0f;
            REAL availRowsH = boostH - 56.0f;
            REAL rowH = std::max(38.0f, std::min(58.0f, availRowsH / 3.0f));

            for (size_t s = 0; s < an.settingImpacts.size() && s < 3; ++s) {
                REAL sy = rowStartY + s * rowH;
                if (sy + rowH > curY + boostH - 6.0f) break;

                if (s % 2 == 1) {
                    SolidBrush altRow(Color(150, 18, 18, 30));
                    g.FillRectangle(&altRow, rx + 10.0f, sy, rw - 20.0f, rowH - 4.0f);
                }

                const auto& imp = an.settingImpacts[s];
                std::wstring wSet  = std::to_wstring(s + 1) + L". " + GameCheck::utf8ToWide(imp.setting);
                std::wstring wRec  = GameCheck::utf8ToWide(imp.recommendedValue);
                std::wstring wGain = GameCheck::utf8ToWide("+" + std::to_string(imp.fpsGainPercent) + "% FPS");
                std::wstring wNote = GameCheck::utf8ToWide(imp.note);

                REAL textY = sy + (rowH - 22.0f) * 0.5f;
                g.DrawString(wSet.c_str(),  -1, &fontTableBold, RectF(rx + 16.0f, textY, 175.0f, rowH), &ellipsisFmt, &whiteBrush);
                g.DrawString(wRec.c_str(),  -1, &fontTableBold, RectF(rx + 196.0f, textY, 140.0f, rowH), &ellipsisFmt, &cyanBrush);
                g.DrawString(wGain.c_str(), -1, &fontTableBold, RectF(rx + 340.0f, textY, 85.0f, rowH), &ellipsisFmt, &greenBrush);
                if (rw > 460.0f) {
                    g.DrawString(wNote.c_str(), -1, &fontTable, RectF(rx + 430.0f, sy + 6.0f, rw - 446.0f, rowH - 10.0f), &wrapFmt, &mutedBrush);
                }
            }
        }
    }
    // =========================================================================
    // TAB 1: PC MATCH & IMPACT (5 Component Cards + Full 8-Setting Breakdown)
    // =========================================================================
    else if (g_app.activeTab == 1) {
        // 5-Component Pass/Fail Bars
        int compGap = 8;
        REAL compW = (rw - compGap * 4) / 5.0f;
        const GameCheck::ComponentEval* comps[5] = {
            &an.cpuEval, &an.gpuEval, &an.vramEval, &an.ramEval, &an.storageEval
        };

        for (int c = 0; c < 5; ++c) {
            REAL cx = rx + c * (compW + compGap);
            RectF cBox(cx, curY, compW, 64.0f);
            Color stCol = tierStatusColor(comps[c]->status);
            DrawCyberPanel(g, cBox, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, stCol, 7.0f, false);

            SolidBrush stBrush(stCol);
            std::wstring statusWord = comps[c]->passRec
                ? tr(L"Pass (Rec)", L"\x00D3ptimo")
                : (comps[c]->passMin ? tr(L"Minimum", L"M\x00EDnimo") : tr(L"Low", L"Bajo"));
            std::wstring wCompHdr = GameCheck::utf8ToWide(comps[c]->name) + L" \x2022 " + statusWord;
            g.DrawString(wCompHdr.c_str(), -1, &fontCardHdr, RectF(cx + 8.0f, curY + 7.0f, compW - 14.0f, 16.0f), &ellipsisFmt, &stBrush);

            std::wstring wCompVal = GameCheck::utf8ToWide(comps[c]->userValue);
            g.DrawString(wCompVal.c_str(), -1, &fontCardSub, RectF(cx + 8.0f, curY + 26.0f, compW - 14.0f, 15.0f), &ellipsisFmt, &whiteBrush);

            std::wstring wCompReq = std::wstring(tr(L"Needs: ", L"Req: ")) + GameCheck::utf8ToWide(comps[c]->recRequired);
            g.DrawString(wCompReq.c_str(), -1, &fontCardSub, RectF(cx + 8.0f, curY + 41.0f, compW - 14.0f, 15.0f), &ellipsisFmt, &mutedBrush);

            int compScorePct = comps[c]->passRec ? 100 : (comps[c]->passMin ? 62 : 28);
            int animCompPct = static_cast<int>(std::round(compScorePct * easedBar));
            DrawSegmentedCyberBar(g, RectF(cx + 8.0f, curY + 57.0f, compW - 16.0f, 3.0f), animCompPct, stCol, 12);
        }

        curY += 74.0f;

        // 8-Setting FPS/VRAM Impact List + Bottleneck Note
        REAL tableH = std::max(120.0f, botBtnTop - curY);
        RectF tableCard(rx, curY, rw, tableH);
        DrawCyberPanel(g, tableCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeonCrimson, 9.0f, true);

        std::wstring wBottleneckHdr = std::wstring(tr(L"Settings Impact Guide \x2022 Bottleneck: ", L"Impacto de Ajustes \x2022 Cuello de Botella: ")) +
            GameCheck::utf8ToWide(an.primaryBottleneck + " \xE2\x80\x94 " + an.bottleneckNote);
        g.DrawString(wBottleneckHdr.c_str(), -1, &fontCardHdr, RectF(rx + 12.0f, curY + 10.0f, rw - 24.0f, 18.0f), &ellipsisFmt, &yellowBrush);

        REAL rowStartY = curY + 34.0f;
        REAL availRowsH = tableH - 42.0f;
        REAL rowH = std::max(20.0f, std::min(32.0f, availRowsH / 8.0f));

        for (size_t s = 0; s < an.settingImpacts.size() && s < 8; ++s) {
            REAL sy = rowStartY + s * rowH;
            if (sy + rowH > curY + tableH - 4.0f) break;

            if (s % 2 == 1) {
                SolidBrush altRow(Color(160, 18, 18, 30));
                g.FillRectangle(&altRow, rx + 6.0f, sy, rw - 12.0f, rowH);
            }

            const auto& imp = an.settingImpacts[s];
            std::wstring wSet = GameCheck::utf8ToWide(imp.setting);
            std::wstring wRec = GameCheck::utf8ToWide(imp.recommendedValue);
            std::wstring wGain = GameCheck::utf8ToWide("+" + std::to_string(imp.fpsGainPercent) + "% FPS");
            std::wstring wVram = GameCheck::utf8ToWide("~" + std::to_string(imp.vramImpactMB) + " MB VRAM");
            std::wstring wNote = GameCheck::utf8ToWide(imp.note);

            REAL textY = sy + (rowH - 16.0f) * 0.5f;
            g.DrawString(wSet.c_str(), -1, &fontTableBold, RectF(rx + 12.0f, textY, 150.0f, rowH), &ellipsisFmt, &whiteBrush);
            g.DrawString(wRec.c_str(), -1, &fontTable, RectF(rx + 166.0f, textY, 140.0f, rowH), &ellipsisFmt, &cyanBrush);
            g.DrawString(wGain.c_str(), -1, &fontTableBold, RectF(rx + 310.0f, textY, 76.0f, rowH), &ellipsisFmt, &greenBrush);
            g.DrawString(wVram.c_str(), -1, &fontTable, RectF(rx + 390.0f, textY, 96.0f, rowH), &ellipsisFmt, &mutedBrush);
            if (rw > 520.0f) {
                g.DrawString(wNote.c_str(), -1, &fontTable, RectF(rx + 490.0f, textY, rw - 502.0f, rowH), &ellipsisFmt, &mutedBrush);
            }
        }
    }
    // =========================================================================
    // TAB 2: DRIVER APP SETTINGS
    // =========================================================================
    else if (g_app.activeTab == 2) {
        GameCheck::DriverAdvisorResult drv = GameCheck::getDriverAppRecommendations(g_app.activeSpecs, game, g_app.activeOptMode);

        // Top Driver Suite Summary Card
        RectF drvHdrCard(rx, curY, rw, 76.0f);
        DrawCyberPanel(g, drvHdrCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeuralCyan, 9.0f, true);

        std::wstring statusFriendly = (drv.suiteStatus == "INSTALLED")
            ? tr(L"Installed on PC", L"Instalado en PC")
            : tr(L"Driver Detected", L"Driver Detectado");
        std::wstring wSuiteTitle = GameCheck::utf8ToWide(drv.suiteName) + L"  (" + statusFriendly + L")";
        g.DrawString(wSuiteTitle.c_str(), -1, &fontSection, RectF(rx + 14.0f, curY + 10.0f, rw - 28.0f, 22.0f), &ellipsisFmt, &cyanBrush);

        std::wstring wDrvSummary = GameCheck::utf8ToWide(drv.summary);
        g.DrawString(wDrvSummary.c_str(), -1, &fontTable, RectF(rx + 14.0f, curY + 34.0f, rw - 28.0f, 34.0f), &wrapFmt, &whiteBrush);

        curY += 86.0f;

        // Spacious Driver Settings Table (room at bottom for Save Driver Guide button)
        REAL tableH = std::max(140.0f, botBtnTop - curY);
        RectF drvTableCard(rx, curY, rw, tableH);
        DrawCyberPanel(g, drvTableCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::CyberYellow, 9.0f, true);

        REAL colSetW = std::min(270.0f, std::max(210.0f, rw * 0.25f));
        REAL colValX = colSetW + 24.0f;
        REAL colValW = std::min(250.0f, std::max(185.0f, rw * 0.23f));
        REAL colWhyX = colValX + colValW + 14.0f;

        g.DrawString(tr(L"Recommended Driver Toggles", L"Ajustes Recomendados del Driver"), -1, &fontCardHdr, PointF(rx + 14.0f, curY + 10.0f), &yellowBrush);
        g.DrawString(tr(L"Setting", L"Opci\x00F3n"), -1, &fontCardHdr, PointF(rx + 14.0f, curY + 32.0f), &mutedBrush);
        g.DrawString(tr(L"Recommended Value", L"Valor Recomendado"), -1, &fontCardHdr, PointF(rx + colValX, curY + 32.0f), &mutedBrush);
        g.DrawString(tr(L"Why It Helps", L"Por Qu\x00E9 Ayuda"), -1, &fontCardHdr, PointF(rx + colWhyX, curY + 32.0f), &mutedBrush);

        Pen divPen(CyberPalette::BorderSubtle, 1.0f);
        g.DrawLine(&divPen, rx + 12.0f, curY + 50.0f, rx + rw - 12.0f, curY + 50.0f);

        REAL rowStartY = curY + 56.0f;
        REAL availH = tableH - 104.0f; // leave space for Save Driver Guide (.MD) button
        int nRows = static_cast<int>(drv.settings.size());
        REAL rowH = nRows > 0 ? std::max(26.0f, std::min(38.0f, availH / static_cast<REAL>(nRows))) : 30.0f;

        for (size_t d = 0; d < drv.settings.size(); ++d) {
            REAL sy = rowStartY + d * rowH;
            if (sy + rowH > curY + tableH - 44.0f) break;

            if (d % 2 == 1) {
                SolidBrush altRow(Color(160, 18, 18, 30));
                g.FillRectangle(&altRow, rx + 8.0f, sy, rw - 16.0f, rowH);
            }

            const auto& rec = drv.settings[d];
            std::wstring wSet = GameCheck::utf8ToWide(rec.setting);
            std::wstring wVal = GameCheck::utf8ToWide(rec.recommendedValue);
            std::wstring wReason = GameCheck::utf8ToWide(rec.reason);

            REAL textY = sy + (rowH - 18.0f) * 0.5f;
            g.DrawString(wSet.c_str(), -1, &fontTableBold, RectF(rx + 14.0f, textY, colSetW, rowH), &ellipsisFmt, &whiteBrush);
            g.DrawString(wVal.c_str(), -1, &fontTableBold, RectF(rx + colValX, textY, colValW, rowH), &ellipsisFmt, &yellowBrush);
            g.DrawString(wReason.c_str(), -1, &fontTable, RectF(rx + colWhyX, sy + 3.0f, std::max(120.0f, rw - colWhyX - 14.0f), rowH - 4.0f), &wrapFmt, &mutedBrush);
        }
    }
    // =========================================================================
    // TAB 3: UPSCALING & TIPS
    // =========================================================================
    else {
        GameCheck::DriverAdvisorResult drv = GameCheck::getDriverAppRecommendations(g_app.activeSpecs, game, g_app.activeOptMode);
        std::vector<GameCheck::UpscaleTierInfo> upMatrix = GameCheck::computeUpscalingMatrix(g_app.activeSpecs, game, g_app.activeOptMode);

        // 1) Upscaling & Resolution Math Card (4 tiers)
        REAL upH = 136.0f;
        RectF upCard(rx, curY, rw, upH);
        DrawCyberPanel(g, upCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeuralCyan, 9.0f, true);

        int dispW = g_app.activeSpecs.display.width > 0 ? g_app.activeSpecs.display.width : 1920;
        int dispH = g_app.activeSpecs.display.height > 0 ? g_app.activeSpecs.display.height : 1080;
        int dispHz = g_app.activeSpecs.display.refreshRateHz > 0 ? g_app.activeSpecs.display.refreshRateHz : 60;
        std::wstring wUpHdr = std::wstring(tr(L"Upscaling & Resolution Math \x2022 ", L"Escalado y Resoluci\x00F3n Interna \x2022 ")) +
            std::to_wstring(dispW) + L"x" + std::to_wstring(dispH) + L" @ " + std::to_wstring(dispHz) + L"Hz";
        g.DrawString(wUpHdr.c_str(), -1, &fontSection, RectF(rx + 14.0f, curY + 8.0f, rw - 28.0f, 22.0f), &ellipsisFmt, &cyanBrush);

        REAL uy = curY + 34.0f;
        for (size_t i = 0; i < upMatrix.size() && i < 4; ++i) {
            const auto& t = upMatrix[i];
            if (i % 2 == 1) {
                SolidBrush zebra(Color(16, 255, 255, 255));
                g.FillRectangle(&zebra, rx + 8.0f, uy, rw - 16.0f, 22.0f);
            }
            std::wstring wTier = GameCheck::utf8ToWide(t.tierName);
            std::wstring wRender = GameCheck::utf8ToWide(t.renderLabel);
            std::wstring wFps = L"~" + std::to_wstring(t.estimatedFpsAvg) + L" FPS";
            std::wstring wVram = t.vramSavedMB > 0
                ? (L"-" + std::to_wstring(t.vramSavedMB) + L" MB VRAM")
                : std::wstring(tr(L"Baseline", L"Base"));
            std::wstring wRec = GameCheck::utf8ToWide(t.recommendation);

            g.DrawString(wTier.c_str(), -1, &fontTableBold, RectF(rx + 14.0f, uy + 2.0f, 146.0f, 19.0f), &ellipsisFmt, &whiteBrush);
            g.DrawString(wRender.c_str(), -1, &fontTable, RectF(rx + 164.0f, uy + 2.0f, 168.0f, 19.0f), &ellipsisFmt, &cyanBrush);
            g.DrawString(wFps.c_str(), -1, &fontTableBold, RectF(rx + 336.0f, uy + 2.0f, 84.0f, 19.0f), &ellipsisFmt, &greenBrush);
            g.DrawString(wVram.c_str(), -1, &fontTable, RectF(rx + 424.0f, uy + 2.0f, 108.0f, 19.0f), &ellipsisFmt,
                t.vramSavedMB > 0 ? &yellowBrush : &mutedBrush);
            if (rw > 560.0f) {
                g.DrawString(wRec.c_str(), -1, &fontTable, RectF(rx + 536.0f, uy + 2.0f, rw - 550.0f, 19.0f), &ellipsisFmt, &mutedBrush);
            }
            uy += 23.0f;
        }

        // 2) Engine & Performance Tuning Tips Card
        REAL tipsY = curY + upH + 8.0f;
        REAL tipsH = std::max(98.0f, (botBtnTop - tipsY - 8.0f) * 0.48f);
        RectF tipsCard(rx, tipsY, rw, tipsH);
        DrawCyberPanel(g, tipsCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::CyberYellow, 9.0f, true);

        std::wstring wTipsHdr = std::wstring(tr(L"Engine & Performance Tuning Tips \x2022 ", L"Consejos de Rendimiento \x2022 ")) +
            GameCheck::utf8ToWide(game.title + " (" + game.engine + ")");
        g.DrawString(wTipsHdr.c_str(), -1, &fontSection, RectF(rx + 14.0f, tipsY + 8.0f, rw - 28.0f, 22.0f), &ellipsisFmt, &yellowBrush);

        REAL ty = tipsY + 34.0f;
        const auto& tips = an.tuningTips.empty() ? game.tuningTips : an.tuningTips;
        if (tips.empty()) {
            g.DrawString(tr(
                L"\x2022 Keep GPU drivers up to date and close heavy background browser tabs before launching.",
                L"\x2022 Mant\x00E9n los drivers de GPU actualizados y cierra pesta\x00F1as pesadas antes de jugar."
            ), -1, &fontTable, RectF(rx + 16.0f, ty, rw - 32.0f, 32.0f), &wrapFmt, &whiteBrush);
        } else {
            for (size_t t = 0; t < tips.size() && ty + 24.0f < tipsY + tipsH - 6.0f; ++t) {
                std::wstring wTip = L"\x2022  " + GameCheck::utf8ToWide(tips[t]);
                g.DrawString(wTip.c_str(), -1, &fontTable, RectF(rx + 16.0f, ty, rw - 32.0f, 30.0f), &wrapFmt, &whiteBrush);
                ty += 30.0f;
            }
        }

        // 3) Storage & Drive Placement Card
        REAL storY = tipsY + tipsH + 8.0f;
        REAL storH = std::max(96.0f, botBtnTop - storY);
        RectF storCard(rx, storY, rw, storH);
        DrawCyberPanel(g, storCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::AcidGreen, 9.0f, true);

        std::wstring wStorHdr = std::wstring(tr(L"Storage & Drive Placement \x2022 Game Size: ", L"Almacenamiento y Discos \x2022 Tama\x00F1o: ")) +
            std::to_wstring(game.storageGB) + L" GB (" +
            (game.ssdRequired ? tr(L"SSD Recommended", L"SSD Recomendado") : tr(L"HDD/SSD OK", L"HDD/SSD OK")) + L")";
        g.DrawString(wStorHdr.c_str(), -1, &fontSection, RectF(rx + 14.0f, storY + 8.0f, rw - 28.0f, 22.0f), &ellipsisFmt, &greenBrush);

        std::wstring wDriveAdvice = GameCheck::utf8ToWide(drv.storageAdvice);
        g.DrawString(wDriveAdvice.c_str(), -1, &fontTable, RectF(rx + 14.0f, storY + 32.0f, rw - 28.0f, 30.0f), &wrapFmt, &cyanBrush);

        REAL dy = storY + 66.0f;
        const auto& drives = g_app.activeSpecs.storage.allDrives;
        for (size_t i = 0; i < drives.size() && dy + 22.0f <= storY + storH - 6.0f; ++i) {
            const auto& d = drives[i];
            bool enough = d.freeGB >= game.storageGB;
            Color dCol = enough ? CyberPalette::AcidGreen : CyberPalette::NeonCrimson;

            std::wstring wDrvLine = GameCheck::utf8ToWide(d.drive) + L"  " + std::to_wstring(d.freeGB) +
                tr(L" GB Free / ", L" GB Libres / ") + std::to_wstring(d.totalGB) + tr(L" GB Total", L" GB Total") +
                (enough ? tr(L"  (Fits Game)", L"  (Espacio OK)") : tr(L"  (Low Space)", L"  (Poco Espacio)"));
            SolidBrush dBrush(dCol);
            g.DrawString(wDrvLine.c_str(), -1, &fontTableBold, RectF(rx + 14.0f, dy, 310.0f, 20.0f), &ellipsisFmt, &dBrush);

            REAL barX = rx + 334.0f;
            REAL barW = rw - 350.0f;
            if (barW > 80.0f) {
                int usedPct = d.totalGB > 0 ? ((d.totalGB - d.freeGB) * 100) / d.totalGB : 50;
                int animUsedPct = static_cast<int>(std::round(usedPct * easedBar));
                DrawSegmentedCyberBar(g, RectF(barX, dy + 5.0f, barW, 8.0f), animUsedPct, dCol, 20);
            }
            dy += 24.0f;
        }
    }

    g.Restore(tabState);

    if (easedTab < 0.999f && tabClipH > 0.0f) {
        BYTE fadeAlpha = static_cast<BYTE>((1.0f - easedTab) * 185.0f);
        if (fadeAlpha > 0) {
            SolidBrush fadeBrush(Color(fadeAlpha, 6, 6, 10));
            g.FillRectangle(&fadeBrush, rx, tabClipTop, rw, tabClipH);
        }
    }

    BitBlt(hdc, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
    SelectObject(memDC, oldBmp);
    DeleteObject(memBmp);
    DeleteDC(memDC);
}

// =============================================================================
// Export Configuration File Dialog
// =============================================================================
static void saveExportedConfigDialog(HWND hwnd, const std::string& ext) {
    if (g_app.allGames.empty()) return;
    const auto& game = g_app.allGames[g_app.selectedGameIdx];
    const auto& an = g_app.currentAnalysis;

    std::string content;
    const wchar_t* filter = L"All Files (*.*)\0*.*\0";
    std::string defName = game.id + "-gamecheck-" + an.modeId + "." + ext;

    if (ext == "ini") {
        content = GameCheck::exportConfigIni(g_app.activeSpecs, game, an);
        filter = L"INI Configuration (*.ini)\0*.ini\0All Files (*.*)\0*.*\0";
    } else if (ext == "json") {
        content = GameCheck::exportConfigJson(g_app.activeSpecs, game, an);
        filter = L"JSON Profile (*.json)\0*.json\0All Files (*.*)\0*.*\0";
    } else {
        content = GameCheck::exportConfigMd(g_app.activeSpecs, game, an);
        filter = L"Markdown Tuning Guide (*.md)\0*.md\0All Files (*.*)\0*.*\0";
    }

    wchar_t fileBuf[MAX_PATH] = {};
    std::wstring wDef = GameCheck::utf8ToWide(defName);
    wcsncpy_s(fileBuf, wDef.c_str(), _TRUNCATE);

    OPENFILENAMEW ofn = {};
    ofn.lStructSize = sizeof(ofn);
    ofn.hwndOwner = hwnd;
    ofn.lpstrFilter = filter;
    ofn.lpstrFile = fileBuf;
    ofn.nMaxFile = MAX_PATH;
    std::wstring wExt = GameCheck::utf8ToWide(ext);
    ofn.lpstrDefExt = wExt.c_str();
    ofn.Flags = OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR;

    if (GetSaveFileNameW(&ofn)) {
        std::string outPath = GameCheck::wideToUtf8(fileBuf);
        std::ofstream ofs(outPath, std::ios::binary | std::ios::trunc);
        if (ofs) {
            ofs.write(content.data(), static_cast<std::streamsize>(content.size()));
            ofs.close();
            std::wstring msg = L"Saved " + GameCheck::utf8ToWide(GameCheck::toUpper(ext)) + L" settings for " +
                               GameCheck::utf8ToWide(game.title) + L" to:\n\n" + fileBuf;
            MessageBoxW(hwnd, msg.c_str(), L"GameCheck — File Saved", MB_OK | MB_ICONINFORMATION);
        }
    }
}

// =============================================================================
// Modal Dialog Helper Loop & Styling
// =============================================================================
static void centerWindowToParent(HWND hwnd, HWND parent) {
    RECT rcDlg, rcPar;
    GetWindowRect(hwnd, &rcDlg);
    GetWindowRect(parent, &rcPar);
    int dw = rcDlg.right - rcDlg.left;
    int dh = rcDlg.bottom - rcDlg.top;
    int x = rcPar.left + ((rcPar.right - rcPar.left) - dw) / 2;
    int y = rcPar.top + ((rcPar.bottom - rcPar.top) - dh) / 2;
    SetWindowPos(hwnd, nullptr, std::max(10, x), std::max(10, y), 0, 0, SWP_NOSIZE | SWP_NOZORDER);
}

static void runModalLoop(HWND parent, HWND dlg) {
    EnableWindow(parent, FALSE);
    ShowWindow(dlg, SW_SHOWNORMAL);
    UpdateWindow(dlg);

    MSG msg;
    while (IsWindow(dlg) && GetMessageW(&msg, nullptr, 0, 0) > 0) {
        if (msg.message == WM_KEYDOWN && msg.wParam == VK_ESCAPE) {
            DestroyWindow(dlg);
            break;
        }
        if (!IsDialogMessageW(dlg, &msg)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    EnableWindow(parent, TRUE);
    SetForegroundWindow(parent);
}

static LRESULT handleDarkDlgColors(UINT msg, WPARAM wParam) {
    HDC hdcCtrl = reinterpret_cast<HDC>(wParam);
    if (msg == WM_CTLCOLORSTATIC) {
        SetTextColor(hdcCtrl, RGB(242, 245, 250));
        SetBkColor(hdcCtrl, RGB(12, 12, 20));
        return reinterpret_cast<LRESULT>(g_app.hBrushDlgBg);
    }
    if (msg == WM_CTLCOLOREDIT || msg == WM_CTLCOLORLISTBOX) {
        SetTextColor(hdcCtrl, RGB(252, 238, 9));
        SetBkColor(hdcCtrl, RGB(18, 18, 30));
        return reinterpret_cast<LRESULT>(g_app.hBrushDarkEdit);
    }
    return 0;
}

static void paintDarkDlgBg(HWND hwnd, const wchar_t* headerTitle, Color accent) {
    PAINTSTRUCT ps;
    HDC hdc = BeginPaint(hwnd, &ps);
    RECT rc;
    GetClientRect(hwnd, &rc);
    Graphics g(hdc);
    SolidBrush bg(CyberPalette::PanelSurface);
    g.FillRectangle(&bg, 0, 0, rc.right, rc.bottom);

    SolidBrush bar(accent);
    g.FillRectangle(&bar, 0, 0, rc.right, 3);

    FontFamily ff(L"Segoe UI");
    Font fHdr(&ff, 12.0f, FontStyleBold, UnitPoint);
    SolidBrush txtBrush(accent);
    g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
    g.DrawString(headerTitle, -1, &fHdr, PointF(16.0f, 12.0f), &txtBrush);

    Pen linePen(CyberPalette::BorderSubtle, 1.0f);
    g.DrawLine(&linePen, 16, 40, rc.right - 16, 40);
    EndPaint(hwnd, &ps);
}

static HWND makeDlgLabel(HWND parent, const wchar_t* text, int x, int y, int w, int h, int id = 0) {
    HWND lbl = CreateWindowExW(0, L"STATIC", text, WS_CHILD | WS_VISIBLE | SS_LEFT,
                               x, y, w, h, parent, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)),
                               GetModuleHandleW(nullptr), nullptr);
    SendMessageW(lbl, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUiBold), TRUE);
    return lbl;
}

static HWND makeDlgButton(HWND parent, const wchar_t* text, int x, int y, int w, int h, int id) {
    HWND btn = CreateWindowExW(0, L"BUTTON", text, WS_CHILD | WS_VISIBLE | BS_OWNERDRAW | WS_TABSTOP,
                               x, y, w, h, parent, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)),
                               GetModuleHandleW(nullptr), nullptr);
    SendMessageW(btn, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUiBold), TRUE);
    attachCyberButtonHover(btn);
    return btn;
}

// =============================================================================
// 1. INTERACTIVE COMPONENT PRICE & DEALS FINDER DIALOG
// =============================================================================
struct DealsDlgState {
    HWND comboCountry = nullptr;
    HWND editQuery = nullptr;
    HWND lblFirewall = nullptr;
    HWND lblSummary = nullptr;
    HWND listDeals = nullptr;
    GameCheck::DealSearchResult lastResult;
};
static DealsDlgState g_dealsDlg;

static void refreshDealsDialogResults(HWND dlg) {
    int cIdx = static_cast<int>(SendMessageW(g_dealsDlg.comboCountry, CB_GETCURSEL, 0, 0));
    const char* codes[] = { "AR", "US", "BR", "CL", "MX", "ES" };
    if (cIdx >= 0 && cIdx < 6 && g_app.activeCountry != codes[cIdx]) {
        g_app.activeCountry = codes[cIdx];
        GameCheck::UserPreferences prefs = GameCheck::loadUserPreferences();
        prefs.isSpanish = g_app.isSpanish;
        prefs.activeOptMode = g_app.activeOptMode;
        prefs.detailedQuickView = g_app.detailedQuickView;
        prefs.activeCountry = g_app.activeCountry;
        GameCheck::saveUserPreferences(prefs);
    }

    wchar_t qBuf[256] = {};
    GetWindowTextW(g_dealsDlg.editQuery, qBuf, 255);
    std::string query = GameCheck::trim(GameCheck::wideToUtf8(qBuf));
    if (query.empty()) query = "NVIDIA GeForce RTX 4070 Super 12GB";

    if (GameCheck::isFirewallAuthorized()) {
        SetWindowTextW(g_dealsDlg.lblFirewall, L"Firewall: Authorized (HTTPS 443)");
    } else {
        SetWindowTextW(g_dealsDlg.lblFirewall, L"Firewall: Blocked (Safe Read-Only)");
    }

    if (!GameCheck::isFirewallAuthorized()) {
        ListView_DeleteAllItems(g_dealsDlg.listDeals);
        SetWindowTextW(g_dealsDlg.lblSummary, L"Click 'Search Verified Deals' to authorize HTTPS store lookups and scan verified sellers.");
        return;
    }

    g_dealsDlg.lastResult = GameCheck::searchComponentDeals(query, g_app.activeCountry, false);
    const auto& res = g_dealsDlg.lastResult;

    ListView_DeleteAllItems(g_dealsDlg.listDeals);
    for (size_t i = 0; i < res.deals.size(); ++i) {
        const auto& d = res.deals[i];
        std::wstring wStore = GameCheck::utf8ToWide(d.storeName);
        std::wstringstream ts;
        ts << std::fixed << std::setprecision(1) << d.trustScore << L"/10 (" << d.positiveRatingPct << L"%+)";
        std::wstring wTrust = ts.str();
        std::wstring wPrice = GameCheck::utf8ToWide(d.formattedPrice);
        std::wstring wBadge = GameCheck::utf8ToWide(d.badge.empty() ? (d.isOfficialStore ? "Official Store" : "Verified Seller") : d.badge);

        LVITEMW lvi = {};
        lvi.mask = LVIF_TEXT;
        lvi.iItem = static_cast<int>(i);
        lvi.pszText = const_cast<LPWSTR>(wStore.c_str());
        ListView_InsertItem(g_dealsDlg.listDeals, &lvi);

        ListView_SetItemText(g_dealsDlg.listDeals, static_cast<int>(i), 1, const_cast<LPWSTR>(wTrust.c_str()));
        ListView_SetItemText(g_dealsDlg.listDeals, static_cast<int>(i), 2, const_cast<LPWSTR>(wPrice.c_str()));
        ListView_SetItemText(g_dealsDlg.listDeals, static_cast<int>(i), 3, const_cast<LPWSTR>(wBadge.c_str()));
    }

    if (!res.deals.empty()) {
        ListView_SetItemState(g_dealsDlg.listDeals, 0, LVIS_SELECTED | LVIS_FOCUSED, LVIS_SELECTED | LVIS_FOCUSED);
    }

    std::wstring summary = GameCheck::utf8ToWide(
        std::to_string(res.verifiedCount) + " Verified Stores \xE2\x80\xA2 " +
        std::to_string(res.blockedBadReputationCount) + " Bad Reputation & Scam Sellers Blocked \xE2\x80\xA2 Market Ref: " +
        res.formattedMarketRefPrice
    );
    SetWindowTextW(g_dealsDlg.lblSummary, summary.c_str());
    InvalidateRect(dlg, nullptr, FALSE);
}

static void openSelectedDealInBrowser(HWND dlg) {
    if (g_dealsDlg.lastResult.deals.empty()) return;
    int sel = ListView_GetNextItem(g_dealsDlg.listDeals, -1, LVNI_SELECTED);
    if (sel < 0 || sel >= static_cast<int>(g_dealsDlg.lastResult.deals.size())) sel = 0;
    std::wstring wUrl = GameCheck::utf8ToWide(g_dealsDlg.lastResult.deals[sel].url);
    ShellExecuteW(dlg, L"open", wUrl.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

static LRESULT CALLBACK DealsDlgProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            makeDlgLabel(hwnd, tr(L"Country / Currency:", L"Pa\x00EDs / Moneda:"), 18, 52, 140, 20);
            g_dealsDlg.comboCountry = CreateWindowExW(0, WC_COMBOBOXW, L"", WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST | WS_TABSTOP,
                                                      160, 48, 210, 200, hwnd, reinterpret_cast<HMENU>(IDC_DLG_COMBO_1),
                                                      GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_dealsDlg.comboCountry, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            const wchar_t* countries[] = {
                L"Argentina (ARS $)", L"United States (USD $)", L"Brazil (BRL R$)",
                L"Chile (CLP $)", L"Mexico (MXN $)", L"Spain / EU (EUR \x20AC)"
            };
            const char* codes[] = { "AR", "US", "BR", "CL", "MX", "ES" };
            int selC = 0;
            for (int i = 0; i < 6; ++i) {
                SendMessageW(g_dealsDlg.comboCountry, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(countries[i]));
                if (g_app.activeCountry == codes[i]) selC = i;
            }
            SendMessageW(g_dealsDlg.comboCountry, CB_SETCURSEL, selC, 0);

            makeDlgLabel(hwnd, tr(L"Component Search:", L"Buscar Componente:"), 18, 86, 140, 20);
            g_dealsDlg.editQuery = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"", WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL | WS_TABSTOP,
                                                   160, 82, 410, 26, hwnd, reinterpret_cast<HMENU>(IDC_DLG_EDIT_1),
                                                   GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_dealsDlg.editQuery, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);

            const auto& game = g_app.allGames.empty() ? GameCheck::getCatalogGames().front() : g_app.allGames[g_app.selectedGameIdx];
            std::string defaultHw = g_app.currentAnalysis.canRunRecommended
                ? "NVIDIA GeForce RTX 4070 Super 12GB"
                : (game.recGpu.empty() ? "AMD Radeon RX 7800 XT 16GB" : game.recGpu);
            SetWindowTextW(g_dealsDlg.editQuery, GameCheck::utf8ToWide(defaultHw).c_str());

            // Quick-Pick buttons
            makeDlgLabel(hwnd, tr(L"Quick Picks:", L"Sugeridos:"), 18, 120, 90, 20);
            const wchar_t* picks[] = { L"RX 7600", L"RX 7800 XT", L"RTX 4060", L"RTX 4070 Super", L"Ryzen 7 5700X3D" };
            int px = 114;
            for (int i = 0; i < 5; ++i) {
                int bw = (i >= 3) ? 116 : 86;
                makeDlgButton(hwnd, picks[i], px, 116, bw, 26, IDC_DLG_PICK_1 + i);
                px += bw + 6;
            }

            // Firewall Protection Bar + Search Button
            g_dealsDlg.lblFirewall = makeDlgLabel(hwnd, L"Firewall: Blocked (Safe Read-Only)", 18, 156, 340, 22, IDC_DLG_FW_LBL);
            makeDlgButton(hwnd, tr(L"Search Verified Deals", L"Buscar Precios Verificados"), 380, 151, 190, 30, IDC_DLG_SEARCH_DEALS);

            // Results ListView
            g_dealsDlg.listDeals = CreateWindowExW(0, WC_LISTVIEWW, L"",
                                                   WS_CHILD | WS_VISIBLE | WS_BORDER | LVS_REPORT | LVS_SINGLESEL | LVS_SHOWSELALWAYS,
                                                   18, 192, 668, 220, hwnd, reinterpret_cast<HMENU>(IDC_DLG_LIST_1),
                                                   GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_dealsDlg.listDeals, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            ListView_SetExtendedListViewStyle(g_dealsDlg.listDeals, LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER);
            ListView_SetBkColor(g_dealsDlg.listDeals, RGB(8, 8, 14));
            ListView_SetTextBkColor(g_dealsDlg.listDeals, RGB(8, 8, 14));
            ListView_SetTextColor(g_dealsDlg.listDeals, RGB(242, 245, 250));
            if (g_app.hListImg) ListView_SetImageList(g_dealsDlg.listDeals, g_app.hListImg, LVSIL_SMALL);

            const wchar_t* cols[] = { L"Store", L"Trust Score", L"Est. Price", L"Verification Badge" };
            int colW[] = { 190, 140, 130, 195 };
            for (int c = 0; c < 4; ++c) {
                LVCOLUMNW lvc = {};
                lvc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
                lvc.cx = colW[c];
                lvc.pszText = const_cast<LPWSTR>(cols[c]);
                lvc.iSubItem = c;
                ListView_InsertColumn(g_dealsDlg.listDeals, c, &lvc);
            }

            g_dealsDlg.lblSummary = makeDlgLabel(hwnd, L"", 18, 422, 668, 22, IDC_DLG_STATUS_LBL);

            makeDlgButton(hwnd, tr(L"Open Selected Store in Browser", L"Abrir Tienda en Navegador"), 18, 452, 240, 34, IDC_DLG_OPEN_BROWSER);
            makeDlgButton(hwnd, tr(L"Close", L"Cerrar"), 576, 452, 110, 34, IDC_DLG_CANCEL);

            refreshDealsDialogResults(hwnd);
            return 0;
        }
        case WM_DRAWITEM:
            drawCyberOwnerButton(reinterpret_cast<const DRAWITEMSTRUCT*>(lParam), CyberPalette::PanelSurface);
            return TRUE;
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT:
            paintDarkDlgBg(hwnd, tr(L"Component Price & Verified Deals Finder", L"Buscador de Precios y Ofertas Verificadas"), CyberPalette::CyberYellow);
            return 0;
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            return handleDarkDlgColors(msg, wParam);
        case WM_NOTIFY: {
            NMHDR* nm = reinterpret_cast<NMHDR*>(lParam);
            if (nm && nm->idFrom == IDC_DLG_LIST_1 && nm->code == NM_DBLCLK) {
                openSelectedDealInBrowser(hwnd);
            }
            break;
        }
        case WM_COMMAND: {
            int id = LOWORD(wParam);
            int code = HIWORD(wParam);
            if (id == IDC_DLG_COMBO_1 && code == CBN_SELCHANGE) {
                refreshDealsDialogResults(hwnd);
                return 0;
            }
            if (id >= IDC_DLG_PICK_1 && id <= IDC_DLG_PICK_5) {
                const wchar_t* fullNames[] = {
                    L"AMD Radeon RX 7600 8GB",
                    L"AMD Radeon RX 7800 XT 16GB",
                    L"NVIDIA GeForce RTX 4060 8GB",
                    L"NVIDIA GeForce RTX 4070 Super 12GB",
                    L"AMD Ryzen 7 5700X3D"
                };
                SetWindowTextW(g_dealsDlg.editQuery, fullNames[id - IDC_DLG_PICK_1]);
                if (GameCheck::isFirewallAuthorized()) refreshDealsDialogResults(hwnd);
                return 0;
            }
            if (id == IDC_DLG_SEARCH_DEALS) {
                if (!GameCheck::isFirewallAuthorized()) {
                    int fw = MessageBoxW(
                        hwnd,
                        L"GameCheck runs offline by default.\n\nAllow session permission to look up verified store prices and open HTTPS (Port 443) links?",
                        L"GameCheck — Firewall Permission",
                        MB_YESNO | MB_ICONQUESTION
                    );
                    if (fw != IDYES) return 0;
                    GameCheck::setFirewallAuthorized(true);
                }
                refreshDealsDialogResults(hwnd);
                return 0;
            }
            if (id == IDC_DLG_OPEN_BROWSER) {
                openSelectedDealInBrowser(hwnd);
                return 0;
            }
            if (id == IDC_DLG_CANCEL) {
                DestroyWindow(hwnd);
                return 0;
            }
            break;
        }
        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void showDealsDialog(HWND parent) {
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = DealsDlgProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.lpszClassName = L"GameCheckDealsModal";
    RegisterClassExW(&wc);

    HWND dlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME, wc.lpszClassName, L"GameCheck — Find Component Deals",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        0, 0, 720, 536, parent, nullptr, wc.hInstance, nullptr
    );
    centerWindowToParent(dlg, parent);
    runModalLoop(parent, dlg);
}

// =============================================================================
// 2. INTERACTIVE UPGRADE ("WHAT-IF") SIMULATOR DIALOG
// =============================================================================
struct SimDlgState {
    HWND cbCpu = nullptr;
    HWND cbGpu = nullptr;
    HWND cbRam = nullptr;
    HWND cbMon = nullptr;
};
static SimDlgState g_simDlg;

static const char* kSimCpus[] = {
    nullptr,
    "AMD Ryzen 5 3600",
    "AMD Ryzen 5 5600X",
    "AMD Ryzen 7 5700X3D",
    "AMD Ryzen 7 7800X3D",
    "Intel Core i5-12400F",
    "Intel Core i5-13600K",
    "Intel Core i7-14700K",
    "Intel Core i9-14900K"
};

static const char* kSimGpus[] = {
    nullptr,
    "NVIDIA GeForce GTX 1060 6GB",
    "NVIDIA GeForce RTX 3060 12GB",
    "NVIDIA GeForce RTX 4060 8GB",
    "NVIDIA GeForce RTX 4070 Super 12GB",
    "NVIDIA GeForce RTX 4080 Super 16GB",
    "NVIDIA GeForce RTX 4090 24GB",
    "AMD Radeon RX 6600 8GB",
    "AMD Radeon RX 7600 8GB",
    "AMD Radeon RX 7800 XT 16GB",
    "AMD Radeon RX 7900 XTX 24GB"
};

static const int kSimRams[] = { 0, 8, 16, 32, 64 };

static LRESULT CALLBACK SimDlgProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            auto makeCombo = [&](const wchar_t* label, int y, int id) -> HWND {
                makeDlgLabel(hwnd, label, 20, y + 4, 150, 22);
                HWND cb = CreateWindowExW(0, WC_COMBOBOXW, L"", WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST | WS_TABSTOP,
                                          175, y, 360, 240, hwnd, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)),
                                          GetModuleHandleW(nullptr), nullptr);
                SendMessageW(cb, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
                return cb;
            };

            g_simDlg.cbCpu = makeCombo(L"Processor (CPU):", 56, IDC_DLG_COMBO_1);
            SendMessageW(g_simDlg.cbCpu, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>((L"Use My Real CPU (" + GameCheck::utf8ToWide(g_app.detectedSpecs.cpu.name) + L")").c_str()));
            for (int i = 1; i < 9; ++i) {
                SendMessageW(g_simDlg.cbCpu, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(GameCheck::utf8ToWide(kSimCpus[i]).c_str()));
            }
            SendMessageW(g_simDlg.cbCpu, CB_SETCURSEL, g_app.simCpuIdx, 0);

            g_simDlg.cbGpu = makeCombo(L"Graphics Card (GPU):", 98, IDC_DLG_COMBO_2);
            SendMessageW(g_simDlg.cbGpu, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>((L"Use My Real GPU (" + GameCheck::utf8ToWide(g_app.detectedSpecs.gpu.name) + L")").c_str()));
            for (int i = 1; i < 11; ++i) {
                SendMessageW(g_simDlg.cbGpu, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(GameCheck::utf8ToWide(kSimGpus[i]).c_str()));
            }
            SendMessageW(g_simDlg.cbGpu, CB_SETCURSEL, g_app.simGpuIdx, 0);

            g_simDlg.cbRam = makeCombo(L"System Memory (RAM):", 140, IDC_DLG_COMBO_3);
            SendMessageW(g_simDlg.cbRam, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>((L"Use My Real RAM (" + std::to_wstring(g_app.detectedSpecs.ram.totalGB) + L" GB)").c_str()));
            SendMessageW(g_simDlg.cbRam, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"8 GB RAM"));
            SendMessageW(g_simDlg.cbRam, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"16 GB RAM"));
            SendMessageW(g_simDlg.cbRam, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"32 GB RAM"));
            SendMessageW(g_simDlg.cbRam, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"64 GB RAM"));
            SendMessageW(g_simDlg.cbRam, CB_SETCURSEL, g_app.simRamIdx, 0);

            g_simDlg.cbMon = makeCombo(L"Monitor / Screen:", 182, IDC_DLG_COMBO_4);
            std::wstring realMon = L"Use My Real Monitor (" + std::to_wstring(g_app.detectedSpecs.display.width) + L"x" +
                                   std::to_wstring(g_app.detectedSpecs.display.height) + L" @ " +
                                   std::to_wstring(g_app.detectedSpecs.display.refreshRateHz) + L"Hz)";
            SendMessageW(g_simDlg.cbMon, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(realMon.c_str()));
            SendMessageW(g_simDlg.cbMon, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"1080p @ 60Hz"));
            SendMessageW(g_simDlg.cbMon, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"1080p @ 144Hz"));
            SendMessageW(g_simDlg.cbMon, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"1080p @ 240Hz"));
            SendMessageW(g_simDlg.cbMon, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"1440p @ 165Hz"));
            SendMessageW(g_simDlg.cbMon, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"4K @ 120Hz"));
            SendMessageW(g_simDlg.cbMon, CB_SETCURSEL, g_app.simMonIdx, 0);

            makeDlgButton(hwnd, tr(L"Apply Simulation", L"Aplicar Simulaci\x00F3n"), 20, 236, 165, 34, IDC_DLG_OK);
            makeDlgButton(hwnd, tr(L"Reset to My PC", L"Restaurar Mi PC"), 195, 236, 155, 34, IDC_DLG_RESET);
            makeDlgButton(hwnd, tr(L"Cancel", L"Cancelar"), 425, 236, 110, 34, IDC_DLG_CANCEL);
            return 0;
        }
        case WM_DRAWITEM:
            drawCyberOwnerButton(reinterpret_cast<const DRAWITEMSTRUCT*>(lParam), CyberPalette::PanelSurface);
            return TRUE;
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT:
            paintDarkDlgBg(hwnd, tr(L"Upgrade Simulator (What-If)", L"Simulador de Mejoras (What-If)"), CyberPalette::NeuralCyan);
            return 0;
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            return handleDarkDlgColors(msg, wParam);
        case WM_COMMAND: {
            int id = LOWORD(wParam);
            if (id == IDC_DLG_OK) {
                g_app.simCpuIdx = std::max(0, static_cast<int>(SendMessageW(g_simDlg.cbCpu, CB_GETCURSEL, 0, 0)));
                g_app.simGpuIdx = std::max(0, static_cast<int>(SendMessageW(g_simDlg.cbGpu, CB_GETCURSEL, 0, 0)));
                g_app.simRamIdx = std::max(0, static_cast<int>(SendMessageW(g_simDlg.cbRam, CB_GETCURSEL, 0, 0)));
                g_app.simMonIdx = std::max(0, static_cast<int>(SendMessageW(g_simDlg.cbMon, CB_GETCURSEL, 0, 0)));

                g_app.activeSpecs = g_app.detectedSpecs;
                g_app.isSimulated = (g_app.simCpuIdx > 0 || g_app.simGpuIdx > 0 || g_app.simRamIdx > 0 || g_app.simMonIdx > 0);

                if (g_app.simCpuIdx > 0 && g_app.simCpuIdx < 9) {
                    std::string cpuName = kSimCpus[g_app.simCpuIdx];
                    auto res = GameCheck::scoreCPU(cpuName);
                    g_app.activeSpecs.cpu.name = cpuName;
                    g_app.activeSpecs.cpu.score = res.score;
                    g_app.activeSpecs.cpu.cores = res.estimatedCores;
                    g_app.activeSpecs.cpu.threads = res.estimatedCores * 2;
                }
                if (g_app.simGpuIdx > 0 && g_app.simGpuIdx < 11) {
                    std::string gpuName = kSimGpus[g_app.simGpuIdx];
                    auto res = GameCheck::scoreGPU(gpuName);
                    g_app.activeSpecs.gpu.name = gpuName;
                    g_app.activeSpecs.gpu.score = res.score;
                    g_app.activeSpecs.gpu.vramGB = res.vramGB;
                    g_app.activeSpecs.gpu.vramMB = res.vramGB * 1024;
                    g_app.activeSpecs.gpu.vendor = res.vendor;
                    g_app.activeSpecs.gpu.rtCapable = res.rtCapable;
                    g_app.activeSpecs.gpu.upscaler = res.upscaler;
                }
                if (g_app.simRamIdx > 0 && g_app.simRamIdx < 5) {
                    g_app.activeSpecs.ram.totalGB = kSimRams[g_app.simRamIdx];
                }
                if (g_app.simMonIdx > 0) {
                    struct MonPreset { int w, h, hz; const char* tier; const char* name; };
                    const MonPreset mons[] = {
                        { 1920, 1080, 60,  "1080p", "Simulated 1080p 60Hz" },
                        { 1920, 1080, 144, "1080p", "Simulated 1080p 144Hz" },
                        { 1920, 1080, 240, "1080p", "Simulated 1080p 240Hz" },
                        { 2560, 1440, 165, "1440p", "Simulated 1440p 165Hz" },
                        { 3840, 2160, 120, "4K",    "Simulated 4K 120Hz" }
                    };
                    if (g_app.simMonIdx >= 1 && g_app.simMonIdx <= 5) {
                        const auto& mp = mons[g_app.simMonIdx - 1];
                        g_app.activeSpecs.display.width = mp.w;
                        g_app.activeSpecs.display.height = mp.h;
                        g_app.activeSpecs.display.refreshRateHz = mp.hz;
                        g_app.activeSpecs.display.tier = mp.tier;
                        g_app.activeSpecs.display.name = mp.name;
                        g_app.activeSpecs.display.monitorName = mp.name;
                        g_app.activeSpecs.display.vrrCapable = (mp.hz >= 120);
                    }
                }

                SetWindowTextW(g_app.btnWhatIf, g_app.isSimulated ? L"Simulator (Active)" : L"Upgrade Simulator");
                InvalidateRect(g_app.btnWhatIf, nullptr, FALSE);
                populateGameListView();
                DestroyWindow(hwnd);
                return 0;
            }
            if (id == IDC_DLG_RESET) {
                g_app.simCpuIdx = g_app.simGpuIdx = g_app.simRamIdx = g_app.simMonIdx = 0;
                g_app.isSimulated = false;
                g_app.activeSpecs = g_app.detectedSpecs;
                SetWindowTextW(g_app.btnWhatIf, L"Upgrade Simulator");
                InvalidateRect(g_app.btnWhatIf, nullptr, FALSE);
                populateGameListView();
                DestroyWindow(hwnd);
                return 0;
            }
            if (id == IDC_DLG_CANCEL) {
                DestroyWindow(hwnd);
                return 0;
            }
            break;
        }
        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void showSimulatorDialog(HWND parent) {
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = SimDlgProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.lpszClassName = L"GameCheckSimulatorModal";
    RegisterClassExW(&wc);

    HWND dlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME, wc.lpszClassName, L"GameCheck — Upgrade Simulator",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        0, 0, 570, 326, parent, nullptr, wc.hInstance, nullptr
    );
    centerWindowToParent(dlg, parent);
    runModalLoop(parent, dlg);
}

// =============================================================================
// 3. INTERACTIVE STEAM REQUIREMENTS PARSER DIALOG
// =============================================================================
struct SteamDlgState {
    HWND editTitle = nullptr;
    HWND editReqs = nullptr;
};
static SteamDlgState g_steamDlg;

static std::string readClipboardUtf8(HWND hwnd) {
    std::string clipText;
    if (OpenClipboard(hwnd)) {
        HANDLE hData = GetClipboardData(CF_UNICODETEXT);
        if (hData) {
            const wchar_t* wPtr = static_cast<const wchar_t*>(GlobalLock(hData));
            if (wPtr) {
                clipText = GameCheck::wideToUtf8(wPtr);
                GlobalUnlock(hData);
            }
        }
        CloseClipboard();
    }
    return clipText;
}

static LRESULT CALLBACK SteamDlgProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            makeDlgLabel(hwnd, tr(L"Game Title:", L"Nombre del Juego:"), 18, 54, 120, 22);
            g_steamDlg.editTitle = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", tr(L"Custom Steam Game", L"Juego de Steam"),
                                                   WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL | WS_TABSTOP,
                                                   140, 50, 460, 26, hwnd, reinterpret_cast<HMENU>(IDC_DLG_EDIT_1),
                                                   GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_steamDlg.editTitle, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);

            makeDlgLabel(hwnd, tr(L"Paste Steam System Requirements (Minimum / Recommended):", L"Pega los Requisitos de Steam (M\x00EDnimos / Recomendados):"), 18, 86, 560, 20);
            g_steamDlg.editReqs = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"",
                                                  WS_CHILD | WS_VISIBLE | ES_MULTILINE | ES_AUTOVSCROLL | WS_VSCROLL | ES_WANTRETURN | WS_TABSTOP,
                                                  18, 110, 582, 230, hwnd, reinterpret_cast<HMENU>(IDC_DLG_EDIT_2),
                                                  GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_steamDlg.editReqs, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);

            std::string clip = readClipboardUtf8(hwnd);
            bool hasReqs = GameCheck::containsIgnoreCase(clip, "processor") ||
                           GameCheck::containsIgnoreCase(clip, "graphics") ||
                           GameCheck::containsIgnoreCase(clip, "memory");
            std::string initText = hasReqs ? clip :
                "Minimum:\r\n"
                "OS: Windows 10/11 64-bit\r\n"
                "Processor: AMD Ryzen 5 3600 or Intel Core i5-10400\r\n"
                "Memory: 16 GB RAM\r\n"
                "Graphics: NVIDIA GeForce RTX 2060 Super 8GB or AMD Radeon RX 6600 8GB\r\n"
                "Storage: 85 GB available space (SSD Recommended)\r\n\r\n"
                "Recommended:\r\n"
                "Processor: AMD Ryzen 7 5800X3D or Intel Core i7-12700K\r\n"
                "Memory: 32 GB RAM\r\n"
                "Graphics: NVIDIA GeForce RTX 4070 12GB or AMD Radeon RX 7800 XT 16GB\r\n"
                "Storage: 85 GB available space";
            SetWindowTextW(g_steamDlg.editReqs, GameCheck::utf8ToWide(initText).c_str());

            makeDlgButton(hwnd, tr(L"Analyze Game", L"Analizar Juego"), 18, 356, 160, 34, IDC_DLG_OK);
            makeDlgButton(hwnd, tr(L"Paste from Clipboard", L"Pegar del Portapapeles"), 188, 356, 175, 34, IDC_DLG_PASTE_CLIP);
            makeDlgButton(hwnd, tr(L"Cancel", L"Cancelar"), 490, 356, 110, 34, IDC_DLG_CANCEL);
            return 0;
        }
        case WM_DRAWITEM:
            drawCyberOwnerButton(reinterpret_cast<const DRAWITEMSTRUCT*>(lParam), CyberPalette::PanelSurface);
            return TRUE;
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT:
            paintDarkDlgBg(hwnd, tr(L"Paste Steam System Requirements", L"Pegar Requisitos de Steam"), CyberPalette::AcidGreen);
            return 0;
        case WM_CTLCOLORSTATIC:
        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX:
            return handleDarkDlgColors(msg, wParam);
        case WM_COMMAND: {
            int id = LOWORD(wParam);
            if (id == IDC_DLG_PASTE_CLIP) {
                std::string clip = readClipboardUtf8(hwnd);
                if (!clip.empty()) {
                    SetWindowTextW(g_steamDlg.editReqs, GameCheck::utf8ToWide(clip).c_str());
                }
                return 0;
            }
            if (id == IDC_DLG_OK) {
                wchar_t titleBuf[256] = {};
                GetWindowTextW(g_steamDlg.editTitle, titleBuf, 255);
                std::string title = GameCheck::trim(GameCheck::wideToUtf8(titleBuf));
                if (title.empty()) title = "Custom Steam Game";

                int len = GetWindowTextLengthW(g_steamDlg.editReqs);
                std::wstring wReqs(static_cast<size_t>(len + 1), L'\0');
                GetWindowTextW(g_steamDlg.editReqs, &wReqs[0], len + 1);
                std::string rawReqs = GameCheck::trim(GameCheck::wideToUtf8(wReqs.c_str()));
                if (rawReqs.empty()) {
                    MessageBoxW(hwnd, L"Please paste Steam system requirements before analyzing.", L"GameCheck", MB_OK | MB_ICONWARNING);
                    return 0;
                }

                g_app.customParsedGame = GameCheck::parseRawSteamReqs(rawReqs, title, "Custom Steam Spec");
                g_app.hasCustomParsedGame = true;
                if (!g_app.allGames.empty() && g_app.allGames.front().id == g_app.customParsedGame.id) {
                    g_app.allGames.front() = g_app.customParsedGame;
                } else {
                    g_app.allGames.insert(g_app.allGames.begin(), g_app.customParsedGame);
                }
                g_app.selectedGameIdx = 0;
                g_app.activeTab = 0;
                updateTabVisibility();
                populateGameListView();
                DestroyWindow(hwnd);
                return 0;
            }
            if (id == IDC_DLG_CANCEL) {
                DestroyWindow(hwnd);
                return 0;
            }
            break;
        }
        case WM_CLOSE:
            DestroyWindow(hwnd);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void showSteamParserDialog(HWND parent) {
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = SteamDlgProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.lpszClassName = L"GameCheckSteamParserModal";
    RegisterClassExW(&wc);

    HWND dlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME, wc.lpszClassName, L"GameCheck — Paste Steam Specs",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        0, 0, 634, 444, parent, nullptr, wc.hInstance, nullptr
    );
    centerWindowToParent(dlg, parent);
    runModalLoop(parent, dlg);
}

// =============================================================================
// 4. UPDATES & PATCH INFO DIALOG
// =============================================================================
static std::wstring buildUpdatesInfoText() {
    std::wstring updLine = L"Update Status: ";
    if (g_app.updateCheckInProgress) {
        updLine += L"Checking GitHub Releases & local patches...";
    } else if (!g_app.updateState.checked) {
        updLine += L"Not checked yet";
    } else if (g_app.updateState.applied) {
        updLine += L"Updated to v" + GameCheck::utf8ToWide(g_app.updateState.latestVersion) +
                   (g_app.updateState.restartRequired ? L" (Relaunching...)" : L"");
    } else if (g_app.updateState.updateAvailable) {
        updLine += L"Available: v" + GameCheck::utf8ToWide(g_app.updateState.latestVersion) +
                   L" (" + GameCheck::utf8ToWide(g_app.updateState.source) + L")";
    } else if (!g_app.updateState.errorMessage.empty()) {
        updLine += GameCheck::utf8ToWide(g_app.updateState.errorMessage);
    } else {
        updLine += L"Up to date (v" + GameCheck::utf8ToWide(GameCheck::FULL_VERSION) + L")";
    }

    return L"Version: v" + GameCheck::utf8ToWide(GameCheck::FULL_VERSION) + L"\r\n" +
           updLine + L"\r\n" +
           L"Mode: 100% Read-Only \x2022 Non-Invasive \x2022 Anti-Cheat Safe \x2022 0% Idle CPU\r\n" +
           L"Hardware Scan Speed: " + std::to_wstring(static_cast<int>(g_app.detectedSpecs.scanDurationMs)) + L" ms\r\n" +
           L"Built-in Game Catalog: " + std::to_wstring(GameCheck::getCatalogGames().size()) + L" Titles + Installed Steam/Epic/Xbox Detection\r\n\r\n" +
           L"Auto-checks GitHub Releases & local .rigpatch.json bundles on startup.";
}

static LRESULT CALLBACK UpdatesDlgProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            std::wstring info = buildUpdatesInfoText();
            HWND lbl = makeDlgLabel(hwnd, info.c_str(), 18, 52, 540, 146);
            SendMessageW(lbl, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            g_app.hwndUpdatesDlgLabel = lbl;

            makeDlgButton(hwnd, tr(L"Check & Apply Updates Now", L"Buscar y Aplicar Actualizaciones"), 18, 210, 224, 34, IDC_DLG_CHECK_UPDATES);
            makeDlgButton(hwnd, tr(L"Apply Patch File...", L"Aplicar Parche..."), 250, 210, 178, 34, IDC_DLG_OK);
            makeDlgButton(hwnd, tr(L"Close", L"Cerrar"), 436, 210, 122, 34, IDC_DLG_CANCEL);
            return 0;
        }
        case WM_DRAWITEM:
            drawCyberOwnerButton(reinterpret_cast<const DRAWITEMSTRUCT*>(lParam), CyberPalette::PanelSurface);
            return TRUE;
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT:
            paintDarkDlgBg(hwnd, tr(L"Updates & Application Info", L"Actualizaciones e Informaci\x00F3n"), CyberPalette::CyberYellow);
            return 0;
        case WM_CTLCOLORSTATIC:
            return handleDarkDlgColors(msg, wParam);
        case WM_COMMAND: {
            int id = LOWORD(wParam);
            if (id == IDC_DLG_CHECK_UPDATES) {
                startAsyncUpdateCheck(g_app.hwndMain, true);
                if (g_app.hwndUpdatesDlgLabel && IsWindow(g_app.hwndUpdatesDlgLabel)) {
                    SetWindowTextW(g_app.hwndUpdatesDlgLabel, buildUpdatesInfoText().c_str());
                }
                return 0;
            }
            if (id == IDC_DLG_OK) {
                wchar_t fileBuf[MAX_PATH] = {};
                OPENFILENAMEW ofn = {};
                ofn.lStructSize = sizeof(ofn);
                ofn.hwndOwner = hwnd;
                ofn.lpstrFilter = L"GameCheck Patch Bundle (*.rigpatch.json)\0*.rigpatch.json;*.json\0All Files (*.*)\0*.*\0";
                ofn.lpstrFile = fileBuf;
                ofn.nMaxFile = MAX_PATH;
                ofn.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR;
                if (GetOpenFileNameW(&ofn)) {
                    GameCheck::UpdateCheckResult manualRes;
                    manualRes.updateAvailable = true;
                    manualRes.isLocalPatch = true;
                    manualRes.currentVersion = GameCheck::FULL_VERSION;
                    manualRes.localPatchPath = GameCheck::wideToUtf8(fileBuf);
                    if (GameCheck::applyAutoUpdate(manualRes, getAppRootDir())) {
                        g_app.updateState = manualRes;
                        g_app.updatePillText = L"Updated!";
                        g_app.updatePillColor = CyberPalette::AcidGreen;
                        InvalidateRect(g_app.hwndMain, nullptr, FALSE);
                        if (g_app.hwndUpdatesDlgLabel && IsWindow(g_app.hwndUpdatesDlgLabel)) {
                            SetWindowTextW(g_app.hwndUpdatesDlgLabel, buildUpdatesInfoText().c_str());
                        }
                        MessageBoxW(hwnd, L"Verified and applied SHA-256 patch bundle successfully.", L"GameCheck — Patch Applied", MB_OK | MB_ICONINFORMATION);
                    } else {
                        std::wstring errMsg = L"Patch verification failed:\n" + GameCheck::utf8ToWide(manualRes.errorMessage);
                        MessageBoxW(hwnd, errMsg.c_str(), L"GameCheck — Patch Error", MB_OK | MB_ICONERROR);
                    }
                }
                return 0;
            }
            if (id == IDC_DLG_CANCEL) {
                g_app.hwndUpdatesDlgLabel = nullptr;
                DestroyWindow(hwnd);
                return 0;
            }
            break;
        }
        case WM_CLOSE:
            g_app.hwndUpdatesDlgLabel = nullptr;
            DestroyWindow(hwnd);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void showUpdatesDialog(HWND parent) {
    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = UpdatesDlgProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.lpszClassName = L"GameCheckUpdatesModal";
    RegisterClassExW(&wc);

    HWND dlg = CreateWindowExW(
        WS_EX_DLGMODALFRAME, wc.lpszClassName, L"GameCheck — Updates & Info",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        0, 0, 584, 298, parent, nullptr, wc.hInstance, nullptr
    );
    centerWindowToParent(dlg, parent);
    runModalLoop(parent, dlg);
}

// =============================================================================
// Persistent Preferences Helper
// =============================================================================
static void saveCurrentPreferences(HWND hwnd) {
    GameCheck::UserPreferences prefs = GameCheck::loadUserPreferences();
    prefs.isSpanish = g_app.isSpanish;
    prefs.activeOptMode = g_app.activeOptMode;
    prefs.detailedQuickView = g_app.detailedQuickView;
    prefs.activeCountry = g_app.activeCountry;
    if (hwnd && IsWindow(hwnd) && !IsIconic(hwnd) && !IsZoomed(hwnd)) {
        RECT rc = {};
        if (GetWindowRect(hwnd, &rc)) {
            prefs.windowX = rc.left;
            prefs.windowY = rc.top;
            prefs.windowW = rc.right - rc.left;
            prefs.windowH = rc.bottom - rc.top;
        }
    }
    GameCheck::saveUserPreferences(prefs);
}

// =============================================================================
// Main Window Procedure
// =============================================================================
static LRESULT CALLBACK MainWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            g_app.hwndMain = hwnd;
            g_app.hFontUi = CreateFontW(-14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                        OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                        DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
            g_app.hFontUiBold = CreateFontW(-14, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                            DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
            g_app.hFontTitle = CreateFontW(-15, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                           OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                           DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
            g_app.hBrushDarkEdit = CreateSolidBrush(RGB(26, 32, 44));
            g_app.hBrushDlgBg = CreateSolidBrush(RGB(16, 20, 28));
            g_app.hListImg = nullptr;

            auto makeCyberBtn = [&](const wchar_t* text, int id) -> HWND {
                HWND b = CreateWindowExW(0, L"BUTTON", text, WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
                                         0, 0, 100, 28, hwnd, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)),
                                         GetModuleHandleW(nullptr), nullptr);
                SendMessageW(b, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUiBold), TRUE);
                attachCyberButtonHover(b);
                return b;
            };

            // Language Selector Combo in Top Header
            g_app.hwndLang = CreateWindowExW(0, WC_COMBOBOXW, L"", WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST,
                                             0, 0, 136, 120, hwnd, reinterpret_cast<HMENU>(IDC_COMBO_LANG),
                                             GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndLang, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUiBold), TRUE);
            SendMessageW(g_app.hwndLang, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"EN | English"));
            SendMessageW(g_app.hwndLang, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"ES | Espa\x00F1ol"));
            SendMessageW(g_app.hwndLang, CB_SETCURSEL, g_app.isSpanish ? 1 : 0, 0);

            // Top Action Bar Buttons
            g_app.btnRescan     = makeCyberBtn(L"Rescan PC", IDC_BTN_RESCAN);
            g_app.btnWhatIf     = makeCyberBtn(L"Upgrade Simulator", IDC_BTN_WHATIF);
            g_app.btnParseSteam = makeCyberBtn(L"Paste Steam Specs", IDC_BTN_PARSE_STEAM);
            g_app.btnDealsTop   = makeCyberBtn(L"Find Component Deals", IDC_BTN_DEALS_TOP);
            g_app.btnDriverCfg  = makeCyberBtn(L"Driver App Settings", IDC_BTN_DRIVER_CFG);
            g_app.btnPatchInfo  = makeCyberBtn(L"Updates & Info", IDC_BTN_PATCH_INFO);

            // Search Box & Filter Combo
            g_app.hwndSearch = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"", WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL,
                                               0, 0, 180, 28, hwnd, reinterpret_cast<HMENU>(IDC_EDIT_SEARCH),
                                               GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndSearch, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            SendMessageW(g_app.hwndSearch, EM_SETCUEBANNER, FALSE, reinterpret_cast<LPARAM>(L"Search 50+ games, genres, engines..."));

            g_app.hwndFilter = CreateWindowExW(0, WC_COMBOBOXW, L"", WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST,
                                               0, 0, 205, 220, hwnd, reinterpret_cast<HMENU>(IDC_COMBO_FILTER),
                                               GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndFilter, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Installed Games"));
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"All Games (Installed First)"));
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Ultra / Recommended"));
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Competitive / High FPS"));
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"Story / AAA"));
            SendMessageW(g_app.hwndFilter, CB_SETCURSEL, 0, 0);

            // Game ListView with 60x30 mini-banner thumbnails and 3 clean columns
            g_app.hwndList = CreateWindowExW(0, WC_LISTVIEWW, L"",
                                             WS_CHILD | WS_VISIBLE | WS_BORDER | LVS_REPORT | LVS_SINGLESEL | LVS_SHOWSELALWAYS,
                                             0, 0, 400, 400, hwnd, reinterpret_cast<HMENU>(IDC_LIST_GAMES),
                                             GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndList, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            ListView_SetExtendedListViewStyle(g_app.hwndList, LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER);
            ListView_SetBkColor(g_app.hwndList, RGB(18, 23, 31));
            ListView_SetTextBkColor(g_app.hwndList, RGB(8, 8, 14));
            ListView_SetTextColor(g_app.hwndList, RGB(236, 240, 248));

            const wchar_t* cols[3] = { L"Game", L"Status", L"Est. FPS" };
            int colW[3] = { 210, 92, 86 };
            for (int c = 0; c < 3; ++c) {
                LVCOLUMNW lvc = {};
                lvc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
                lvc.cx = colW[c];
                lvc.pszText = const_cast<LPWSTR>(cols[c]);
                lvc.iSubItem = c;
                ListView_InsertColumn(g_app.hwndList, c, &lvc);
            }

            // 4 Optimization Mode Buttons
            g_app.btnModeOptimal  = makeCyberBtn(L"Optimal (Auto)", IDC_BTN_MODE_OPTIMAL);
            g_app.btnModeFullFps  = makeCyberBtn(L"Max FPS", IDC_BTN_MODE_FULLFPS);
            g_app.btnModeBalanced = makeCyberBtn(L"Balanced", IDC_BTN_MODE_BALANCED);
            g_app.btnModeQuality  = makeCyberBtn(L"Quality (30-60 FPS)", IDC_BTN_MODE_QUALITY);

            // 4 Sub-View Tab Buttons
            g_app.btnTabQuick  = makeCyberBtn(L"Quick Settings", IDC_BTN_TAB_QUICK);
            g_app.btnTabMatch  = makeCyberBtn(L"PC Match & Impact", IDC_BTN_TAB_MATCH);
            g_app.btnTabDriver = makeCyberBtn(L"Driver App", IDC_BTN_TAB_DRIVER);
            g_app.btnTabTips   = makeCyberBtn(L"Upscaling & Tips", IDC_BTN_TAB_TIPS);

            // Save Driver Guide button (shown on Tab 2) & Detailed Quick View Toggle (shown on Tab 0)
            g_app.btnSaveDrvMd = makeCyberBtn(L"Save Driver Guide (.MD)", IDC_BTN_SAVE_DRV_MD);
            ShowWindow(g_app.btnSaveDrvMd, SW_HIDE);
            g_app.btnToggleDetail = makeCyberBtn(L"Detailed View (All)", IDC_BTN_TOGGLE_DETAIL);

            // Scrollable Detailed Settings ListView (Tab 0 Detailed Mode)
            g_app.hwndDetailList = CreateWindowExW(0, WC_LISTVIEWW, L"",
                                                   WS_CHILD | WS_BORDER | WS_VSCROLL | LVS_REPORT | LVS_SINGLESEL,
                                                   0, 0, 500, 200, hwnd, reinterpret_cast<HMENU>(IDC_LIST_DETAIL),
                                                   GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndDetailList, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            ListView_SetExtendedListViewStyle(g_app.hwndDetailList, LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER);
            ListView_SetBkColor(g_app.hwndDetailList, RGB(8, 8, 14));
            ListView_SetTextBkColor(g_app.hwndDetailList, RGB(8, 8, 14));
            ListView_SetTextColor(g_app.hwndDetailList, RGB(236, 240, 248));
            const wchar_t* dCols[5] = { L"Setting", L"Recommended", L"FPS Impact", L"VRAM", L"Why / Details" };
            int dColW[5] = { 165, 135, 75, 72, 220 };
            for (int c = 0; c < 5; ++c) {
                LVCOLUMNW lvc = {};
                lvc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
                lvc.cx = dColW[c];
                lvc.pszText = const_cast<LPWSTR>(dCols[c]);
                lvc.iSubItem = c;
                ListView_InsertColumn(g_app.hwndDetailList, c, &lvc);
            }
            ShowWindow(g_app.hwndDetailList, SW_HIDE);

            // Bottom Action Buttons
            g_app.btnSaveIni     = makeCyberBtn(L"Save .INI", IDC_BTN_SAVE_INI);
            g_app.btnSaveJson    = makeCyberBtn(L"Save .JSON", IDC_BTN_SAVE_JSON);
            g_app.btnSaveMd      = makeCyberBtn(L"Save Guide (.MD)", IDC_BTN_SAVE_MD);
            g_app.btnCopySummary = makeCyberBtn(L"Copy Summary", IDC_BTN_COPY_SUMMARY);

            layoutChildControls(hwnd);
            return 0;
        }

        case WM_DRAWITEM: {
            drawCyberOwnerButton(reinterpret_cast<const DRAWITEMSTRUCT*>(lParam));
            return TRUE;
        }

        case WM_GETMINMAXINFO: {
            MINMAXINFO* mmi = reinterpret_cast<MINMAXINFO*>(lParam);
            mmi->ptMinTrackSize.x = 1040;
            mmi->ptMinTrackSize.y = 640;
            return 0;
        }

        case WM_SIZE: {
            layoutChildControls(hwnd);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }

        case WM_ERASEBKGND:
            return 1;

        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX: {
            HDC hdcCtrl = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdcCtrl, RGB(252, 238, 9));
            SetBkColor(hdcCtrl, RGB(18, 18, 30));
            return reinterpret_cast<LRESULT>(g_app.hBrushDarkEdit);
        }

        case WM_COMMAND: {
            int id = LOWORD(wParam);
            int code = HIWORD(wParam);

            if (id == IDC_EDIT_SEARCH && code == EN_CHANGE) {
                populateGameListView();
                return 0;
            }
            if (id == IDC_COMBO_FILTER && code == CBN_SELCHANGE) {
                populateGameListView();
                return 0;
            }
            if (id == IDC_COMBO_LANG && code == CBN_SELCHANGE) {
                int sel = static_cast<int>(SendMessageW(g_app.hwndLang, CB_GETCURSEL, 0, 0));
                g_app.isSpanish = (sel == 1);
                applyLanguageToUi();
                saveCurrentPreferences(hwnd);
                return 0;
            }

            switch (id) {
                case IDC_BTN_RESCAN:
                    refreshHardwareAndGames();
                    break;

                case IDC_BTN_WHATIF:
                    showSimulatorDialog(hwnd);
                    break;

                case IDC_BTN_PARSE_STEAM:
                    showSteamParserDialog(hwnd);
                    break;

                case IDC_BTN_DEALS_TOP:
                case IDC_BTN_FIND_DEALS:
                    showDealsDialog(hwnd);
                    break;

                case IDC_BTN_PATCH_INFO:
                    showUpdatesDialog(hwnd);
                    break;

                case IDC_BTN_DRIVER_CFG:
                    g_app.activeTab = 2;
                    updateTabVisibility();
                    startUiAnimation(true, true);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    break;

                case IDC_BTN_TAB_QUICK:
                case IDC_BTN_TAB_MATCH:
                case IDC_BTN_TAB_DRIVER:
                case IDC_BTN_TAB_TIPS:
                    g_app.activeTab = id - IDC_BTN_TAB_QUICK;
                    updateTabVisibility();
                    startUiAnimation(true, true);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    break;

                case IDC_BTN_TOGGLE_DETAIL:
                    g_app.detailedQuickView = !g_app.detailedQuickView;
                    updateDetailButtonText();
                    updateTabVisibility();
                    populateDetailListView();
                    saveCurrentPreferences(hwnd);
                    startUiAnimation(true, false);
                    InvalidateRect(hwnd, nullptr, FALSE);
                    break;

                case IDC_BTN_MODE_OPTIMAL:
                case IDC_BTN_MODE_FULLFPS:
                case IDC_BTN_MODE_BALANCED:
                case IDC_BTN_MODE_QUALITY:
                    g_app.activeOptMode = id - IDC_BTN_MODE_OPTIMAL;
                    saveCurrentPreferences(hwnd);
                    startUiAnimation(true, true);
                    populateGameListView();
                    break;

                case IDC_BTN_SAVE_INI:
                    saveExportedConfigDialog(hwnd, "ini");
                    break;
                case IDC_BTN_SAVE_JSON:
                    saveExportedConfigDialog(hwnd, "json");
                    break;
                case IDC_BTN_SAVE_MD:
                case IDC_BTN_SAVE_DRV_MD:
                    saveExportedConfigDialog(hwnd, "md");
                    break;

                case IDC_BTN_COPY_SUMMARY: {
                    if (!g_app.allGames.empty()) {
                        const auto& gm = g_app.allGames[g_app.selectedGameIdx];
                        GameCheck::GameAnalysis ga = GameCheck::analyzeGame(g_app.activeSpecs, gm, g_app.activeOptMode);
                        std::string summaryUtf8 = GameCheck::buildShareableSummaryText(g_app.activeSpecs, gm, ga, g_app.isSpanish);
                        std::wstring summaryW = GameCheck::utf8ToWide(summaryUtf8);
                        if (OpenClipboard(hwnd)) {
                            EmptyClipboard();
                            SIZE_T bytes = (summaryW.size() + 1) * sizeof(wchar_t);
                            HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, bytes);
                            if (hMem) {
                                void* ptr = GlobalLock(hMem);
                                if (ptr) {
                                    memcpy(ptr, summaryW.c_str(), bytes);
                                    GlobalUnlock(hMem);
                                    if (!SetClipboardData(CF_UNICODETEXT, hMem)) {
                                        GlobalFree(hMem);
                                    }
                                } else {
                                    GlobalFree(hMem);
                                }
                            }
                            CloseClipboard();
                            if (g_app.btnCopySummary) {
                                SetWindowTextW(g_app.btnCopySummary, tr(L"Copied! \x2713", L"\x00A1Copiado! \x2713"));
                                SetTimer(hwnd, AppState::TIMER_COPY_CONFIRM, 1800, nullptr);
                            }
                        }
                    }
                    break;
                }
            }
            return 0;
        }

        case WM_NOTIFY: {
            NMHDR* nmhdr = reinterpret_cast<NMHDR*>(lParam);
            if (nmhdr && nmhdr->idFrom == IDC_LIST_DETAIL && nmhdr->code == NM_CUSTOMDRAW) {
                LPNMLVCUSTOMDRAW lvcd = reinterpret_cast<LPNMLVCUSTOMDRAW>(lParam);
                if (lvcd->nmcd.dwDrawStage == CDDS_PREPAINT) return CDRF_NOTIFYITEMDRAW;
                if (lvcd->nmcd.dwDrawStage == CDDS_ITEMPREPAINT) {
                    lvcd->clrText = RGB(241, 245, 249);
                    lvcd->clrTextBk = (lvcd->nmcd.dwItemSpec % 2 == 0) ? RGB(18, 23, 31) : RGB(23, 29, 39);
                    return CDRF_NOTIFYSUBITEMDRAW;
                }
                if (lvcd->nmcd.dwDrawStage == (CDDS_SUBITEM | CDDS_ITEMPREPAINT)) {
                    if (lvcd->iSubItem == 1) lvcd->clrText = RGB(56, 189, 248);
                    else if (lvcd->iSubItem == 2) lvcd->clrText = RGB(16, 185, 129);
                    else if (lvcd->iSubItem == 3) lvcd->clrText = RGB(245, 158, 11);
                    else if (lvcd->iSubItem == 4) lvcd->clrText = RGB(148, 163, 184);
                    return CDRF_NEWFONT;
                }
            }
            if (nmhdr && nmhdr->idFrom == IDC_LIST_GAMES) {
                if (nmhdr->code == LVN_ITEMCHANGED) {
                    NMLISTVIEW* nmlv = reinterpret_cast<NMLISTVIEW*>(lParam);
                    if ((nmlv->uNewState & LVIS_SELECTED) && !(nmlv->uOldState & LVIS_SELECTED)) {
                        int gameIdx = static_cast<int>(nmlv->lParam);
                        if (gameIdx >= 0 && gameIdx < static_cast<int>(g_app.allGames.size())) {
                            g_app.selectedGameIdx = gameIdx;
                            updateSelectedGameAnalysis();
                            startUiAnimation(true, true);
                            InvalidateRect(hwnd, nullptr, FALSE);
                        }
                    }
                } else if (nmhdr->code == NM_CUSTOMDRAW) {
                    LPNMLVCUSTOMDRAW lvcd = reinterpret_cast<LPNMLVCUSTOMDRAW>(lParam);
                    if (lvcd->nmcd.dwDrawStage == CDDS_PREPAINT) {
                        return CDRF_NOTIFYITEMDRAW;
                    }
                    if (lvcd->nmcd.dwDrawStage == CDDS_ITEMPREPAINT) {
                        int idx = static_cast<int>(lvcd->nmcd.lItemlParam);
                        bool isSel = (ListView_GetItemState(g_app.hwndList, static_cast<int>(lvcd->nmcd.dwItemSpec), LVIS_SELECTED) & LVIS_SELECTED) != 0;
                        if (isSel) {
                            lvcd->clrText = RGB(248, 250, 252);
                            lvcd->clrTextBk = RGB(31, 46, 72);
                        } else if (idx >= 0 && idx < static_cast<int>(g_app.allGames.size())) {
                            const auto& gm = g_app.allGames[idx];
                            lvcd->clrText = RGB(236, 242, 248);
                            if (gm.installed) {
                                lvcd->clrTextBk = (lvcd->nmcd.dwItemSpec % 2 == 0) ? RGB(20, 28, 36) : RGB(24, 33, 43);
                            } else {
                                lvcd->clrTextBk = (lvcd->nmcd.dwItemSpec % 2 == 0) ? RGB(18, 23, 31) : RGB(22, 27, 36);
                            }
                        }
                        return CDRF_NOTIFYSUBITEMDRAW;
                    }
                    if (lvcd->nmcd.dwDrawStage == (CDDS_SUBITEM | CDDS_ITEMPREPAINT)) {
                        int idx = static_cast<int>(lvcd->nmcd.lItemlParam);
                        bool isSel = (ListView_GetItemState(g_app.hwndList, static_cast<int>(lvcd->nmcd.dwItemSpec), LVIS_SELECTED) & LVIS_SELECTED) != 0;
                        if (!isSel && idx >= 0 && idx < static_cast<int>(g_app.allGames.size())) {
                            const auto& gm = g_app.allGames[idx];
                            if (lvcd->iSubItem == 1) {
                                lvcd->clrText = gm.installed ? RGB(52, 211, 153) : RGB(148, 163, 184);
                                return CDRF_NEWFONT;
                            }
                            if (lvcd->iSubItem == 2) {
                                auto ga = GameCheck::analyzeGame(g_app.activeSpecs, gm, g_app.activeOptMode);
                                Color vc = verdictColor(ga.verdictBadge);
                                lvcd->clrText = RGB(vc.GetR(), vc.GetG(), vc.GetB());
                                return CDRF_NEWFONT;
                            }
                        }
                    }
                }
            }
            break;
        }

        case AppState::WM_APP_UPDATE_RESULT: {
            auto* res = reinterpret_cast<GameCheck::UpdateCheckResult*>(lParam);
            if (res) {
                g_app.updateState = *res;
                g_app.updateCheckInProgress = false;
                if (res->applied) {
                    g_app.updatePillText = L"Updated v" + GameCheck::utf8ToWide(res->latestVersion);
                    g_app.updatePillColor = CyberPalette::AcidGreen;
                } else if (res->updateAvailable) {
                    g_app.updatePillText = L"Update v" + GameCheck::utf8ToWide(res->latestVersion);
                    g_app.updatePillColor = CyberPalette::CyberYellow;
                } else {
                    g_app.updatePillText = g_app.isSpanish ? L"Al d\x00EDa" : L"Up to date";
                    g_app.updatePillColor = CyberPalette::AcidGreen;
                }
                if (g_app.hwndUpdatesDlgLabel && IsWindow(g_app.hwndUpdatesDlgLabel)) {
                    SetWindowTextW(g_app.hwndUpdatesDlgLabel, buildUpdatesInfoText().c_str());
                }
                InvalidateRect(hwnd, nullptr, FALSE);
                if (res->applied && res->restartRequired) {
                    std::wstring msg = L"GameCheck is updating to v" + GameCheck::utf8ToWide(res->latestVersion) +
                                       L" in the background. Please relaunch after setup finishes.";
                    MessageBoxW(hwnd, msg.c_str(), L"GameCheck — Auto-Update", MB_OK | MB_ICONINFORMATION);
                }
                delete res;
            }
            return 0;
        }
        case WM_TIMER: {
            if (wParam == AppState::TIMER_COPY_CONFIRM) {
                KillTimer(hwnd, AppState::TIMER_COPY_CONFIRM);
                if (g_app.btnCopySummary) {
                    SetWindowTextW(g_app.btnCopySummary, tr(L"Copy Summary", L"Copiar Resumen"));
                }
                return 0;
            }
            if (wParam == AppState::TIMER_UI_ANIM) {
                bool needCanvasRedraw = false;
                if (g_app.tabAnimT < 1.0f) {
                    g_app.tabAnimT = std::min(1.0f, g_app.tabAnimT + (16.0f / 220.0f));
                    needCanvasRedraw = true;
                }
                if (g_app.barAnimT < 1.0f) {
                    g_app.barAnimT = std::min(1.0f, g_app.barAnimT + (16.0f / 280.0f));
                    needCanvasRedraw = true;
                }
                float indDiff = g_app.tabIndicatorTargetX - g_app.tabIndicatorX;
                if (std::abs(indDiff) >= 0.5f) {
                    g_app.tabIndicatorX += indDiff * 0.28f;
                    if (std::abs(g_app.tabIndicatorTargetX - g_app.tabIndicatorX) < 0.5f) {
                        g_app.tabIndicatorX = g_app.tabIndicatorTargetX;
                    }
                    needCanvasRedraw = true;
                } else if (g_app.tabIndicatorX != g_app.tabIndicatorTargetX) {
                    g_app.tabIndicatorX = g_app.tabIndicatorTargetX;
                    needCanvasRedraw = true;
                }

                bool anyHoverActive = false;
                for (auto it = g_app.btnHoverTarget.begin(); it != g_app.btnHoverTarget.end(); ) {
                    HWND btn = it->first;
                    if (!IsWindow(btn)) {
                        g_app.btnHoverCurrent.erase(btn);
                        g_app.btnHoverTracked.erase(btn);
                        it = g_app.btnHoverTarget.erase(it);
                        continue;
                    }
                    float tgt = it->second;
                    float cur = g_app.btnHoverCurrent[btn];
                    if (std::abs(tgt - cur) > 0.001f) {
                        float step = 0.18f;
                        if (cur < tgt) cur = std::min(tgt, cur + step);
                        else           cur = std::max(tgt, cur - step);
                        if (std::abs(tgt - cur) <= 0.01f) cur = tgt;
                        g_app.btnHoverCurrent[btn] = cur;
                        InvalidateRect(btn, nullptr, FALSE);
                        if (std::abs(tgt - cur) > 0.001f) {
                            anyHoverActive = true;
                        }
                    }
                    ++it;
                }

                if (needCanvasRedraw) {
                    InvalidateRect(hwnd, nullptr, FALSE);
                }

                if (g_app.tabAnimT >= 1.0f &&
                    g_app.barAnimT >= 1.0f &&
                    std::abs(g_app.tabIndicatorX - g_app.tabIndicatorTargetX) < 0.5f &&
                    !anyHoverActive) {
                    KillTimer(hwnd, AppState::TIMER_UI_ANIM);
                    g_app.uiAnimTimerActive = false;
                }
                return 0;
            }
            break;
        }

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            paintDashboard(hwnd, hdc);
            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_CLOSE: {
            saveCurrentPreferences(hwnd);
            DestroyWindow(hwnd);
            return 0;
        }

        case WM_DESTROY: {
            if (g_app.uiAnimTimerActive) {
                KillTimer(hwnd, AppState::TIMER_UI_ANIM);
                g_app.uiAnimTimerActive = false;
            }
            if (g_app.hFontUi) DeleteObject(g_app.hFontUi);
            if (g_app.hFontUiBold) DeleteObject(g_app.hFontUiBold);
            if (g_app.hFontTitle) DeleteObject(g_app.hFontTitle);
            if (g_app.hBrushDarkEdit) DeleteObject(g_app.hBrushDarkEdit);
            if (g_app.hBrushDlgBg) DeleteObject(g_app.hBrushDlgBg);
            if (g_app.hListImg) ImageList_Destroy(g_app.hListImg);
            PostQuitMessage(0);
            return 0;
        }
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static int runWin32DesktopGui() {
    HANDLE hSingleInstanceMutex = CreateMutexW(nullptr, FALSE, L"Local\\GameCheckSingleInstanceMutex");
    if (hSingleInstanceMutex && GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND existing = FindWindowW(L"GameCheckNativeDesktopWnd", nullptr);
        if (existing) {
            if (IsIconic(existing)) {
                ShowWindow(existing, SW_RESTORE);
            } else {
                ShowWindow(existing, SW_SHOW);
            }
            SetForegroundWindow(existing);
        }
        CloseHandle(hSingleInstanceMutex);
        return 0;
    }

    SetProcessDPIAware();

    INITCOMMONCONTROLSEX icex = {};
    icex.dwSize = sizeof(icex);
    icex.dwICC = ICC_LISTVIEW_CLASSES | ICC_STANDARD_CLASSES | ICC_BAR_CLASSES;
    InitCommonControlsEx(&icex);

    GdiplusStartupInput gdiplusStartupInput;
    ULONG_PTR gdiplusToken = 0;
    GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, nullptr);

    GameCheck::UserPreferences prefs = GameCheck::loadUserPreferences();
    g_app.isSpanish = prefs.isSpanish;
    g_app.activeOptMode = prefs.activeOptMode;
    g_app.detailedQuickView = prefs.detailedQuickView;
    g_app.activeCountry = prefs.activeCountry;

    g_app.detectedSpecs = GameCheck::detectSystemSpecs();
    g_app.activeSpecs = g_app.detectedSpecs;
    g_app.allGames = GameCheck::getMergedGameList();
    if (!g_app.allGames.empty()) {
        g_app.currentAnalysis = GameCheck::analyzeGame(g_app.activeSpecs, g_app.allGames[0], g_app.activeOptMode);
    }

    HINSTANCE hInst = GetModuleHandleW(nullptr);
    HICON hCustomIcon = static_cast<HICON>(LoadImageW(hInst, MAKEINTRESOURCEW(101), IMAGE_ICON, 0, 0, LR_DEFAULTSIZE | LR_SHARED));
    if (!hCustomIcon) hCustomIcon = LoadIconW(hInst, MAKEINTRESOURCEW(101));
    if (!hCustomIcon) hCustomIcon = LoadIconW(nullptr, reinterpret_cast<LPCWSTR>(IDI_APPLICATION));
    HICON hCustomIconSm = static_cast<HICON>(LoadImageW(hInst, MAKEINTRESOURCEW(101), IMAGE_ICON,
                                                        GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_SHARED));
    if (!hCustomIconSm) hCustomIconSm = hCustomIcon;

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = MainWndProc;
    wc.hInstance = hInst;
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.hIcon = hCustomIcon;
    wc.hIconSm = hCustomIconSm;
    wc.hbrBackground = nullptr;
    wc.lpszClassName = L"GameCheckNativeDesktopWnd";
    RegisterClassExW(&wc);

    std::wstring winTitle = L"GameCheck \x2014 PC Game & Hardware Advisor (v" +
                            GameCheck::utf8ToWide(GameCheck::FULL_VERSION) + L")";

    int winW = (prefs.windowW >= 1040 && prefs.windowW <= 3840) ? prefs.windowW : 1320;
    int winH = (prefs.windowH >= 640 && prefs.windowH <= 2160) ? prefs.windowH : 820;
    int winX = CW_USEDEFAULT;
    int winY = CW_USEDEFAULT;
    if (prefs.windowX != -1 && prefs.windowY != -1) {
        RECT desired = { prefs.windowX, prefs.windowY, prefs.windowX + winW, prefs.windowY + winH };
        if (MonitorFromRect(&desired, MONITOR_DEFAULTTONULL) != nullptr) {
            winX = prefs.windowX;
            winY = prefs.windowY;
        }
    }

    HWND hwnd = CreateWindowExW(
        0,
        wc.lpszClassName,
        winTitle.c_str(),
        WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
        winX, winY, winW, winH,
        nullptr, nullptr, wc.hInstance, nullptr
    );

    g_app.hwndMain = hwnd;
    rebuildGameImageList();
    populateGameListView();
    updateDetailButtonText();
    updateTabVisibility();
    if (g_app.detailedQuickView) {
        populateDetailListView();
    }
    if (g_app.isSpanish) {
        applyLanguageToUi();
    }

    ShowWindow(hwnd, SW_SHOWNORMAL);
    UpdateWindow(hwnd);
    startAsyncUpdateCheck(hwnd, true);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    GdiplusShutdown(gdiplusToken);
    if (hSingleInstanceMutex) CloseHandle(hSingleInstanceMutex);
    return static_cast<int>(msg.wParam);
}

#elif defined(__linux__) && defined(GAMECHECK_USE_GTK)

#include <gtk/gtk.h>

struct LinuxGtkApp {
    GameCheck::SystemSpecs specs;
    std::vector<GameCheck::GameSpec> allGames;
    std::vector<size_t> filteredIndices;
    size_t selectedGameIdx = 0;
    int activeOptMode = GameCheck::OPT_MODE_OPTIMAL;
    bool isSpanish = false;

    GtkWidget* window = nullptr;
    GtkWidget* lblHwBar = nullptr;
    GtkWidget* searchEntry = nullptr;
    GtkWidget* treeView = nullptr;
    GtkListStore* listStore = nullptr;
    GtkWidget* modeButtons[4] = { nullptr, nullptr, nullptr, nullptr };
    GtkWidget* btnLang = nullptr;
    GtkTextView* detailsView = nullptr;
};

static LinuxGtkApp g_gtkApp;

static void saveLinuxGtkPrefs() {
    GameCheck::UserPreferences prefs = GameCheck::loadUserPreferences();
    prefs.isSpanish = g_gtkApp.isSpanish;
    prefs.activeOptMode = g_gtkApp.activeOptMode;
    if (g_gtkApp.window && GTK_IS_WIDGET(g_gtkApp.window)) {
        int w = 1280, h = 800, x = -1, y = -1;
        gtk_window_get_size(GTK_WINDOW(g_gtkApp.window), &w, &h);
        gtk_window_get_position(GTK_WINDOW(g_gtkApp.window), &x, &y);
        prefs.windowW = w;
        prefs.windowH = h;
        prefs.windowX = x;
        prefs.windowY = y;
    }
    GameCheck::saveUserPreferences(prefs);
}

static void refreshLinuxDetailsPane() {
    if (!g_gtkApp.detailsView || g_gtkApp.allGames.empty()) return;
    if (g_gtkApp.selectedGameIdx >= g_gtkApp.allGames.size()) g_gtkApp.selectedGameIdx = 0;

    const auto& game = g_gtkApp.allGames[g_gtkApp.selectedGameIdx];
    auto ga = GameCheck::analyzeGame(g_gtkApp.specs, game, g_gtkApp.activeOptMode);
    auto drv = GameCheck::getDriverAppRecommendations(g_gtkApp.specs, game, g_gtkApp.activeOptMode);

    std::ostringstream oss;
    oss << game.title << " (" << game.genre << " | " << game.engine << ")\n";
    oss << (g_gtkApp.isSpanish ? "Estado: " : "Status: ") << ga.verdictBadge
        << "  |  " << (g_gtkApp.isSpanish ? "FPS Est. Pantalla: " : "Est. Screen FPS: ")
        << ga.estimatedScreenFps.avg << " FPS (min " << ga.estimatedScreenFps.low
        << " / max " << ga.estimatedScreenFps.high << ")\n";
    oss << (g_gtkApp.isSpanish ? "Modo: " : "Mode: ") << ga.modeLabel
        << "  |  " << ga.syncAdvice << "\n";
    oss << "------------------------------------------------------------\n";
    oss << (g_gtkApp.isSpanish ? "AJUSTES RECOMENDADOS EN JUEGO:\n" : "RECOMMENDED IN-GAME SETTINGS:\n");
    for (const auto& s : ga.settingImpacts) {
        oss << "  • " << s.setting << ": " << s.recommendedValue
            << "  (+" << s.fpsGainPercent << "% FPS, VRAM: ~" << s.vramImpactMB << " MB)\n";
    }
    oss << "\n------------------------------------------------------------\n";
    oss << (g_gtkApp.isSpanish ? "ESCALADO Y RESOLUCIÓN INTERNA:\n" : "UPSCALING & RESOLUTION MATH:\n");
    for (const auto& t : GameCheck::computeUpscalingMatrix(g_gtkApp.specs, game, g_gtkApp.activeOptMode)) {
        oss << "  • " << t.tierName << "  " << t.renderLabel
            << "  (~" << t.estimatedFpsAvg << " FPS"
            << (t.vramSavedMB > 0 ? (", -" + std::to_string(t.vramSavedMB) + " MB VRAM") : "")
            << ")  " << t.recommendation << "\n";
    }
    oss << "\n------------------------------------------------------------\n";
    oss << (g_gtkApp.isSpanish ? "CONFIGURACIÓN DE DRIVER GPU (" : "GPU DRIVER APP SETTINGS (") << drv.suiteName << "):\n";
    for (const auto& ds : drv.settings) {
        oss << "  • " << ds.setting << ": " << ds.recommendedValue << "\n"
            << "    " << ds.reason << "\n";
    }

    GtkTextBuffer* buf = gtk_text_view_get_buffer(g_gtkApp.detailsView);
    std::string text = oss.str();
    gtk_text_buffer_set_text(buf, text.c_str(), static_cast<gint>(text.size()));

    for (int i = 0; i < 4; ++i) {
        if (!g_gtkApp.modeButtons[i]) continue;
        GtkStyleContext* ctx = gtk_widget_get_style_context(g_gtkApp.modeButtons[i]);
        if (i == g_gtkApp.activeOptMode) {
            gtk_style_context_add_class(ctx, "gc-mode-active");
        } else {
            gtk_style_context_remove_class(ctx, "gc-mode-active");
        }
    }
}

static void populateLinuxGameList() {
    if (!g_gtkApp.listStore) return;
    gtk_list_store_clear(g_gtkApp.listStore);
    g_gtkApp.filteredIndices.clear();

    const char* qRaw = g_gtkApp.searchEntry ? gtk_entry_get_text(GTK_ENTRY(g_gtkApp.searchEntry)) : "";
    std::string q = qRaw ? GameCheck::trim(qRaw) : "";

    for (size_t i = 0; i < g_gtkApp.allGames.size(); ++i) {
        const auto& gm = g_gtkApp.allGames[i];
        if (!q.empty() && !GameCheck::containsIgnoreCase(gm.title, q) &&
            !GameCheck::containsIgnoreCase(gm.genre, q) && !GameCheck::containsIgnoreCase(gm.engine, q)) {
            continue;
        }
        auto ga = GameCheck::analyzeGame(g_gtkApp.specs, gm, g_gtkApp.activeOptMode);
        std::string fpsStr = std::to_string(ga.estimatedScreenFps.avg) + " FPS";
        std::string titleStr = gm.installed ? ("[Installed] " + gm.title) : gm.title;

        GtkTreeIter iter;
        gtk_list_store_append(g_gtkApp.listStore, &iter);
        gtk_list_store_set(g_gtkApp.listStore, &iter,
                           0, titleStr.c_str(),
                           1, ga.verdictBadge.c_str(),
                           2, fpsStr.c_str(),
                           3, static_cast<guint>(i),
                           -1);
        g_gtkApp.filteredIndices.push_back(i);
    }
    if (!g_gtkApp.filteredIndices.empty()) {
        g_gtkApp.selectedGameIdx = g_gtkApp.filteredIndices[0];
        GtkTreePath* firstPath = gtk_tree_path_new_first();
        gtk_tree_view_set_cursor(GTK_TREE_VIEW(g_gtkApp.treeView), firstPath, nullptr, FALSE);
        gtk_tree_path_free(firstPath);
    }
    refreshLinuxDetailsPane();
}

static void onLinuxSearchChanged(GtkSearchEntry*, gpointer) {
    populateLinuxGameList();
}

static void onLinuxSelectionChanged(GtkTreeSelection* selection, gpointer) {
    GtkTreeModel* model = nullptr;
    GtkTreeIter iter;
    if (gtk_tree_selection_get_selected(selection, &model, &iter)) {
        guint idx = 0;
        gtk_tree_model_get(model, &iter, 3, &idx, -1);
        g_gtkApp.selectedGameIdx = static_cast<size_t>(idx);
        refreshLinuxDetailsPane();
    }
}

static void onLinuxModeClicked(GtkButton*, gpointer userData) {
    int mode = static_cast<int>(reinterpret_cast<intptr_t>(userData));
    g_gtkApp.activeOptMode = mode;
    saveLinuxGtkPrefs();
    populateLinuxGameList();
}

static void onLinuxLangToggle(GtkButton*, gpointer) {
    g_gtkApp.isSpanish = !g_gtkApp.isSpanish;
    if (g_gtkApp.btnLang) {
        gtk_button_set_label(GTK_BUTTON(g_gtkApp.btnLang), g_gtkApp.isSpanish ? "ES | Español" : "EN | English");
    }
    saveLinuxGtkPrefs();
    refreshLinuxDetailsPane();
}

static void onLinuxExportClicked(GtkButton*, gpointer userData) {
    if (g_gtkApp.allGames.empty()) return;
    const char* ext = static_cast<const char*>(userData);
    const auto& game = g_gtkApp.allGames[g_gtkApp.selectedGameIdx];
    auto ga = GameCheck::analyzeGame(g_gtkApp.specs, game, g_gtkApp.activeOptMode);

    std::string content;
    std::string defaultName = "GameCheck-Config." + std::string(ext);
    if (std::string(ext) == "ini") content = GameCheck::exportConfigIni(g_gtkApp.specs, game, ga);
    else if (std::string(ext) == "json") content = GameCheck::exportConfigJson(g_gtkApp.specs, game, ga);
    else content = GameCheck::exportConfigMd(g_gtkApp.specs, game, ga);

    GtkWidget* dlg = gtk_file_chooser_dialog_new(
        g_gtkApp.isSpanish ? "Guardar Configuración" : "Save Configuration",
        GTK_WINDOW(g_gtkApp.window),
        GTK_FILE_CHOOSER_ACTION_SAVE,
        "_Cancel", GTK_RESPONSE_CANCEL,
        "_Save", GTK_RESPONSE_ACCEPT,
        nullptr
    );
    gtk_file_chooser_set_do_overwrite_confirmation(GTK_FILE_CHOOSER(dlg), TRUE);
    gtk_file_chooser_set_current_name(GTK_FILE_CHOOSER(dlg), defaultName.c_str());

    if (gtk_dialog_run(GTK_DIALOG(dlg)) == GTK_RESPONSE_ACCEPT) {
        char* filename = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dlg));
        if (filename) {
            std::ofstream ofs(filename, std::ios::binary | std::ios::trunc);
            if (ofs) ofs.write(content.data(), static_cast<std::streamsize>(content.size()));
            g_free(filename);
        }
    }
    gtk_widget_destroy(dlg);
}

static void onLinuxCopySummaryClicked(GtkButton* btn, gpointer) {
    if (g_gtkApp.allGames.empty()) return;
    const auto& game = g_gtkApp.allGames[g_gtkApp.selectedGameIdx];
    auto ga = GameCheck::analyzeGame(g_gtkApp.specs, game, g_gtkApp.activeOptMode);
    std::string summary = GameCheck::buildShareableSummaryText(g_gtkApp.specs, game, ga, g_gtkApp.isSpanish);
    GtkClipboard* cb = gtk_clipboard_get(GDK_SELECTION_CLIPBOARD);
    if (cb) {
        gtk_clipboard_set_text(cb, summary.c_str(), static_cast<gint>(summary.size()));
    }
    gtk_button_set_label(btn, g_gtkApp.isSpanish ? "¡Copiado! ✓" : "Copied! ✓");
}

static gboolean onLinuxWindowDelete(GtkWidget*, GdkEvent*, gpointer) {
    saveLinuxGtkPrefs();
    return FALSE;
}

static int runLinuxGtkDesktopGui(int argc, char* argv[]) {
    gtk_init(&argc, &argv);

    GameCheck::UserPreferences prefs = GameCheck::loadUserPreferences();
    g_gtkApp.isSpanish = prefs.isSpanish;
    g_gtkApp.activeOptMode = prefs.activeOptMode;
    g_gtkApp.specs = GameCheck::detectSystemSpecs();
    g_gtkApp.allGames = GameCheck::getMergedGameList();

    GtkCssProvider* css = gtk_css_provider_new();
    gtk_css_provider_load_from_data(css,
        "window, .background { background-color: #06060A; color: #E8ECF4; }\n"
        "headerbar, .gc-bar { background-color: #0D0F18; border-bottom: 1px solid #1E2436; padding: 8px; }\n"
        "entry, textview, textview text, treeview { background-color: #0B0D14; color: #E8ECF4; }\n"
        "treeview:selected { background-color: #163042; color: #00F0FF; }\n"
        "button { background-color: #141824; color: #E8ECF4; border: 1px solid #2A324B; border-radius: 4px; padding: 6px 10px; }\n"
        "button:hover { border-color: #00F0FF; }\n"
        "button.gc-mode-active { background-color: #242108; color: #FCEE09; border-color: #FCEE09; font-weight: bold; }\n",
        -1, nullptr);
    gtk_style_context_add_provider_for_screen(gdk_screen_get_default(), GTK_STYLE_PROVIDER(css), GTK_STYLE_PROVIDER_PRIORITY_APPLICATION);
    g_object_unref(css);

    g_gtkApp.window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    std::string title = std::string("GameCheck \xE2\x80\x94 PC Game & Hardware Advisor (v") + GameCheck::FULL_VERSION + ")";
    gtk_window_set_title(GTK_WINDOW(g_gtkApp.window), title.c_str());
    int winW = (prefs.windowW >= 900 && prefs.windowW <= 3840) ? prefs.windowW : 1280;
    int winH = (prefs.windowH >= 600 && prefs.windowH <= 2160) ? prefs.windowH : 800;
    gtk_window_set_default_size(GTK_WINDOW(g_gtkApp.window), winW, winH);
    if (prefs.windowX >= 0 && prefs.windowY >= 0) {
        gtk_window_move(GTK_WINDOW(g_gtkApp.window), prefs.windowX, prefs.windowY);
    }
    g_signal_connect(g_gtkApp.window, "delete-event", G_CALLBACK(onLinuxWindowDelete), nullptr);
    g_signal_connect(g_gtkApp.window, "destroy", G_CALLBACK(gtk_main_quit), nullptr);

    GtkWidget* rootBox = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    gtk_container_set_border_width(GTK_CONTAINER(rootBox), 10);
    gtk_container_add(GTK_CONTAINER(g_gtkApp.window), rootBox);

    // Top Hardware Summary Bar
    GtkWidget* topBar = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 10);
    gtk_style_context_add_class(gtk_widget_get_style_context(topBar), "gc-bar");
    std::ostringstream hwSs;
    hwSs << "CPU: " << g_gtkApp.specs.cpu.name
         << "  |  GPU: " << g_gtkApp.specs.gpu.name << " (" << g_gtkApp.specs.gpu.vramGB << " GB)"
         << "  |  RAM: " << g_gtkApp.specs.ram.totalGB << " GB"
         << "  |  Display: " << g_gtkApp.specs.display.width << "x" << g_gtkApp.specs.display.height
         << " @ " << g_gtkApp.specs.display.refreshRateHz << "Hz";
    g_gtkApp.lblHwBar = gtk_label_new(hwSs.str().c_str());
    gtk_label_set_ellipsize(GTK_LABEL(g_gtkApp.lblHwBar), PANGO_ELLIPSIZE_END);
    gtk_box_pack_start(GTK_BOX(topBar), g_gtkApp.lblHwBar, TRUE, TRUE, 0);

    g_gtkApp.btnLang = gtk_button_new_with_label(g_gtkApp.isSpanish ? "ES | Español" : "EN | English");
    g_signal_connect(g_gtkApp.btnLang, "clicked", G_CALLBACK(onLinuxLangToggle), nullptr);
    gtk_box_pack_end(GTK_BOX(topBar), g_gtkApp.btnLang, FALSE, FALSE, 0);
    gtk_box_pack_start(GTK_BOX(rootBox), topBar, FALSE, FALSE, 0);

    // Main Split Panes
    GtkWidget* paned = gtk_paned_new(GTK_ORIENTATION_HORIZONTAL);
    gtk_paned_set_position(GTK_PANED(paned), 460);
    gtk_box_pack_start(GTK_BOX(rootBox), paned, TRUE, TRUE, 0);

    // Left Pane: Search + TreeView
    GtkWidget* leftBox = gtk_box_new(GTK_ORIENTATION_VERTICAL, 6);
    g_gtkApp.searchEntry = gtk_search_entry_new();
    gtk_entry_set_placeholder_text(GTK_ENTRY(g_gtkApp.searchEntry), "Search 50+ games, genres, engines...");
    g_signal_connect(g_gtkApp.searchEntry, "search-changed", G_CALLBACK(onLinuxSearchChanged), nullptr);
    gtk_box_pack_start(GTK_BOX(leftBox), g_gtkApp.searchEntry, FALSE, FALSE, 0);

    g_gtkApp.listStore = gtk_list_store_new(4, G_TYPE_STRING, G_TYPE_STRING, G_TYPE_STRING, G_TYPE_UINT);
    g_gtkApp.treeView = gtk_tree_view_new_with_model(GTK_TREE_MODEL(g_gtkApp.listStore));
    auto addCol = [&](const char* titleStr, int colId, int minW) {
        GtkCellRenderer* renderer = gtk_cell_renderer_text_new();
        GtkTreeViewColumn* col = gtk_tree_view_column_new_with_attributes(titleStr, renderer, "text", colId, nullptr);
        gtk_tree_view_column_set_resizable(col, TRUE);
        gtk_tree_view_column_set_min_width(col, minW);
        gtk_tree_view_append_column(GTK_TREE_VIEW(g_gtkApp.treeView), col);
    };
    addCol("Game", 0, 220);
    addCol("Status", 1, 110);
    addCol("Est. FPS", 2, 80);

    GtkTreeSelection* sel = gtk_tree_view_get_selection(GTK_TREE_VIEW(g_gtkApp.treeView));
    gtk_tree_selection_set_mode(sel, GTK_SELECTION_SINGLE);
    g_signal_connect(sel, "changed", G_CALLBACK(onLinuxSelectionChanged), nullptr);

    GtkWidget* leftScroll = gtk_scrolled_window_new(nullptr, nullptr);
    gtk_container_add(GTK_CONTAINER(leftScroll), g_gtkApp.treeView);
    gtk_box_pack_start(GTK_BOX(leftBox), leftScroll, TRUE, TRUE, 0);
    gtk_paned_pack1(GTK_PANED(paned), leftBox, TRUE, FALSE);

    // Right Pane: Mode Buttons + Details TextView + Export Buttons
    GtkWidget* rightBox = gtk_box_new(GTK_ORIENTATION_VERTICAL, 8);
    GtkWidget* modeBox = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 6);
    const char* modeLabels[4] = { "Optimal", "Max FPS", "Balanced", "Quality 30-60" };
    for (int i = 0; i < 4; ++i) {
        g_gtkApp.modeButtons[i] = gtk_button_new_with_label(modeLabels[i]);
        g_signal_connect(g_gtkApp.modeButtons[i], "clicked", G_CALLBACK(onLinuxModeClicked), reinterpret_cast<gpointer>(static_cast<intptr_t>(i)));
        gtk_box_pack_start(GTK_BOX(modeBox), g_gtkApp.modeButtons[i], TRUE, TRUE, 0);
    }
    gtk_box_pack_start(GTK_BOX(rightBox), modeBox, FALSE, FALSE, 0);

    GtkWidget* rightScroll = gtk_scrolled_window_new(nullptr, nullptr);
    GtkWidget* tv = gtk_text_view_new();
    g_gtkApp.detailsView = GTK_TEXT_VIEW(tv);
    gtk_text_view_set_editable(g_gtkApp.detailsView, FALSE);
    gtk_text_view_set_wrap_mode(g_gtkApp.detailsView, GTK_WRAP_WORD_CHAR);
    gtk_text_view_set_left_margin(g_gtkApp.detailsView, 8);
    gtk_text_view_set_top_margin(g_gtkApp.detailsView, 8);
    gtk_container_add(GTK_CONTAINER(rightScroll), tv);
    gtk_box_pack_start(GTK_BOX(rightBox), rightScroll, TRUE, TRUE, 0);

    GtkWidget* exportBox = gtk_box_new(GTK_ORIENTATION_HORIZONTAL, 8);
    GtkWidget* btnIni = gtk_button_new_with_label("Save .INI");
    GtkWidget* btnJson = gtk_button_new_with_label("Save .JSON");
    GtkWidget* btnMd = gtk_button_new_with_label("Save Guide (.MD)");
    GtkWidget* btnCopySummary = gtk_button_new_with_label("Copy Summary");
    g_signal_connect(btnIni, "clicked", G_CALLBACK(onLinuxExportClicked), const_cast<char*>("ini"));
    g_signal_connect(btnJson, "clicked", G_CALLBACK(onLinuxExportClicked), const_cast<char*>("json"));
    g_signal_connect(btnMd, "clicked", G_CALLBACK(onLinuxExportClicked), const_cast<char*>("md"));
    g_signal_connect(btnCopySummary, "clicked", G_CALLBACK(onLinuxCopySummaryClicked), nullptr);
    gtk_box_pack_start(GTK_BOX(exportBox), btnIni, FALSE, FALSE, 0);
    gtk_box_pack_start(GTK_BOX(exportBox), btnJson, FALSE, FALSE, 0);
    gtk_box_pack_start(GTK_BOX(exportBox), btnMd, FALSE, FALSE, 0);
    gtk_box_pack_start(GTK_BOX(exportBox), btnCopySummary, FALSE, FALSE, 0);
    gtk_box_pack_start(GTK_BOX(rightBox), exportBox, FALSE, FALSE, 0);

    gtk_paned_pack2(GTK_PANED(paned), rightBox, TRUE, FALSE);

    populateLinuxGameList();
    gtk_widget_show_all(g_gtkApp.window);
    gtk_main();
    return 0;
}

#endif // _WIN32 / __linux__

int main(int argc, char* argv[]) {
    bool smokeTest = false;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--smoke-test" || arg == "--json") {
            smokeTest = true;
        } else if (arg == "--version" || arg == "-v") {
            std::cout << GameCheck::APP_NAME << " v" << GameCheck::FULL_VERSION << " (" << GameCheck::ARCHITECTURE << ")" << std::endl;
            return 0;
        }
    }

    if (smokeTest) {
        GameCheck::SystemSpecs specs = GameCheck::detectSystemSpecs();
        std::vector<GameCheck::GameSpec> merged = GameCheck::getMergedGameList();
        if (!merged.empty()) {
            (void)GameCheck::analyzeGame(specs, merged.front(), GameCheck::OPT_MODE_OPTIMAL);
        }
        std::cout << GameCheck::buildSmokeTestJson(specs, merged) << std::endl;
        return 0;
    }

#ifdef _WIN32
    return runWin32DesktopGui();
#elif defined(__linux__) && defined(GAMECHECK_USE_GTK)
    return runLinuxGtkDesktopGui(argc, argv);
#else
    GameCheck::SystemSpecs specs = GameCheck::detectSystemSpecs();
    std::vector<GameCheck::GameSpec> merged = GameCheck::getMergedGameList();
    std::cout << GameCheck::buildSmokeTestJson(specs, merged) << std::endl;
    return 0;
#endif
}
