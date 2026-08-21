// Renders every icon target from the single vector master, AppIcon-source.svg:
//   - the iOS asset catalog (Assets.xcassets/AppIcon.appiconset/)
//   - the PWA icons and apple-touch-icon the web app serves (public/icons/)
// Requires the `playwright` package and a Chromium browser.
// Run with: node scripts/generate-app-icon.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const assetsRoot = path.join(repoRoot, 'Assets.xcassets');
const svg = fs.readFileSync(path.join(assetsRoot, 'AppIcon-source.svg'), 'utf8');

const appiconset = path.join(assetsRoot, 'AppIcon.appiconset');
const webIcons = path.join(repoRoot, 'public', 'icons');

// Unique pixel sizes in Apple's iOS AppIcon table (iPhone/iPad notification,
// settings, spotlight, app, and marketing slots), plus the web targets.
const targets = [
  ...[20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024].map((px) => ({
    px,
    out: path.join(appiconset, `icon-${px}.png`),
  })),
  { px: 192, out: path.join(webIcons, 'icon-192.png') },
  { px: 512, out: path.join(webIcons, 'icon-512.png') },
  // iOS uses exactly 180x180 for the home-screen icon of an installed web app.
  { px: 180, out: path.join(webIcons, 'apple-touch-icon.png') },
];

(async () => {
  for (const dir of [appiconset, webIcons]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const browser = await chromium.launch();
  for (const { px, out } of targets) {
    const page = await browser.newPage({
      viewport: { width: px, height: px },
      deviceScaleFactor: 1,
    });
    await page.setContent(`<!doctype html><html><head><style>
      html,body{margin:0;padding:0;}
      svg{display:block;width:${px}px;height:${px}px;}
    </style></head><body>${svg}</body></html>`);
    const svgEl = await page.$('svg');
    await svgEl.screenshot({ path: out });
    await page.close();
    console.log(`wrote ${path.relative(repoRoot, out)}`);
  }
  await browser.close();
})();
