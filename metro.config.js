const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * pdfjs-dist's legacy CommonJS build statically `require`s a handful of
 * Node.js-only modules (`fs`, `http`, `https`, `url`, `zlib`, `canvas`,
 * `path2d-polyfill`). Those are only reachable in Node-specific code paths that
 * React Native never executes, but Metro still tries to *resolve* them at bund
 * time. We redirect any such require that originates inside pdfjs-dist to a
 * lightweight stub so the bundle builds without shipping Node APIs.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      const fromPdfjs =
        context.originModulePath &&
        context.originModulePath.indexOf(
          path.sep + 'pdfjs-dist' + path.sep,
        ) !== -1;

      if (fromPdfjs) {
        const nodeOnly = new Set([
          'canvas',
          'fs',
          'http',
          'https',
          'path2d-polyfill',
          'url',
          'zlib',
        ]);
        if (nodeOnly.has(moduleName)) {
          return {
            type: 'sourceFile',
            filePath: path.resolve(
              __dirname,
              'src/__metro_stubs__/pdfjs-node-stub.js',
            ),
          };
        }
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
