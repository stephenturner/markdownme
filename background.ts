export {}

function isPdfUrl(url?: string): boolean {
  if (!url) return false
  const path = url.split("?")[0].split("#")[0].toLowerCase()
  return path.endsWith(".pdf")
}

// The markdown tab can fetch these schemes; anything else (about:, moz-extension:,
// view-source:) can't be converted, so we don't fall back to the PDF path for it.
function isFetchable(url?: string): boolean {
  return !!url && /^(https?|file):/i.test(url)
}

function convertPdfTab(tab: chrome.tabs.Tab) {
  // PDFs never run our content script (Firefox renders them in its own viewer),
  // so hand the URL to the markdown tab, which fetches, verifies, and converts.
  chrome.storage.local.set(
    {
      pdfRequest: { url: tab.url, title: tab.title || "" },
      pageData: null
    },
    () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("tabs/markdown.html") })
    }
  )
}

function trigger(tab?: chrome.tabs.Tab) {
  if (!tab?.id) return

  if (isPdfUrl(tab.url)) {
    convertPdfTab(tab)
    return
  }

  chrome.tabs.sendMessage(tab.id, { action: "convert-to-markdown" }).catch(() => {
    // No content script answered. On a fetchable page that almost always means
    // the built-in PDF viewer (e.g. arxiv.org/pdf/1234.56789 serves a PDF with
    // no .pdf in the URL), so try the PDF path — the tab magic-byte-checks it
    // and shows a clear error if it turns out not to be a PDF.
    if (isFetchable(tab.url)) {
      convertPdfTab(tab)
    } else {
      console.log("No content script and page isn't fetchable:", tab.url)
    }
  })
}

chrome.action.onClicked.addListener((tab) => trigger(tab))

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "convert-to-markdown") return
  if (tab?.id) {
    trigger(tab)
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
      trigger(tabs[0])
    )
  }
})

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "open-markdown-tab") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/markdown.html") })
  }
})
