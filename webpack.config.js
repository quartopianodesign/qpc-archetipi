const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');

const isDev = process.env.NODE_ENV === 'development';

// su CodePen gli SVG arrivano dal repo GitHub via jsDelivr
const CDN_DIR = 'https://cdn.jsdelivr.net/gh/quartopianodesign/qpc-archetipi@main/src/archetipi/';

// src/index.html è l'unico template: da qui escono dist/index.html e il markup per CodePen
const template = './src/index.html';
const bodyOf = file => fs.readFileSync(file, 'utf8')
  .match(/<body>\n*([\s\S]*?)\s*<\/body>/)[1]
  .replace(/^ {2}/gm, '') + '\n';

// build del sito: dist/index.html + app.min.js + app.min.css + archetipi/, gsap incluso
const site = {
  name: 'site',
  entry: { app: ['./src/js/app.js', './src/scss/style.scss'] },
  devtool: isDev ? 'source-map' : false,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].min.js',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.s?css$/i, use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'] },
    ],
  },
  optimization: {
    minimizer: [new CssMinimizerPlugin(), new TerserPlugin({ extractComments: false })],
  },
  plugins: [
    new webpack.ProvidePlugin({ gsap: ['gsap', 'gsap'] }),
    new MiniCssExtractPlugin({ filename: '[name].min.css' }),
    new HtmlWebpackPlugin({ template, minify: false }),
    new CopyPlugin({ patterns: [{ from: 'src/archetipi', to: 'archetipi' }] }),
    ...(isDev ? [new BrowserSyncPlugin({
      server: { baseDir: './dist' },
      port: 3000,
      files: ['dist/*'],
      notify: false,
    })] : []),
  ],
};

// build per CodePen: markup + script leggibile, gsap dalla CDN del pen
// (style.css lo compila sass dopo webpack, vedi "build" in package.json)
const codepen = {
  name: 'codepen',
  entry: './src/js/app.js',
  devtool: false,
  output: {
    path: path.resolve(__dirname, 'codepen'),
    filename: 'script.js',
    clean: true,
  },
  optimization: { minimize: false },
  plugins: [
    new HtmlWebpackPlugin({
      templateContent: () => bodyOf(template).replace("dir: 'archetipi/'", `dir: '${CDN_DIR}'`),
      inject: false,
      minify: false,
    }),
  ],
};

module.exports = isDev ? site : [site, codepen];
