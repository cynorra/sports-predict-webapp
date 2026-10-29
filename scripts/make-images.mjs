// Generates /public/logo.png and /public/og-default.png from inline SVG (uses sharp, bundled with Astro).
import sharp from 'sharp';
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="96" fill="#0b6e4f"/><circle cx="256" cy="256" r="150" fill="none" stroke="#f5b700" stroke-width="22"/><circle cx="256" cy="256" r="42" fill="#f5b700"/><path d="M256 256 L380 170" stroke="#f5b700" stroke-width="22" stroke-linecap="round"/></svg>`;
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0b6e4f"/><circle cx="1000" cy="315" r="210" fill="none" stroke="#f5b700" stroke-opacity=".35" stroke-width="28"/><text x="80" y="290" font-family="Arial,sans-serif" font-size="96" font-weight="800" fill="#fff">Skor<tspan fill="#f5b700">Radar</tspan></text><text x="80" y="370" font-family="Arial,sans-serif" font-size="40" fill="#e2e8f0">Football predictions, match analysis</text><text x="80" y="425" font-family="Arial,sans-serif" font-size="40" fill="#e2e8f0">and sports news</text></svg>`;
await sharp(Buffer.from(logo)).png().toFile('public/logo.png');
await sharp(Buffer.from(og)).png().toFile('public/og-default.png');
console.log('images written');
