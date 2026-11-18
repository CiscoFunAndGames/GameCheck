const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.join(__dirname, '..');

/**
 * Parses a CalVer string (`YYYY.MM.DD`, `YYYY.MM.DD.PATCH`, `YYYY.MM.DD-PATCH`, `vYYYY.MM.DD`)
 */
function parseCalVer(str) {
  if (!str || typeof str !== 'string') {
    return { valid: false };
  }
  const cleaned = str.trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:[.-](\d+))?$/);
  if (!match) {
    return { valid: false };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const patchLevel = match[4] !== undefined ? parseInt(match[4], 10) : 0;

  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || patchLevel < 0) {
    return { valid: false };
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const calver = `${year}.${mm}.${dd}`;
  const fullVersion = patchLevel > 0 ? `${calver}.${patchLevel}` : calver;
  const npmVersion = patchLevel > 0 ? `${calver}-${patchLevel}` : calver;

  return {
    valid: true,
    year,
    month,
    day,
    patchLevel,
    calver,
    fullVersion,
    npmVersion
  };
}

/**
 * Formats a Date object or date string into a CalVer string `YYYY.MM.DD` or `YYYY.MM.DD.PATCH`
 */
function formatCalVer(dateInput = new Date(), patchLevel = 0) {
  let year;
  let month;
  let day;

  if (typeof dateInput === 'string') {
    const parsed = parseCalVer(dateInput);
    if (parsed.valid) {
      year = parsed.year;
      month = parsed.month;
      day = parsed.day;
      if (patchLevel === 0 && parsed.patchLevel > 0) {
        patchLevel = parsed.patchLevel;
      }
    } else {
      const d = new Date(dateInput);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
  } else if (dateInput instanceof Date) {
    year = dateInput.getFullYear();
    month = dateInput.getMonth() + 1;
    day = dateInput.getDate();
  } else {
    const d = new Date();
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const base = `${year}.${mm}.${dd}`;
  return patchLevel > 0 ? `${base}.${patchLevel}` : base;
}

/**
 * Compares two CalVer strings (`a` and `b`).
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
function compareCalVer(a, b) {
  const pa = typeof a === 'object' && a !== null && a.valid ? a : parseCalVer(String(a || ''));
  const pb = typeof b === 'object' && b !== null && b.valid ? b : parseCalVer(String(b || ''));

  if (!pa.valid && !pb.valid) return 0;
  if (!pa.valid) return -1;
  if (!pb.valid) return 1;

  if (pa.year !== pb.year) return pa.year > pb.year ? 1 : -1;
  if (pa.month !== pb.month) return pa.month > pb.month ? 1 : -1;
  if (pa.day !== pb.day) return pa.day > pb.day ? 1 : -1;
  if (pa.patchLevel !== pb.patchLevel) return pa.patchLevel > pb.patchLevel ? 1 : -1;
  return 0;
}

/**
 * Reads the current CalVer metadata from `version.json`
 */
function getVersionInfo(appRootDir = DEFAULT_ROOT) {
  const versionFilePath = path.join(appRootDir, 'version.json');
  try {
    if (fs.existsSync(versionFilePath)) {
      const raw = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
      const parsed = parseCalVer(raw.fullVersion || raw.calver || '2026.11.17');
      const patchLevel = typeof raw.patchLevel === 'number' ? raw.patchLevel : (parsed.patchLevel || 0);
      const calver = raw.calver || parsed.calver || '2026.11.17';
      const fullVersion = raw.fullVersion || (patchLevel > 0 ? `${calver}.${patchLevel}` : calver);
      const npmVersion = raw.npmVersion || (patchLevel > 0 ? `${calver}-${patchLevel}` : calver);
      const gitTag = raw.gitTag || `v${fullVersion}`;
      const history = Array.isArray(raw.history) ? raw.history : [];
      return {
        calver,
        npmVersion,
        patchLevel,
        fullVersion,
        gitTag,
        scheme: raw.scheme || 'YYYY.MM.DD[.PATCH]',
        channel: raw.channel || 'stable',
        releasedAt: raw.releasedAt || new Date().toISOString(),
        notes: raw.notes || `CalVer ${fullVersion} Release`,
        history
      };
    }
  } catch (e) {
    // fallback below
  }

  return {
    calver: '2026.11.17',
    npmVersion: '2026.11.17-1',
    patchLevel: 1,
    fullVersion: '2026.11.17.1',
    gitTag: 'v2026.11.17.1',
    scheme: 'YYYY.MM.DD[.PATCH]',
    channel: 'stable',
    releasedAt: new Date().toISOString(),
    notes: 'CalVer 2026.11.17.1 Native Desktop Release',
    history: []
  };
}

/**
 * Bumps or sets the CalVer version in `version.json` (and optionally `package.json`).
 */
function bumpCalVer(options = {}) {
  const {
    mode = 'date',
    targetCalVer = null,
    notes = null,
    customDate = null,
    channel = null,
    appRootDir = DEFAULT_ROOT,
    updatePackageJson = true
  } = options;

  const current = getVersionInfo(appRootDir);
  let nextCalver = current.calver;
  let nextPatch = current.patchLevel || 0;

  if (mode === 'set' || targetCalVer) {
    const parsed = parseCalVer(targetCalVer || customDate || '');
    if (!parsed.valid) {
      throw new Error(`Invalid CalVer string: "${targetCalVer || customDate}"`);
    }
    nextCalver = parsed.calver;
    nextPatch = parsed.patchLevel;
  } else if (mode === 'patch' || mode === 'bump-patch') {
    nextPatch = (current.patchLevel || 0) + 1;
  } else {
    // mode === 'date' / 'bump'
    const candidateDate = formatCalVer(customDate || new Date(), 0);
    if (candidateDate === current.calver) {
      nextPatch = (current.patchLevel || 0) + 1;
    } else {
      nextCalver = candidateDate;
      nextPatch = 0;
    }
  }

  const fullVersion = nextPatch > 0 ? `${nextCalver}.${nextPatch}` : nextCalver;
  const npmVersion = nextPatch > 0 ? `${nextCalver}-${nextPatch}` : nextCalver;
  const gitTag = `v${fullVersion}`;
  const releasedAt = new Date().toISOString();
  const resolvedNotes = notes || `CalVer ${fullVersion} update`;

  const prevHistory = Array.isArray(current.history) ? current.history.slice() : [];
  const newHistoryEntry = {
    version: fullVersion,
    calver: nextCalver,
    patchLevel: nextPatch,
    gitTag,
    releasedAt,
    notes: resolvedNotes
  };
  const updatedHistory = [
    newHistoryEntry,
    ...prevHistory.filter((h) => h && h.version !== fullVersion)
  ];

  const updated = {
    calver: nextCalver,
    npmVersion,
    patchLevel: nextPatch,
    fullVersion,
    gitTag,
    scheme: 'YYYY.MM.DD[.PATCH]',
    channel: channel || current.channel || 'stable',
    releasedAt,
    notes: resolvedNotes,
    history: updatedHistory
  };

  const versionFilePath = path.join(appRootDir, 'version.json');
  fs.writeFileSync(versionFilePath, JSON.stringify(updated, null, 2) + '\n', 'utf8');

  if (updatePackageJson) {
    const pkgPath = path.join(appRootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = npmVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      } catch (e) {
        // ignore package.json write errors if locked
      }
    }
  }

  return updated;
}

module.exports = {
  getVersionInfo,
  formatCalVer,
  parseCalVer,
  compareCalVer,
  bumpCalVer
};
