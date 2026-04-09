import { LogseqBlockType, LogseqPageIdenity } from '../../../types/logseqBlock';
import LogseqClient from './client';
import { renderBlock } from '../tool';
import { LogseqServiceInterface } from '../interfaces';
import {
  isPureBlockReference,
  collectBlockReferenceUuids,
  resolveBlockReferences,
  blockReferenceLabel,
} from './blockReference';
import { normalizeProperties } from './blockProperties';
import { normalizeBlockTree } from './blockTree';

export default class LogseqDBService implements LogseqServiceInterface {
  public client: LogseqClient = new LogseqClient();

  public async getGraph() {
    return (await this.client.getGraph()).name.replace('logseq_db_', '');;
  }

  public async showMsg(message: string) {
    return await this.client.showMsg(message);
  }

  public async getVersion() {
    return ((await this.client.getVersion()) as any).version;
  }

  // Fetch each uuid referenced by `((uuid))` / `[[uuid]]` in parallel
  // and build a lowercase-keyed label map suitable for
  // `resolveBlockReferences`. Missing or unreachable targets are
  // silently dropped so the caller's resolver falls through to the raw
  // ref for those entries.
  private async buildBlockRefMap(
    uuids: Iterable<string>,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniqueUuids = new Set<string>();
    for (const uuid of uuids) {
      if (typeof uuid === 'string' && uuid.length > 0) {
        uniqueUuids.add(uuid.toLowerCase());
      }
    }
    if (uniqueUuids.size === 0) return map;
    await Promise.all(
      Array.from(uniqueUuids).map(async (uuid) => {
        try {
          const refBlock = await this.client.getBlockViaUuid(uuid, {
            includeChildren: false,
          });
          if (refBlock && typeof refBlock.content === 'string') {
            const label = blockReferenceLabel(refBlock.content);
            if (label.length > 0) {
              map.set(uuid, label);
            }
          }
        } catch {
          // Unknown or unreachable target -- leave it out of the map.
        }
      }),
    );
    return map;
  }

