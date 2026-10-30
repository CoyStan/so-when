const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// MUI + Emotion ship mixed ESM/CJS entrypoints; package exports break Metro web.
// React Native 0.88 resolves its own internals through package exports, so
// keep them on for native and turn them off only for web.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const scoped =
    platform === 'web'
      ? { ...context, unstable_enablePackageExports: false }
      : context;
  return upstreamResolveRequest
    ? upstreamResolveRequest(scoped, moduleName, platform)
    : scoped.resolveRequest(scoped, moduleName, platform);
};
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Agent skill packs are not app source; watching them can crash Metro mid-install.
config.watchFolders = config.watchFolders?.filter(Boolean) ?? [];
config.resolver.blockList = [
  /(^|\/)\.agents\/.*/,
  /(^|\/)\.cursor\/.*/,
];

module.exports = withNativeWind(config, { input: './global.css' });
