const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname);

// 3D body models (assets/avatar/*.glb, built by tools/avatar/build_avatars.py).
config.resolver.assetExts.push("glb");

module.exports = withNativeWind(config, { input: "./src/global.css" });
