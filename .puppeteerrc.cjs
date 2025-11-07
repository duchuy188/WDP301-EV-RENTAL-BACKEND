const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Change cache directory to be inside project
  // This ensures Chrome is available at runtime on Render
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};

