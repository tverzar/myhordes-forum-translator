// Copies the shared source (content script, options page, translation
// providers) into the firefox/ and chrome/ packages. Each package keeps its
// own manifest.json and background.js (they differ: MV2 background page vs
// MV3 service worker), everything else is a byte-for-byte copy of shared/.

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const TARGETS = ["firefox", "chrome"];

const COPIES = [
  ["shared/content/content.js", "content/content.js"],
  ["shared/content/content.css", "content/content.css"],
  ["shared/options/options.html", "options/options.html"],
  ["shared/options/options.js", "options/options.js"],
  ["shared/options/options.css", "options/options.css"],
  ["shared/background/providers.js", "background/providers.js"]
];

for (const target of TARGETS) {
  for (const [src, dest] of COPIES) {
    const srcPath = path.join(ROOT, src);
    const destPath = path.join(ROOT, target, dest);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log(`${target}: ${src} -> ${target}/${dest}`);
  }
}

console.log("Done.");
