#!/usr/bin/env node
/**
 * `bun run ios`: one command that builds SpotMe for your iPhone and the SpotMe app for your
 * Apple Watch, installs both, and starts Metro.
 *
 *   bun run ios                    Debug: live reload from this Mac (iPhone on the same Wi-Fi)
 *   bun run ios:release            Release: JS bundled in, works away from the Mac (the gym)
 *   bun run ios -- --clean         regenerate ios/ first
 *   bun run ios -- --no-watch      iPhone only
 *   bun run ios -- --device "Damiano's iPhone"   pick the iPhone (name or id)
 *   bun run ios -- --watch "Damiano's Apple Watch"
 *   bun run ios:sim                the simulator instead (expo run:ios)
 *
 * What it takes care of, so nothing has to be set up by hand in Xcode:
 *   - `bun install`, and `expo prebuild` when the native config changed since the last one
 *     (app.json, app.config.ts, packages, native modules, the watch target, .env.local's
 *     EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN), plus the SpotMeWatch scheme prebuild doesn't make;
 *   - signing with the team in app.json, registering the iPhone and the watch with it (the
 *     "integrity could not be verified" error on the watch is an unregistered watch);
 *   - installing the watch app on the watch directly instead of waiting for the iPhone to.
 * The full build log is in logs/ios-build.log.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeWatchScheme } from './watch-scheme.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

// ── options ────────────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
if (flag('--help') || flag('-h')) {
  const doc = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0];
  console.log(doc.replace(/^#!.*\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''));
  process.exit(0);
}
const release = flag('--release');
const configuration = release ? 'Release' : 'Debug';
const wantWatch = !flag('--no-watch');

const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const bundleId = appJson.ios.bundleIdentifier;
const team = appJson.ios.appleTeamId;
const iosDir = path.join(root, 'ios');
const derivedData = path.join(iosDir, 'build', 'DerivedData');
const logFile = path.join(root, 'logs', 'ios-build.log');
const statePath = path.join(root, '.expo', 'spotme-ios.json');

// ── output ─────────────────────────────────────────────────────────────────────────────────

const tty = process.stdout.isTTY;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c('1');
const dim = c('2');
const red = c('31');
const green = c('32');
const yellow = c('33');

const step = (s) => console.log(`\n${bold('›')} ${bold(s)}`);
const info = (s) => console.log(`  ${s}`);
const warn = (s) => console.log(`  ${yellow('!')} ${s}`);
const ok = (s) => console.log(`  ${green('✓')} ${s}`);
function fail(message, hints = []) {
  console.log(`\n${red('✗')} ${bold(message)}`);
  for (const h of hints) console.log(`  → ${h}`);
  process.exit(1);
}

// ── small helpers ──────────────────────────────────────────────────────────────────────────

const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
};
const writeState = (patch) => {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ ...readState(), ...patch }, null, 2));
};

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}

function have(cmd) {
  return sh('/usr/bin/which', [cmd]).status === 0;
}

/** One value from .env.local / .env (the ones that change the native build). */
function envValue(key) {
  if (process.env[key] !== undefined) return process.env[key];
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue;
    const m = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm').exec(fs.readFileSync(f, 'utf8'));
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

// ── 1. native project ──────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'android', 'build', 'Assets.xcassets', '.DS_Store'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * What ios/ is generated from. Config files count by content; source files (Swift, ObjC) by
 * name only, since a new or removed file needs pod install / prebuild but an edit doesn't.
 */
function nativeFingerprint() {
  const h = createHash('sha256');
  const config = /\.(json|js|cjs|mjs|ts|plist|entitlements|podspec|rb)$/;
  const files = [
    'app.json',
    'app.config.ts',
    'package.json',
    'bun.lock',
    ...walk('targets'),
    ...walk('modules'),
    ...walk('plugins'),
  ].filter((f) => fs.existsSync(f));
  for (const f of files.sort()) {
    h.update(f);
    if (config.test(f) && !/\.test\.|__tests__/.test(f)) h.update(fs.readFileSync(f));
  }
  h.update(`apple-sign-in=${envValue('EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN')}`);
  return h.digest('hex').slice(0, 16);
}

function ensureNativeProject() {
  step('Dependencies');
  if (have('bun')) {
    const r = spawnSync('bun', ['install'], { stdio: ['ignore', 'pipe', 'inherit'] });
    if (r.status !== 0) fail('bun install failed.');
    ok('bun install');
  }

  const fingerprint = nativeFingerprint();
  const hasProject =
    fs.existsSync(path.join(iosDir, 'Pods')) && fs.existsSync(path.join(iosDir, 'SpotMe.xcworkspace'));
  const state = readState();
  const reasons = [];
  if (flag('--clean')) reasons.push('--clean');
  else if (!hasProject) reasons.push('ios/ is missing');
  else if (state.fingerprint !== fingerprint) reasons.push('native config changed since the last prebuild');

  if (reasons.length) {
    step(`Prebuild (${reasons.join(', ')})`);
    const r = spawnSync('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean'], {
      stdio: 'inherit',
      env: { ...process.env, CI: '1' },
    });
    if (r.status !== 0) {
      fail('expo prebuild failed.', [
        'If CocoaPods failed: `cd ios && pod repo update && cd ..` then run this again.',
      ]);
    }
    writeState({ fingerprint });
  } else {
    ok('ios/ is up to date');
  }
  const scheme = writeWatchScheme({ iosDir });
  if (!scheme && wantWatch) warn('No SpotMeWatch target in ios/: building the iPhone app only.');
  return Boolean(scheme);
}

