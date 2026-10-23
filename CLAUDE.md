# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install dependencies
pnpm dev              # dev build with watch (outputs to build/firefox-mv3-dev/)
pnpm build            # production build + zip (outputs to build/firefox-mv3-prod/)
```

There is no test suite or linter configured.

## Loading the extension in Firefox

After `pnpm dev`, go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `build/firefox-mv3-dev/manifest.json`. The add-on must be reloaded from that page after each Firefox restart (temporary add-ons are not persisted).

After changing `content.ts` or `background.ts`, click **Reload** on the extension in `about:debugging`. After changing `tabs/markdown.tsx`, just reload the preview tab.

## Architecture

This is a Firefox MV3 browser extension built with [Plasmo](https://plasmo.com/). There are three distinct execution contexts:

- **`background.ts`** — service worker. Handles toolbar icon clicks (`chrome.action.onClicked`) and keyboard shortcut commands (`convert-to-markdown`, default `Alt+M`). For normal pages it forwards `{ action: "convert-to-markdown" }` to the active tab's content script via `chrome.tabs.sendMessage`. If the active tab's URL is a PDF (path ends in `.pdf`), it takes a different path: it stores `{ pdfRequest: { url, title } }` (and nulls out `pageData`) in `chrome.storage.local` and opens `tabs/markdown.html` directly, because Firefox renders PDFs in its own viewer where our content script never runs. When it receives `open-markdown-tab` back from the content script, it opens `tabs/markdown.html`.

- **`content.ts`** — injected into every page. Does the actual conversion. If text is selected when the extension is triggered, it extracts HTML from the selection range directly and skips Readability. Otherwise it clones the DOM, strips Wikipedia-specific noise, runs `@mozilla/readability`, and falls back to a `<main>`/`#content` selector chain. Converts to Markdown with `turndown` (GFM plugin enabled). Stores the result in `chrome.storage.local` under `pageData` and sends `open-markdown-tab` to the background script.

- **`options.tsx`** — extension settings page (accessible via about:addons → markdownme → Preferences). Lets the user record a custom keyboard shortcut; reads the current binding via `chrome.commands.getAll()` and saves changes via `chrome.commands.update()`. Uses `event.code` (not `event.key`) to capture physical keys, avoiding Mac Alt-key character substitution.

- **`tabs/markdown.tsx`** — a full React page rendered in a new tab. On mount, reads `pageData`, `pdfRequest`, and `toggles` from `chrome.storage.local` in a single call. If a `pdfRequest` is present it fetches the PDF bytes, converts them with `pdf2md`, and builds a `PageData` object (title derived from the filename); otherwise it uses the `pageData` written by the content script. Everything downstream (toggles, page map, export) is identical for both sources. Toggle state (images, links, metadata, source URL, page map) is persisted back to storage on every change; a `togglesLoaded` ref prevents the default values from overwriting storage before the initial load resolves. Re-derives the final markdown on every toggle change. The page map is a tree view generated from heading levels in the markdown. Auto-copies to clipboard on first render.

**Data flow:** `content.ts` → `chrome.storage.local` → `tabs/markdown.tsx`. The background script only opens the tab; it never touches the markdown content. Toggle preferences are also stored in `chrome.storage.local` under `toggles`. The keyboard shortcut binding is managed by the browser and updated via `chrome.commands.update()` from the options page.

**Shared code in `lib/`:**
- `types.ts` — `PageData` and `HeadingNode` interfaces shared between content and tab
- `cleanMarkdown.ts` — post-processing to remove blank bullets, collapse blank lines, and trim
- `pdf.ts` — PDF path used by the tab: `fetchPdfBytes` (fetch + `%PDF-` magic-byte check via `checkPdfBytes`), `isLocalFileUrl`, `pdfTitleFromUrl`, and `convertPdf`. The extension's `host_permissions` give the tab page cross-origin fetch for `http(s)`; a remote server still has to allow CORS. Firefox never lets extensions fetch `file://` URLs (no per-add-on file access setting exists, unlike Chrome), so for a `file://` `pdfRequest` the tab skips the fetch and shows a "Choose file" prompt that also accepts drag and drop, then reads the picked `File` directly.

**PDF conversion bundle (`vendor/pdf2md.js`):** a prebuilt browser bundle of [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (pdf.js via unpdf, no separate worker file), **checked in deliberately**. It is built as an esbuild **IIFE** that assigns a `window.pdf2mdBundle` global (`pdf2mdBundle.default` is the convert function). `lib/pdf.ts` loads it by injecting a `<script src={chrome.runtime.getURL("vendor/pdf2md.js")}>` tag into the tab and then reads the global — no parcel involvement at all.

Everything that routes this bundle through parcel was tried and fails, so don't "simplify" it back:
- Importing the npm package (`import pdf2md from "@opendocsg/pdf2md"`) fails the build — parcel can't resolve unpdf's `unpdf/pdfjs` subpath export.
- A static `import("~vendor/pdf2md.js")` (parcel-managed async chunk) builds but throws `Cannot find module '<id>'` at runtime — parcel's async-chunk registry doesn't survive the moz-extension context.
- A `url:` raw-asset import still runs the file through parcel's JS transformer (it comes out `parcelRequire`-wrapped with the global stripped) and also gets a dev `?<timestamp>` cache-buster that Firefox's resource loader rejects.

The winning path needs two things: the file must reach the build **verbatim**, and it must load **outside** parcel's module system. Listing `vendor/pdf2md.js` in `web_accessible_resources` (in the `package.json` manifest) makes Plasmo copy it as-is to a stable, hash-free path; the `<script>` tag off `chrome.runtime.getURL` loads it same-origin (allowed by the extension CSP) with no bundler in the loop. Works identically in `pnpm dev` and `pnpm build`.

To refresh the bundle: rebuild the ESM bundle in [pdfdown](https://github.com/stephenturner/pdfdown) (`npm run build:pdf2md`), then re-wrap it as an IIFE global with `esbuild vendor/pdf2md.js --bundle --format=iife --global-name=pdf2mdBundle --platform=browser --minify --outfile=vendor/pdf2md.js` and copy that here. (The two `import.meta`/`createRequire` warnings are unpdf's Node-only fallback path, dead code in the browser.)

## Build notes

Plasmo reads the `manifest` field in `package.json` and merges it into the generated `manifest.json`. The `version` field in `package.json` is the extension version — Firefox Add-ons requires it to increment monotonically.

For AMO submission, generate the source zip from an allowlist of the files needed to build:
```bash
zip -r -X markdownme-source.zip \
  background.ts content.ts options.tsx tabs lib vendor assets \
  package.json pnpm-lock.yaml tsconfig.json tailwind.config.js postcss.config.js \
  .prettierrc.mjs turndown-plugin-gfm.d.ts README.md LICENSE CHANGELOG.md CLAUDE.md \
  -x "*.DS_Store"
```

Don't switch to a `zip -r . --exclude …` approach. It sweeps in Parcel's `.plasmo/` cache (~280 MB, over AMO's 200 MB upload limit), `web-ext-artifacts/`, the previous source zip, and `.env` (the AMO API key and secret). If a new file becomes part of the build, add it to the list here and in `README.md`.
