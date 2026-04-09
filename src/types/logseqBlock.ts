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
