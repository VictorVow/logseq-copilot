import { LogseqBlockType } from '../../types/logseqBlock';


export interface LogseqClientInterface {
  getGraph(): any;
  appendBlock(page: string, content: string): any;
  getVersion(): any;
  getAllPages(): any;
  showMsg(message: string): any;
  getUserConfig(): any;
  isDBGraph(): any;
  getBlockViaUuid(uuid: string, opt?: { includeChildren: boolean }): any;
  updateBlock(block: LogseqBlockType): any;
  search(query: string): any;
}

export interface LogseqServiceInterface {
  client: any;
  getGraph(): any;
  search(query: string): any;
  getBlock(
    blockUuid: string,
    graph: string,
    query?: string,
    includeChildren?: boolean,
  ): any;
  // Deferred fetch of a block's descendant tree. Only implemented by the
  // DB-graph service for now -- the background worker guards with a
  // typeof check before calling, so file-graph search (which won't set
  // `hasChildren` on its results) never triggers this path.
  getBlockChildren?(uuid: string, query?: string): Promise<LogseqBlockType[]>;
  urlSearch(url: URL, opt?: { fuzzy: boolean }): any;
  showMsg(message: string): any;
  getVersion(): any;
  changeBlockMarker(uuid: string, marker: string): any;
}
