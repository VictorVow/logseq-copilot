export const delay = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// https://gist.github.com/ca0v/73a31f57b397606c9813472f7493a940?permalink_comment_id=3062135#gistcomment-3062135
export const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: NodeJS.Timeout | undefined = undefined;

  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => resolve(func(...args)), waitFor)
    })
}

export const removeUrlHash = (url: string) => {
  const hashIndex = url.indexOf('#');
  return hashIndex > 0 ? url.substring(0, hashIndex) : url;
};

/**
 * True only for `http://` and `https://` URLs. Used to skip Logseq lookups
 * on extension/chrome/about/file pages — notably the extension's own
 * options page (`moz-extension://…/options.html`), where searching for
 * the URL would fire pointless `logseq.Editor.getPage` calls.
 */
export const isWebUrl = (url: string | undefined | null): url is string => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

// Tracking query parameters stripped before using a URL as a Logseq
// search query. Compiled from Brave's query_filter list
// (https://github.com/brave/brave-core/blob/master/components/query_filter/utils.cc)
// plus the `utm_*` family from Firefox's Enhanced Tracking Protection
// query-stripping list. We strip unconditionally — Brave keeps some of
// these conditional (per-site) for general web browsing, but for
// Logseq search matching a cleaner URL is always better.
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  // Brave "simple" trackers
  '__hsfp', '__hssc', '__hstc', '__s', '_bhlid', '_branch_match_id',
  '_branch_referrer', '_gl', '_hsenc', '_openstat', 'at_recipient_id',
  'at_recipient_list', 'bbeml', 'bsft_clkid', 'bsft_uid', 'dclid',
  'et_rid', 'fb_action_ids', 'fb_comment_id', 'fbclid', 'gclid',
  'guce_referrer', 'guce_referrer_sig', 'hsCtaTracking', 'irclickid',
  'mc_eid', 'ml_subscriber', 'ml_subscriber_hash', 'msclkid', 'mtm_cid',
  'oft_c', 'oft_ck', 'oft_d', 'oft_id', 'oft_ids', 'oft_k', 'oft_lk',
  'oft_sk', 'oly_anon_id', 'oly_enc_id', 'pk_cid', 'rb_clickid',
  's_cid', 'sc_customer', 'sc_eh', 'sc_uid', 'sfmc_activityid',
  'sfmc_id', 'sms_click', 'sms_source', 'sms_uph', 'srsltid',
  'ss_email_id', 'syclid', 'ttclid', 'twclid', 'unicorn_click_id',
  'vero_conv', 'vero_id', 'vgo_ee', 'wbraid', 'wickedid', 'yclid',
  'ymclid', 'ysclid',
  // Brave "conditional" trackers (stripped unconditionally here)
  'ck_subscriber_id', 'h_sid', 'h_slt', 'mkt_tok',
  // Brave "scoped" site-specific trackers (IG, Reddit, YouTube, etc.)
  'igsh', 'igshid', 'ref_src', 'ref_url', 'si',
  // Firefox ETP utm_* family (not in Brave's utils.cc list)
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_name', 'utm_id', 'utm_reader', 'utm_social', 'utm_brand',
  'utm_social-type',
]);

/**
 * Return the URL with known tracking query parameters and the hash
 * fragment removed. Used as the Logseq search query for the generic
 * (non-search-engine) fallback so users get precision matches against
 * URLs they've stored in their notes.
 *
 * Returns the input unchanged if it fails to parse as a URL (e.g.
 * `about:blank`, data URIs) so the caller always gets *something*.
 */
export const cleanUrl = (url: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  // Drop hash — anchors rarely help with Logseq note matching.
  parsed.hash = '';
  // Strip every known tracking param. URLSearchParams.delete mutates.
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAMS.has(key)) {
      parsed.searchParams.delete(key);
    }
  }
  return parsed.toString();
};

function cleanAttribute(attribute: string | null) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
}

function linkProcess(src: string | null) {
  if (!src) {
    return '';
  }
  if (src.startsWith('/')) {
    return window.location.origin + src;
  } else if (src.startsWith('http')) {
    return src;
  } else if (src.startsWith('data')) {
    return src;
  } else {
    return window.location.href + src;
  }
}

export const buildTurndownService = () => {
  const TurndownService = require('turndown');

  const turndownService = new TurndownService({
    bulletListMarker: '*',
    codeBlockStyle: 'fenced',
    linkStyle: 'inlined',
    headingStyle: 'atx',
    br: '\n',
  });

  turndownService.addRule('image-add-black', {
    filter: 'img',

    replacement: function (content: string, node: HTMLElement) {
      const alt = cleanAttribute(node.getAttribute('alt'));
      const src = node.getAttribute('src') || '';
      return src ? ` ![${alt}](${linkProcess(src)}) ` : '';
    },
  });

  turndownService.addRule('p-logseq', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

    replacement: function (content: string, node: HTMLElement) {
      const hLevel = Number(node.nodeName.charAt(1));
      if (hLevel === 1) return '\n\n**' + content + '**\n\n';
      return '\n\n' + content + '\n\n';
    },
  });

  turndownService.addRule('a-logseq', {
    filter: 'a',

    replacement: function (content: string, node: HTMLElement) {
      const href = node.getAttribute('href');
      return `[${content}](${linkProcess(href)})`;
    },
  });

  return turndownService;
};

export const fixDuckDuckGoDark = () => {
  if (document.querySelector('.dark-bg')) {
    document.body.style.color = 'var(--theme-col-txt-snippet)';
  }
}