// ── 2. devices ─────────────────────────────────────────────────────────────────────────────

function listDevices() {
  const out = path.join(os.tmpdir(), `spotme-devices-${process.pid}.json`);
  const r = sh('xcrun', ['devicectl', 'list', 'devices', '--json-output', out]);
  if (r.status !== 0 || !fs.existsSync(out)) return [];
  try {
    const json = JSON.parse(fs.readFileSync(out, 'utf8'));
    return (json.result?.devices ?? [])
      .filter((d) => d.hardwareProperties?.reality === 'physical')
      .map((d) => ({
        id: d.identifier,
        udid: d.hardwareProperties?.udid,
        name: d.deviceProperties?.name ?? 'Unknown device',
        platform: d.hardwareProperties?.platform,
        os: d.deviceProperties?.osVersionNumber,
        devMode: d.deviceProperties?.developerModeStatus,
        paired: d.connectionProperties?.pairingState === 'paired',
        connected: d.connectionProperties?.tunnelState === 'connected',
        transport: d.connectionProperties?.transportType,
      }));
  } catch {
    return [];
  } finally {
    fs.rmSync(out, { force: true });
  }
}

function pick(devices, platform, wanted) {
  const list = devices.filter((d) => d.platform === platform);
  if (wanted) {
    const w = wanted.toLowerCase();
    return list.find((d) => [d.name, d.udid, d.id].some((v) => v?.toLowerCase() === w));
  }
  return list.find((d) => d.paired && d.connected) ?? list.find((d) => d.paired) ?? list[0];
}

// ── 3. build ───────────────────────────────────────────────────────────────────────────────

const HINTS = [
  [
    /No Accounts?|No account for team|not signed in/i,
    'Xcode › Settings › Accounts: sign in with your Apple ID, then run this again.',
  ],
  [
    /Sign in with Apple|com\.apple\.developer\.applesignin/i,
    "A free Personal Team can't use Sign in with Apple: set EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN=false in .env.local (this script then rebuilds ios/ by itself).",
  ],
  [
    /Push Notifications|aps-environment/i,
    "Push isn't available on a Personal Team: run `bun run ios -- --clean` to rebuild ios/ without it.",
  ],
  [
    /maximum number of (registered )?devices|device limit/i,
    'The Apple ID has reached its device limit: remove an old device at developer.apple.com, or wait for it to expire.',
  ],
  [
    /maximum App ID|limit on the number of App IDs|App ID.*limit/i,
    'A free team can create 10 App IDs a week: reuse the existing bundle id, or wait a few days.',
  ],
  [
    /Developer Mode/i,
    'Turn on Developer Mode on the device: Settings › Privacy & Security › Developer Mode, then restart it.',
  ],
  [/locked|passcode/i, 'Unlock the iPhone (and the watch) and keep them unlocked during the build.'],
  [
    /Unable to find a destination|not available|is not connected|Timed out waiting/i,
    'Keep the iPhone unlocked and on the same Wi-Fi (or a cable), and the watch on your wrist or charger near it.',
  ],
  [
    /Command PhaseScriptExecution failed/i,
    'A build script failed (often the JS bundle in Release): the lines above the error in the log say which.',
  ],
];

