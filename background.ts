export {}

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    chrome.tabs
      .sendMessage(tab.id, { action: "convert-to-markdown" })
      .catch((err) =>
        console.log("Content script not ready or an extension page.", err)
      )
  }
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "convert-to-markdown") {
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, { action: "convert-to-markdown" })
        .catch((err) => console.log("Content script not ready.", err))
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs
            .sendMessage(tabs[0].id, { action: "convert-to-markdown" })
            .catch((err) => console.log("Content script not ready.", err))
        }
      })
    }
  }
})

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "open-markdown-tab") {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/markdown.html") })
  }
})
