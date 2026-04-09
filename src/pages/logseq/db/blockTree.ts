import { LogseqBlockType } from '../../../types/logseqBlock';
import { isPureBlockReference } from './blockReference';

// Caller-supplied per-node render function. In production this wraps
// `renderBlock` from ../tool (markdown -> html); in tests it is usually a
// pass-through stub so the tree walker can be exercised without pulling
// in the `marked` / service layer import graph.
export type BlockRenderer = (rawBlock: any) => LogseqBlockType;

// Logseq's plugin API may expose the block's collapsed state as either a
// bare `collapsed` boolean (plugin shape) or the raw datascript keyword
// `:block/collapsed?` (DB graph raw shape). Check both, prefer the
// plugin shape, and coerce to a strict boolean so downstream code can
// rely on `=== true`.
const readCollapsed = (rawBlock: any): boolean => {
  if (typeof rawBlock?.collapsed === 'boolean') return rawBlock.collapsed;
  const keyword = rawBlock?.[':block/collapsed?'];
  if (typeof keyword === 'boolean') return keyword;
  return false;
};

// Walk a raw Logseq BlockEntity (possibly with a nested `children` array)
// and return it normalized to our LogseqBlockType tree. Three rules:
//   1. Pure block references (`[[uuid]]`-only content) are dropped at
//      every level, just like the top-level search filter in db/service.ts.
//   2. Collapsed blocks are kept but their descendants are dropped,
//      matching how the Logseq desktop app renders collapsed outlines.
//   3. `hasChildren` is populated at every level from the final,
//      post-filter children count so the UI can decide whether to show
//      a nested toggle button without any additional checks.
//
// `render` receives the raw block with its raw `children` array already
// stripped, and is expected to return a LogseqBlockType (typically by
// delegating to `renderBlock` from the shared tool module). Returns
// `null` for blocks that should not be rendered (pure refs, nullish
// input), so callers can `.filter(Boolean)` the results of a map.
export function normalizeBlockTree(
  rawBlock: any,
  render: BlockRenderer,
): LogseqBlockType | null {
  if (!rawBlock) return null;
  if (isPureBlockReference(rawBlock?.content)) return null;

  const collapsed = readCollapsed(rawBlock);
  const rawChildren = Array.isArray(rawBlock.children) ? rawBlock.children : [];

  // Strip the raw children array before handing off so unnormalized
  // nested entities can't leak back out through the returned LogseqBlockType.
  delete rawBlock.children;
  const rendered: LogseqBlockType = render(rawBlock);
  rendered.collapsed = collapsed;

  if (collapsed) {
    // Matches Logseq desktop: the collapsed block itself is visible,
    // but its descendants are hidden. We intentionally do not recurse.
    rendered.hasChildren = false;
    rendered.children = undefined;
    return rendered;
  }

  const normalizedChildren: LogseqBlockType[] = [];
  for (const rawChild of rawChildren) {
    // With `includeChildren: true` the plugin API is supposed to return
    // full BlockEntity objects, but the type union (BlockEntity |
    // BlockUUIDTuple) allows plain `[":uuid", "..."]` arrays too. Drop
    // those defensively rather than feeding them into the renderer.
    if (Array.isArray(rawChild)) continue;
    const child = normalizeBlockTree(rawChild, render);
    if (child) normalizedChildren.push(child);
  }

  if (normalizedChildren.length > 0) {
    rendered.children = normalizedChildren;
    rendered.hasChildren = true;
  } else {
    rendered.children = undefined;
    rendered.hasChildren = false;
  }

  return rendered;
}
