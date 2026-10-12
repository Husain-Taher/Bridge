// Bridge Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bridge Extension installed.');
  // Set default Bridge host if not configured
  chrome.storage.local.get(['bridge_url'], (res) => {
    if (!res.bridge_url) {
      chrome.storage.local.set({ bridge_url: 'http://localhost:3000' });
    }
  });
});

// Helper: Send payload to Bridge backend
async function sendToBridge(payload) {
  const settings = await chrome.storage.local.get(['bridge_url', 'bridge_token', 'device_name']);
  const bridgeUrl = (settings.bridge_url || 'http://localhost:3000').replace(/\/$/, '');

  const response = await fetch(`${bridgeUrl}/api/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Device': settings.device_name || 'Chrome Extension',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return await response.json();
}

// Handle global keyboard shortcut: Alt+Shift+B
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'send-current-tab') {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) return;

      await sendToBridge({
        type: 'url',
        content: activeTab.url,
        title: activeTab.title || 'Web Link',
      });

      // Show temporary badge feedback
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 2500);
    } catch (err) {
      console.error('Shortcut send failed:', err);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#f43f5e' });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 2500);
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SEND_TRANSFER') {
    sendToBridge(request.data)
      .then((res) => sendResponse({ success: true, data: res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});
