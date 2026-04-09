// In DB graphs, `logseq.Editor.getBlock` resolves page refs in content
// (`[[uuid]]` -> `[[Page Name]]`) but leaves block refs as `[[uuid]]`
// because Logseq only auto-resolves page references in a block's title.
// A block whose entire content is therefore still `[[uuid]]` after that
// lookup is a pure block reference -- the referenced block is already
// its own search hit, so rendering the reference block on top of it
// just produces a duplicate result that shows up as a bare UUID in the
// sidebar.
const UUID_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const PURE_BLOCK_REFERENCE_RE = new RegExp(
  `^\\s*\\[\\[${UUID_SRC}\\]\\]\\s*$`,
  'i',
);

// Inline `((uuid))` block references. Unlike pure refs these can live
// anywhere in a block's content ("see ((uuid)) for details") and need
// to be resolved to their target's first line so the sidebar doesn't
// show a wall of raw UUIDs when rendering fetched child trees.
const BLOCK_REF_PAREN_RE = new RegExp(`\\(\\(${UUID_SRC}\\)\\)`, 'gi');

// Inline `[[uuid]]` references. Logseq's plugin API resolves `[[Page
// Name]]` but leaves UUID-shaped page-style links untouched, so if a
// `[[uuid]]` survived round-trip it is almost certainly a block-scope
// reference that the UI also needs to resolve.
const BLOCK_REF_BRACKET_RE = new RegExp(`\\[\\[${UUID_SRC}\\]\\]`, 'gi');

// Extract a UUID out of a full match like `((uuid))` or `[[uuid]]`.
const EXTRACT_UUID_RE = new RegExp(`(${UUID_SRC})`, 'i');

export const isPureBlockReference = (
  content: string | undefined | null,
): boolean =>
  typeof content === 'string' && PURE_BLOCK_REFERENCE_RE.test(content);

// Walks a content string and returns all uuids referenced via
// `((uuid))` or `[[uuid]]`. The result is lowercased and de-duplicated
// so callers can feed it straight into a `Set` and fan out one fetch
// per unique referent.
export const collectBlockReferenceUuids = (
  content: string | undefined | null,
): string[] => {
  if (typeof content !== 'string' || content.length === 0) return [];
  const uuids = new Set<string>();
  for (const match of content.matchAll(BLOCK_REF_PAREN_RE)) {
    const uuid = match[0].match(EXTRACT_UUID_RE);
    if (uuid) uuids.add(uuid[1].toLowerCase());
  }
  for (const match of content.matchAll(BLOCK_REF_BRACKET_RE)) {
    const uuid = match[0].match(EXTRACT_UUID_RE);
    if (uuid) uuids.add(uuid[1].toLowerCase());
  }
  return Array.from(uuids);
};

// Replace every `((uuid))` and `[[uuid]]` in content with the label
// stored in `refMap` for that uuid. Unknown uuids are left as-is so
// the user still sees *something* even when a reference target can't
// be fetched.
export const resolveBlockReferences = (
  content: string,
  refMap: Map<string, string>,
): string => {
  if (typeof content !== 'string' || content.length === 0) return content;
  const swap = (match: string) => {
    const uuid = match.match(EXTRACT_UUID_RE);
    if (!uuid) return match;
    const label = refMap.get(uuid[1].toLowerCase());
    return label ?? match;
  };
  return content
    .replace(BLOCK_REF_PAREN_RE, swap)
    .replace(BLOCK_REF_BRACKET_RE, swap);
};

// Turn a block's full content into a short, single-line label suitable
// for inlining in place of a `((uuid))` reference. Mirrors what Logseq
// desktop shows for block-ref previews: first non-empty line, trimmed,
// and capped so deeply-nested refs don't blow out the sidebar width.
export const blockReferenceLabel = (
  content: string | undefined | null,
): string => {
  if (typeof content !== 'string') return '';
  const lines = content.split('\n');
  let firstLine = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      firstLine = trimmed;
      break;
    }
  }
  if (firstLine.length === 0) return '';
  const max = 80;
  if (firstLine.length <= max) return firstLine;
  return firstLine.slice(0, max - 1) + '\u2026';
};
