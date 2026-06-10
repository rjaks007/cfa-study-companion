// Post-process the Expo web export (dist/) to add an iOS/Android home-screen
// icon and PWA metadata. Expo's web export does not emit an apple-touch-icon,
// so iOS "Add to Home Screen" falls back to an ugly page screenshot. We copy
// the app icon into dist/ and inject the right <head> tags + a web manifest.
//
// Runs after `expo export -p web` (see netlify.toml build command).

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const indexPath = join(dist, "index.html");
const iconSrc = join(root, "assets", "icon.png");

if (!existsSync(indexPath)) {
  console.error("[inject-web-icons] dist/index.html not found — did expo export run?");
  process.exit(1);
}
if (!existsSync(iconSrc)) {
  console.error("[inject-web-icons] assets/icon.png not found.");
  process.exit(1);
}

// Copy the app icon into the web root.
copyFileSync(iconSrc, join(dist, "icon.png"));

// A minimal PWA manifest (used by Android/Chrome "Install app").
const manifest = {
  name: "CFA Study Companion",
  short_name: "CFA Study",
  display: "standalone",
  background_color: "#f6f8fb",
  theme_color: "#f6f8fb",
  icons: [
    { src: "/icon.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" },
  ],
};
writeFileSync(join(dist, "manifest.webmanifest"), JSON.stringify(manifest));

const headTags = [
  '<link rel="apple-touch-icon" href="/icon.png" />',
  '<link rel="icon" type="image/png" href="/icon.png" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="apple-mobile-web-app-title" content="CFA Study" />',
  '<meta name="theme-color" content="#f6f8fb" />',
].join("\n    ");

let html = readFileSync(indexPath, "utf8");

if (html.includes("apple-touch-icon")) {
  console.log("[inject-web-icons] icon tags already present — skipping.");
} else {
  // Insert just before </head>.
  html = html.replace("</head>", `    ${headTags}\n  </head>`);
  writeFileSync(indexPath, html);
  console.log("[inject-web-icons] injected icon + PWA tags into dist/index.html");
}
