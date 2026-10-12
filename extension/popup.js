// Bridge Extension Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const tabTitleEl = document.getElementById('tab-title');
  const tabUrlEl = document.getElementById('tab-url');
  const btnSendTab = document.getElementById('btn-send-tab');
  const btnSendSelection = document.getElementById('btn-send-selection');
  const btnSendSnippet = document.getElementById('btn-send-snippet');
  const snippetInput = document.getElementById('snippet-input');
  const toastEl = document.getElementById('toast');
  const linkOpenBridge = document.getElementById('link-open-bridge');

  let currentTab = null;

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    setTimeout(() => {
      toastEl.className = 'toast hidden';
    }, 2800);
  }

  // Get current active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
      tabTitleEl.textContent = currentTab.title || 'Untitled Page';
      tabUrlEl.textContent = currentTab.url || 'No URL available';
    }
  } catch (err) {
    console.error('Error fetching tab:', err);
    tabTitleEl.textContent = 'Active tab unavailable';
  }

  // Open Bridge Web App
  linkOpenBridge.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.local.get(['bridge_url'], (res) => {
      const url = res.bridge_url || 'http://localhost:3000';
      chrome.tabs.create({ url });
    });
  });

  // Action: Send Page URL to Phone
  btnSendTab.addEventListener('click', async () => {
    if (!currentTab || !currentTab.url) {
      showToast('No active URL found to send.', 'error');
      return;
    }

    btnSendTab.disabled = true;
    btnSendTab.textContent = 'Sending...';

    chrome.runtime.sendMessage(
      {
        action: 'SEND_TRANSFER',
        data: {
          type: 'url',
          content: currentTab.url,
          title: currentTab.title || 'Web Link',
        },
      },
      (response) => {
        btnSendTab.disabled = false;
        btnSendTab.innerHTML = '<span class="icon">↗</span> Send Page to Phone';
        if (response && response.success) {
          showToast('Link sent to your phone!', 'success');
        } else {
          showToast(response?.error || 'Transfer failed.', 'error');
        }
      }
    );
  });

  // Action: Send Selected Text
  btnSendSelection.addEventListener('click', async () => {
    if (!currentTab?.id) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => window.getSelection()?.toString() || '',
      });

      const selectedText = results?.[0]?.result?.trim();
      if (!selectedText) {
        showToast('No text highlighted on page.', 'error');
        return;
      }

      btnSendSelection.disabled = true;
      chrome.runtime.sendMessage(
        {
          action: 'SEND_TRANSFER',
          data: {
            type: 'text',
            content: selectedText,
            title: `Selection from ${currentTab.title || 'webpage'}`,
          },
        },
        (response) => {
          btnSendSelection.disabled = false;
          if (response && response.success) {
            showToast('Selected text sent to phone!', 'success');
          } else {
            showToast(response?.error || 'Transfer failed.', 'error');
          }
        }
      );
    } catch (err) {
      console.error(err);
      showToast('Cannot access page selection.', 'error');
    }
  });

  // Action: Send Quick Snippet
  btnSendSnippet.addEventListener('click', () => {
    const text = snippetInput.value.trim();
    if (!text) {
      showToast('Please type a snippet first.', 'error');
      return;
    }

    btnSendSnippet.disabled = true;
    chrome.runtime.sendMessage(
      {
        action: 'SEND_TRANSFER',
        data: {
          type: 'text',
          content: text,
        },
      },
      (response) => {
        btnSendSnippet.disabled = false;
        if (response && response.success) {
          snippetInput.value = '';
          showToast('Snippet sent to phone!', 'success');
        } else {
          showToast(response?.error || 'Transfer failed.', 'error');
        }
      }
    );
  });
});
