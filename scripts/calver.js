#!/usr/bin/env node
const { getVersionInfo, bumpCalVer, parseCalVer } = require('../src/version');

function runCalVerCli() {
  const args = process.argv.slice(2);
  const cmd = (args[0] || 'status').toLowerCase();

  if (cmd === 'status') {
    const info = getVersionInfo();
    if (args.includes('--json')) {
      console.log(JSON.stringify(info, null, 2));
      return;
    }
    console.log('==============================================================');
    console.log('   RIGCHECK OPTIMIZER — CALVER VERSION STATUS');
    console.log('==============================================================');
    console.log(`CalVer Date   : ${info.calver}`);
    console.log(`Patch Level   : .${info.patchLevel}`);
    console.log(`Full Version  : ${info.fullVersion}`);
    console.log(`Git Tag       : ${info.gitTag}`);
    console.log(`NPM Version   : ${info.npmVersion}`);
    console.log(`Scheme        : ${info.scheme}`);
    console.log(`Channel       : ${info.channel}`);
    console.log(`Released At   : ${info.releasedAt}`);
    console.log(`Release Notes : ${info.notes}`);
    if (Array.isArray(info.history) && info.history.length > 0) {
      console.log(`Release Hist. : ${info.history.length} release(s) tracked`);
    }
    console.log('==============================================================');
    return;
  }

  if (cmd === 'bump') {
    const notes = args.slice(1).join(' ') || undefined;
    const updated = bumpCalVer({ mode: 'date', notes });
    console.log(`[CalVer] Bumped version to ${updated.fullVersion} (${updated.releasedAt})`);
    return;
  }

  if (cmd === 'bump-patch' || cmd === 'patch') {
    const notes = args.slice(1).join(' ') || undefined;
    const updated = bumpCalVer({ mode: 'patch', notes });
    console.log(`[CalVer] Bumped patch level to ${updated.fullVersion} (${updated.releasedAt})`);
    return;
  }

  if (cmd === 'set') {
    const target = args[1];
    if (!target || !parseCalVer(target).valid) {
      console.error('Usage: node scripts/calver.js set <YYYY.MM.DD[.PATCH]> [notes]');
      process.exit(1);
    }
    const notes = args.slice(2).join(' ') || undefined;
    const updated = bumpCalVer({ mode: 'set', targetCalVer: target, notes });
    console.log(`[CalVer] Set version to ${updated.fullVersion}`);
    return;
  }

  console.error(`Unknown command "${cmd}". Supported: status | bump | bump-patch | set <YYYY.MM.DD>`);
  process.exit(1);
}

if (require.main === module) {
  runCalVerCli();
}

module.exports = { runCalVerCli };
