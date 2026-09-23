const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * The game core lives in ../engine, shared with the video renderer. Files there are compiled with
 * helpers (@babel/runtime) that must resolve from this app's node_modules.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [path.resolve(__dirname, '../engine')],
  resolver: { nodeModulesPaths: [path.resolve(__dirname, 'node_modules')] },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
