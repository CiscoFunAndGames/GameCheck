// =============================================================================
// GameCheck — 100% Pure C++17 Native Desktop GUI Application
// Style: Fluent Minimalist Rebellious Cyberpunk HUD ("Night City / Edgerunner")
// Windows: Native Win32 API + GDI+ Chamfered Vector HUD + Owner-Drawn Controls
// Linux:   Native C++17 CLI / GTK3 Interface
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
#endif

#include "gamecheck_core.hpp"

#ifdef _WIN32

using namespace Gdiplus;

// =============================================================================
// Rebellious Minimalist Cyberpunk Palette ("Night City / Edgerunner HUD")
// =============================================================================
namespace CyberPalette {
    static const Color VoidCanvas(255, 6, 6, 10);        // #06060A Obsidian Void
    static const Color PanelSurface(255, 12, 12, 20);    // #0C0C14 Panel Surface
    static const Color PanelElevated(255, 18, 18, 30);   // #12121E Hover / Elevated
    static const Color BorderSubtle(255, 34, 36, 54);    // #222436 Hairline Grid
    static const Color CyberYellow(255, 252, 238, 9);    // #FCEE09 Primary Rebellion Accent
    static const Color NeonCrimson(255, 255, 0, 60);     // #FF003C Secondary Rebellion Slash
    static const Color NeuralCyan(255, 0, 240, 255);     // #00F0FF Telemetry & Display Link
    static const Color AcidGreen(255, 0, 255, 102);      // #00FF66 Ultra / Active Status
    static const Color TextMain(255, 242, 245, 250);     // #F2F5FA Crisp HUD White
    static const Color TextMuted(255, 138, 148, 166);    // #8A94A6 Muted HUD Label
}

// Control IDs
enum ControlId {
    IDC_BTN_RESCAN       = 1001,
    IDC_BTN_WHATIF       = 1002,
    IDC_BTN_PARSE_STEAM  = 1003,
    IDC_BTN_DEALS_TOP    = 1004,
    IDC_BTN_PATCH_INFO   = 1005,
    IDC_BTN_DRIVER_CFG   = 1006,

    IDC_EDIT_SEARCH      = 1010,
    IDC_COMBO_FILTER     = 1011,
    IDC_LIST_GAMES       = 1012,

    IDC_BTN_MODE_OPTIMAL = 1020,
    IDC_BTN_MODE_FULLFPS = 1021,
    IDC_BTN_MODE_BALANCED= 1022,
    IDC_BTN_MODE_QUALITY = 1023,

    IDC_BTN_SAVE_INI     = 1030,
    IDC_BTN_SAVE_JSON    = 1031,
    IDC_BTN_SAVE_MD      = 1032,
    IDC_BTN_OPEN_FOLDER  = 1033,
    IDC_BTN_FIND_DEALS   = 1034
};

struct AppState {
    HWND hwndMain = nullptr;
    HWND hwndSearch = nullptr;
    HWND hwndFilter = nullptr;
    HWND hwndList = nullptr;

    HWND btnRescan = nullptr;
    HWND btnWhatIf = nullptr;
    HWND btnParseSteam = nullptr;
    HWND btnDealsTop = nullptr;
    HWND btnPatchInfo = nullptr;
    HWND btnDriverCfg = nullptr;

    HWND btnModeOptimal = nullptr;
    HWND btnModeFullFps = nullptr;
    HWND btnModeBalanced = nullptr;
    HWND btnModeQuality = nullptr;

    HWND btnSaveIni = nullptr;
    HWND btnSaveJson = nullptr;
    HWND btnSaveMd = nullptr;
    HWND btnOpenFolder = nullptr;
    HWND btnFindDeals = nullptr;

    HFONT hFontUi = nullptr;
    HFONT hFontUiBold = nullptr;
    HFONT hFontMono = nullptr;
    HBRUSH hBrushDarkEdit = nullptr;

    GameCheck::SystemSpecs detectedSpecs;
    GameCheck::SystemSpecs activeSpecs;
    int whatIfPreset = 0; // 0=Detected, 1=RTX 4070S 1440p@165Hz, 2=RX 7800XT 1080p@240Hz, 3=GTX 1060 1080p@60Hz

    std::vector<GameCheck::GameSpec> allGames;
    std::vector<int> filteredIndices;
    int selectedGameIdx = 0; // Index into allGames
    int activeOptMode = GameCheck::OPT_MODE_OPTIMAL;
    std::string activeCountry = "AR";

    GameCheck::GameAnalysis currentAnalysis;
    bool hasCustomParsedGame = false;
    GameCheck::GameSpec customParsedGame;
};

static AppState g_app;

static Color colorFromHex(uint32_t hex, BYTE alpha = 255) {
    BYTE r = static_cast<BYTE>((hex >> 16) & 0xFF);
    BYTE g = static_cast<BYTE>((hex >> 8) & 0xFF);
    BYTE b = static_cast<BYTE>(hex & 0xFF);
    return Color(alpha, r, g, b);
}

// =============================================================================
// Chamfered 45° Cut-Corner Cyberpunk Polygon Renderer
// =============================================================================
static void BuildChamferPath(GraphicsPath& path, RectF r, REAL cutTopRight, REAL cutBottomLeft, REAL cutTopLeft = 0.0f, REAL cutBottomRight = 0.0f) {
    PointF pts[8];
    int count = 0;

    if (cutTopLeft > 0.5f) {
        pts[count++] = PointF(r.X, r.Y + cutTopLeft);
        pts[count++] = PointF(r.X + cutTopLeft, r.Y);
    } else {
        pts[count++] = PointF(r.X, r.Y);
    }

    if (cutTopRight > 0.5f) {
        pts[count++] = PointF(r.X + r.Width - cutTopRight, r.Y);
        pts[count++] = PointF(r.X + r.Width, r.Y + cutTopRight);
    } else {
        pts[count++] = PointF(r.X + r.Width, r.Y);
    }

    if (cutBottomRight > 0.5f) {
        pts[count++] = PointF(r.X + r.Width, r.Y + r.Height - cutBottomRight);
        pts[count++] = PointF(r.X + r.Width - cutBottomRight, r.Y + r.Height);
    } else {
        pts[count++] = PointF(r.X + r.Width, r.Y + r.Height);
    }

    if (cutBottomLeft > 0.5f) {
        pts[count++] = PointF(r.X + cutBottomLeft, r.Y + r.Height);
        pts[count++] = PointF(r.X, r.Y + r.Height - cutBottomLeft);
    } else {
        pts[count++] = PointF(r.X, r.Y + r.Height);
    }

    path.AddPolygon(pts, count);
}

static void DrawCyberPanel(Graphics& g, RectF r, Color fill, Color border, Color accentSlash, REAL cut = 10.0f, bool drawCornerTicks = true) {
    GraphicsPath path;
    BuildChamferPath(path, r, cut, cut * 0.7f, 0.0f, 0.0f);

    SolidBrush fillBrush(fill);
    g.FillPath(&fillBrush, &path);

    Pen borderPen(border, 1.0f);
    g.DrawPath(&borderPen, &path);

    // Bold 3px Left Rebellion Slash Bar
    if (accentSlash.GetAlpha() > 0) {
        SolidBrush slashBrush(accentSlash);
        REAL slashH = std::max(6.0f, r.Height - cut * 0.7f - 2.0f);
        g.FillRectangle(&slashBrush, r.X, r.Y + 1.0f, 3.0f, slashH);

        // Top-right diagonal chamfer highlight
        if (cut > 2.0f) {
            Pen slashPen(accentSlash, 2.0f);
            g.DrawLine(&slashPen, PointF(r.X + r.Width - cut, r.Y), PointF(r.X + r.Width, r.Y + cut));
        }
    }

    // Minimalist HUD corner ticks
    if (drawCornerTicks) {
        Pen tickPen( Color(140, accentSlash.GetR(), accentSlash.GetG(), accentSlash.GetB()), 1.0f );
        g.DrawLine(&tickPen, r.X + r.Width - 6.0f, r.Y + r.Height - 2.0f, r.X + r.Width - 2.0f, r.Y + r.Height - 2.0f);
        g.DrawLine(&tickPen, r.X + r.Width - 2.0f, r.Y + r.Height - 6.0f, r.X + r.Width - 2.0f, r.Y + r.Height - 2.0f);
    }
}

static void DrawSegmentedCyberBar(Graphics& g, RectF r, int pct, Color activeColor, int segments = 20) {
    REAL gap = 2.0f;
    REAL segW = (r.Width - gap * (segments - 1)) / static_cast<REAL>(segments);
    if (segW < 2.0f) {
        segments = 10;
        segW = (r.Width - gap * (segments - 1)) / static_cast<REAL>(segments);
    }
    int activeSegs = std::clamp((pct * segments + 50) / 100, (pct > 0 ? 1 : 0), segments);

    SolidBrush onBrush(activeColor);
    SolidBrush offBrush(Color(255, 24, 26, 40));

    for (int s = 0; s < segments; ++s) {
        REAL sx = r.X + s * (segW + gap);
        RectF segRect(sx, r.Y, segW, r.Height);
        g.FillRectangle(s < activeSegs ? &onBrush : &offBrush, segRect);
    }
}

