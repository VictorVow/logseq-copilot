import { normalizeBlockTree, BlockRenderer } from './blockTree';

// Stub renderer: mimics the shape of the production `renderBlock` helper
// from ../tool but skips the markdown pipeline so we don't need to load
// the full service import graph (which breaks the esbuild-jest fallback
// transformer in this project). Records a fake html string so tests can
// distinguish rendered vs raw nodes.
const passthroughRender: BlockRenderer = (rawBlock: any) => ({
  uuid: rawBlock.uuid,
  html: `<p>${rawBlock.content ?? ''}</p>`,
  page: rawBlock.page,
  content: rawBlock.content ?? '',
  format: rawBlock.format ?? 'markdown',
  marker: rawBlock.marker ?? '',
  priority: rawBlock.priority ?? '',
});

// Minimal stand-in for a Logseq plugin API BlockEntity. We only need the
// fields that normalizeBlockTree reads: uuid, content, children, and the
// passthroughs the renderer keeps.
// Function name deliberately avoids a four-char substring that the
// esbuild-jest 0.5.0 transformer misidentifies as a jest-mock call and
// routes through a broken babel fallback. See blockTree.ts for the same
// concession on its import of the renderer.
const entity = (overrides: Record<string, any> = {}): any => ({
  uuid: 'root-uuid',
  content: 'root content',
  format: 'markdown',
  marker: '',
  priority: '',
  page: { id: 1, name: 'page', uuid: 'page-uuid' },
  ...overrides,
});

describe('normalizeBlockTree', () => {
  test('returns null for nullish input', () => {
    expect(normalizeBlockTree(null, passthroughRender)).toBeNull();
    expect(normalizeBlockTree(undefined, passthroughRender)).toBeNull();
  });

  test('returns null for a pure block reference', () => {
    const raw = entity({
      content: '[[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]',
    });
    expect(normalizeBlockTree(raw, passthroughRender)).toBeNull();
  });

  test('renders a leaf block with no children and hasChildren=false', () => {
    const result = normalizeBlockTree(entity(), passthroughRender);
    expect(result).not.toBeNull();
    expect(result!.uuid).toBe('root-uuid');
    expect(result!.html).toContain('root content');
    expect(result!.hasChildren).toBe(false);
    expect(result!.children).toBeUndefined();
    expect(result!.collapsed).toBe(false);
  });

  test('recursively normalizes a two-level tree and sets hasChildren at each level', () => {
    const raw = entity({
      content: 'root',
      children: [
        entity({ uuid: 'child-1', content: 'child one' }),
        entity({
          uuid: 'child-2',
          content: 'child two',
          children: [
            entity({ uuid: 'grandchild', content: 'gc' }),
          ],
        }),
      ],
    });
    const result = normalizeBlockTree(raw, passthroughRender)!;
    expect(result.hasChildren).toBe(true);
    expect(result.children).toHaveLength(2);
    expect(result.children![0].uuid).toBe('child-1');
    expect(result.children![0].hasChildren).toBe(false);
    expect(result.children![1].uuid).toBe('child-2');
    expect(result.children![1].hasChildren).toBe(true);
    expect(result.children![1].children).toHaveLength(1);
    expect(result.children![1].children![0].uuid).toBe('grandchild');
    expect(result.children![1].children![0].hasChildren).toBe(false);
  });

  test('prunes the descendants of a collapsed block', () => {
    const raw = entity({
      children: [
        entity({
          uuid: 'collapsed-parent',
          content: 'collapsed parent',
          collapsed: true,
          children: [
            entity({ uuid: 'hidden', content: 'should not appear' }),
          ],
        }),
      ],
    });
    const result = normalizeBlockTree(raw, passthroughRender)!;
    const collapsedChild = result.children![0];
    expect(collapsedChild.uuid).toBe('collapsed-parent');
    expect(collapsedChild.collapsed).toBe(true);
    expect(collapsedChild.hasChildren).toBe(false);
    expect(collapsedChild.children).toBeUndefined();
  });

  test('also honours the `:block/collapsed?` raw datascript keyword', () => {
    const raw = entity({
      ':block/collapsed?': true,
      children: [entity({ uuid: 'hidden', content: 'hidden' })],
    });
    const result = normalizeBlockTree(raw, passthroughRender)!;
    expect(result.collapsed).toBe(true);
    expect(result.hasChildren).toBe(false);
    expect(result.children).toBeUndefined();
  });

  test('drops pure-block-reference children at any depth', () => {
    const raw = entity({
      children: [
        entity({
          uuid: 'ref-child',
          content: '[[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]',
        }),
        entity({ uuid: 'kept', content: 'kept content' }),
      ],
    });
    const result = normalizeBlockTree(raw, passthroughRender)!;
    expect(result.children).toHaveLength(1);
    expect(result.children![0].uuid).toBe('kept');
  });

  test('defensively drops BlockUUIDTuple array-shaped children', () => {
    const raw = entity({
      children: [
        [':uuid', '632093e1-e4e6-4c84-ae91-1f468cfb7fbb'],
        entity({ uuid: 'real-child', content: 'real' }),
      ],
    });
    const result = normalizeBlockTree(raw, passthroughRender)!;
    expect(result.children).toHaveLength(1);
    expect(result.children![0].uuid).toBe('real-child');
  });

  test('strips the raw children array before handing the block to the renderer', () => {
    let received: any;
    const spyRenderer: BlockRenderer = (rawBlock: any) => {
      received = rawBlock;
      return passthroughRender(rawBlock);
    };
    const raw = entity({
      children: [entity({ uuid: 'c', content: 'c' })],
    });
    normalizeBlockTree(raw, spyRenderer);
    expect(received).toBeDefined();
    expect(received.children).toBeUndefined();
  });

  test('leaves hasChildren=false when every child is filtered out', () => {
    const raw = entity({
      children: [
        entity({
          uuid: 'ref-only',
          content: '[[632093e1-e4e6-4c84-ae91-1f468cfb7fbb]]',
        }),
      ],
    });
    const result = normalizeBlockTree(raw, passthroughRender)!;
    expect(result.hasChildren).toBe(false);
    expect(result.children).toBeUndefined();
  });
});
