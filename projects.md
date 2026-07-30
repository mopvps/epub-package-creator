# Epub Front Matter Automation

## Purpose
Browser-only tool (no backend) that builds EPUB navigation/package files: `toc.ncx`, `nav.xhtml`, `package.opf`. User picks build mode (NCX only / NCX+NAV / Full Package), fills metadata, uploads Contents.xhtml + page-list Excel + image folder, tool generates files client-side and bundles as `output.zip` (or single download for NCX-only mode).

## Project Structure
- **index.html** — full UI markup. Startup screen (mode picker) plus 8-step wizard (Meta, Front Matter, Classes, Table of Contents, Generate NCX, Page List, Packaging, Generate Files). Includes code-preview modal, sidebar progress ring/stats.
- **script.js** — all logic, single IIFE, no framework. Handles state, parsing, XML/XHTML/OPF generation, wizard navigation, theming, sidebar stats.
- **style.css** — styling only (theme via `data-theme` attr, light/dark, animations). No logic.
- External libs via CDN: `xlsx.full.min.js` (Excel parsing), `jszip.min.js` (zip bundling).

## Features
- 3 build modes controlling which wizard steps are shown (`MODE_TAB_ORDERS`): mode 1 = NCX only, mode 2 = NCX+NAV, mode 3 = full package (+ OPF).
- Wizard step lock/unlock with validation per step (`validateStep`), progress ring, live sidebar summary (TOC count, pages, images, contributors).
- Front Matter entries: reorderable list (Cover/Title/Copyright/Contents default), add/remove, auto filename from label, `xhtml/` prefix.
- Class list for HTML parsing targets (`toc1` locked default, user can add e.g. `toc2`).
- Contents.xhtml parser: regex-extracts `<p>/<h1-6>` tags with matching classes, pulls first `<a href="*.xhtml">` inside, strips nested tags for label text. Also extracts `<title>`.
- toc.ncx generator: builds navMap from front matter + extracted entries, embeds ISBN/page counts.
- Page List Excel parser (via SheetJS): reads # / File Name / Start Page / End Page columns starting row 3, detects roman-numeral front matter vs. body pages by page-number decrease, expands ranges into per-page entries.
- nav.xhtml generator: EPUB3 nav doc with TOC list + page-list nav from parsed NCX + Excel data.
- package.opf generator: contributors (`marc:relators` role codes), manifest (front matter + extracted entries + images), spine, guide, cover image (`{ISBN}.jpg` convention).
- Images folder upload (`webkitdirectory`), auto media-type guess by extension, excludes cover image from manifest imageItems.
- Code preview modal: view/copy/download any generated file.
- Success panel with confetti animation, per-file view rows, "download all" and "start new build".
- Dark/light theme toggle persisted to `localStorage`.

## How It Works
1. Startup screen: user selects mode (1/2/3) then clicks "Start Building" → reveals wizard, calls `applyMode()`.
2. **Meta**: enter ISBN, total page count, max page number (dtb:depth fixed at 2). Validated via regex/non-empty checks.
3. **Front Matter**: default 4 entries editable/reorderable/deletable; add custom entries (filename auto-slugified from label).
4. **Classes**: define which CSS classes on `<p>/<h*>` tags to extract from Contents.xhtml (`toc1` always included/locked).
5. **Contents**: upload Contents.xhtml; regex extracts title and matching blocks' anchor text/href into `extractedEntries`.
6. **Generate NCX** (modes 2/3 only for a distinct step; mode 1 skips to Generate): builds `toc.ncx` string, parses it back (`parseNcxData`) to populate `navTocEntries`/`navDocTitle` for later nav generation.
7. **Page List** (modes 2/3): upload Excel, parsed into `navPageEntries` (roman numerals pre-body, arabic in body).
8. **Packaging** (mode 3 only): contributors, publisher, date, images folder → feeds `package.opf`.
9. **Generate Files**: review summary shown, "Generate All Files" builds remaining artifacts per mode and either downloads single file (mode 1) or zips via JSZip and triggers download (`output.zip`), then shows success panel with per-file inspection.

All state is in-memory JS variables (`frontMatter`, `extractedEntries`, `contributors`, `imageFiles`, `ncxData`, `navTocEntries`, `navPageEntries`, etc.) — nothing persisted except theme preference.

## Code Quality Notes
- Parsing done entirely with regex against raw HTML/XML text instead of DOMParser — fragile against edge cases (self-closing tags, attribute quoting variance, nested same-tag blocks in `blockRe` since `\1` back-reference doesn't handle nesting).
- `parseContentsFile`/`parseNcxData`/regex-based extraction have no handling for malformed input beyond try/catch at call site — errors surface as generic messages.
- ISBN inserted into identifiers with stray `p` prefix: `urn:isbn: p${isbn}` and `unique-identifier="p${isbn}"` (script.js:189-196) — looks like leftover typo (`p` should likely not be there, or should read `urn:isbn:${isbn}` without space/prefix). Worth confirming intent.
- `escapeXml` vs `escapeXmlPreserveEntities` split is a bit implicit — easy to use wrong one when extending (e.g., titles/labels use "preserve" variant, everything else plain).
- No automated tests present; `Test/` directory exists but untracked/empty per git status.
- Global mutable state via closures instead of a state object/module — manageable at current size but will get harder to extend.
- `setInterval(updateSidebarSummary, 600)` polls continuously as a "safety net" for async updates instead of proper event-driven updates — works but wasteful/hacky.
- No input sanitization against XML injection beyond escaping functions (fine for this use case, but labels/filenames aren't validated for illegal filesystem characters before use as EPUB item hrefs).
- Duplicate/inline modal close fallback logic (`transitionend` + `setTimeout` fallback) suggests possible past bug with animation not firing; verify still necessary.

## Improvement Suggestions
- Swap regex-based HTML parsing for `DOMParser`/`XMLSerializer` — more robust against nested tags, attribute ordering, self-closing variants.
- Add filename/label validation (strip or reject invalid EPUB path characters) before writing manifest/spine entries.
- Extract per-step logic into modules (meta, frontmatter, classes, contents, ncx, nav, package) for maintainability as feature set grows.
- Add unit tests for the pure functions (`buildNcx`, `buildNavXhtml`, `buildPackageOpf`, `parsePageListRows`, `parseContentsFile`) — they're deterministic and easy to test in isolation.
- Clarify/fix the `p${isbn}` prefix in identifiers — confirm with real EPUB validators (epubcheck) whether current output passes.
- Replace polling (`setInterval` sidebar refresh) with direct calls after each state mutation, or a small pub/sub, to avoid unnecessary work.
- Persist wizard state (localStorage/sessionStorage) so accidental reload doesn't lose all entered data.
- Run generated files through epubcheck-style validation before download, surfacing warnings in the UI.
- Support drag-and-drop reordering for front matter list (currently up/down buttons only).
