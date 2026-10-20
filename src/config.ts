import Browser from 'webextension-polyfill';

export type LogseqCopliotConfig = {
  version: string;
  logseqHost: string;
  logseqHostName: string;
  logseqPort: number;
  logseqAuthToken: string;
  enableClipNoteFloatButton: boolean;
  clipNoteLocation: string;
  clipNoteCustomPage: string;
  clipNoteTemplate: string;
  clipNoteAddToTop: boolean;
  blacklistedHosts: string[];
};

export const getLogseqCopliotConfig =
  async (): Promise<LogseqCopliotConfig> => {
    const {
      version = '',
      logseqHost = 'http://localhost:12315',
      logseqHostName = 'localhost',
      logseqPort = 12315,
      logseqAuthToken = '',
      enableClipNoteFloatButton = false,
      clipNoteLocation = "journal",
      clipNoteCustomPage = "",
      clipNoteTemplate = `#[[Clip]] [{{title}}]({{url}})
{{content}}`,
      clipNoteAddToTop = false,
      blacklistedHosts = [],
    } = await Browser.storage.local.get();
    return {
      version,
      logseqHost,
      logseqHostName,
      logseqPort,
      logseqAuthToken,
      enableClipNoteFloatButton,
      clipNoteLocation,
      clipNoteCustomPage,
      clipNoteTemplate,
      clipNoteAddToTop,
      blacklistedHosts,
    };
  };

export const saveLogseqCopliotConfig = async (
  updates: Partial<LogseqCopliotConfig>,
) => {
  console.log('saveLogseqCopliotConfig', updates);
  await Browser.storage.local.set(updates);
};

export const getHostname = (url?: string) => {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
};

export const isHostBlacklisted = async (hostname: string) => {
  const { blacklistedHosts } = await getLogseqCopliotConfig();
  return blacklistedHosts.includes(hostname);
};

// Returns true if the host is blacklisted after the toggle.
export const toggleHostBlacklisted = async (hostname: string) => {
  const { blacklistedHosts } = await getLogseqCopliotConfig();
  const blacklisted = !blacklistedHosts.includes(hostname);
  await saveLogseqCopliotConfig({
    blacklistedHosts: blacklisted
      ? [...blacklistedHosts, hostname]
      : blacklistedHosts.filter((h) => h !== hostname),
  });
  return blacklisted;
};
