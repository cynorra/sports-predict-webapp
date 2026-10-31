// Image gates for posts (ported into `npm run audit`). Pure function: file access is injected so it can be unit-tested.
// Rules: every post has an own cover (SVG + PNG twin for social cards), real alt text, figures with captions and
// explicit width/height (no layout shift), and small files.
const HERO_RE = /^image:\s*\n\s+src:\s*"([^"]*)"\s*\n\s+alt:\s*"([^"]*)"/m;
const MAX_SVG = 80_000, MAX_PNG = 200_000;
const attr = (tag, name) => (new RegExp(String.raw`\b${name}="([^"]*)"`, 'i').exec(tag) || [])[1];

/**
 * @param {{ fm: string, raw: string, minFigures: number, fileSize: (publicPath: string) => number | null }} p
 * @returns {string[]} error messages (empty = ok)
 */
export function checkImages({ fm, raw, minFigures, fileSize }) {
  const errors = [];
  const hero = HERO_RE.exec(fm);
  if (!hero) return ['missing cover image: add image.src and image.alt to the front matter'];
  const [, src, alt] = hero;
  if (!/^\/images\/[a-z0-9-]+\.svg$/.test(src)) errors.push(`cover src must be /images/<slug>.svg (got ${src})`);
  if (alt.length < 30 || alt.length > 160) errors.push(`cover alt is ${alt.length} chars (want 30-160)`);
  if (/^(image|picture|photo|graphic) of\b/i.test(alt)) errors.push('cover alt should describe the content, not start with "image of"');
  const svg = fileSize(src);
  if (svg == null) errors.push(`cover file missing: public${src} (run npm run images)`);
  else if (svg > MAX_SVG) errors.push(`cover SVG is ${svg} bytes (max ${MAX_SVG})`);
  const png = fileSize(src.replace(/\.svg$/, '.png'));
  if (png == null) errors.push(`social-card PNG missing: public${src.replace(/\.svg$/, '.png')} (run npm run images)`);
  else if (png > MAX_PNG) errors.push(`social-card PNG is ${png} bytes (max ${MAX_PNG})`);

  if (/!\[[^\]]*\]\(/.test(raw)) errors.push('markdown image syntax found: use <figure><img ... width height><figcaption> so size and caption are explicit');
  for (const tag of raw.match(/<img\b[^>]*>/gi) || []) {
    const s = attr(tag, 'src') ?? '';
    const a = attr(tag, 'alt') ?? '';
    if (a.length < 30) errors.push(`figure alt too short (${a.length} chars, want 30+): ${s}`);
    if (!attr(tag, 'width') || !attr(tag, 'height')) errors.push(`figure needs width and height attributes: ${s}`);
    if (attr(tag, 'loading') !== 'lazy') errors.push(`in-article figure should use loading="lazy": ${s}`);
    if (!s.startsWith('/images/')) errors.push(`figure must be a local /images/ file: ${s}`);
    else {
      const size = fileSize(s);
      if (size == null) errors.push(`figure file missing: public${s}`);
      else if (size > MAX_SVG) errors.push(`figure is ${size} bytes (max ${MAX_SVG}): ${s}`);
    }
  }
  const figures = (raw.match(/<figure\b/gi) || []).length;
  const captions = (raw.match(/<figcaption\b/gi) || []).length;
  if (captions !== figures) errors.push(`${figures} figure(s) but ${captions} figcaption(s): every figure needs a caption`);
  if (figures < minFigures) errors.push(`${figures} in-article figure(s) (min ${minFigures})`);
  return errors;
}
