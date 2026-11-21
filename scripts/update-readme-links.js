#!/usr/bin/env node
/**
 * Updates direct Windows & Linux installer download links in README.md
 * to match the current release version in version.json (or --tag / --calver).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const README_PATH = path.join(ROOT_DIR, 'README.md');
const VERSION_PATH = path.join(ROOT_DIR, 'version.json');
const REPO_URL = 'https://github.com/CiscoFunAndGames/GameCheck/releases/download';

function updateReadmeDownloadLinks(tag, calver) {
  if (!fs.existsSync(README_PATH)) return false;
  let content = fs.readFileSync(README_PATH, 'utf8');
  const cleanTag = tag.startsWith('v') ? tag : `v${tag}`;

  const winExe = `GameCheck-Setup-${calver}.exe`;
  const linSh  = `gamecheck-installer-${calver}.sh`;
  const winZip = `GameCheck-App-Payload-${calver}.zip`;

  const winExeUrl = `${REPO_URL}/${cleanTag}/${winExe}`;
  const linShUrl  = `${REPO_URL}/${cleanTag}/${linSh}`;
  const winZipUrl = `${REPO_URL}/${cleanTag}/${winZip}`;

  const updated = content
    .replace(
      /\[`GameCheck-Setup-[^`]+\.exe`\]\([^)]+\)/g,
      `[\`${winExe}\`](${winExeUrl})`
    )
    .replace(
      /\[`gamecheck-installer-[^`]+\.sh`\]\([^)]+\)/g,
      `[\`${linSh}\`](${linShUrl})`
    )
    .replace(
      /\[`GameCheck-App-Payload-[^`]+\.zip`\]\([^)]+\)/g,
      `[\`${winZip}\`](${winZipUrl})`
    )
    .replace(
      /\*\*`GameCheck-Setup-[^`]+\.exe`\*\*/g,
      `**\`${winExe}\`**`
    )
    .replace(
      /\*\*`gamecheck-installer-[^`]+\.sh`\*\*/g,
      `**\`${linSh}\`**`
    )
    .replace(
      /`GameCheck-Setup-[^`]+\.exe`/g,
      `\`${winExe}\``
    )
    .replace(
      /`gamecheck-installer-[^`]+\.sh`/g,
      `\`${linSh}\``
    );

  if (updated !== content) {
    fs.writeFileSync(README_PATH, updated, 'utf8');
    return true;
  }
  return false;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let tag = '';
  let calver = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) tag = args[++i];
    if (args[i] === '--calver' && args[i + 1]) calver = args[++i];
  }
  if (!tag || !calver) {
    const v = JSON.parse(fs.readFileSync(VERSION_PATH, 'utf8'));
    tag = tag || `v${v.fullVersion}`;
    calver = calver || v.calver;
  }
  const changed = updateReadmeDownloadLinks(tag, calver);
  console.log(`README.md download links ${changed ? 'updated' : 'already up to date'} for ${tag} (${calver})`);
}

module.exports = { updateReadmeDownloadLinks };
