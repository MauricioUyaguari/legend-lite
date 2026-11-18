// Spike 11: builds main.js with legend-studio's own webpack, naming files as its production build does
// (legend-dev-utils/WebpackConfigUtils.js), so the page can be served and `await window.probe()` run in a browser.
//
//   node build.cjs <legend-studio root, built> <planner package dir: bazel-bin/wasm/planner_package> <out dir>
//   python3 -m http.server 8791 --bind 127.0.0.1 --directory <out dir>
//
// What it shows: the worker and the runtime are emitted as files of their own (minified, not bundled), the module
// under a hashed name, and nothing of the planner is fetched before the first request.
const path = require('path');
const [studio, plannerPackage, out] = process.argv.slice(2).map((p) => path.resolve(p));
const webpack = require(path.join(studio, 'node_modules/webpack'));
const HtmlWebpackPlugin = require(path.join(studio, 'node_modules/html-webpack-plugin'));
webpack({
  mode: 'production',
  entry: path.resolve(__dirname, 'main.js'),
  output: {
    path: out,
    assetModuleFilename: 'static/[name].[contenthash:8].[ext]',
    filename: 'static/[name].[contenthash:8].js',
    publicPath: './',
    clean: true,
  },
  resolve: {
    alias: {
      '@probe/planner': path.join(studio, 'packages/legend-application-data-cube/lib/stores/planner'),
      // an exact-match alias per file the package exports, standing for an installed package
      '@legend-lite/planner-wasm/classes.wasm$': path.join(plannerPackage, 'classes.wasm'),
      '@legend-lite/planner-wasm/wasm-gc-module-runtime.js$': path.join(plannerPackage, 'wasm-gc-module-runtime.js'),
    },
    modules: [path.join(studio, 'node_modules')],
  },
  module: { rules: [{ test: /\.(?:woff2?|ttf|otf|eot|svg|png|gif|wasm)$/, type: 'asset/resource' }] },
  experiments: { asyncWebAssembly: true },
  plugins: [new HtmlWebpackPlugin({ title: 'planner probe' })],
}, (err, stats) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(stats.toString({ colors: false, modules: false, chunks: false, assets: true }));
  process.exit(stats.hasErrors() ? 1 : 0);
});
