// Regenerates Assets.xcassets/AppIcon.appiconset/*.png from AppIcon-source.svg.
// Requires the `playwright` package and a Chromium browser to be installed.
// Run with: node scripts/generate-app-icon.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'Assets.xcassets');
const svg = fs.readFileSync(path.join(root, 'AppIcon-source.svg'), 'utf8');
const outDir = path.join(root, 'AppIcon.appiconset');

// Unique pixel sizes required by the Apple iOS AppIcon.appiconset table
// (iPhone/iPad notification, settings, spotlight, app, and marketing slots).
const sizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];

(async () => {
  const browser = await chromium.launch();
  for (const px of sizes) {
    const page = await browser.newPage({
      viewport: { width: px, height: px },
      deviceScaleFactor: 1,
    });
    await page.setContent(`<!doctype html><html><head><style>
      html,body{margin:0;padding:0;}
      svg{display:block;width:${px}px;height:${px}px;}
    </style></head><body>${svg}</body></html>`);
    const svgEl = await page.$('svg');
    await svgEl.screenshot({ path: path.join(outDir, `icon-${px}.png`) });
    await page.close();
    console.log(`wrote icon-${px}.png`);
  }
  await browser.close();
})();
