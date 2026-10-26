const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// 3D body models (assets/avatar/*.glb, built by tools/avatar/build_avatars.py).
config.resolver.assetExts.push("glb");

// three is ESM-only now: its CommonJS entry (picked for `require('three')`, which is what
// react-three-fiber's CJS build and Babel-transpiled imports emit) calls Node's
// process.emitWarning and crashes in React Native. Always resolve the ES module build, which
// also guarantees a single three instance for the app and react-three-fiber.
const THREE_ESM = path.resolve(__dirname, "node_modules/three/build/three.module.js");
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") return { type: "sourceFile", filePath: THREE_ESM };
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
