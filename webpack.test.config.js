const path = require("path");

module.exports = {
  mode: "development",
  entry: "./test/index.ts",
  output: {
    path: path.resolve(__dirname, "test"),
    filename: "test-bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: "node_modules/",
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
};
