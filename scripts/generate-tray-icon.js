/**
 * Generate simple tray icons for macOS and Windows
 * macOS: Template image (black on transparent, 16x16 and 32x32)
 * Windows: Regular icon (16x16 and 32x32)
 */

const fs = require('fs');
const path = require('path');

// Simple SVG for tray icon (A character silhouette)
const svgTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple character icon: head + body -->
  <circle cx="8" cy="4" r="3" fill="black"/>
  <path d="M 4 8 Q 8 7 12 8 L 12 14 L 4 14 Z" fill="black"/>
</svg>`;

const svgTemplate32 = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple character icon: head + body (2x scale) -->
  <circle cx="16" cy="8" r="6" fill="black"/>
  <path d="M 8 16 Q 16 14 24 16 L 24 28 L 8 28 Z" fill="black"/>
</svg>`;

const resourcesDir = path.join(__dirname, '../resources');

// Write SVG files
fs.writeFileSync(path.join(resourcesDir, 'trayIconTemplate.svg'), svgTemplate);
fs.writeFileSync(path.join(resourcesDir, 'trayIconTemplate@2x.svg'), svgTemplate32);

console.log('✓ Generated tray icon SVG templates');
console.log('  - trayIconTemplate.svg (16x16)');
console.log('  - trayIconTemplate@2x.svg (32x32)');
console.log('');
console.log('Note: For production, convert SVG to PNG using:');
console.log('  brew install librsvg');
console.log('  rsvg-convert -w 16 -h 16 trayIconTemplate.svg > trayIconTemplate.png');
console.log('  rsvg-convert -w 32 -h 32 trayIconTemplate@2x.svg > trayIconTemplate@2x.png');
