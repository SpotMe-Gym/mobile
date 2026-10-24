module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 54) injects react-native-worklets/plugin automatically when
  // react-native-worklets is installed, so it must not be listed here a second time.
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
