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

- **`background.ts`** — service worker. Handles toolbar icon clicks (`chrome.action.onClicked`) and keyboard shortcut commands (`convert-to-markdown`, default `Alt+M`). Both forward `{ action: "convert-to-markdown" }` to the active tab's content script via `chrome.tabs.sendMessage`. When it receives `open-markdown-tab` back from the content script, it opens `tabs/markdown.html`.

- **`content.ts`** — injected into every page. Does the actual conversion. If text is selected when the extension is triggered, it extracts HTML from the selection range directly and skips Readability. Otherwise it clones the DOM, strips Wikipedia-specific noise, runs `@mozilla/readability`, and falls back to a `<main>`/`#content` selector chain. Converts to Markdown with `turndown` (GFM plugin enabled). Stores the result in `chrome.storage.local` under `pageData` and sends `open-markdown-tab` to the background script.

- **`options.tsx`** — extension settings page (accessible via about:addons → markdownme → Preferences). Lets the user record a custom keyboard shortcut; reads the current binding via `chrome.commands.getAll()` and saves changes via `chrome.commands.update()`. Uses `event.code` (not `event.key`) to capture physical keys, avoiding Mac Alt-key character substitution.

- **`tabs/markdown.tsx`** — a full React page rendered in a new tab. On mount, reads both `pageData` and `toggles` from `chrome.storage.local` in a single call. Toggle state (images, links, metadata, source URL, page map) is persisted back to storage on every change; a `togglesLoaded` ref prevents the default values from overwriting storage before the initial load resolves. Re-derives the final markdown on every toggle change. The page map is a tree view generated from heading levels in the markdown. Auto-copies to clipboard on first render.

**Data flow:** `content.ts` → `chrome.storage.local` → `tabs/markdown.tsx`. The background script only opens the tab; it never touches the markdown content. Toggle preferences are also stored in `chrome.storage.local` under `toggles`. The keyboard shortcut binding is managed by the browser and updated via `chrome.commands.update()` from the options page.

**Shared code in `lib/`:**
- `types.ts` — `PageData` and `HeadingNode` interfaces shared between content and tab
- `cleanMarkdown.ts` — post-processing to remove blank bullets, collapse blank lines, and trim

## Build notes

Plasmo reads the `manifest` field in `package.json` and merges it into the generated `manifest.json`. The `version` field in `package.json` is the extension version — Firefox Add-ons requires it to increment monotonically.

For AMO submission, generate the source zip with:
```bash
zip -r markdownme-source.zip . --exclude "node_modules/*" --exclude "build/*" --exclude ".git/*"
```
