import { getLogseqCopliotConfig, isHostBlacklisted } from '@/config';
import { fixDuckDuckGoDark } from '@/utils';
import { createRoot, Root } from 'react-dom/client';
import Browser from 'webextension-polyfill';
import { LogseqCopliot } from './LogseqCopliot';
import mountQuickCapture from './QuickCapture';
import searchEngines, {
  Baidu,
  Bing,
  Ecosia,
  DuckDuckGo,
  GenericPage,
  Google,
  Kagi,
  SearX,
  Startpage,
  Yandex,
} from './searchingEngines/searchingEngines';

const connect = Browser.runtime.connect();

// Module-scope root so Baidu's SPA reload path doesn't call createRoot twice
// on the same universal container (which would log a React warning).
let root: Root | null = null;

const mount = async (container: Element, query: string) => {
  if (!root) {
    root = createRoot(container);
  }

  connect.postMessage({ type: 'query', query: query });

  root.render(<LogseqCopliot connect={connect} />);
};

async function run(
  searchEngine:
    | Google
    | Bing
    | Ecosia
    | DuckDuckGo
    | Yandex
    | SearX
    | Baidu
    | Kagi
    | Startpage
    | GenericPage,
) {
  console.debug('Logseq copliot', window.location.hostname);

  if (searchEngine instanceof DuckDuckGo) {
    fixDuckDuckGoDark()
  }

  const query = searchEngine.getQuery();
  if (query) {
    console.log(`match ${typeof searchEngine}, query ${query}`);
    const container = await searchEngine.gotElement();
    await mount(container, query);
  }
}

function getEngine() {
  for (const engine of searchEngines) {
    if (engine.isMatch()) {
      return engine;
    }
  }
}

const initPlugin = () => {
  const searchEngine = getEngine();
  if (!searchEngine) return;
  setTimeout(() => run(searchEngine), 200);
  if (searchEngine.reload) {
    searchEngine.reload(() => run(searchEngine));
  }
};

const start = () => {
  // Defer initialization until the tab is actually being viewed, so
  // background tabs don't fire a Logseq search on every page load or
  // extension reload. Firefox re-injects content scripts into all
  // matching tabs when a temporary addon reloads — without this gate
  // every open tab would hit the API regardless of whether the user
  // is looking at it.
  if (document.visibilityState === 'visible') {
    initPlugin();
  } else {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      initPlugin();
    };
    document.addEventListener('visibilitychange', onVisible);
  }

  getLogseqCopliotConfig().then(({ enableClipNoteFloatButton }) => {
    if (!enableClipNoteFloatButton) return;
    mountQuickCapture();
  });
};

// Blacklisting hides the injected UI in place rather than reloading the page.
const injectedIds = ['logseq-copilot-root', 'logseq-copilot-popup'];
let started = false;

const applyBlacklist = async () => {
  const blacklisted = await isHostBlacklisted(window.location.hostname);
  for (const id of injectedIds) {
    const el = document.getElementById(id);
    if (el) el.style.display = blacklisted ? 'none' : '';
  }
  if (!blacklisted && !started) {
    started = true;
    start();
  }
};

Browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.blacklistedHosts) applyBlacklist();
});

applyBlacklist();
