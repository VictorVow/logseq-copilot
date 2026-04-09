import { LogseqBlockType, LogseqPageIdenity } from '../../../types/logseqBlock';
import LogseqClient from './client';
import { renderBlock } from '../tool';
import { LogseqServiceInterface } from '../interfaces';
import { isPureBlockReference } from './blockReference';
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

    const fetchedBlocks = await Promise.all(
      blockHits.map(async (item: any) => {
        // includeChildren: true lets us probe whether the block has
        // descendants so the sidebar can decide whether to render the
        // "Show child blocks" button. We discard the children tree here
        // and re-fetch it on demand via getBlockChildren() so the port
        // response stays small.
        const [block, rawProps] = await Promise.all([
          this.client.getBlockViaUuid(item.uuid, { includeChildren: true }),
          this.client.getBlockProperties(item.uuid).catch(() => null),
        ]);
        // Skip blocks whose content is only a reference to another block --
        // the referenced block is already a search hit on its own, so
        // rendering both produces a duplicate result that shows up as a
        // bare UUID in the sidebar.
        if (isPureBlockReference(block?.content)) {
          return null;
        }
        const hasChildren =
          Array.isArray(block?.children) && block.children.length > 0;
        delete block.children;
        block.page = await getPageCached(block.page);
        block.properties = normalizeProperties(rawProps);
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
  // pruned, pure block references dropped, hasChildren populated at
  // every level -- so the caller can render it without further logic.
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
    const rendered: LogseqBlockType[] = [];
    for (const rawChild of rawChildren) {
      // BlockUUIDTuple fallback shape: plain array, no content to render.
      if (Array.isArray(rawChild)) continue;
      const child = normalizeBlockTree(rawChild, (node) =>
        renderBlock(node, graph, query),
      );
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
