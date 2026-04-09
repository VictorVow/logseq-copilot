export type RenderedProperty = {
  name: string;
  values: string[];
};

export type LogseqPageIdenity = {
  name: string;
  id: number;
  uuid: string;
  originalName?: string;
  title?: string;
  properties?: RenderedProperty[];
};

export type LogseqBlockType = {
  uuid: string;
  html: string;
  page: LogseqPageIdenity;
  content: string;
  format: string;
  marker: string;
  priority: string;
  properties?: RenderedProperty[];
  // True when the block has at least one descendant block. Set at search
  // time so the sidebar can decide whether to render the "Show child
  // blocks" button. The children tree itself is *not* carried in the
  // search response -- it is fetched on demand when the button is clicked.
  hasChildren?: boolean;
  // Populated after a deferred fetch of the block's descendants. Each
  // node in the tree is itself a LogseqBlockType, so rendering is just
  // recursive. Collapsed subtrees have been pruned at the service layer,
  // so the UI never needs to inspect `collapsed` to decide what to render.
  children?: LogseqBlockType[];
  // Mirrors Logseq's `:block/collapsed?` state. Preserved on each node in
  // a fetched tree so the UI can optionally style collapsed leaves.
  collapsed?: boolean;
};

export type LogseqPageContentType = {
  uuid: string;
  content: string;
  page: LogseqPageIdenity;
};

export type LogseqSearchResult = {
  blocks: LogseqBlockType[];
  pages: LogseqPageIdenity[];
  // pageContents: LogseqPageContentType[];
  graph: string;
};
