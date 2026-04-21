import { isProbablyReaderable, Readability } from "@mozilla/readability"
import TurndownService from "turndown"
import { gfm } from "turndown-plugin-gfm"

import { cleanMarkdown } from "~/lib/cleanMarkdown"
import type { PageData } from "~/lib/types"

export {}

function convertPageToMarkdown() {
  const selection = window.getSelection()
  const hasSelection = !!selection && !selection.isCollapsed && selection.rangeCount > 0

  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced"
  })
  turndownService.use(gfm)

  turndownService.remove([
    "script",
    "style",
    "noscript",
    "header",
    "footer",
    "nav",
    "aside",
    "svg",
    "iframe",
    "canvas",
    "form",
    "button",
    "dialog"
  ])

  turndownService.addRule("ignoreBase64Images", {
    filter: (node: HTMLElement) => {
      if (node.nodeName === "IMG") {
        const src = (node as HTMLImageElement).getAttribute("src") || ""
        return src.startsWith("data:image")
      }
      return false
    },
    replacement: () => ""
  })

  let htmlToConvert = ""
  let article: ReturnType<Readability["parse"]> = null

  if (hasSelection) {
    const range = selection.getRangeAt(0)
    const fragment = range.cloneContents()
    const wrapper = document.createElement("div")
    wrapper.appendChild(fragment)
    htmlToConvert = wrapper.innerHTML
  } else {
    const documentClone = document.cloneNode(true) as Document

    const badSelectors = [
      ".infobox",
      ".mw-editsection",
      ".navbox",
      ".metadata",
      ".reflist",
      ".reference",
      ".mw-empty-elt"
    ]
    badSelectors.forEach((selector) => {
      documentClone.querySelectorAll(selector).forEach((el) => el.remove())
    })

    try {
      if (isProbablyReaderable(documentClone)) {
        article = new Readability(documentClone).parse()
      }
    } catch (error) {
      console.warn("Readability failed to parse this page:", error)
    }

    if (article?.content) {
      htmlToConvert = article.content
    } else {
      const mainEl =
        document.querySelector("main") ||
        document.querySelector('[role="main"]') ||
        document.querySelector("#main-content") ||
        document.querySelector("#main") ||
        document.querySelector("#content") ||
        document.querySelector(".content") ||
        document.body
      htmlToConvert = mainEl.innerHTML
    }
  }

  const pageData: PageData = {
    markdown: cleanMarkdown(turndownService.turndown(htmlToConvert)),
    title: article?.title || document.title || "",
    author: article?.byline || "",
    date: article?.publishedTime || "",
    url: window.location.href
  }

  chrome.storage.local.set({ pageData }, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to save page data:", chrome.runtime.lastError)
      return
    }
    chrome.runtime.sendMessage({ action: "open-markdown-tab" })
  })
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "convert-to-markdown") {
    convertPageToMarkdown()
  }
})
