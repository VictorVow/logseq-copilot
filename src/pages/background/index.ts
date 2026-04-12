import { browser } from '@/browser';
import { getLogseqCopliotConfig } from '../../config';
import { blockRending, versionCompare } from './utils';
import { format } from 'date-fns';
import { changeOptionsHostToHostNameAndPort } from './upgrade';
import {getLogseqService} from '@pages/logseq/tool';

browser.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((msg) => {
    if (msg.type === 'query') {
      const promise = new Promise(async () => {
        const logseqService = await getLogseqService();
        const searchRes = await logseqService.search(msg.query);
        console.debug("search result", searchRes)
        port.postMessage(searchRes);

      });

      promise.catch((err) => console.error(err));
    } else if (msg.type === 'open-options') {
      browser.runtime.openOptionsPage();
    } else {
      console.debug(msg);
    }
  });
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'open-options') {
    browser.runtime.openOptionsPage();
  } else if (msg.type === 'clip-with-selection') {
    quickCapture(msg.data);
  } else if (msg.type === 'clip-page') {
    quickCapture('');
  } else if (msg.type === 'open-page') {
    openPage(msg.url);
  } else if (msg.type === 'change-block-marker') {
    changeBlockMarker(msg.uuid, msg.marker);
  } else if (msg.type === 'get-block-children') {
    getBlockChildren(msg.uuid, msg.query);
  } else {
    console.debug(msg);
  }
});

const changeBlockMarker = async (uuid: string, marker: string) => {
  const tab = await getCurrentTab();
  if (!tab) {
    return;
  }
  const logseqService = await getLogseqService();
  const result = await logseqService.changeBlockMarker(uuid, marker);
  browser.tabs.sendMessage(tab.id!, result);
};

// Deferred fetch of a block's descendant tree, triggered by the "Show
// child blocks" button in the sidebar. Posts a fire-and-forget result
// message back to the tab (matching the changeBlockMarker pattern) that
// the LogseqBlockItem component listens for. File-graph search results
// never set `hasChildren: true` so the button is never rendered for
// them; the typeof guard here is a defensive fallback for the case
// where a file-graph service is somehow reached.
const getBlockChildren = async (uuid: string, query?: string) => {
  const tab = await getCurrentTab();
  if (!tab) return;
  const logseqService = await getLogseqService();
  if (typeof logseqService.getBlockChildren !== 'function') {
    browser.tabs.sendMessage(tab.id!, {
      type: 'get-block-children-result',
      uuid,
      status: 'failed',
      msg: 'Child-block fetching is only supported on Logseq DB graphs.',
    });
    return;
  }
  try {
    const children = await logseqService.getBlockChildren(uuid, query);
    browser.tabs.sendMessage(tab.id!, {
      type: 'get-block-children-result',
      uuid,
      status: 'success',
      children,
    });
  } catch (err: any) {
    browser.tabs.sendMessage(tab.id!, {
      type: 'get-block-children-result',
      uuid,
      status: 'failed',
      msg: err?.message ?? String(err),
    });
  }
};

const getCurrentTab = async () => {
  const tab = await browser.tabs.query({ active: true, currentWindow: true });
  return tab[0];
};

const openPage = async (url: string) => {
  console.debug(url);
  const tab = await getCurrentTab();
  if (!tab) {
    browser.tabs.create({ url: url });
    return;
  }
  const activeTab = tab;
  if (activeTab.url !== url)
    await browser.tabs.update(activeTab.id, { url: url });
};

const quickCapture = async (data: string) => {
  const tab = await getCurrentTab();
  if (!tab) return;
  const activeTab = tab;
  const { clipNoteLocation, clipNoteCustomPage, clipNoteTemplate, clipNoteAddToTop } =
    await getLogseqCopliotConfig();
  const now = new Date();
  const logseqService = await getLogseqService();

  const resp = await logseqService.client.getUserConfig();

  const block = blockRending({
    url: activeTab.url,
    title: activeTab.title,
    data,
    clipNoteTemplate,
    preferredDateFormat: resp['preferredDateFormat'],
    time: now,
  });

  const insertBlock = clipNoteAddToTop
    ? logseqService.client.prependBlock
    : logseqService.client.appendBlock;

  if (clipNoteLocation === 'customPage') {
    await insertBlock(clipNoteCustomPage, block);
  } else if (clipNoteLocation === 'currentPage') {
    const { name: currentPage } = await logseqService.client.getCurrentPage();
    await insertBlock(currentPage, block);
  } else {
    const journalPage = format(now, resp['preferredDateFormat']);
    await insertBlock(journalPage, block);
  }

};


try {
  browser.contextMenus.create({
    id: 'clip-with-selection',
    title: 'Clip "%s"',
    visible: true,
    contexts: ['selection'],
  });
} catch (error) {
  console.log(error);
}

try {
  browser.contextMenus.create({
    id: 'clip-page',
    title: 'Clip page link',
    visible: true,
    contexts: ['page'],
  });
} catch (error) {
  console.log(error);
}

browser.contextMenus.onClicked.addListener((info, tab) => {
  browser.tabs.sendMessage(tab!.id!, { type: info.menuItemId }, {});
});

browser.runtime.onInstalled.addListener((event) => {
  if (event.reason === 'install') {
    browser.runtime.openOptionsPage();
  } else if (event.reason === 'update') {
    if (versionCompare(event.previousVersion!, '1.10.19') < 0) {
      changeOptionsHostToHostNameAndPort();
    }
  }
});

browser.commands.onCommand.addListener((command, tab) => {
  if (command === 'clip' && tab !== undefined) {
    browser.tabs.sendMessage(tab.id!, { type: 'clip' });
  }
});

