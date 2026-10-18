const ReleaseFor = {
  chrome: {
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnkAYeXnTWrNIu2h8D4xi9NHWLe0eTR3CX8DDw1c0qyCucaCKxkk/+gZcl89Ifyq5joXc/CeQrM3QVjrL1RAXrKZVqTNvBCUh1H1oJJ47nqkKKI6bNZVT8utjFTjDD1ZYXPYzQhsGuP/cY1wIrlhhIuawFW1h+UUwYlYQtS5FcjJ/RPrao+8KwJaS9p3Cei9rWXhE/PV19ZVOqOUx9ZSzj5/OYCB1u1VWFD5BlUbTXSbzyM/VvXZseAVruVy7oRHJ565AH/uPz2ZVL55Gz0LzcHw4HNRc2f+mSVAbHAuK7JDWtRlrZ3Fbav9qBrcVIAxTpnf5B2I2YMBMcu852Vkc3QIDAQAB',
    background: {
      service_worker: 'background.js',
    },
  },
  edge: {
    background: {
      service_worker: 'background.js',
    },
  },
  firefox: {
    background: {
      scripts: ['background.js'],
    },
    developer: {
      name: 'VictorVow',
      url: 'https://github.com/VictorVow/logseq-copilot',
    },
    browser_specific_settings: {
      gecko: {
        id: '{b460bedc-e57a-47bd-9561-f3f1b226fadd}',
      },
    },
  },
};

const build = (releaseFor) => {
  return {
    manifest_version: 3,
    version: process.env.VERSION?.replace('v', '') ?? '0.0.0',
    author: 'VictorVow',
    name: 'Logseq Copilot',
    description:
      'Logseq Copilot, Connect with you logseq API server, bring your information when you browsing.',
    chrome_url_overrides: {},
    icons: {
      192: 'assets/img/logo-192.png',
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        js: ['content-script.js'],
        css: ['content-script.css'],
      },
    ],
    action: {
      default_popup: 'popup.html',
      default_title: 'Logseq Copilot',
    },
    options_ui: {
      page: 'options.html',
      browser_style: false,
      open_in_tab: true,
    },
    commands: {
      clip: {
        suggested_key: {
          default: 'Ctrl+Shift+U',
        },
        description: 'Make Clip note',
      },
    },
    web_accessible_resources: [
      {
        resources: ['content-script.css', 'assets/img/logo.png'],
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
      },
    ],
    permissions: ['storage', 'activeTab', 'contextMenus'],
    host_permissions: ['<all_urls>'],
    ...ReleaseFor[releaseFor],
  };
};

module.exports = build;