/** Runs xcodebuild, logging everything to logs/ios-build.log and showing progress + errors. */
function xcodebuild(label, args, { timeoutMs = 30 * 60_000 } = {}) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile, { flags: 'a' });
  log.write(`\n\n=== ${new Date().toISOString()} ${label}\n$ xcodebuild ${args.join(' ')}\n`);
  return new Promise((resolve) => {
    const child = spawn('xcodebuild', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const errors = new Set();
    let compiled = 0;
    let last = '';
    const started = Date.now();
    const show = () => {
      if (!tty) return;
      const sec = Math.round((Date.now() - started) / 1000);
      process.stdout.write(
        `\r\x1b[2K  ${dim(`${label}: ${compiled} files · ${sec}s ${last}`.slice(0, 110))}`,
      );
    };
    const timer = setInterval(show, 500);
    const timeout = setTimeout(() => {
      errors.add(`Timed out after ${Math.round(timeoutMs / 60_000)} minutes.`);
      child.kill('SIGTERM');
    }, timeoutMs);
    let buf = '';
    const onData = (chunk) => {
      log.write(chunk);
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (/^(CompileC|SwiftCompile|CompileSwift|Ld|CompileAssetCatalog) /.test(line)) compiled++;
        if (/^(ProcessProductPackaging|CodeSign|PhaseScriptExecution) /.test(line))
          last = `· ${line.split(' ')[0]}`;
        if (
          /(^|\s)error: |^xcodebuild: error|\*\* BUILD FAILED|requires a provisioning profile|No profiles for/.test(
            line,
          )
        ) {
          errors.add(line.trim().replace(/^.*?error: /, ''));
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      clearInterval(timer);
      clearTimeout(timeout);
      log.end();
      if (tty) process.stdout.write('\r\x1b[2K');
      const sec = Math.round((Date.now() - started) / 1000);
      if (code === 0) ok(`${label} (${sec}s)`);
      resolve({ ok: code === 0, errors: [...errors].filter((e) => !/BUILD FAILED/.test(e)) });
    });
  });
}

function hintsFor(errors) {
  const text = errors.join('\n');
  return HINTS.filter(([re]) => re.test(text)).map(([, h]) => h);
}

function reportErrors(errors) {
  for (const e of errors.slice(0, 12)) console.log(`  ${red('error')} ${e}`);
  if (errors.length > 12) console.log(dim(`  … ${errors.length - 12} more`));
}

const signing = () => [
  '-allowProvisioningUpdates',
  '-allowProvisioningDeviceRegistration',
  ...(team ? [`DEVELOPMENT_TEAM=${team}`] : []),
];

// ── 4. install / launch ────────────────────────────────────────────────────────────────────

