import type Browser from 'webextension-polyfill';

declare global {
  var browser: Browser.Browser;

  // CSS Custom Highlight API (not yet in TS lib.dom on TS 4.9)
  class Highlight {
    constructor(...initialRanges: AbstractRange[]);
    add(range: AbstractRange): void;
  }

  interface HighlightRegistry {
    has(name: string): boolean;
    get(name: string): Highlight | undefined;
    set(name: string, highlight: Highlight): void;
  }
}

