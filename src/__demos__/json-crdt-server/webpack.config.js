const path = require('path');

const plugins = [];

module.exports = {
  devtool: false,
  mode: 'production',
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
    global: false,
  },
  entry: {
    index: path.join(__dirname, 'main-http1'),
  },
  output: {
    libraryTarget: 'commonjs',
    filename: '[name].js',
    path: path.join(__dirname, '..', '..', '..', 'dist', 'demo-server'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          compilerOptions: {
            target: 'es6',
            module: 'commonjs',
            downlevelIteration: false,
            noEmitHelpers: false,
          },
        },
      },
      {
        test: /\.md$/i,
        use: 'raw-loader',
      },
    ],
  },
  plugins,
};
