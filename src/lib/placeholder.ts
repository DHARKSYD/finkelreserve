/**
 * A tasteful stand-in bottle for products that don't have a photo yet.
 *
 * Returned as an SVG data URI so it works anywhere an image URL does (cards,
 * product page, cart, emails' fallbacks) with no network request, no hotlinked
 * stock photo and no layout change. The colour follows the wine style so an
 * unphotographed catalog still reads as a range, not a wall of identical grey boxes.
 */
const STYLES: Record<string, { glass: string; glassDark: string; foil: string }> = {
  red: { glass: "#4a1522", glassDark: "#1d070c", foil: "#6b1f2c" },
  white: { glass: "#b8c27a", glassDark: "#7d8a45", foil: "#c9a24b" },
  rose: { glass: "#e0a0a6", glassDark: "#b8636e", foil: "#c9847f" },
  sparkling: { glass: "#3d4a2a", glassDark: "#1c2412", foil: "#c9a24b" },
  dessert: { glass: "#8a5a22", glassDark: "#4d2f0f", foil: "#6b1f2c" },
  fortified: { glass: "#6e3a1a", glassDark: "#3a1d0b", foil: "#6b1f2c" },
  whiskey: { glass: "#b36b1c", glassDark: "#5e3408", foil: "#3a2a14" },
  cognac: { glass: "#8f4a1a", glassDark: "#47220a", foil: "#3a2a14" },
  gin: { glass: "#8fb5b0", glassDark: "#4d7773", foil: "#2f4a4a" },
  vodka: { glass: "#b9c4cc", glassDark: "#6f7f8a", foil: "#2f3d47" },
  rum: { glass: "#6e3a1a", glassDark: "#3a1d0b", foil: "#c9a24b" },
  tequila: { glass: "#d6b660", glassDark: "#8a7230", foil: "#3a4a2a" },
  liqueur: { glass: "#7a2f4a", glassDark: "#3d1425", foil: "#c9a24b" },
  beer: { glass: "#c98a1e", glassDark: "#7a5010", foil: "#3a2a14" },
  non_alcoholic: { glass: "#7f9a6a", glassDark: "#46603a", foil: "#2f4a2a" },
  mixers: { glass: "#6f93ad", glassDark: "#3d5f78", foil: "#2f4a5f" },
};

export function bottlePlaceholder(productType?: string | null): string {
  const s = STYLES[productType ?? ""] ?? STYLES.red;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" role="img" aria-label="Bottle">
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#fbf7ef"/><stop offset="1" stop-color="#eadfcf"/></radialGradient>
<linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="${s.glassDark}"/><stop offset=".35" stop-color="${s.glass}"/><stop offset="1" stop-color="${s.glassDark}"/></linearGradient>
</defs>
<rect width="400" height="520" fill="url(#bg)"/>
<ellipse cx="200" cy="486" rx="70" ry="9" fill="#000" opacity=".12"/>
<rect x="183" y="30" width="34" height="62" rx="4" fill="${s.foil}"/>
<rect x="183" y="30" width="34" height="9" rx="3" fill="#fff" opacity=".18"/>
<path d="M186 92h28v82c0 30 38 38 38 88v206c0 12-8 20-20 20h-64c-12 0-20-8-20-20V262c0-50 38-58 38-88z" fill="url(#glass)"/>
<rect x="154" y="316" width="92" height="122" rx="3" fill="#f6efe4"/>
<rect x="160" y="322" width="80" height="110" rx="2" fill="none" stroke="${s.foil}" stroke-width="1.5" opacity=".55"/>
<text x="200" y="372" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" font-weight="700" fill="${s.foil}">F</text>
<text x="200" y="398" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="9" letter-spacing="3" fill="${s.foil}">FINKEL</text>
<rect x="166" y="404" width="68" height="1.2" fill="${s.foil}" opacity=".5"/>
<path d="M170 250c-4 70-4 190 0 262" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".14" fill="none"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
