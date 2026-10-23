# Changelog

All notable changes to markdownme are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.3] - 2026-10-23

### Fixed

- Converting an ordinary web page could fail with "Couldn't fetch the file. The server may block cross-origin requests (CORS)." The page's script never confirmed it had received the request, so the extension wrongly assumed the tab was a PDF and tried to download it. Pages now convert normally again.
- When the extension can't reach a page at all (usually a tab that was open before the add-on was loaded), the preview tab now tells you to reload the page instead of showing a misleading CORS error.

## [1.3.2] - 2026-10-22

### Fixed

- Local `file://` PDFs failed with a fetch error because Firefox never lets extensions read local files, and it has no setting to allow it. The preview tab now asks you to choose the file (or drop it on the page) and converts it from there.

## [1.3.1] - 2026-07-22

### Added

- PDF support. Trigger the extension while viewing a PDF and it converts to Markdown in the same preview tab, with the same toggles, page map, and export options as web pages. Works on remote PDFs (`https://…/paper.pdf`), local files (`file://…/report.pdf`), and PDFs that render inline without a `.pdf` in the URL, such as `arxiv.org/pdf/2607.14479`. Conversion runs entirely in the browser via [pdf2md](https://github.com/opendocsg/pdf2md); nothing is uploaded.

### Notes

- Local `file://` PDFs require "Access your data for file URLs" to be enabled for the add-on in `about:addons`.
- A remote PDF that its server refuses to share cross-origin (CORS) will report an error instead of converting.

## [1.2.1] - 2026-04-21

### Added

- Toolbar button to convert the current page, plus a configurable keyboard shortcut (default `Alt+M`).
- Settings page for recording a custom shortcut.

### Changed

- Replaced the right-click context menu with the toolbar button.
- Switched the preview UI from dark mode to light mode.

## [1.1.0] - 2026-04-21

### Added

- Convert only the selected text when a selection is active, instead of the whole page.
- Output toggles (images, links, metadata, source URL, page map) that persist between conversions.

## [1.0.0] - 2026-04-21

### Added

- Initial release. One-click conversion of a web page to clean Markdown using Mozilla's Readability and Turndown, with a split-pane preview tab and copy/download export.
