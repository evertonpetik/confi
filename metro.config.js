// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow .tflite files to be bundled as assets (native only)
config.resolver.assetExts.push("tflite");

module.exports = config;
