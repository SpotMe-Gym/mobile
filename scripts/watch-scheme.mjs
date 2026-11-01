#!/usr/bin/env node
/**
 * Adds a shared "SpotMeWatch" scheme to ios/SpotMe.xcodeproj, so the watch app can be built
 * and run on the Apple Watch (from Xcode or `bun run ios`). `expo prebuild` only creates the
 * iPhone app's scheme and `prebuild --clean` deletes any scheme made by hand, so this runs after
 * every prebuild.
 *
 *   node scripts/watch-scheme.mjs [target name, default SpotMeWatch]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The Xcode project in ios/ (SpotMe.xcodeproj). */
export function findXcodeProject(iosDir) {
  const name = fs.existsSync(iosDir) && fs.readdirSync(iosDir).find((f) => f.endsWith('.xcodeproj'));
  return name ? path.join(iosDir, name) : null;
}

/** The target's id in project.pbxproj, or null if the project has no such target. */
export function findTargetId(pbxproj, target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(
    `([0-9A-F]{24}|XX[0-9A-F]{20}XX) /\\* ${escaped} \\*/ = \\{\\s*isa = PBXNativeTarget;`,
  ).exec(pbxproj);
  return m ? m[1] : null;
}

export function schemeXml({ id, target, container }) {
  const ref = `<BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${id}"
               BuildableName = "${target}.app"
               BlueprintName = "${target}"
               ReferencedContainer = "container:${container}">
            </BuildableReference>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            ${ref}
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         ${ref}
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         ${ref}
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
`;
}

/** Writes the scheme; returns its path, or null if there's no ios/ project or no watch target. */
export function writeWatchScheme({ iosDir = path.join(root, 'ios'), target = 'SpotMeWatch' } = {}) {
  const project = findXcodeProject(iosDir);
  if (!project) return null;
  const id = findTargetId(fs.readFileSync(path.join(project, 'project.pbxproj'), 'utf8'), target);
  if (!id) return null;
  const dir = path.join(project, 'xcshareddata', 'xcschemes');
  fs.mkdirSync(dir, { recursive: true });
  // Schemes Xcode made by hand ("SpotMeWatch 1") would show up twice in the scheme menu.
  for (const f of fs.readdirSync(dir)) {
    if (new RegExp(`^${target} \\d+\\.xcscheme$`).test(f)) fs.rmSync(path.join(dir, f));
  }
  const file = path.join(dir, `${target}.xcscheme`);
  fs.writeFileSync(file, schemeXml({ id, target, container: path.basename(project) }));
  return file;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = writeWatchScheme({ target: process.argv[2] ?? 'SpotMeWatch' });
  if (file) console.log(`› Watch scheme: ${path.relative(root, file)}`);
  else console.log('› No watch target in ios/ yet (run `bun run prebuild` first).');
}