  // Collect every uuid referenced by `((uuid))` / `[[uuid]]` inside the
  // content of a raw Logseq block tree. Walks children recursively so a
  // single search of the full subtree yields the full fan-out for a
  // single `buildBlockRefMap` call.
  private collectTreeBlockReferenceUuids(rawNodes: any[]): Set<string> {
    const uuids = new Set<string>();
    const visit = (node: any) => {
      if (!node || Array.isArray(node)) return;
      for (const uuid of collectBlockReferenceUuids(node.content)) {
        uuids.add(uuid);
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) visit(child);
      }
    };
    for (const node of rawNodes) visit(node);
    return uuids;
  }

  private async searchGraph(graphName: string, query: string) {
    const resp = await this.client.search(query);
    const response: {
      blocks: LogseqBlockType[];
      pages: LogseqPageIdenity[];
      count: number;
      graph: string;
    } = {
      blocks: [],
      pages: [],
      count: 0,
      graph: graphName,
    };

    // Logseq 2.x search returns a flat `blocks` array where page results
    // are flagged with `page?: true` and block results with `page?: null`.
    // `uuid` is the top-level user-facing uuid; there is no nested
    // `block/uuid` wrapper like older Datascript-style responses had.
    const rawHits = resp.blocks as any[];
    const pageHits = rawHits.filter((item) => item['page?'] === true);
    const blockHits = rawHits.filter((item) => !item['page?']);

    // Memoize getPage within this one search so multiple blocks on
    // the same parent page only trigger a single logseq.Editor.getPage
    // call. The cache key is whichever identifier getPage accepts
    // (id > uuid > name), matching the lookup in client.getPage.
    const pageCache = new Map<unknown, Promise<any>>();
    const getPageCached = (pageRef: any): Promise<any> => {
      const key =
        pageRef?.id ?? pageRef?.uuid ?? pageRef?.name ?? pageRef;
      let p = pageCache.get(key);
      if (!p) {
        p = this.client.getPage(pageRef);
        pageCache.set(key, p);
      }
      return p;
    };

    response.pages = await Promise.all(
      pageHits.map(async (item: any) => {
        const [page, rawProps] = await Promise.all([
          getPageCached({ uuid: item.uuid }),
          this.client.getPageProperties(item.uuid).catch(() => null),
        ]);
        if (!page) return page;
        return { ...page, properties: normalizeProperties(rawProps) };
      }),
    );

    // Phase 1: fetch every root hit + its properties in parallel. We
    // split the pipeline here (rather than fusing fetch->render in a
    // single map) so Phase 2 can gather all inline block references
    // across every hit and fan out one deduped fetch per unique
    // referent instead of doing it per-block.
    const rawHitsFetched = await Promise.all(
      blockHits.map(async (item: any) => {
        const [block, rawProps] = await Promise.all([
          // includeChildren: true lets us probe whether the block has
          // descendants so the sidebar can decide whether to render
          // the "Show child blocks" button. We discard the children
          // tree below and re-fetch it on demand via getBlockChildren()
          // so the port response stays small.
          this.client.getBlockViaUuid(item.uuid, { includeChildren: true }),
          this.client.getBlockProperties(item.uuid).catch(() => null),
        ]);
        return { block, rawProps };
      }),
    );

    // Phase 2: gather the full set of `((uuid))` / `[[uuid]]` referents
    // from every root hit's content, then fetch them all in parallel.
    // Root hits discard their children tree so we only need to scan
    // the root content itself; the children path resolves its own refs
    // on demand in getBlockChildren().
    const rootRefUuids = new Set<string>();
    for (const { block } of rawHitsFetched) {
      if (block && typeof block.content === 'string') {
        for (const uuid of collectBlockReferenceUuids(block.content)) {
          rootRefUuids.add(uuid);
        }
      }
    }
    const rootRefMap = await this.buildBlockRefMap(rootRefUuids);

    // Phase 3: normalize, substitute references, and render each hit.
    const fetchedBlocks = await Promise.all(
      rawHitsFetched.map(async ({ block, rawProps }) => {
        // Skip blocks whose content is only a reference to another
        // block -- the referenced block is already a search hit on its
        // own, so rendering both produces a duplicate result that shows
        // up as a bare UUID in the sidebar.
        if (isPureBlockReference(block?.content)) {
          return null;
        }
        const hasChildren =
          Array.isArray(block?.children) && block.children.length > 0;
        delete block.children;
        block.page = await getPageCached(block.page);
        block.properties = normalizeProperties(rawProps);
        if (typeof block.content === 'string') {
          block.content = resolveBlockReferences(block.content, rootRefMap);
        }
        const rendered: LogseqBlockType = renderBlock(block, graphName, query);
        rendered.hasChildren = hasChildren;
        return rendered;
      }),
    );
    response.blocks = fetchedBlocks.filter(
      (block): block is LogseqBlockType => block != null,
    );

    return response;
  }

  public async search(query: string) {
    const graph = await this.getGraph();
    console.debug(`DG Graph Name: ${graph}`);
    const resp = {
      msg: 'success',
      status: 200,
      response: await this.searchGraph(graph, query),
    };
    return resp;
  }

  public async getBlock(
    blockUuid: string,
    graph: string,
    query?: string,
    includeChildren: boolean = false,
  ) {
    const block = await this.client.getBlockViaUuid(blockUuid, {
      includeChildren,
    });
    block.page = await this.client.getPage(block.page);
    return renderBlock(block, graph, query);
  }

  // Fetch the descendants of a block on demand. Called from the
  // background worker in response to a "Show child blocks" click in the
  // sidebar. The returned tree is fully normalized -- collapsed subtrees
  // pruned, pure block references dropped, inline `((uuid))` and
  // `[[uuid]]` references resolved to their target's first line, and
  // hasChildren populated at every level -- so the caller can render
  // it without further logic.
  public async getBlockChildren(
    blockUuid: string,
    query?: string,
  ): Promise<LogseqBlockType[]> {
    const graph = await this.getGraph();
    const rawBlock = await this.client.getBlockViaUuid(blockUuid, {
      includeChildren: true,
    });
    if (!rawBlock || !Array.isArray(rawBlock.children)) {
      return [];
    }
    const rawChildren = rawBlock.children;

    // Walk the full subtree once up-front, gather every inline block
    // reference uuid, and fetch them all in parallel. The resulting
    // label map is then applied inside the render callback so every
    // node in the tree sees its references replaced before marked
    // turns the content into HTML. Logseq's plugin API doesn't resolve
    // block-scope refs automatically, so without this step fetched
    // children show as walls of raw UUIDs in the sidebar.
    const refUuids = this.collectTreeBlockReferenceUuids(rawChildren);
    const refMap = await this.buildBlockRefMap(refUuids);

    const rendered: LogseqBlockType[] = [];
    for (const rawChild of rawChildren) {
      // BlockUUIDTuple fallback shape: plain array, no content to render.
      if (Array.isArray(rawChild)) continue;
      const child = normalizeBlockTree(rawChild, (node) => {
        if (typeof node.content === 'string') {
          node.content = resolveBlockReferences(node.content, refMap);
        }
        return renderBlock(node, graph, query);
      });
      if (child) rendered.push(child);
    }
    return rendered;
  }

  public async urlSearch(url: URL, opt: { fuzzy: boolean } = { fuzzy: false }) {
    const graph = await this.getGraph();
    const blockUuidSet = new Set();
    const blocks: LogseqBlockType[] = [];

    const blockAdd = (block: LogseqBlockType) => {
      if (blockUuidSet.has(block.uuid)) {
        return;
      }
      blockUuidSet.add(block.uuid);
      blocks.push(block);
    };

    const find = async (url: string) => {
      const results = await this.searchGraph(graph, url);
      results.blocks.forEach(blockAdd);
    };

    if (url.pathname) {
      await find(url.host + url.pathname);
    }

    const count = blocks.length;

    if (url.host && opt.fuzzy) {
      await find(url.host);
    }

    return {
      status: 200,
      msg: 'success',
      response: {
        blocks: blocks.map((block) => {
          return renderBlock(block, graph, url.href);
        }),
        graph: graph,
      },
      count: count,
    };
  }

  public async changeBlockMarker(uuid: string, marker: string) {
    const graph = await this.getGraph();
    const block = await this.getBlock(uuid, graph);

    if (block.content.includes('SCHEDULED:')) {
      return {
        type: 'change-block-marker-result',
        uuid: uuid,
        status: 'failed',
        msg: 'Not support scheduled task.',
      };
    }
    block.content = block.content.replace(block.marker, marker);

    const result = await this.client.updateBlock(block);
    console.debug(result);
    if (Object.prototype.hasOwnProperty.call(result, 'error')) {
      return {
        type: 'change-block-marker-result',
        uuid: uuid,
        status: 'failed',
        msg: 'error',
      };
    }
    return {
      type: 'change-block-marker-result',
      uuid: uuid,
      status: 'success',
      marker: marker,
    };
  }
}
