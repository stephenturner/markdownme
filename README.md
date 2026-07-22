# markdownme

Turn any webpage or PDF into clean, LLM-ready Markdown in one click. Strip the browser, keep the structure, then copy or download instantly.

![](screenshot.png)

## How it works

1. Open any webpage
2. Click the markdownme toolbar button (or press `Alt+M`)
3. Get clean Markdown instantly

## Features

- **One-click conversion** via toolbar button or `Alt+M` keyboard shortcut (configurable in Settings)
- **Works on PDFs too:** trigger the extension while viewing any PDF (a remote `https://…/paper.pdf` or a local `file://…/report.pdf`) and it converts to Markdown, using [pdf2md](https://github.com/opendocsg/pdf2md) entirely in the browser
- **Smart extraction** powered by Mozilla's Readability to isolate main content and ignore ads, navbars, and boilerplate
- **Dedicated preview tab** with a live split-pane editor and rendered preview
- **Toggles** to customize output: images, links, metadata (title/author/date), source URL, and a document structure map
- **Export options:** copy to clipboard, download as `.md`, or copy wrapped as a code block for AI prompts

HTML pages carry navigation bars, scripts, ads, and deeply nested DOM structures that consume context window without adding meaning. Clean Markdown removes the noise, preserves headings and structure, and fits more useful content into limited context windows.

## Installation

The extension is available on [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/markdownme/).

Or install directly from the [GitHub releases page](https://github.com/stephenturner/markdownme/releases):

1. Download the `.xpi` file from the latest release
2. Open Firefox and go to `about:addons`
3. Click the gear icon and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file and confirm the installation

Or build it yourself from source (see below).

## Building from source

### Environment

- **OS:** macOS, Linux, or Windows (WSL recommended on Windows)
- **Node.js:** v18 or later — [nodejs.org](https://nodejs.org/)
- **pnpm:** v9 or later — install with `npm install -g pnpm`

Key build dependencies (installed automatically via `pnpm install`):
- Plasmo 0.90.3 (extension framework and bundler)
- TypeScript 5.3.3
- React 18.2.0

### Development

```bash
# Install dependencies
pnpm install

# Start the dev server (outputs to build/firefox-mv3-dev/)
pnpm dev
```

Then load it in Firefox:

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to `build/firefox-mv3-dev/` and select the `manifest.json` file

The extension will stay loaded until you close Firefox or click "Remove."

### Iterating

Plasmo watches your files and rebuilds on save. After each rebuild:

- Changes to `tabs/markdown.tsx` (the preview UI) — reload the open preview tab, or trigger the extension again on any page
- Changes to `content.ts` or `background.ts` — go to `about:debugging`, find the extension, and click **Reload**. Content scripts are injected at page load time, so a full reload is required for those changes to take effect

One gotcha: temporary add-ons are wiped when Firefox closes. You have to re-load from `about:debugging` each time you restart. That's expected — the permanent install only happens after you sign and install the built `.zip`.

### Production build

Before building, set the version number in `package.json`:

```json
"version": "1.0.0"
```

Firefox Add-ons requires versions to always increment — `1.0.0` → `1.0.1` → `1.1.0` etc. Plasmo reads this field and embeds it in the built manifest automatically.

```bash
pnpm build
```

This produces two things in `build/firefox-mv3-prod/`:

- A folder with the unpacked extension
- A `.zip` file ready for upload to Firefox Add-ons

### Local install (signed, permanent)

To install permanently without waiting for AMO review, sign for self-distribution using `web-ext`. Get API credentials from `addons.mozilla.org/developers/addon/api/key/`, then add them to `.env` (already gitignored):

```
WEB_EXT_API_KEY=your-jwt-issuer
WEB_EXT_API_SECRET=your-jwt-secret
```

Then build and sign:

```bash
# Bump patch version in package.json first, e.g. 1.1.1
pnpm build && \
   source .env && \
   web-ext sign --channel=unlisted \
  --source-dir=build/firefox-mv3-prod \
  --api-key=$WEB_EXT_API_KEY \
  --api-secret=$WEB_EXT_API_SECRET
```

The signed `.xpi` lands in `web-ext-artifacts/`. Open it in Firefox to install permanently. This doesn't conflict with a listed submission that's under review.

### Submitting to Firefox Add-ons (AMO)

1. Run `pnpm build` to generate the zip
2. Sign in at [addons.mozilla.org/developers](https://addons.mozilla.org/en-US/developers/)
3. Click **Submit a New Add-on** (or **Upload New Version** for updates)
4. Upload the `.zip` from `build/firefox-mv3-prod/`
5. When prompted for source code, AMO will ask whether you use any build tools. Answer yes — Plasmo (Parcel bundler + SWC minifier) bundles and minifies the source. Generate the source zip with an allowlist of exactly the files needed to build, so nothing else is swept in:

   ```bash
   zip -r -X markdownme-source.zip \
     background.ts content.ts options.tsx tabs lib vendor assets \
     package.json pnpm-lock.yaml tsconfig.json tailwind.config.js postcss.config.js \
     .prettierrc.mjs turndown-plugin-gfm.d.ts README.md LICENSE CHANGELOG.md CLAUDE.md \
     -x "*.DS_Store"
   ```

   This produces a ~800 KB zip. Do **not** use a `zip -r . --exclude …` approach: it silently sweeps in Parcel's `.plasmo/` cache (~280 MB, which blows past AMO's 200 MB upload limit), `web-ext-artifacts/`, the previous source zip, and `.env` (your AMO API key and secret). Upload the allowlisted zip. AMO reviewers will run `pnpm install` and `pnpm build` to verify the output matches the submitted extension.
6. In the **Notes to reviewer** field, explain the one prebuilt file that `pnpm build` does not regenerate (`vendor/pdf2md.js`). Paste the block below.
7. Fill in the listing details and submit for review

#### Notes to reviewer

The submission contains one third-party bundle that the extension's own build does not produce, so reviewers can't reproduce it with `pnpm build` alone. Paste this into the notes field (adjust wording as you like):

> **Build:** The extension is built with [Plasmo](https://plasmo.com/) (Parcel bundler + SWC minifier). Run `pnpm install` then `pnpm build`; the output is `build/firefox-mv3-prod/`. All of the extension's own source (`background.ts`, `content.ts`, `options.tsx`, `tabs/`, `lib/`) is minified by that step and reproducible from the source zip.
>
> **Prebuilt library (`vendor/pdf2md.js`, ~1.6 MB, minified):** This is [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) version `0.2.7` (an MIT-licensed PDF-to-Markdown converter that wraps Mozilla's pdf.js via [unpdf](https://github.com/unjs/unpdf)), prebundled with esbuild. It is **not** processed by `pnpm build`: it's declared in `web_accessible_resources` and copied into the package byte-for-byte, then loaded at runtime via a `<script>` tag. It ships prebuilt because Parcel cannot resolve unpdf's `unpdf/pdfjs` subpath export from source, so the extension build fails if it tries to bundle the package directly.
>
> **To reproduce `vendor/pdf2md.js` from source:**
> ```bash
> mkdir pdf2md-build && cd pdf2md-build
> npm init -y
> npm install @opendocsg/pdf2md@0.2.7 esbuild
> printf "import pdf2md from '@opendocsg/pdf2md'\nexport default pdf2md\n" > entry.js
> npx esbuild entry.js --bundle --format=iife --global-name=pdf2mdBundle --platform=browser --minify --outfile=pdf2md.js
> ```
> The result is functionally identical to the shipped `vendor/pdf2md.js`: an IIFE that assigns a global `pdf2mdBundle`, where `pdf2mdBundle.default` is the convert function. (esbuild output can differ byte-for-byte between machines/versions; the reviewer-runnable command above pins the library to `0.2.7`.) The two esbuild warnings about `import.meta`/`createRequire` are from unpdf's Node-only fallback path, which is dead code in the browser build.

> **Note:** Before submitting, update the `gecko.id` in `package.json` under `manifest.browser_specific_settings.gecko` to a unique identifier for your listing (e.g., `"your-addon-name@yourdomain"`). This ID must match across all versions you submit.

## Built with

- [Plasmo](https://plasmo.com/) — browser extension framework
- [React](https://reactjs.org/) — UI
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [@mozilla/readability](https://github.com/mozilla/readability) — content extraction
- [Turndown](https://github.com/mixmark-io/turndown) — HTML to Markdown
- [@opendocsg/pdf2md](https://github.com/opendocsg/pdf2md) — PDF to Markdown (prebuilt bundle in `vendor/`, shared with [pdfdown](https://github.com/stephenturner/pdfdown))

## License

MIT

## Credits

Modified from [MD-This-Page](https://github.com/Ademking/MD-This-Page) by [Adem Kouki](https://github.com/Ademking).