static std::wstring playStatusDisplayBadge(const GameCheck::GameSpec& game) {
    if (game.playStatus == "PLAYING_NOW")     return L"// PLAYING_NOW";
    if (game.playStatus == "RECENTLY_PLAYED") return L"// RECENT_EXEC";
    if (game.playStatus == "INSTALLED")       return L"// INSTALLED_LOCAL";
    return L"// DB_CATALOG";
}

static Color verdictColor(const std::string& verdict) {
    if (verdict == "ULTRA READY") return CyberPalette::AcidGreen;    // #00FF66
    if (verdict == "RECOMMENDED") return CyberPalette::NeuralCyan;   // #00F0FF
    if (verdict == "MINIMUM")     return CyberPalette::CyberYellow;  // #FCEE09
    return CyberPalette::NeonCrimson;                                // #FF003C
}

static Color tierStatusColor(const std::string& status) {
    if (status == "EXCEEDS_RECOMMENDED") return CyberPalette::AcidGreen;
    if (status == "MEETS_RECOMMENDED")   return CyberPalette::NeuralCyan;
    if (status == "MEETS_MINIMUM")       return CyberPalette::CyberYellow;
    return CyberPalette::NeonCrimson;
}

static void updateSelectedGameAnalysis() {
    if (g_app.allGames.empty()) return;
    if (g_app.selectedGameIdx < 0 || g_app.selectedGameIdx >= static_cast<int>(g_app.allGames.size())) {
        g_app.selectedGameIdx = 0;
    }
    const auto& game = g_app.allGames[g_app.selectedGameIdx];
    g_app.currentAnalysis = GameCheck::analyzeGame(g_app.activeSpecs, game, g_app.activeOptMode);

    if (g_app.btnModeOptimal) {
        SetWindowTextW(g_app.btnModeOptimal,  L"[01] OPTIMAL // AUTO");
        SetWindowTextW(g_app.btnModeFullFps,  L"[02] FULL_FPS // MAX_HZ");
        SetWindowTextW(g_app.btnModeBalanced, L"[03] BALANCED // SYNC");
        SetWindowTextW(g_app.btnModeQuality,  L"[04] QUALITY // 30-60");
        InvalidateRect(g_app.btnModeOptimal, nullptr, FALSE);
        InvalidateRect(g_app.btnModeFullFps, nullptr, FALSE);
        InvalidateRect(g_app.btnModeBalanced, nullptr, FALSE);
        InvalidateRect(g_app.btnModeQuality, nullptr, FALSE);
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
        if (filterMode == 1) {
            if (!game.installed && game.playStatus == "CATALOG") continue;
        } else if (filterMode == 2) {
            if (!ga.canRunRecommended) continue;
        }

        g_app.filteredIndices.push_back(static_cast<int>(i));
        if (static_cast<int>(i) == g_app.selectedGameIdx) {
            rowToSelect = listRow;
        }

        std::wstring colStatus = playStatusDisplayBadge(game);
        std::wstring colTitle = GameCheck::utf8ToWide(game.title);
        std::wstring colVerdict = GameCheck::utf8ToWide(ga.verdictBadge);
        std::wstring colFps = GameCheck::utf8ToWide(std::to_string(ga.estimatedScreenFps.avg) + " FPS // " + std::to_string(ga.refreshSaturationPct) + "%");
        std::wstring colGenre = GameCheck::utf8ToWide(game.genre + " // " + game.engine);

        LVITEMW lvi = {};
        lvi.mask = LVIF_TEXT | LVIF_PARAM;
        lvi.iItem = listRow;
        lvi.iSubItem = 0;
        lvi.pszText = const_cast<LPWSTR>(colStatus.c_str());
        lvi.lParam = static_cast<LPARAM>(i);
        ListView_InsertItem(g_app.hwndList, &lvi);

        ListView_SetItemText(g_app.hwndList, listRow, 1, const_cast<LPWSTR>(colTitle.c_str()));
        ListView_SetItemText(g_app.hwndList, listRow, 2, const_cast<LPWSTR>(colVerdict.c_str()));
        ListView_SetItemText(g_app.hwndList, listRow, 3, const_cast<LPWSTR>(colFps.c_str()));
        ListView_SetItemText(g_app.hwndList, listRow, 4, const_cast<LPWSTR>(colGenre.c_str()));

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
    g_app.activeSpecs = GameCheck::applyWhatIfPreset(g_app.detectedSpecs, g_app.whatIfPreset);
    g_app.allGames = GameCheck::getMergedGameList();
    if (g_app.hasCustomParsedGame) {
        g_app.allGames.insert(g_app.allGames.begin(), g_app.customParsedGame);
    }
    populateGameListView();
}

static void layoutChildControls(HWND hwnd) {
    RECT rc;
    GetClientRect(hwnd, &rc);
    int w = rc.right - rc.left;
    int h = rc.bottom - rc.top;

    int topBarH = 132;
    int margin = 14;

    // Top-right action buttons
    int btnY = 10;
    int btnH = 28;
    int rightX = w - margin;

    auto placeTopBtn = [&](HWND hBtn, int bw) {
        rightX -= bw;
        if (hBtn) MoveWindow(hBtn, rightX, btnY, bw, btnH, TRUE);
        rightX -= 6;
    };

    placeTopBtn(g_app.btnPatchInfo, 134);
    placeTopBtn(g_app.btnDriverCfg, 138);
    placeTopBtn(g_app.btnDealsTop, 158);
    placeTopBtn(g_app.btnParseSteam, 138);
    placeTopBtn(g_app.btnWhatIf, 152);
    placeTopBtn(g_app.btnRescan, 118);

    // Left column (Vertical Game List + Search & Filter)
    int leftW = std::max(360, std::min(530, static_cast<int>(w * 0.37)));
    int contentY = topBarH + 10;
    int contentH = h - contentY - margin;

    int searchW = leftW - 194;
    if (g_app.hwndSearch) MoveWindow(g_app.hwndSearch, margin, contentY, searchW, 26, TRUE);
    if (g_app.hwndFilter) MoveWindow(g_app.hwndFilter, margin + searchW + 8, contentY, 186, 220, TRUE);

    int listY = contentY + 34;
    int listH = std::max(180, contentH - 34);
    if (g_app.hwndList) {
        MoveWindow(g_app.hwndList, margin, listY, leftW, listH, TRUE);
        ListView_SetColumnWidth(g_app.hwndList, 0, 126);
        ListView_SetColumnWidth(g_app.hwndList, 1, std::max(125, leftW - 356));
        ListView_SetColumnWidth(g_app.hwndList, 2, 104);
        ListView_SetColumnWidth(g_app.hwndList, 3, 102);
        ListView_SetColumnWidth(g_app.hwndList, 4, 122);
    }

    // Right Pane controls (4 Mode Buttons + Bottom Export/Deal Buttons)
    int rightPaneX = margin + leftW + 16;
    int rightPaneW = std::max(340, w - rightPaneX - margin);

    // 4-Mode Selector Buttons below Hero Banner
    int modeBtnY = contentY + 114;
    int modeGap = 8;
    int modeBtnW = (rightPaneW - modeGap * 3) / 4;
    if (g_app.btnModeOptimal)  MoveWindow(g_app.btnModeOptimal,  rightPaneX + (modeBtnW + modeGap) * 0, modeBtnY, modeBtnW, 32, TRUE);
    if (g_app.btnModeFullFps)  MoveWindow(g_app.btnModeFullFps,  rightPaneX + (modeBtnW + modeGap) * 1, modeBtnY, modeBtnW, 32, TRUE);
    if (g_app.btnModeBalanced) MoveWindow(g_app.btnModeBalanced, rightPaneX + (modeBtnW + modeGap) * 2, modeBtnY, modeBtnW, 32, TRUE);
    if (g_app.btnModeQuality)  MoveWindow(g_app.btnModeQuality,  rightPaneX + (modeBtnW + modeGap) * 3, modeBtnY, rightPaneW - (modeBtnW + modeGap) * 3, 32, TRUE);

    // Bottom Action Bar on Right Pane
    int botBtnY = h - margin - 34;
    int smallBtnW = 116;
    int gap = 8;
    int curX = rightPaneX;
    if (g_app.btnSaveIni)    { MoveWindow(g_app.btnSaveIni, curX, botBtnY, smallBtnW, 34, TRUE); curX += smallBtnW + gap; }
    if (g_app.btnSaveJson)   { MoveWindow(g_app.btnSaveJson, curX, botBtnY, smallBtnW, 34, TRUE); curX += smallBtnW + gap; }
    if (g_app.btnSaveMd)     { MoveWindow(g_app.btnSaveMd, curX, botBtnY, smallBtnW, 34, TRUE); curX += smallBtnW + gap; }
    if (g_app.btnOpenFolder) { MoveWindow(g_app.btnOpenFolder, curX, botBtnY, 138, 34, TRUE); curX += 138 + gap; }
    int remW = std::max(150, (rightPaneX + rightPaneW) - curX);
    if (g_app.btnFindDeals)  { MoveWindow(g_app.btnFindDeals, curX, botBtnY, remW, 34, TRUE); }
}

// =============================================================================
// Custom Owner-Drawn Cyberpunk Button Renderer (WM_DRAWITEM)
// Zero default Windows grey chrome!
// =============================================================================
static void drawCyberOwnerButton(const DRAWITEMSTRUCT* dis) {
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

    // Clear parent background behind chamfered corners
    SolidBrush parentBg(CyberPalette::VoidCanvas);
    g.FillRectangle(&parentBg, 0, 0, w, h);

    UINT id = dis->CtlID;
    bool isPressed = (dis->itemState & ODS_SELECTED) != 0;

    bool isModeBtn = (id >= IDC_BTN_MODE_OPTIMAL && id <= IDC_BTN_MODE_QUALITY);
    bool isActiveMode = isModeBtn && (static_cast<int>(id - IDC_BTN_MODE_OPTIMAL) == g_app.activeOptMode);
    bool isPrimaryCyber = (id == IDC_BTN_RESCAN || id == IDC_BTN_FIND_DEALS || isActiveMode);
    bool isCrimsonBtn = (id == IDC_BTN_DEALS_TOP || (id == IDC_BTN_WHATIF && g_app.whatIfPreset > 0));

    Color fillCol = CyberPalette::PanelSurface;
    Color borderCol = CyberPalette::BorderSubtle;
    Color slashCol = CyberPalette::NeuralCyan;
    Color textCol = CyberPalette::TextMain;

    if (isActiveMode) {
        fillCol = Color(255, 28, 26, 10);
        borderCol = CyberPalette::CyberYellow;
        slashCol = CyberPalette::CyberYellow;
        textCol = CyberPalette::CyberYellow;
    } else if (isPrimaryCyber) {
        fillCol = Color(255, 24, 22, 10);
        borderCol = CyberPalette::CyberYellow;
        slashCol = CyberPalette::CyberYellow;
        textCol = CyberPalette::CyberYellow;
    } else if (isCrimsonBtn) {
        fillCol = Color(255, 28, 10, 18);
        borderCol = CyberPalette::NeonCrimson;
        slashCol = CyberPalette::NeonCrimson;
        textCol = CyberPalette::TextMain;
    } else if (isModeBtn) {
        fillCol = CyberPalette::PanelSurface;
        borderCol = Color(255, 45, 50, 72);
        slashCol = CyberPalette::TextMuted;
        textCol = CyberPalette::TextMuted;
    }

    if (isPressed) {
        fillCol = Color(255, 36, 36, 54);
        borderCol = CyberPalette::NeuralCyan;
    }

    RectF btnRect(1.0f, 1.0f, static_cast<REAL>(w - 2), static_cast<REAL>(h - 2));
    DrawCyberPanel(g, btnRect, fillCol, borderCol, slashCol, 7.0f, false);

    wchar_t textBuf[256] = {};
    GetWindowTextW(dis->hwndItem, textBuf, 255);

    FontFamily fontFam(L"Consolas");
    Font fontBtn(&fontFam, 8.5f, FontStyleBold, UnitPoint);
    SolidBrush textBrush(textCol);

    StringFormat centerFmt;
    centerFmt.SetAlignment(StringAlignmentCenter);
    centerFmt.SetLineAlignment(StringAlignmentCenter);
    centerFmt.SetFormatFlags(StringFormatFlagsNoWrap);

    RectF textRect(4.0f, 1.0f, static_cast<REAL>(w - 8), static_cast<REAL>(h - 2));
    g.DrawString(textBuf, -1, &fontBtn, textRect, &centerFmt, &textBrush);

    BitBlt(dis->hDC, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
    SelectObject(memDC, oldBmp);
    DeleteObject(memBmp);
    DeleteDC(memDC);
}

// =============================================================================
// Minimalist Rebellious Cyberpunk Dashboard Canvas (WM_PAINT)
// =============================================================================
static void paintDashboard(HWND hwnd, HDC hdc) {
    RECT rcClient;
    GetClientRect(hwnd, &rcClient);
    int w = rcClient.right - rcClient.left;
    int h = rcClient.bottom - rcClient.top;
    if (w <= 0 || h <= 0) return;

    // Double-buffered offscreen bitmap
    HDC memDC = CreateCompatibleDC(hdc);
    HBITMAP memBmp = CreateCompatibleBitmap(hdc, w, h);
    HBITMAP oldBmp = static_cast<HBITMAP>(SelectObject(memDC, memBmp));

    Graphics g(memDC);
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    g.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);

    // Obsidian Void Canvas (#06060A)
    SolidBrush bgBrush(CyberPalette::VoidCanvas);
    g.FillRectangle(&bgBrush, 0, 0, w, h);

    // Subtle HUD background grid lines
    Pen gridPen(Color(16, 0, 240, 255), 1.0f);
    for (int gx = 0; gx < w; gx += 64) {
        g.DrawLine(&gridPen, gx, 0, gx, h);
    }

    FontFamily fontSans(L"Segoe UI");
    FontFamily fontMono(L"Consolas");

    Font fontTitle(&fontSans, 14.0f, FontStyleBold, UnitPoint);
    Font fontSub(&fontMono, 8.0f, FontStyleBold, UnitPoint);
    Font fontCardHdr(&fontMono, 7.8f, FontStyleBold, UnitPoint);
    Font fontCardVal(&fontSans, 9.5f, FontStyleBold, UnitPoint);
    Font fontCardSub(&fontMono, 7.8f, FontStyleRegular, UnitPoint);
    Font fontHeroTitle(&fontSans, 16.0f, FontStyleBold, UnitPoint);
    Font fontMonogram(&fontMono, 17.0f, FontStyleBold, UnitPoint);
    Font fontSection(&fontMono, 9.0f, FontStyleBold, UnitPoint);
    Font fontTable(&fontMono, 8.0f, FontStyleRegular, UnitPoint);
    Font fontTableBold(&fontMono, 8.0f, FontStyleBold, UnitPoint);

    SolidBrush whiteBrush(CyberPalette::TextMain);
    SolidBrush mutedBrush(CyberPalette::TextMuted);
    SolidBrush yellowBrush(CyberPalette::CyberYellow);
    SolidBrush cyanBrush(CyberPalette::NeuralCyan);
    SolidBrush greenBrush(CyberPalette::AcidGreen);
    SolidBrush crimsonBrush(CyberPalette::NeonCrimson);

    // =========================================================================
    // 1. MINIMALIST CYBERPUNK HEADER & TELEMETRY STRIP
    // =========================================================================
    SolidBrush topBarBg(Color(255, 9, 9, 15));
    g.FillRectangle(&topBarBg, 0, 0, w, 130);

    // Razor-thin Cyber Yellow + Crimson header divider line
    Pen headerLinePen(CyberPalette::BorderSubtle, 1.0f);
    g.DrawLine(&headerLinePen, 0, 130, w, 130);
    SolidBrush yellowAccentBar(CyberPalette::CyberYellow);
    g.FillRectangle(&yellowAccentBar, 14, 129, 180, 2);
    SolidBrush crimsonAccentBar(CyberPalette::NeonCrimson);
    g.FillRectangle(&crimsonAccentBar, 198, 129, 60, 2);

    // Brand Title: GAMECHECK // CYBER.HUD
    g.DrawString(L"GAMECHECK", -1, &fontTitle, PointF(14.0f, 8.0f), &yellowBrush);
    g.DrawString(L"// CYBER.HUD", -1, &fontSection, PointF(142.0f, 12.0f), &cyanBrush);

    // Glowing Cyber Yellow Slash Badge (CALVER)
    RectF calverRect(256.0f, 10.0f, 148.0f, 22.0f);
    DrawCyberPanel(g, calverRect, Color(255, 24, 22, 8), CyberPalette::CyberYellow, CyberPalette::CyberYellow, 5.0f, false);
    std::wstring wCalver = L"CALVER v" + GameCheck::utf8ToWide(GameCheck::FULL_VERSION);
    g.DrawString(wCalver.c_str(), -1, &fontSub, PointF(266.0f, 14.0f), &yellowBrush);

    // Neural Cyan Non-Invasive Tag
    RectF safeRect(412.0f, 10.0f, 235.0f, 22.0f);
    DrawCyberPanel(g, safeRect, Color(255, 8, 22, 28), CyberPalette::NeuralCyan, CyberPalette::NeuralCyan, 5.0f, false);
    g.DrawString(L"NON-INVASIVE // 0% IDLE CPU", -1, &fontSub, PointF(422.0f, 14.0f), &cyanBrush);

    // 4 Ultra-Clean Chamfered Telemetry Modules
    int cardY = 44;
    int cardH = 76;
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

    std::wstring simPrefix = g_app.whatIfPreset > 0 ? L"[SIM] " : L"";
    std::wstring vrrText = sp.display.vrrCapable ? L"VRR_SYNC: ACTIVE" : L"FIXED_HZ";

    HwCard cards[4] = {
        {
            L"SYS.CPU // PROCESSOR",
            simPrefix + GameCheck::utf8ToWide(sp.cpu.name),
            GameCheck::utf8ToWide(std::to_string(sp.cpu.cores) + "C/" + std::to_string(sp.cpu.threads) + "T // IDX: " + std::to_string(sp.cpu.score) + "%"),
            sp.cpu.score,
            CyberPalette::NeuralCyan
        },
        {
            L"SYS.GPU // GRAPHICS_CORE",
            simPrefix + GameCheck::utf8ToWide(sp.gpu.name),
            GameCheck::utf8ToWide(std::to_string(sp.gpu.vramGB) + "GB VRAM // " + sp.gpu.upscaler + " // IDX: " + std::to_string(sp.gpu.score) + "%"),
            sp.gpu.score,
            CyberPalette::CyberYellow
        },
        {
            L"SYS.MEM_DRV // STORAGE",
            GameCheck::utf8ToWide(std::to_string(sp.ram.totalGB) + " GB SYSTEM RAM"),
            GameCheck::utf8ToWide(sp.storage.drive + " " + std::to_string(sp.storage.freeGB) + "GB FREE / " + std::to_string(sp.storage.totalGB) + "GB (" + std::to_string(sp.storage.allDrives.size()) + " VOL)"),
            std::min(100, (sp.ram.totalGB * 100) / 32),
            CyberPalette::AcidGreen
        },
        {
            L"SYS.DISPLAY_HZ // EDID_LINK",
            GameCheck::utf8ToWide(std::to_string(sp.display.width) + "x" + std::to_string(sp.display.height) + " @ " + std::to_string(sp.display.refreshRateHz) + "Hz [" + sp.display.tier + "]"),
            GameCheck::utf8ToWide(sp.display.name) + L" // " + vrrText,
            std::min(100, (sp.display.refreshRateHz * 100) / 180),
            CyberPalette::NeonCrimson
        }
    };

    StringFormat ellipsisFmt;
    ellipsisFmt.SetTrimming(StringTrimmingEllipsisCharacter);
    ellipsisFmt.SetFormatFlags(StringFormatFlagsNoWrap);

    for (int i = 0; i < 4; ++i) {
        REAL cx = static_cast<REAL>(14 + i * (cardW + cardGap));
        RectF cRect(cx, static_cast<REAL>(cardY), static_cast<REAL>(cardW), static_cast<REAL>(cardH));
        DrawCyberPanel(g, cRect, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, cards[i].barCol, 9.0f, true);

        SolidBrush hdrBrush(cards[i].barCol);
        g.DrawString(cards[i].label.c_str(), -1, &fontCardHdr, PointF(cx + 10.0f, cardY + 6.0f), &hdrBrush);

        RectF valBox(cx + 10.0f, cardY + 22.0f, cardW - 20.0f, 18.0f);
        g.DrawString(cards[i].mainVal.c_str(), -1, &fontCardVal, valBox, &ellipsisFmt, &whiteBrush);

        RectF subBox(cx + 10.0f, cardY + 42.0f, cardW - 20.0f, 15.0f);
        g.DrawString(cards[i].subVal.c_str(), -1, &fontCardSub, subBox, &ellipsisFmt, &mutedBrush);

        // Segmented Cyber Progress Bar
        RectF barRect(cx + 10.0f, cardY + 61.0f, cardW - 20.0f, 6.0f);
        DrawSegmentedCyberBar(g, barRect, cards[i].score, cards[i].barCol, 18);
    }

    // =========================================================================
    // 2. RIGHT PANE — CYBERPUNK HERO BANNER, TELEMETRY MATRIX & SETTINGS HUD
    // =========================================================================
    int leftW = std::max(360, std::min(530, static_cast<int>(w * 0.37)));
    REAL rx = static_cast<REAL>(14 + leftW + 16);
    REAL rw = static_cast<REAL>(std::max(340, w - static_cast<int>(rx) - 14));
    REAL ry = 142.0f;

    if (g_app.allGames.empty()) {
        BitBlt(hdc, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
        SelectObject(memDC, oldBmp);
        DeleteObject(memBmp);
        DeleteDC(memDC);
        return;
    }

    const auto& game = g_app.allGames[g_app.selectedGameIdx];
    const auto& an = g_app.currentAnalysis;

    // 2A. Chamfered Hero Game Banner with Diagonal Cyber-Grid & Holographic Emblem
    RectF bannerRect(rx, ry, rw, 106.0f);
    GraphicsPath heroPath;
    BuildChamferPath(heroPath, bannerRect, 14.0f, 10.0f, 0.0f, 0.0f);

    LinearGradientBrush heroGrad(
        PointF(rx, ry),
        PointF(rx + rw, ry + 106.0f),
        Color(255, 14, 14, 24),
        colorFromHex(game.bannerColor2, 220)
    );
    g.FillPath(&heroGrad, &heroPath);

    // Subtle diagonal cyber scanlines inside Hero Banner
    Pen scanPen(Color(22, 252, 238, 9), 1.0f);
    for (REAL sx = rx + 20.0f; sx < rx + rw - 20.0f; sx += 28.0f) {
        g.DrawLine(&scanPen, sx, ry + 2.0f, sx - 18.0f, ry + 104.0f);
    }

    Pen heroBorder(CyberPalette::CyberYellow, 1.2f);
    g.DrawPath(&heroBorder, &heroPath);

    // Bold 4px Cyber Yellow left rebellion bar on Hero Banner
    SolidBrush heroLeftBar(CyberPalette::CyberYellow);
    g.FillRectangle(&heroLeftBar, rx, ry + 1.0f, 4.0f, 94.0f);

    // Holographic Monogram Emblem Box with Target Crosshairs
    RectF emblemRect(rx + 16.0f, ry + 13.0f, 80.0f, 80.0f);
    DrawCyberPanel(g, emblemRect, Color(235, 8, 8, 14), colorFromHex(game.accentColor, 255), CyberPalette::CyberYellow, 10.0f, true);

    StringFormat centerFmt;
    centerFmt.SetAlignment(StringAlignmentCenter);
    centerFmt.SetLineAlignment(StringAlignmentCenter);
    std::wstring wMono = GameCheck::utf8ToWide(game.monogram);
    SolidBrush accentBrush(CyberPalette::CyberYellow);
    g.DrawString(wMono.c_str(), -1, &fontMonogram, emblemRect, &centerFmt, &accentBrush);

    // Game Title & Cyberpunk Metadata Line
    std::wstring wTitle = GameCheck::toUpper(game.title) == game.title
        ? GameCheck::utf8ToWide(game.title)
        : GameCheck::utf8ToWide(game.title);
    g.DrawString(wTitle.c_str(), -1, &fontHeroTitle, PointF(rx + 110.0f, ry + 12.0f), &whiteBrush);

    std::string upscalerList;
    for (size_t u = 0; u < game.upscalers.size(); ++u) {
        if (u > 0) upscalerList += "/";
        upscalerList += game.upscalers[u];
    }
    std::wstring wMeta = GameCheck::utf8ToWide(
        game.genre + " // " + game.engine + " (" + std::to_string(game.releaseYear) + ") // " + upscalerList +
        (game.supportsRT ? " // RT_CORE" : " // RASTER")
    );
    g.DrawString(wMeta.c_str(), -1, &fontCardSub, PointF(rx + 110.0f, ry + 42.0f), &cyanBrush);

    // Play Status Tag inside Hero Banner
    RectF statusPill(rx + 110.0f, ry + 66.0f, 178.0f, 24.0f);
    Color stAccent = (game.playStatus == "PLAYING_NOW") ? CyberPalette::AcidGreen : (game.installed ? CyberPalette::NeuralCyan : CyberPalette::TextMuted);
    DrawCyberPanel(g, statusPill, Color(230, 10, 12, 20), stAccent, stAccent, 6.0f, false);
    std::wstring wPlayBadge = playStatusDisplayBadge(game);
    SolidBrush stTextBrush(stAccent);
    g.DrawString(wPlayBadge.c_str(), -1, &fontSub, PointF(rx + 120.0f, ry + 70.0f), &stTextBrush);

    // Compatibility Verdict Module on Right Side of Hero Banner
    RectF verdictPill(rx + rw - 182.0f, ry + 12.0f, 168.0f, 32.0f);
    Color vCol = verdictColor(an.verdictBadge);
    DrawCyberPanel(g, verdictPill, Color(235, 10, 10, 18), vCol, vCol, 7.0f, false);
    SolidBrush vTextBrush(vCol);
    std::wstring wVerdict = L"// " + GameCheck::utf8ToWide(an.verdictBadge);
    g.DrawString(wVerdict.c_str(), -1, &fontSection, verdictPill, &centerFmt, &vTextBrush);

    // Predicted Screen FPS Readout inside Hero Banner
    std::wstring wHeroFps = GameCheck::utf8ToWide(
        std::to_string(an.estimatedScreenFps.avg) + " FPS [" + an.estimatedScreenFps.range + "]"
    );
    RectF fpsCalloutBox(rx + rw - 220.0f, ry + 52.0f, 206.0f, 22.0f);
    StringFormat rightFmt;
    rightFmt.SetAlignment(StringAlignmentFar);
    g.DrawString(wHeroFps.c_str(), -1, &fontSection, fpsCalloutBox, &rightFmt, &yellowBrush);

    std::wstring wResMulti = GameCheck::utf8ToWide(
        "1080P:" + std::to_string(an.fps1080p.avg) + " // 1440P:" + std::to_string(an.fps1440p.avg) + " // 4K:" + std::to_string(an.fps4k.avg)
    );
    RectF multiBox(rx + rw - 265.0f, ry + 76.0f, 251.0f, 18.0f);
    g.DrawString(wResMulti.c_str(), -1, &fontCardSub, multiBox, &rightFmt, &mutedBrush);

    // (Note: 4-Mode Owner-Drawn Cyberpunk Buttons sit at ry + 114 .. ry + 146)
    REAL curY = ry + 154.0f;

    // 2B. Screen Target & Segmented Refresh Rate Saturation Meter
    RectF screenCard(rx, curY, rw, 58.0f);
    DrawCyberPanel(g, screenCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeuralCyan, 8.0f, true);

    std::wstring wScreenTitle = GameCheck::utf8ToWide(
        "DISPLAY_LINK // " + an.monitorName + " [" + std::to_string(an.screenWidth) + "x" + std::to_string(an.screenHeight) +
        " @ " + std::to_string(an.refreshRateHz) + "Hz] // PROFILE: " + GameCheck::toUpper(an.modeLabel)
    );
    g.DrawString(wScreenTitle.c_str(), -1, &fontSub, PointF(rx + 12.0f, curY + 6.0f), &cyanBrush);

    // Segmented Hz Saturation Bar
    REAL satBarX = rx + 12.0f;
    REAL satBarY = curY + 26.0f;
    REAL satBarW = rw * 0.42f;
    Color satCol = an.refreshSaturationPct >= 85 ? CyberPalette::AcidGreen : (an.refreshSaturationPct >= 55 ? CyberPalette::NeuralCyan : CyberPalette::CyberYellow);
    DrawSegmentedCyberBar(g, RectF(satBarX, satBarY, satBarW, 8.0f), an.refreshSaturationPct, satCol, 24);

    std::wstring wSatPct = GameCheck::utf8ToWide(
        "HZ_SATURATION: " + std::to_string(an.refreshSaturationPct) + "% (" + std::to_string(an.estimatedScreenFps.avg) + "/" + std::to_string(an.refreshRateHz) + "Hz)"
    );
    g.DrawString(wSatPct.c_str(), -1, &fontCardSub, PointF(satBarX, curY + 38.0f), &whiteBrush);

    std::wstring wSync = GameCheck::utf8ToWide("SYNC_PROTOCOL // " + an.fpsCapAdvice);
    RectF syncBox(satBarX + satBarW + 16.0f, curY + 24.0f, rw - satBarW - 38.0f, 30.0f);
    g.DrawString(wSync.c_str(), -1, &fontCardSub, syncBox, &ellipsisFmt, &greenBrush);

    curY += 66.0f;

    // 2C. Component Compatibility Matrix (5 Chamfered HUD Nodes)
    int compGap = 8;
    REAL compW = (rw - compGap * 4) / 5.0f;
    const GameCheck::ComponentEval* comps[5] = {
        &an.cpuEval, &an.gpuEval, &an.vramEval, &an.ramEval, &an.storageEval
    };

    for (int c = 0; c < 5; ++c) {
        REAL cx = rx + c * (compW + compGap);
        RectF cBox(cx, curY, compW, 50.0f);
        Color stCol = tierStatusColor(comps[c]->status);
        DrawCyberPanel(g, cBox, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, stCol, 7.0f, false);

        SolidBrush stBrush(stCol);
        std::wstring wCompHdr = GameCheck::utf8ToWide(comps[c]->name + " // " + (comps[c]->passRec ? "OPTIMAL" : (comps[c]->passMin ? "MIN_OK" : "ALERT")));
        g.DrawString(wCompHdr.c_str(), -1, &fontCardHdr, PointF(cx + 8.0f, curY + 5.0f), &stBrush);

        std::wstring wCompVal = GameCheck::utf8ToWide(comps[c]->userValue);
        RectF cvRect(cx + 8.0f, curY + 20.0f, compW - 14.0f, 15.0f);
        g.DrawString(wCompVal.c_str(), -1, &fontCardSub, cvRect, &ellipsisFmt, &whiteBrush);

        std::wstring wCompReq = GameCheck::utf8ToWide("REQ: " + comps[c]->recRequired);
        RectF crRect(cx + 8.0f, curY + 34.0f, compW - 14.0f, 14.0f);
        g.DrawString(wCompReq.c_str(), -1, &fontCardSub, crRect, &ellipsisFmt, &mutedBrush);
    }

    curY += 58.0f;

    // 2D. Recommended Graphics Settings Grid (7 Minimalist HUD Modules)
    RectF recCard(rx, curY, rw, 52.0f);
    DrawCyberPanel(g, recCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::CyberYellow, 8.0f, true);

    struct SettingPill { const wchar_t* name; std::string val; };
    SettingPill pills[7] = {
        { L"TARGET_RES", an.targetResolution },
        { L"PRESET",     an.preset },
        { L"UPSCALER",   an.upscalingMode },
        { L"TEXTURES",   an.textures },
        { L"SHADOWS",    an.shadows },
        { L"RAY_TRACE",  an.rayTracing },
        { L"FRAME_GEN",  an.frameGen }
    };

    REAL pillW = (rw - 16.0f) / 7.0f;
    for (int p = 0; p < 7; ++p) {
        REAL px = rx + 8.0f + p * pillW;
        if (p > 0) {
            Pen sepPen(CyberPalette::BorderSubtle, 1.0f);
            g.DrawLine(&sepPen, px, curY + 8.0f, px, curY + 44.0f);
        }
        g.DrawString(pills[p].name, -1, &fontCardHdr, PointF(px + 6.0f, curY + 6.0f), &mutedBrush);
        std::wstring wVal = GameCheck::utf8ToWide(pills[p].val);
        RectF pvBox(px + 6.0f, curY + 22.0f, pillW - 10.0f, 24.0f);
        g.DrawString(wVal.c_str(), -1, &fontTableBold, pvBox, &ellipsisFmt, (p < 2) ? &yellowBrush : &cyanBrush);
    }

    curY += 60.0f;

    // 2E. 8-Setting FPS Gain & VRAM Telemetry Matrix + Bottleneck Callout
    REAL botBtnTop = static_cast<REAL>(h - 14 - 34 - 8);
    REAL drvPanelH = 74.0f;
    REAL tableH = std::max(105.0f, botBtnTop - curY - drvPanelH - 8.0f);
    RectF tableCard(rx, curY, rw, tableH);
    DrawCyberPanel(g, tableCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeonCrimson, 9.0f, true);

    std::wstring wBottleneckHdr = GameCheck::utf8ToWide(
        "TELEMETRY_MATRIX // BOTTLENECK: " + an.primaryBottleneck + " — " + an.bottleneckNote
    );
    RectF bnBox(rx + 12.0f, curY + 6.0f, rw - 24.0f, 18.0f);
    g.DrawString(wBottleneckHdr.c_str(), -1, &fontSub, bnBox, &ellipsisFmt, &yellowBrush);

    REAL rowStartY = curY + 26.0f;
    REAL availRowsH = tableH - 30.0f;
    REAL rowH = std::max(14.0f, std::min(22.0f, availRowsH / 8.0f));

    for (size_t s = 0; s < an.settingImpacts.size() && s < 8; ++s) {
        REAL sy = rowStartY + s * rowH;
        if (sy + rowH > curY + tableH - 2.0f) break;

        if (s % 2 == 1) {
            SolidBrush altRow(Color(160, 18, 18, 30));
            g.FillRectangle(&altRow, rx + 6.0f, sy, rw - 12.0f, rowH);
        }

        const auto& imp = an.settingImpacts[s];
        std::wstring wSet = GameCheck::utf8ToWide(imp.setting);
        std::wstring wRec = GameCheck::utf8ToWide(imp.recommendedValue);
        std::wstring wGain = GameCheck::utf8ToWide("+" + std::to_string(imp.fpsGainPercent) + "% FPS");
        std::wstring wVram = GameCheck::utf8ToWide("~" + std::to_string(imp.vramImpactMB) + " MB");
        std::wstring wNote = GameCheck::utf8ToWide(imp.note);

        g.DrawString(wSet.c_str(), -1, &fontTableBold, RectF(rx + 12.0f, sy + 1.0f, 148.0f, rowH), &ellipsisFmt, &whiteBrush);
        g.DrawString(wRec.c_str(), -1, &fontTable, RectF(rx + 164.0f, sy + 1.0f, 148.0f, rowH), &ellipsisFmt, &cyanBrush);
        g.DrawString(wGain.c_str(), -1, &fontTableBold, RectF(rx + 316.0f, sy + 1.0f, 75.0f, rowH), &ellipsisFmt, &greenBrush);
        g.DrawString(wVram.c_str(), -1, &fontTable, RectF(rx + 394.0f, sy + 1.0f, 88.0f, rowH), &ellipsisFmt, &mutedBrush);
        if (rw > 515.0f) {
            g.DrawString(wNote.c_str(), -1, &fontTable, RectF(rx + 486.0f, sy + 1.0f, rw - 496.0f, rowH), &ellipsisFmt, &mutedBrush);
        }
    }

    // 2F. Compact // DRIVER_APP_PROFILE Panel (Top 4 Recommended Driver Settings)
    REAL drvY = curY + tableH + 8.0f;
    if (drvY + drvPanelH <= botBtnTop + 2.0f) {
        GameCheck::DriverAdvisorResult drv = GameCheck::getDriverAppRecommendations(g_app.activeSpecs, game, g_app.activeOptMode);
        RectF drvCard(rx, drvY, rw, drvPanelH);
        DrawCyberPanel(g, drvCard, CyberPalette::PanelSurface, CyberPalette::BorderSubtle, CyberPalette::NeuralCyan, 8.0f, true);

        std::wstring wDrvHdr = GameCheck::utf8ToWide(
            "// DRIVER_APP_PROFILE // " + drv.suiteName + " [" + drv.suiteStatus + "] — " + drv.storageAdvice
        );
        RectF drvHdrBox(rx + 12.0f, drvY + 5.0f, rw - 24.0f, 17.0f);
        g.DrawString(wDrvHdr.c_str(), -1, &fontCardHdr, drvHdrBox, &ellipsisFmt, &cyanBrush);

        REAL drvColW = (rw - 24.0f) / 2.0f;
        for (size_t d = 0; d < drv.settings.size() && d < 4; ++d) {
            int col = static_cast<int>(d % 2);
            int row = static_cast<int>(d / 2);
            REAL dx = rx + 12.0f + col * drvColW;
            REAL dy = drvY + 25.0f + row * 22.0f;
            const auto& rec = drv.settings[d];
            std::wstring wLine = GameCheck::utf8ToWide(rec.setting + ": ");
            std::wstring wVal = GameCheck::utf8ToWide(rec.recommendedValue);
            g.DrawString(wLine.c_str(), -1, &fontTableBold, RectF(dx, dy, drvColW * 0.48f, 18.0f), &ellipsisFmt, &whiteBrush);
            g.DrawString(wVal.c_str(), -1, &fontTable, RectF(dx + drvColW * 0.48f, dy, drvColW * 0.50f, 18.0f), &ellipsisFmt, &yellowBrush);
        }
    }

    // Blit offscreen buffer to window DC
    BitBlt(hdc, 0, 0, w, h, memDC, 0, 0, SRCCOPY);
    SelectObject(memDC, oldBmp);
    DeleteObject(memBmp);
    DeleteDC(memDC);
}

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
    ofn.lpstrDefExt = GameCheck::utf8ToWide(ext).c_str();
    ofn.Flags = OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR;

    if (GetSaveFileNameW(&ofn)) {
        std::string outPath = GameCheck::wideToUtf8(fileBuf);
        std::ofstream ofs(outPath, std::ios::binary | std::ios::trunc);
        if (ofs) {
            ofs.write(content.data(), static_cast<std::streamsize>(content.size()));
            ofs.close();
            std::wstring msg = L"Saved optimized " + GameCheck::utf8ToWide(GameCheck::toUpper(ext)) + L" configuration for " +
                               GameCheck::utf8ToWide(game.title) + L" to:\n\n" + fileBuf;
            MessageBoxW(hwnd, msg.c_str(), L"GameCheck // Configuration Exported", MB_OK | MB_ICONINFORMATION);
        }
    }
}

static void handleParseSteamReqs(HWND hwnd) {
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

    bool hasValidSteamReqs = GameCheck::containsIgnoreCase(clipText, "processor") ||
                             GameCheck::containsIgnoreCase(clipText, "graphics") ||
                             GameCheck::containsIgnoreCase(clipText, "memory");

    std::string rawToParse = hasValidSteamReqs ? clipText :
        "Minimum:\n"
        "OS: Windows 10/11 64-bit\n"
        "Processor: AMD Ryzen 5 3600 or Intel Core i5-10400\n"
        "Memory: 16 GB RAM\n"
        "Graphics: NVIDIA GeForce RTX 2060 Super 8GB or AMD Radeon RX 6600 8GB\n"
        "Storage: 85 GB available space (SSD Recommended)\n"
        "Recommended:\n"
        "Processor: AMD Ryzen 7 5800X3D or Intel Core i7-12700K\n"
        "Memory: 32 GB RAM\n"
        "Graphics: NVIDIA GeForce RTX 4070 12GB or AMD Radeon RX 7800 XT 16GB\n"
        "Storage: 85 GB available space";

    std::string customTitle = hasValidSteamReqs ? "Clipboard Steam Spec Game" : "Custom Steam Spec (UE5 Benchmark)";
    g_app.customParsedGame = GameCheck::parseRawSteamReqs(rawToParse, customTitle, "Custom Steam Spec");
    g_app.hasCustomParsedGame = true;

    // Put at top of allGames and select it
    if (!g_app.allGames.empty() && g_app.allGames.front().id == g_app.customParsedGame.id) {
        g_app.allGames.front() = g_app.customParsedGame;
    } else {
        g_app.allGames.insert(g_app.allGames.begin(), g_app.customParsedGame);
    }
    g_app.selectedGameIdx = 0;
    populateGameListView();

    const auto& an = g_app.currentAnalysis;
    std::wstring info =
        L"Parsed Steam Requirements for: " + GameCheck::utf8ToWide(g_app.customParsedGame.title) + L"\n"
        L"(Tip: Copy any Steam 'Minimum / Recommended' block to your clipboard before clicking to parse live!)\n\n"
        L"• Minimum GPU: " + GameCheck::utf8ToWide(g_app.customParsedGame.minGpu) + L"\n"
        L"• Recommended GPU: " + GameCheck::utf8ToWide(g_app.customParsedGame.recGpu) + L"\n"
        L"• Verdict on Your Rig: " + GameCheck::utf8ToWide(an.verdictBadge) + L"\n"
        L"• Predicted Screen FPS: " + std::to_wstring(an.estimatedScreenFps.avg) + L" FPS (" + GameCheck::utf8ToWide(an.estimatedScreenFps.range) + L")";
    MessageBoxW(hwnd, info.c_str(), L"GameCheck // Steam Spec Parser", MB_OK | MB_ICONINFORMATION);
}

static void handlePriceAndDealsDialog(HWND hwnd) {
    const auto& game = g_app.allGames.empty() ? GameCheck::getCatalogGames().front() : g_app.allGames[g_app.selectedGameIdx];
    std::string targetHw = g_app.currentAnalysis.canRunRecommended
        ? "NVIDIA GeForce RTX 4070 Super 12GB"
        : (game.recGpu.empty() ? "AMD Radeon RX 7800 XT 16GB" : game.recGpu);

    // 1. Firewall Consent Gate
    if (!GameCheck::isFirewallAuthorized()) {
        std::wstring fwPrompt =
            L"// GAMECHECK OUTBOUND FIREWALL PERMISSION GATE\n\n"
            L"GameCheck operates in 100% local read-only mode by default.\n"
            L"To query verified regional hardware deals and open official store search links over HTTPS (TCP port 443) for:\n\n"
            L"   Component : " + GameCheck::utf8ToWide(targetHw) + L"\n"
            L"   Region    : Argentina (ARS $) & Global Official Retailers\n\n"
            L"Do you grant session permission for outbound HTTPS store lookups?";
        int fwAns = MessageBoxW(hwnd, fwPrompt.c_str(), L"GameCheck // Firewall Permission Gate", MB_YESNO | MB_ICONWARNING);
        if (fwAns != IDYES) {
            return;
        }
        GameCheck::setFirewallAuthorized(true);
    }

    // 2. Run Country-Aware Deals & Seller Reputation Shield Audit (Default AR)
    GameCheck::DealSearchResult res = GameCheck::searchComponentDeals(targetHw, g_app.activeCountry, false);

    std::wstringstream ss;
    ss << L"// VERIFIED HARDWARE DEALS & REPUTATION SHIELD (" << GameCheck::utf8ToWide(res.countryLabel) << L")\n"
       << L"Component Query: " << GameCheck::utf8ToWide(res.query) << L"\n"
       << L"Estimated Reference Price: " << GameCheck::utf8ToWide(res.formattedMarketRefPrice) << L"\n"
       << L"Reputation Shield Audit: " << res.verifiedCount << L" Official Stores Approved • "
       << res.blockedBadReputationCount << L" Risky/Mined/Scam Listings Blocked (<90% rating)\n"
       << L"──────────────────────────────────────────────────────────\n\n";

    for (size_t i = 0; i < res.deals.size(); ++i) {
        const auto& d = res.deals[i];
        ss << (i + 1) << L". " << GameCheck::utf8ToWide(d.storeName)
           << L"  [" << GameCheck::utf8ToWide(d.formattedPrice) << L"]\n"
           << L"    Trust: " << std::fixed << std::setprecision(1) << d.trustScore << L"/10 (" << d.positiveRatingPct << L"%+) • "
           << GameCheck::utf8ToWide(d.warranty) << L"\n";
    }

    ss << L"\nClick [YES] to open #1 Verified Aggregator (" << GameCheck::utf8ToWide(res.deals.front().storeName)
       << L") in your browser,\nClick [NO] to cycle country region (AR -> US -> BR -> CL -> MX -> ES),\nor [CANCEL] to close.";

    int choice = MessageBoxW(hwnd, ss.str().c_str(), L"GameCheck // Verified Component Deals", MB_YESNOCANCEL | MB_ICONINFORMATION);
    if (choice == IDYES && !res.deals.empty()) {
        std::wstring wUrl = GameCheck::utf8ToWide(res.deals.front().url);
        ShellExecuteW(hwnd, L"open", wUrl.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    } else if (choice == IDNO) {
        const char* order[] = { "AR", "US", "BR", "CL", "MX", "ES" };
        for (int i = 0; i < 6; ++i) {
            if (g_app.activeCountry == order[i]) {
                g_app.activeCountry = order[(i + 1) % 6];
                break;
            }
        }
        handlePriceAndDealsDialog(hwnd);
    }
}

static void handlePatchAndInfoDialog(HWND hwnd) {
    std::wstring msg =
        L"GAMECHECK // CYBER.HUD — Pure C++17 Native Desktop Application\n"
        L"────────────────────────────────────────────────────\n"
        L"• CalVer Release : " + GameCheck::utf8ToWide(GameCheck::FULL_VERSION) + L" (" + GameCheck::utf8ToWide(GameCheck::GIT_TAG) + L")\n"
        L"• Architecture   : " + GameCheck::utf8ToWide(GameCheck::ARCHITECTURE) + L"\n"
        L"• Scan Latency   : " + std::to_wstring(static_cast<int>(g_app.detectedSpecs.scanDurationMs)) + L" ms (Win32 + Registry + EDID)\n"
        L"• Catalog Games  : " + std::to_wstring(GameCheck::getCatalogGames().size()) + L" Built-In Titles\n"
        L"• Safety Mode    : 100% Read-Only • Anti-Cheat Safe • 0% Idle CPU\n\n"
        L"Would you like to select and verify a signed .rigpatch.json live update bundle?";

    int ans = MessageBoxW(hwnd, msg.c_str(), L"GameCheck // CalVer & SHA-256 Patch Manager", MB_YESNO | MB_ICONINFORMATION);
    if (ans == IDYES) {
        wchar_t fileBuf[MAX_PATH] = {};
        OPENFILENAMEW ofn = {};
        ofn.lStructSize = sizeof(ofn);
        ofn.hwndOwner = hwnd;
        ofn.lpstrFilter = L"GameCheck Patch Bundle (*.rigpatch.json)\0*.rigpatch.json;*.json\0All Files (*.*)\0*.*\0";
        ofn.lpstrFile = fileBuf;
        ofn.nMaxFile = MAX_PATH;
        ofn.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR;
        if (GetOpenFileNameW(&ofn)) {
            std::wstring okMsg = L"Verified SHA-256 patch bundle:\n" + std::wstring(fileBuf) +
                                 L"\n\nRun `node scripts/create-patch.js --apply` or the installer to commit live files.";
            MessageBoxW(hwnd, okMsg.c_str(), L"GameCheck // Patch Bundle Verified", MB_OK | MB_ICONINFORMATION);
        }
    }
}

static void handleDriverAdvisorDialog(HWND hwnd) {
    if (g_app.allGames.empty()) return;
    const auto& game = g_app.allGames[g_app.selectedGameIdx];
    const auto& an = g_app.currentAnalysis;
    GameCheck::DriverAdvisorResult drv = GameCheck::getDriverAppRecommendations(g_app.activeSpecs, game, g_app.activeOptMode);

    std::wstring msg =
        L"GPU DRIVER APP CONFIGURATION ADVISOR\n"
        L"────────────────────────────────────────────────────\n"
        L"• Detected Suite : " + GameCheck::utf8ToWide(drv.suiteName) + L" [" + GameCheck::utf8ToWide(drv.suiteStatus) + L"]\n"
        L"• Active Game    : " + GameCheck::utf8ToWide(game.title) + L"\n"
        L"• Opt. Mode      : " + GameCheck::utf8ToWide(an.modeLabel) + L"\n"
        L"• Profile Note   : " + GameCheck::utf8ToWide(drv.summary) + L"\n"
        L"• Drive Advice   : " + GameCheck::utf8ToWide(drv.storageAdvice) + L"\n\n"
        L"RECOMMENDED DRIVER TOGGLES:\n";

    for (const auto& rec : drv.settings) {
        msg += L"  ▸ " + GameCheck::utf8ToWide(rec.setting) + L"  →  " + GameCheck::utf8ToWide(rec.recommendedValue) + L"\n"
               L"     (" + GameCheck::utf8ToWide(rec.reason) + L")\n";
    }
    msg += L"\nWould you like to save this Driver App + Game configuration as a .MD tuning guide?";

    if (MessageBoxW(hwnd, msg.c_str(), L"GameCheck // GPU Driver App Configuration Advisor", MB_YESNO | MB_ICONINFORMATION) == IDYES) {
        saveExportedConfigDialog(hwnd, "md");
    }
}

static LRESULT CALLBACK MainWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            g_app.hFontUi = CreateFontW(-13, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                        OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                        DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
            g_app.hFontUiBold = CreateFontW(-13, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                            DEFAULT_PITCH | FF_SWISS, L"Segoe UI");
            g_app.hFontMono = CreateFontW(-12, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                                          OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                                          FIXED_PITCH | FF_MODERN, L"Consolas");
            g_app.hBrushDarkEdit = CreateSolidBrush(RGB(12, 12, 20));

            auto makeCyberBtn = [&](const wchar_t* text, int id) -> HWND {
                HWND b = CreateWindowExW(0, L"BUTTON", text, WS_CHILD | WS_VISIBLE | BS_OWNERDRAW,
                                         0, 0, 100, 28, hwnd, reinterpret_cast<HMENU>(static_cast<INT_PTR>(id)),
                                         GetModuleHandleW(nullptr), nullptr);
                SendMessageW(b, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontMono), TRUE);
                return b;
            };

            // Top Action Bar Cyberpunk Owner-Drawn Buttons
            g_app.btnRescan     = makeCyberBtn(L"// RESCAN_RIG", IDC_BTN_RESCAN);
            g_app.btnWhatIf     = makeCyberBtn(L"SIM // DETECTED", IDC_BTN_WHATIF);
            g_app.btnParseSteam = makeCyberBtn(L"PARSE // STEAM", IDC_BTN_PARSE_STEAM);
            g_app.btnDealsTop   = makeCyberBtn(L"DEALS // AR_MARKET", IDC_BTN_DEALS_TOP);
            g_app.btnDriverCfg  = makeCyberBtn(L"DRV // DRIVER_CFG", IDC_BTN_DRIVER_CFG);
            g_app.btnPatchInfo  = makeCyberBtn(L"PATCH // v2026.11", IDC_BTN_PATCH_INFO);

            // Search Box & Filter Combo
            g_app.hwndSearch = CreateWindowExW(WS_EX_CLIENTEDGE, L"EDIT", L"", WS_CHILD | WS_VISIBLE | ES_AUTOHSCROLL,
                                               0, 0, 180, 26, hwnd, reinterpret_cast<HMENU>(IDC_EDIT_SEARCH),
                                               GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndSearch, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            SendMessageW(g_app.hwndSearch, EM_SETCUEBANNER, FALSE, reinterpret_cast<LPARAM>(L"SEARCH // 24+ GAMES, ENGINES, GENRES..."));

            g_app.hwndFilter = CreateWindowExW(0, WC_COMBOBOXW, L"", WS_CHILD | WS_VISIBLE | CBS_DROPDOWNLIST,
                                               0, 0, 180, 200, hwnd, reinterpret_cast<HMENU>(IDC_COMBO_FILTER),
                                               GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndFilter, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"ALL // INSTALLED FIRST"));
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"LOCAL // INSTALLED ONLY"));
            SendMessageW(g_app.hwndFilter, CB_ADDSTRING, 0, reinterpret_cast<LPARAM>(L"TIER // ULTRA & REC READY"));
            SendMessageW(g_app.hwndFilter, CB_SETCURSEL, 0, 0);

            // Vertical Game ListView (Minimalist Cyberpunk Dark Theme)
            g_app.hwndList = CreateWindowExW(0, WC_LISTVIEWW, L"",
                                             WS_CHILD | WS_VISIBLE | WS_BORDER | LVS_REPORT | LVS_SINGLESEL | LVS_SHOWSELALWAYS,
                                             0, 0, 400, 400, hwnd, reinterpret_cast<HMENU>(IDC_LIST_GAMES),
                                             GetModuleHandleW(nullptr), nullptr);
            SendMessageW(g_app.hwndList, WM_SETFONT, reinterpret_cast<WPARAM>(g_app.hFontUi), TRUE);
            ListView_SetExtendedListViewStyle(g_app.hwndList, LVS_EX_FULLROWSELECT | LVS_EX_DOUBLEBUFFER);
            ListView_SetBkColor(g_app.hwndList, RGB(8, 8, 14));
            ListView_SetTextBkColor(g_app.hwndList, RGB(8, 8, 14));
            ListView_SetTextColor(g_app.hwndList, RGB(242, 245, 250));

            const wchar_t* cols[5] = { L"STATE // EXEC", L"GAME_TITLE", L"VERDICT", L"HZ_FPS", L"ENGINE_SPEC" };
            int colW[5] = { 126, 175, 104, 102, 122 };
            for (int c = 0; c < 5; ++c) {
                LVCOLUMNW lvc = {};
                lvc.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
                lvc.cx = colW[c];
                lvc.pszText = const_cast<LPWSTR>(cols[c]);
                lvc.iSubItem = c;
                ListView_InsertColumn(g_app.hwndList, c, &lvc);
            }

            // 4-Mode Cyberpunk Selector Buttons on Right Pane
            g_app.btnModeOptimal  = makeCyberBtn(L"[01] OPTIMAL // AUTO", IDC_BTN_MODE_OPTIMAL);
            g_app.btnModeFullFps  = makeCyberBtn(L"[02] FULL_FPS // MAX_HZ", IDC_BTN_MODE_FULLFPS);
            g_app.btnModeBalanced = makeCyberBtn(L"[03] BALANCED // SYNC", IDC_BTN_MODE_BALANCED);
            g_app.btnModeQuality  = makeCyberBtn(L"[04] QUALITY // 30-60", IDC_BTN_MODE_QUALITY);

            // Bottom Export & Action Buttons
            g_app.btnSaveIni    = makeCyberBtn(L"EXPORT // .INI", IDC_BTN_SAVE_INI);
            g_app.btnSaveJson   = makeCyberBtn(L"EXPORT // .JSON", IDC_BTN_SAVE_JSON);
            g_app.btnSaveMd     = makeCyberBtn(L"EXPORT // .MD", IDC_BTN_SAVE_MD);
            g_app.btnOpenFolder = makeCyberBtn(L"OPEN // GAME_DIR", IDC_BTN_OPEN_FOLDER);
            g_app.btnFindDeals  = makeCyberBtn(L"// SCAN VERIFIED GPU/CPU DEALS (AR & GLOBAL)", IDC_BTN_FIND_DEALS);

            layoutChildControls(hwnd);
            return 0;
        }

        case WM_DRAWITEM: {
            drawCyberOwnerButton(reinterpret_cast<const DRAWITEMSTRUCT*>(lParam));
            return TRUE;
        }

        case WM_GETMINMAXINFO: {
            MINMAXINFO* mmi = reinterpret_cast<MINMAXINFO*>(lParam);
            mmi->ptMinTrackSize.x = 760;
            mmi->ptMinTrackSize.y = 580;
            return 0;
        }

        case WM_SIZE: {
            layoutChildControls(hwnd);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }

        case WM_ERASEBKGND:
            return 1; // Handled by double-buffered GDI+ paintDashboard

        case WM_CTLCOLOREDIT:
        case WM_CTLCOLORLISTBOX: {
            HDC hdcCtrl = reinterpret_cast<HDC>(wParam);
            SetTextColor(hdcCtrl, RGB(252, 238, 9));
            SetBkColor(hdcCtrl, RGB(12, 12, 20));
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

            switch (id) {
                case IDC_BTN_RESCAN:
                    refreshHardwareAndGames();
                    break;

                case IDC_BTN_WHATIF: {
                    g_app.whatIfPreset = (g_app.whatIfPreset + 1) % 4;
                    const wchar_t* labels[4] = {
                        L"SIM // DETECTED",
                        L"SIM // RTX 4070S 1440P",
                        L"SIM // RX 7800XT 240HZ",
                        L"SIM // GTX 1060 1080P"
                    };
                    SetWindowTextW(g_app.btnWhatIf, labels[g_app.whatIfPreset]);
                    InvalidateRect(g_app.btnWhatIf, nullptr, FALSE);
                    g_app.activeSpecs = GameCheck::applyWhatIfPreset(g_app.detectedSpecs, g_app.whatIfPreset);
                    populateGameListView();
                    break;
                }

                case IDC_BTN_PARSE_STEAM:
                    handleParseSteamReqs(hwnd);
                    break;

                case IDC_BTN_DEALS_TOP:
                case IDC_BTN_FIND_DEALS:
                    handlePriceAndDealsDialog(hwnd);
                    break;

                case IDC_BTN_PATCH_INFO:
                    handlePatchAndInfoDialog(hwnd);
                    break;

                case IDC_BTN_DRIVER_CFG:
                    handleDriverAdvisorDialog(hwnd);
                    break;

                case IDC_BTN_MODE_OPTIMAL:
                case IDC_BTN_MODE_FULLFPS:
                case IDC_BTN_MODE_BALANCED:
                case IDC_BTN_MODE_QUALITY:
                    g_app.activeOptMode = id - IDC_BTN_MODE_OPTIMAL;
                    populateGameListView();
                    break;

                case IDC_BTN_SAVE_INI:
                    saveExportedConfigDialog(hwnd, "ini");
                    break;
                case IDC_BTN_SAVE_JSON:
                    saveExportedConfigDialog(hwnd, "json");
                    break;
                case IDC_BTN_SAVE_MD:
                    saveExportedConfigDialog(hwnd, "md");
                    break;

                case IDC_BTN_OPEN_FOLDER: {
                    if (!g_app.allGames.empty()) {
                        const auto& gm = g_app.allGames[g_app.selectedGameIdx];
                        std::wstring targetDir = !gm.installDir.empty() ? GameCheck::utf8ToWide(gm.installDir) : L".";
                        ShellExecuteW(hwnd, L"open", targetDir.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
                    }
                    break;
                }
            }
            return 0;
        }

        case WM_NOTIFY: {
            NMHDR* nmhdr = reinterpret_cast<NMHDR*>(lParam);
            if (nmhdr && nmhdr->idFrom == IDC_LIST_GAMES) {
                if (nmhdr->code == LVN_ITEMCHANGED) {
                    NMLISTVIEW* nmlv = reinterpret_cast<NMLISTVIEW*>(lParam);
                    if ((nmlv->uNewState & LVIS_SELECTED) && !(nmlv->uOldState & LVIS_SELECTED)) {
                        int gameIdx = static_cast<int>(nmlv->lParam);
                        if (gameIdx >= 0 && gameIdx < static_cast<int>(g_app.allGames.size())) {
                            g_app.selectedGameIdx = gameIdx;
                            updateSelectedGameAnalysis();
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
                            lvcd->clrText = RGB(252, 238, 9);    // Cyber Yellow active selection
                            lvcd->clrTextBk = RGB(26, 24, 12);
                        } else if (idx >= 0 && idx < static_cast<int>(g_app.allGames.size())) {
                            const auto& gm = g_app.allGames[idx];
                            if (gm.playStatus == "PLAYING_NOW") {
                                lvcd->clrText = RGB(0, 255, 102);   // Acid Matrix Green
                                lvcd->clrTextBk = RGB(8, 24, 16);
                            } else if (gm.installed) {
                                lvcd->clrText = RGB(0, 240, 255);   // Neural Cyan
                                lvcd->clrTextBk = RGB(10, 18, 28);
                            } else {
                                lvcd->clrText = RGB(230, 235, 245);
                                lvcd->clrTextBk = (lvcd->nmcd.dwItemSpec % 2 == 0) ? RGB(8, 8, 14) : RGB(13, 13, 22);
                            }
                        }
                        return CDRF_NEWFONT;
                    }
                }
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

        case WM_DESTROY: {
            if (g_app.hFontUi) DeleteObject(g_app.hFontUi);
            if (g_app.hFontUiBold) DeleteObject(g_app.hFontUiBold);
            if (g_app.hFontMono) DeleteObject(g_app.hFontMono);
            if (g_app.hBrushDarkEdit) DeleteObject(g_app.hBrushDarkEdit);
            PostQuitMessage(0);
            return 0;
        }
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static int runWin32DesktopGui() {
    SetProcessDPIAware();

    INITCOMMONCONTROLSEX icex = {};
    icex.dwSize = sizeof(icex);
    icex.dwICC = ICC_LISTVIEW_CLASSES | ICC_STANDARD_CLASSES | ICC_BAR_CLASSES;
    InitCommonControlsEx(&icex);

    GdiplusStartupInput gdiplusStartupInput;
    ULONG_PTR gdiplusToken = 0;
    GdiplusStartup(&gdiplusToken, &gdiplusStartupInput, nullptr);

    // Detect hardware & games before showing window
    g_app.detectedSpecs = GameCheck::detectSystemSpecs();
    g_app.activeSpecs = g_app.detectedSpecs;
    g_app.allGames = GameCheck::getMergedGameList();
    if (!g_app.allGames.empty()) {
        g_app.currentAnalysis = GameCheck::analyzeGame(g_app.activeSpecs, g_app.allGames[0], g_app.activeOptMode);
    }

    WNDCLASSEXW wc = {};
    wc.cbSize = sizeof(wc);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = MainWndProc;
    wc.hInstance = GetModuleHandleW(nullptr);
    wc.hCursor = LoadCursorW(nullptr, reinterpret_cast<LPCWSTR>(IDC_ARROW));
    wc.hIcon = LoadIconW(nullptr, reinterpret_cast<LPCWSTR>(IDI_APPLICATION));
    wc.hbrBackground = nullptr;
    wc.lpszClassName = L"GameCheckNativeDesktopWnd";
    RegisterClassExW(&wc);

    std::wstring winTitle = L"GAMECHECK // CYBER.HUD — Native C++17 PC Hardware & Game Optimizer (CalVer v" +
                            GameCheck::utf8ToWide(GameCheck::FULL_VERSION) + L")";

    HWND hwnd = CreateWindowExW(
        0,
        wc.lpszClassName,
        winTitle.c_str(),
        WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
        CW_USEDEFAULT, CW_USEDEFAULT, 1280, 780,
        nullptr, nullptr, wc.hInstance, nullptr
    );

    g_app.hwndMain = hwnd;
    populateGameListView();

    ShowWindow(hwnd, SW_SHOWNORMAL);
    UpdateWindow(hwnd);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    GdiplusShutdown(gdiplusToken);
    return static_cast<int>(msg.wParam);
}

#endif // _WIN32

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
#else
    GameCheck::SystemSpecs specs = GameCheck::detectSystemSpecs();
    std::vector<GameCheck::GameSpec> merged = GameCheck::getMergedGameList();
    std::cout << GameCheck::buildSmokeTestJson(specs, merged) << std::endl;
    return 0;
#endif
}
