// In DB graphs, `logseq.Editor.getBlock` resolves page refs in content
// (`[[uuid]]` -> `[[Page Name]]`) but leaves block refs as `[[uuid]]`
// because Logseq only auto-resolves page references in a block's title.
// A block whose entire content is therefore still `[[uuid]]` after that
// lookup is a pure block reference -- the referenced block is already
// its own search hit, so rendering the reference block on top of it
// just produces a duplicate result that shows up as a bare UUID in the
// sidebar.
const PURE_BLOCK_REFERENCE_RE =
  /^\s*\[\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]\]\s*$/i;

export const isPureBlockReference = (
  content: string | undefined | null,
): boolean =>
  typeof content === 'string' && PURE_BLOCK_REFERENCE_RE.test(content);
