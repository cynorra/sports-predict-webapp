// Bibliography gate: every guide and analysis needs a "## Sources" section with named, deep-linked references.
// Principle (AGENTS.md top rule): numbers and rules need a named public source. A bare homepage link is not a source.
// Pure function (no I/O) so it can be unit-tested.

/** @param {string} body markdown body of a post @returns {string[]} error messages (empty = ok) */
export function checkSources(body) {
  const m = /^## Sources\s*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m.exec(body);
  if (!m) return ['missing "## Sources" section (list the public sources the facts come from)'];
  const section = m[1];
  const items = section.split('\n').filter((l) => /^\s*[-*]\s/.test(l) || /^\s*\d+\.\s/.test(l));
  const errors = [];
  if (items.length < 3) errors.push(`Sources section has ${items.length} items (min 3)`);
  const urls = [...section.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((x) => x[1]);
  const parsed = urls.map((u) => { try { return new URL(u); } catch { return null; } }).filter(Boolean);
  const deep = parsed.filter((u) => u.pathname.replace(/\/$/, '').length > 1);
  if (deep.length < 3) errors.push(`only ${deep.length} deep source link(s) in Sources (min 3; a homepage is not a source)`);
  const nonWiki = parsed.filter((u) => !/wikipedia\.org$/.test(u.hostname));
  if (nonWiki.length < 1) errors.push('Sources are all Wikipedia: add at least one primary source (rule book, regulation, paper or data provider)');
  const noDesc = items.filter((l) => l.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/[-*\d.\s,;:]/g, '').length < 15);
  if (noDesc.length) errors.push(`${noDesc.length} source item(s) have no description of what they support`);
  return errors;
}
