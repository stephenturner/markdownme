import Markdown from "markdown-to-jsx"
import { useEffect, useRef, useState } from "react"

import { cleanMarkdown } from "~/lib/cleanMarkdown"
import type { HeadingNode, PageData } from "~/lib/types"

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  LinkIcon,
  MapIcon,
  MetaDataIcon,
  PasteIcon,
  SourceUrlIcon,
  TrashIcon
} from "./icons"
import "./style.css"

function generatePageMap(markdown: string, title = "Document Structure"): string {
  const headings: { level: number; text: string }[] = []

  markdown.split("\n").forEach((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) headings.push({ level: match[1].length, text: match[2].trim() })
  })

  if (headings.length === 0) return ""

  const root: HeadingNode = { text: title, level: 0, children: [] }
  const stack: HeadingNode[] = [root]

  headings.forEach((h) => {
    const node: HeadingNode = { text: h.text, level: h.level, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
      stack.pop()
    }
    stack[stack.length - 1].children.push(node)
    stack.push(node)
  })

  let mapStr = `${title}\n`

  function renderNode(node: HeadingNode, prefix: string, isLast: boolean, isRoot: boolean) {
    if (!isRoot) {
      mapStr += `${prefix}${isLast ? "└── " : "├── "}${node.text}\n`
      if (node.children.length > 0) {
        const childPrefix = prefix + (isLast ? "    " : "│   ")
        node.children.forEach((child, i) =>
          renderNode(child, childPrefix, i === node.children.length - 1, false)
        )
      }
    } else {
      node.children.forEach((child, i) =>
        renderNode(child, "", i === node.children.length - 1, false)
      )
    }
  }

  renderNode(root, "", true, true)

  return "# Page Structure Map\n```text\n" + mapStr.replace(/│\n$/g, "").trimEnd() + "\n```\n"
}

