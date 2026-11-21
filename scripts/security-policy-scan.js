#!/usr/bin/env node
/**
 * GameCheck Security, Anti-Keylogger, Anti-Spyware & Secret Policy Scanner
 *
 * Runs automatically on every Pull Request and CI build to prevent contributors
 * from introducing keyloggers, process injection, credential stealers, obfuscated
 * malware payloads, or leaked secrets.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SCAN_DIRS = ['native', 'src', 'public', 'scripts'];
const ALLOWED_EXTS = new Set(['.cpp', '.hpp', '.h', '.c', '.js', '.mjs', '.cjs', '.sh', '.bat', '.rc']);
const SELF_FILE = path.resolve(__filename);

const RULES = [
  // 1. Anti-Keylogger / Input-Hook APIs
  {
    id: 'ANTI_KEYLOGGER_WIN32_HOOK',
    category: 'Anti-Keylogger',
    severity: 'CRITICAL',
    pattern: /\b(SetWindowsHookEx[AW]?|WH_KEYBOARD_LL|WH_KEYBOARD|WH_MOUSE_LL)\b/g,
    message: 'Global Windows keyboard/mouse hook API detected (keylogger pattern).'
  },
  {
    id: 'ANTI_KEYLOGGER_KEYSTATE',
    category: 'Anti-Keylogger',
    severity: 'CRITICAL',
    pattern: /\b(GetAsyncKeyState|GetKeyboardState|GetKeyState|RegisterRawInputDevices)\b/g,
    message: 'Low-level keyboard state polling / raw input capture API detected.'
  },
  {
    id: 'ANTI_KEYLOGGER_LINUX_INPUT',
    category: 'Anti-Keylogger',
    severity: 'CRITICAL',
    pattern: /(\/dev\/input\/event|\bXQueryKeymap\b|\bXRecordEnableContext\b|\bkeylogger\b)/gi,
    message: 'Linux input device / X11 keystroke capture pattern detected.'
  },

  // 2. Anti-Process-Injection & Anti-Cheat Safety
  {
    id: 'ANTI_INJECTION_WIN32',
    category: 'Anti-Malware / Injection',
    severity: 'CRITICAL',
    pattern: /\b(WriteProcessMemory|CreateRemoteThread|VirtualAllocEx|NtUnmapViewOfSection|NtWriteVirtualMemory|QueueUserAPC|SetThreadContext)\b/g,
    message: 'Remote process memory injection API detected (malware / anti-cheat violation).'
  },
  {
    id: 'ANTI_INJECTION_LINUX_PTRACE',
    category: 'Anti-Malware / Injection',
    severity: 'CRITICAL',
    pattern: /\bptrace\s*\(\s*PTRACE_(ATTACH|POKETEXT|POKEDATA|SETREGS)/g,
    message: 'Linux ptrace process injection pattern detected.'
  },

  // 3. Anti-Credential-Stealer / Spyware
  {
    id: 'ANTI_SPYWARE_CREDENTIALS',
    category: 'Anti-Spyware',
    severity: 'CRITICAL',
    pattern: /\b(CryptUnprotectData|CredEnumerate[AW]?|LsaRetrievePrivateData|MiniDumpWriteDump)\b/g,
    message: 'OS credential / memory dump API detected (infostealer pattern).'
  },
  {
    id: 'ANTI_SPYWARE_BROWSER_DATA',
    category: 'Anti-Spyware',
    severity: 'CRITICAL',
    pattern: /(Login Data|Web Data|Local State\\|cookies\.sqlite|logins\.json)/gi,
    message: 'Browser credential/cookie database access detected (infostealer pattern).'
  },

  // 4. Anti-Obfuscation & Dynamic Code Execution
  {
    id: 'ANTI_OBFUSCATION_JS_EVAL',
    category: 'Code Security',
    severity: 'HIGH',
    pattern: /\b(eval\s*\(|new\s+Function\s*\(|child_process.*powershell.*-EncodedCommand|-enc\s+[A-Za-z0-9+/=]{20,})/gi,
    message: 'Dynamic eval/Function or encoded PowerShell payload execution detected.'
  },

  // 5. Hardcoded Secrets / API Tokens
  {
    id: 'SECRET_LEAK_TOKEN',
    category: 'Secret Scanning',
    severity: 'CRITICAL',
    pattern: /\b(ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{32,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)\b/g,
    message: 'Potential hardcoded secret, private key, or access token detected.'
  }
];

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (ALLOWED_EXTS.has(path.extname(entry.name).toLowerCase())) {
      if (path.resolve(full) !== SELF_FILE) {
        out.push(full);
      }
    }
  }
  return out;
}

function scanAllFiles() {
  const files = [];
  for (const dirName of SCAN_DIRS) {
    walkFiles(path.join(ROOT_DIR, dirName), files);
  }

  const findings = [];
  for (const filePath of files) {
    const relPath = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const rule of RULES) {
      for (let i = 0; i < lines.length; i++) {
        rule.pattern.lastIndex = 0;
        const match = rule.pattern.exec(lines[i]);
        if (match) {
          findings.push({
            ruleId: rule.id,
            category: rule.category,
            severity: rule.severity,
            file: relPath,
            line: i + 1,
            match: match[0],
            message: rule.message
          });
        }
      }
    }
  }

  return { filesScanned: files.length, findings };
}

function main() {
  console.log('==============================================================');
  console.log('  GameCheck — Anti-Keylogger, Anti-Spyware & Security Scanner');
  console.log('==============================================================');

  const { filesScanned, findings } = scanAllFiles();
  console.log(`Files scanned: ${filesScanned}`);
  console.log(`Policy rules : ${RULES.length}`);

  if (findings.length > 0) {
    console.error(`\n[FAIL] Security policy violations detected (${findings.length}):\n`);
    for (const f of findings) {
      console.error(`  [${f.severity}] ${f.ruleId} (${f.category})`);
      console.error(`    Location: ${f.file}:${f.line}`);
      console.error(`    Matched : ${f.match}`);
      console.error(`    Detail  : ${f.message}\n`);
    }
    process.exit(1);
  }

  console.log('\n[PASS] 0 keylogger, spyware, injection, obfuscation, or secret violations found.');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { scanAllFiles, RULES };
