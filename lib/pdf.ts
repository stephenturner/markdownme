export interface PdfRequest {
  url: string
  title: string
}

// Fetch a PDF and confirm it really is one before handing it to the converter.
// Extension pages get cross-origin fetch via the manifest host_permissions; a
// remote server still has to allow the request (CORS) for it to succeed.
export async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(
      "Couldn't fetch the file. The server may block cross-origin requests (CORS), or file access isn't enabled for the extension."
    )
  }
  if (!res.ok) throw new Error(`The server returned ${res.status}.`)

  const bytes = new Uint8Array(await res.arrayBuffer())
  const magic = String.fromCharCode(...bytes.slice(0, 5))
  if (magic !== "%PDF-") throw new Error("That file isn't a PDF.")
  return bytes
}

export function pdfTitleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    const base = decodeURIComponent(path.split("/").pop() || "")
    return base.replace(/\.pdf$/i, "") || "PDF"
  } catch {
    return "PDF"
  }
}

// vendor/pdf2md.js is a prebuilt bundle (~1.6 MB, pdf.js via unpdf, no separate
// worker file) built as an IIFE that assigns a `pdf2mdBundle` global. It cannot
// go through parcel: importing the npm package fails (parcel can't resolve
// unpdf's subpath exports), and every parcel-processed form of the vendor file
// fails to load in the extension at runtime ("Cannot find module …") because
// parcel re-wraps it and its async-chunk registry doesn't survive the
// moz-extension context. So the file is declared in web_accessible_resources
// (which makes Plasmo copy it verbatim to a stable path) and loaded with a
// plain <script> tag off chrome.runtime.getURL. Same-origin, so the extension
// CSP allows it, and the browser fetches it directly — no parcel involvement.
type Pdf2Md = (bytes: Uint8Array | ArrayBuffer) => Promise<string>

declare global {
  interface Window {
    pdf2mdBundle?: { default: Pdf2Md }
  }
}

let loadPromise: Promise<void> | null = null

function loadPdf2md(): Promise<void> {
  if (window.pdf2mdBundle) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = chrome.runtime.getURL("vendor/pdf2md.js")
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error("Couldn't load the PDF converter."))
    }
    document.head.appendChild(script)
  })
  return loadPromise
}

export async function convertPdf(bytes: Uint8Array): Promise<string> {
  await loadPdf2md()
  const pdf2md = window.pdf2mdBundle?.default
  if (!pdf2md) throw new Error("PDF converter is unavailable.")
  return pdf2md(bytes)
}