function devicectl(args) {
  const r = sh('xcrun', ['devicectl', ...args]);
  return { ok: r.status === 0, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

function metroRunning() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: 8081, path: '/status', timeout: 1000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve(body.includes('packager-status:running')));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function launch(phone) {
  const r = devicectl([
    'device',
    'process',
    'launch',
    '--device',
    phone.id,
    '--terminate-existing',
    bundleId,
  ]);
  if (r.ok) return ok(`SpotMe opened on ${phone.name}`);
  if (/Locked|locked/.test(r.out)) return warn('Unlock the iPhone and open SpotMe.');
  if (/trust|profile has not been explicitly trusted|invalid code signature/i.test(r.out)) {
    return warn(
      `iOS hasn't trusted your developer certificate yet: on the iPhone open Settings › General › VPN & Device Management › ${team ? 'your Apple ID' : 'the developer'} › Trust, then open SpotMe.`,
    );
  }
  warn("Couldn't open SpotMe automatically: open it on the iPhone.");
}

// ── run ────────────────────────────────────────────────────────────────────────────────────

async function main() {
  if (process.platform !== 'darwin') fail('Building for iOS needs a Mac with Xcode.');
  if (!have('xcodebuild'))
    fail('Xcode command line tools not found.', [
      'Install Xcode, then `sudo xcode-select -s /Applications/Xcode.app`.',
    ]);
  console.log(bold(`SpotMe · iOS ${configuration}`) + dim(`  (full log: ${path.relative(root, logFile)})`));
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, '');

  // Devices first: no point in a 5-minute build if the iPhone isn't there.
  step('Devices');
  const devices = listDevices();
  const phone = pick(devices, 'iOS', option('--device'));
  if (!phone) {
    fail(option('--device') ? `No iPhone called "${option('--device')}".` : 'No iPhone found.', [
      'Connect it with a cable the first time (afterwards Wi-Fi is enough), unlock it and tap Trust.',
      `Seen: ${devices.map((d) => `${d.name} (${d.platform})`).join(', ') || 'nothing'}.`,
      'For the simulator: bun run ios:sim',
    ]);
  }
  if (phone.devMode && phone.devMode !== 'enabled') {
    fail(`Developer Mode is off on ${phone.name}.`, [
      'On the iPhone: Settings › Privacy & Security › Developer Mode › On, restart, and confirm.',
    ]);
  }
  ok(`iPhone: ${phone.name}${phone.os ? ` (iOS ${phone.os})` : ''}`);

  let watch = wantWatch ? pick(devices, 'watchOS', option('--watch')) : undefined;
  if (wantWatch && !watch) {
    warn(
      'No Apple Watch found: building the iPhone app only. (Pair the watch with this iPhone, and keep it unlocked near it.)',
    );
  }
  if (watch && watch.devMode && watch.devMode !== 'enabled') {
    warn(
      `Developer Mode is off on ${watch.name}: on the watch, Settings › Privacy & Security › Developer Mode › On, restart. Skipping the watch for now.`,
    );
    watch = undefined;
  }
  if (watch) ok(`Watch: ${watch.name}${watch.os ? ` (watchOS ${watch.os})` : ''}`);

  const hasWatchTarget = ensureNativeProject();
  if (!hasWatchTarget) watch = undefined;

  const common = [
    '-workspace',
    path.join('ios', 'SpotMe.xcworkspace'),
    '-configuration',
    configuration,
    '-derivedDataPath',
    derivedData,
  ];

  // The watch app is signed with a profile that must list the watch, so register the watch by
  // building for it once (per watch, per fresh ios/). Afterwards the iPhone build embeds it.
  if (watch && !readState().watchReady?.[watch.udid]) {
    step(`Registering ${watch.name} for signing (first time only)`);
    info(
      dim(
        'Xcode may spend a few minutes preparing the watch: keep it unlocked, on the charger, near the iPhone.',
      ),
    );
    const r = await xcodebuild(
      'Watch app',
      [...common, '-scheme', 'SpotMeWatch', '-destination', `id=${watch.udid}`, ...signing(), 'build'],
      { timeoutMs: 20 * 60_000 },
    );
    if (r.ok) {
      writeState({ watchReady: { ...readState().watchReady, [watch.udid]: true } });
    } else {
      reportErrors(r.errors);
      for (const h of hintsFor(r.errors)) info(`→ ${h}`);
      warn('Continuing with the iPhone app; the watch app can be installed on the next run.');
      watch = undefined;
    }
  }

  step(`Building SpotMe for ${phone.name}`);
  const build = await xcodebuild('iPhone app', [
    ...common,
    '-scheme',
    'SpotMe',
    '-destination',
    `id=${phone.udid}`,
    ...signing(),
    'build',
  ]);
  if (!build.ok) {
    reportErrors(build.errors);
    fail('The iPhone build failed.', [
      ...hintsFor(build.errors),
      `Full log: ${path.relative(root, logFile)}`,
    ]);
  }

  const appPath = path.join(derivedData, 'Build', 'Products', `${configuration}-iphoneos`, 'SpotMe.app');
  const watchApp = path.join(appPath, 'Watch', 'SpotMeWatch.app');

  step('Installing');
  const inst = devicectl(['device', 'install', 'app', '--device', phone.id, appPath]);
  if (!inst.ok) {
    console.log(dim(inst.out.trim().split('\n').slice(-6).join('\n')));
    fail(`Couldn't install on ${phone.name}.`, ['Unlock the iPhone and run this again.']);
  }
  ok(`SpotMe installed on ${phone.name}`);

  if (watch && fs.existsSync(watchApp)) {
    info(dim(`Sending the watch app to ${watch.name} (can take a minute)…`));
    const w = devicectl(['device', 'install', 'app', '--device', watch.id, watchApp]);
    if (w.ok) ok(`SpotMe installed on ${watch.name}`);
    else {
      if (/integrity|verify|profile/i.test(w.out))
        writeState({ watchReady: { ...readState().watchReady, [watch.udid]: false } });
      console.log(dim(w.out.trim().split('\n').slice(-4).join('\n')));
      warn(
        "The watch didn't take it directly. On the iPhone open the Watch app › General › scroll to SpotMe › Install (or run `bun run ios` again with the watch unlocked).",
      );
    }
  }

  if (release) {
    launch(phone);
    console.log(
      `\n${green('Done.')} The Release build runs without this Mac. Free Apple IDs sign it for 7 days: run \`bun run ios:release\` again after that.`,
    );
    return;
  }

  // Debug: the app loads its JavaScript from Metro on this Mac.
  step('Metro');
  if (await metroRunning()) {
    ok('Metro is already running');
    launch(phone);
    return;
  }
  const metro = spawn('npx', ['expo', 'start', '--port', '8081'], { stdio: 'inherit' });
  for (let i = 0; i < 120 && !(await metroRunning()); i++) await new Promise((r) => setTimeout(r, 500));
  launch(phone);
  metro.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => fail(e?.message ?? String(e)));
