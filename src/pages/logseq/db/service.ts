import { LogseqBlockType } from '../../../types/logseqBlock';
import LogseqClient from './client';
import { renderBlock } from '../tool';
import { LogseqServiceInterface } from '../interfaces';

export default class LogseqDBService implements LogseqServiceInterface {
  public client: LogseqClient = new LogseqClient();

  public async getGraph() {
    return (await this.client.getGraph()).name.replace('logseq_db_', '');;
  }

  public async showMsg(message: string) {
    return await this.client.showMsg(message);
  }

  public async getVersion() {
    return (await this.client.getVersion()).version;
  }

  private async searchGraph(graphName: string, query: string) {
    const resp = await this.client.search(query);
    const response = {
      blocks: [],
      pages: [],
      count: 0,
      graph: graphName,
    };

    // Logseq 2.x search returns a flat `blocks` array where page results
    // are flagged with `page?: true` and block results with `page?: null`.
    // `uuid` is the top-level user-facing uuid; there is no nested
    // `block/uuid` wrapper like older Datascript-style responses had.
    const pageHits = resp.blocks.filter((item) => item['page?'] === true);
    const blockHits = resp.blocks.filter((item) => !item['page?']);

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
      pageHits.map((item) => getPageCached({ uuid: item.uuid })),
    );

    response.blocks = await Promise.all(
      blockHits.map(async (item) => {
        const block = await this.client.getBlockViaUuid(item.uuid, {
          includeChildren: false,
        });
        block.page = await getPageCached(block.page);
        return renderBlock(block, graphName, query);
      }),
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
    if (Object.hasOwnProperty(result, 'error')) {
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
