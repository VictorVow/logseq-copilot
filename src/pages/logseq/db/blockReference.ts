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

// Replace every `((uuid))` and `[[uuid]]` in content with a markdown
// link whose visible text is the plain-text label from `refMap` and
// whose href is a `logseq://` URI pointing at the referenced block.
// This way when the content is later parsed by marked, the link
// navigates to the block in Logseq desktop rather than to whatever
// external URL the target block's first line happened to contain.
// Unknown uuids are left as-is so the user still sees the raw ref
// when a target can't be fetched.
export const resolveBlockReferences = (
  content: string,
  refMap: Map<string, string>,
  graph: string,
): string => {
  if (typeof content !== 'string' || content.length === 0) return content;
  const swap = (match: string) => {
    const uuidMatch = match.match(EXTRACT_UUID_RE);
    if (!uuidMatch) return match;
    const uuid = uuidMatch[1].toLowerCase();
    const label = refMap.get(uuid);
    if (!label) return match;
    return `[${label}](logseq://graph/${graph}?block-id=${uuid})`;
  };
  return content
    .replace(BLOCK_REF_PAREN_RE, swap)
    .replace(BLOCK_REF_BRACKET_RE, swap);
};

// Strip the common markdown / Logseq inline syntaxes out of a string
// so only the human-readable text remains. Used when building a
// block-reference label -- the result gets spliced back into another
// block's content, which is then re-parsed by marked, so the label
// must not carry structural markup that could be cut in half by
// truncation and leave an unbalanced `](` or `[[` behind.
const stripInlineMarkupForLabel = (line: string): string => {
  return (
    line
      // Drop image embeds entirely.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // Markdown link `[text](url)` -> text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Logseq page ref `[[Page]]` -> Page
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Logseq block ref `((uuid))` -> drop (one-level resolution only).
      .replace(/\(\([^)]+\)\)/g, '')
      // Inline code / emphasis / strikethrough -> inner text
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      // Collapse any whitespace runs introduced by stripped tokens.
      .replace(/\s+/g, ' ')
      .trim()
  );
};

// Turn a block's full content into a short, single-line, plain-text
// label. The label is used as the visible text inside a
// `[label](logseq://...)` markdown link generated by
// `resolveBlockReferences`, so it must not carry any markdown syntax
// of its own — otherwise truncation or nesting could produce broken
// tokens that trip up marked on the parent block.
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

  const stripped = stripInlineMarkupForLabel(firstLine);
  // Fall back to the raw line if stripping ate everything (first line
  // was a lone image or block ref with no prose).
  const label = stripped.length > 0 ? stripped : firstLine;
  const max = 80;
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + '\u2026';
};