export default function MarkdownPage() {
  const [markdown, setMarkdown] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [pageData, setPageData] = useState<PageData | null>(null)
  const [hasAutoCopied, setHasAutoCopied] = useState(false)
  const [copiedIcon, setCopiedIcon] = useState<"markdown" | "prompt" | "download" | null>(null)
  const defaultToggles = {
    removeImages: true,
    removeLinks: true,
    showMetadata: true,
    showSourceUrl: true,
    showPageMap: true
  }
  const [toggles, setToggles] = useState(defaultToggles)
  const togglesLoaded = useRef(false)

  useEffect(() => {
    chrome.storage.local.get(["pageData", "toggles"], (result) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || "Failed to load")
      } else {
        if (result.toggles) setToggles({ ...defaultToggles, ...result.toggles })
        togglesLoaded.current = true
        if (result.pageData) {
          setPageData(result.pageData)
        } else {
          setError("No page data found. Please trigger the extension again.")
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!togglesLoaded.current) return
    chrome.storage.local.set({ toggles })
  }, [toggles])

  useEffect(() => {
    if (!pageData?.markdown) return

    let baseMd = pageData.markdown

    if (toggles.removeImages) {
      baseMd = baseMd.replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      baseMd = baseMd.replace(/<img[^>]*>/gi, "")
    }

    if (toggles.removeLinks) {
      baseMd = baseMd.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      baseMd = baseMd.replace(/<a[^>]*>(.*?)<\/a>/gi, "$1")
    }

    const meta: string[] = []
    if (toggles.showMetadata) {
      if (pageData.title) meta.push(`**Title:** ${pageData.title}`)
      if (pageData.author) meta.push(`**Author:** ${pageData.author}`)
      if (pageData.date) meta.push(`**Date:** ${new Date(pageData.date).toLocaleDateString()}`)
    }
    if (toggles.showSourceUrl && pageData.url) {
      meta.push(`**Source:** [${pageData.url}](${pageData.url})`)
    }

    let finalMd = meta.length > 0 ? meta.join("\n\n") + "\n\n---\n\n" : ""

    if (toggles.showPageMap) {
      const pageMap = generatePageMap(baseMd, pageData.title || "Page structure map")
      if (pageMap) finalMd += pageMap + "\n---\n\n"
    }

    setMarkdown(cleanMarkdown(finalMd + baseMd))
  }, [pageData, toggles])

  useEffect(() => {
    if (markdown && !hasAutoCopied) {
      setHasAutoCopied(true)
      navigator.clipboard
        .writeText(markdown)
        .then(() => {
          setStatus("Auto-copied!")
          setTimeout(() => setStatus(""), 2000)
        })
        .catch((err) => console.error("Auto-copy failed:", err))
    }
  }, [markdown, hasAutoCopied])

  const flash = (label: string, icon: typeof copiedIcon) => {
    setStatus(label)
    setCopiedIcon(icon)
    setTimeout(() => {
      setStatus("")
      setCopiedIcon(null)
    }, 1500)
  }

  const handleCopy = () =>
    navigator.clipboard.writeText(markdown).then(() => flash("Copied!", "markdown"))

  const handleCopyPrompt = () =>
    navigator.clipboard
      .writeText(`\`\`\`markdown\n${markdown}\n\`\`\``)
      .then(() => flash("Copied as Prompt!", "prompt"))

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${pageData?.title ? pageData.title.replace(/\s+/g, "_") : "page"}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    flash("Downloaded!", "download")
  }

  const handleToggle = (key: keyof typeof toggles) =>
    setToggles((p) => ({ ...p, [key]: !p[key] }))

  const tokenEstimate = Math.ceil(markdown.length / 4)

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <header className="relative px-4 py-4 border-b border-zinc-800/60 bg-zinc-900/60 backdrop-blur-md flex flex-wrap gap-3 items-center justify-between z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={handleCopy}
            className="group inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_2px_10px_-3px_rgba(16,185,129,0.3)] transition-all duration-200 active:scale-[0.98] outline-none focus:ring-2 focus:ring-emerald-500/40">
            {copiedIcon === "markdown" ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <CopyIcon className="w-4 h-4 opacity-90 group-hover:opacity-100" />
            )}
            Copy Markdown
          </button>
          <button
            onClick={handleCopyPrompt}
            className="group inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-all duration-200 active:scale-[0.98] outline-none">
            {copiedIcon === "prompt" ? (
              <CheckIcon className="w-4 h-4 text-emerald-400" />
            ) : (
              <CopyIcon className="w-4 h-4 opacity-70 group-hover:opacity-100" />
            )}
            Copy as Prompt
          </button>
          <button
            onClick={handleDownload}
            className="group inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-all duration-200 active:scale-[0.98] outline-none">
            {copiedIcon === "download" ? (
              <CheckIcon className="w-4 h-4 text-emerald-400" />
            ) : (
              <DownloadIcon className="w-4 h-4 opacity-90 group-hover:opacity-100" />
            )}
            Download .MD
          </button>
        </div>

        {pageData && (
          <div className="hidden lg:flex flex-col items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="flex items-center p-1 bg-zinc-950/60 border border-zinc-800/40 backdrop-blur-xl shadow-lg rounded-full">
              {(
                [
                  { key: "removeImages", icon: ImageIcon, label: "Images", active: !toggles.removeImages },
                  { key: "removeLinks", icon: LinkIcon, label: "Links", active: !toggles.removeLinks },
                  { key: "showMetadata", icon: MetaDataIcon, label: "Page Info", active: toggles.showMetadata },
                  { key: "showPageMap", icon: MapIcon, label: "Map", active: toggles.showPageMap },
                  { key: "showSourceUrl", icon: SourceUrlIcon, label: "Source", active: toggles.showSourceUrl }
                ] as const
              ).map(({ key, icon: Icon, label, active }, i, arr) => (
                <button
                  key={key}
                  onClick={() => handleToggle(key)}
                  className={`group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all
                    ${i === 0 ? "rounded-l-xl" : ""}
                    ${i === arr.length - 1 ? "rounded-r-xl" : ""}
                    ${i > 0 ? "border-l border-zinc-800/40" : ""}
                    ${active ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/40"}`}>
                  <Icon className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-zinc-500 relative z-10">
          {status ? (
            <div className="text-emerald-400 font-medium">{status}</div>
          ) : (
            <div className="flex items-center gap-1.5 text-zinc-400" title="Rough GPT token estimate">
              ~{tokenEstimate.toLocaleString()} tokens
            </div>
          )}
          <div className="hidden sm:block w-px h-3 bg-zinc-700/50" />
          <div className="hidden sm:block">{markdown.length.toLocaleString()} chars</div>
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 text-sm text-red-400 bg-red-950/40 border-b border-red-900/40 shrink-0">
          {error}
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 min-h-0 bg-zinc-950">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 flex flex-col overflow-hidden hover:border-zinc-700/80 transition-colors shadow-sm">
          <div className="px-3 py-2 text-xs font-medium text-zinc-400 border-b border-zinc-800/80 bg-zinc-900/40 flex justify-between items-center">
            <span>Markdown</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  navigator.clipboard
                    .readText()
                    .then((text) => setMarkdown(text + "\n\n" + markdown))
                    .catch(() => {})
                }
                className="hover:text-zinc-200 transition-colors flex items-center gap-1.5 group">
                <PasteIcon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                <span className="hidden xl:inline">Paste</span>
              </button>
              <button
                onClick={() => setMarkdown("")}
                className="hover:text-red-400 transition-colors flex items-center gap-1.5 group">
                <TrashIcon className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
                <span className="hidden xl:inline">Clear</span>
              </button>
            </div>
          </div>
          <textarea
            value={markdown}
            spellCheck={false}
            onChange={(e) => setMarkdown(e.target.value)}
            className="flex-1 w-full p-4 md:p-5 bg-transparent outline-none text-[13px] font-mono text-zinc-300 leading-relaxed resize-none selection:bg-emerald-500/30 placeholder-zinc-700 overflow-y-auto"
            placeholder="Paste or write markdown here..."
          />
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/20 flex flex-col overflow-hidden hover:border-zinc-700/80 transition-colors shadow-sm">
          <div className="px-3 py-2.5 text-xs font-medium text-zinc-400 border-b border-zinc-800/80 bg-zinc-900/40">
            Live Preview
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
            <article className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-200 prose-headings:font-medium prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-zinc-400 prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-strong:text-zinc-200 prose-code:rounded prose-li:text-zinc-400 prose-ul:marker:text-zinc-600 prose-ol:marker:text-zinc-600 prose-blockquote:border-l-zinc-700 prose-blockquote:text-zinc-400 prose-blockquote:font-normal prose-blockquote:not-italic prose-hr:border-zinc-800 prose-pre:leading-none prose-p:my-0 prose-hr:my-4">
              <Markdown>{markdown}</Markdown>
            </article>
          </div>
        </div>
      </main>
    </div>
  )
}
