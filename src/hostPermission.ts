import { useEffect, useState } from 'react';
import Browser from 'webextension-polyfill';

// Firefox MV3 treats host_permissions as optional, so <all_urls> may not be
// granted after install. Without it the content script only runs after the
// user clicks the toolbar button (temporary activeTab access).
const ALL_URLS: Browser.Permissions.Permissions = { origins: ['<all_urls>'] };

export const hasHostPermission = () => Browser.permissions.contains(ALL_URLS);

// Must be called directly from a user input handler, before any await.
export const requestHostPermission = () => Browser.permissions.request(ALL_URLS);

export const useHostPermission = () => {
  const [granted, setGranted] = useState<boolean | undefined>();

  useEffect(() => {
    const refresh = () => hasHostPermission().then(setGranted);
    refresh();
    Browser.permissions.onAdded.addListener(refresh);
    Browser.permissions.onRemoved.addListener(refresh);
    return () => {
      Browser.permissions.onAdded.removeListener(refresh);
      Browser.permissions.onRemoved.removeListener(refresh);
    };
  }, []);

  return granted;
};
