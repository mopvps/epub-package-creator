# Project Overview

Browser-only, no-backend tool that generates EPUB front-matter navigation/package files: `toc.ncx`, `nav.xhtml`, and `package.opf`. Built for EPUB production/QA staff who assemble front matter (cover, title, copyright, contents, TOC) for ebooks and need these three standard files generated from a page-layout spreadsheet and an existing `Contents.xhtml`, instead of hand-writing XML. Runs entirely client-side (static HTML/CSS/JS, no server, no build step).

# Tech Stack

- Vanilla JavaScript (single IIFE in `script.js`), no framework
- Vanilla CSS with `data-theme` attribute for light/dark theming (`style.css`)
- Plain HTML (`index.html`)
- External libs via CDN:
  - `xlsx.full.min.js` (SheetJS) — reads the master Excel workbook
  - `jszip.min.js` — bundles generated files into `output.zip`
  - Google Fonts (Fraunces, Inter) + Tabler Icons webfont
- No package manager, no bundler, no tests

# File Structure

```
index.html      Full UI markup: startup screen + 7-step wizard, 2 modals
style.css       All styling, theme variables, animations. No logic.
script.js       All state, parsing, XML generation, wizard logic (single IIFE)
projects.md     Pre-existing analysis notes (older/partially stale — describes an 8-step layout that no longer matches index.html)
Testing/        Sample EPUB QA fixtures (unrelated test data, not part of app logic)
```

Key `index.html` regions:
- `#startupScreen` — mode picker (3 `.mode-card` buttons: TOC NCX / TOC+NAV / Full Package) + "Start Building"
- `#appRoot` — main app, hidden until a mode is chosen
  - `.sidebar` — brand, step nav (`.tab-btn` × 7), collapsible Build Status panel (progress ring, quick stats, title/ISBN summary), theme toggle
  - `.canvas` — header (step title/desc/progress bar) + `.canvas-body` containing one `.tab-panel` per step:
    1. `tab-excel` — upload master Excel, download template, preview counts
    2. `tab-contents` — upload `Contents.xhtml`, detected title, extracted entries list
    3. `tab-classes` — pick which CSS classes to extract from Contents.xhtml
    4. `tab-generatencx` — Generate NCX button + preview
    5. `tab-nav` — Generate NAV button + preview
    6. `tab-package` — contributors, publisher/date, images folder upload
    7. `tab-generate` — review summary, "Generate All Files", success panel with per-file view/download
- `#fileViewModal` — table preview modal (Excel rows / extracted Contents entries)
- `#codeModal` — generated-file code viewer (copy/download)

# Architecture

Everything lives in one closured IIFE in `script.js`; all "state" is plain module-scoped variables (`excelRows`, `extractedEntries`, `allExtractedEntries`, `h2Entries`, `docTitle`, `detectedClasses`, `extractClasses`, `ncxData`, `lastNavXhtml`, `lastPackageOpf`, `navTocEntries`, `navPageEntries`, `contributors`, `imageFiles`, `selectedMode`). Nothing persists across reload except the dark/light theme (`localStorage`).

Data flow:
1. **Excel upload** (`loadMasterExcel` → `parseMasterExcelRows`) reads workbook via SheetJS: row1/col B = ISBN, row2 = header, data from row3. Columns: `#, File Name, Start Page, End Page, flag, pagelist`. Produces `excelRows` (per-file metadata) and `navPageEntries` (expanded per-page list, roman numerals before the page-number sequence resets/decreases — i.e. front matter — arabic after).
2. **Contents.xhtml upload** (`parseContentsFile`) auto-detects the dominant `toc*` class used on `<p>` tags with `.xhtml` links (`primaryClass`), extracts `<title>`, and regex-scans `<p|h1-6>` blocks for anchors, filtered by selected classes into `extractedEntries`/`allExtractedEntries`. Also separately scans `<h2>` tags into `h2Entries` (used as section/part labels).
3. **Class selection** (`extractClasses`, `detectedClasses`) filters which of the extracted entries actually populate the TOC (`toc1` always locked/included); changing selection re-runs `recomputeExtracted()`.
4. **Generate NCX** (`buildNcx`) — builds `navMap` from `getNcxEntries()` (Excel row order, excluding `flag===1` rows, joined with `extractedEntries` labels), embedding ISBN/page counts. Result is stored (`ncxData`) and re-parsed (`parseNcxData`) via regex to populate `navTocEntries`/`navDocTitle`, which the NAV step consumes.
5. **Generate NAV** (`buildNavXhtml`) — builds EPUB3 `nav.xhtml` with a nested TOC list (rows with `flag===1` become `<li><ol>` parents using `h2Entries` labels) and a `page-list` nav from `navPageEntries`.
6. **Packaging** (mode 3 only) — contributors (mapped to `marc:relators` codes), publisher/date, images folder (`webkitdirectory`, media-type guessed by extension, cover image `{ISBN}.jpg` excluded from manifest image items).
7. **Generate All** (`buildPackageOpf` + zip) — assembles manifest (front-matter + extracted entries + images), spine, guide, cover reference; bundles all applicable files via JSZip into `output.zip` (or single `toc.ncx` download for mode 1).

Wizard/navigation layer is separate from generation logic: `MODE_TAB_ORDERS` maps each of the 3 modes to its own ordered tab list, `unlockedIndex` gates forward navigation, `validateStep()` checks required state per tab before advancing, and a `MutationObserver` on `.tab-panel` class changes drives `refreshChrome()` (updates header title/desc/progress bar, re-renders review summary on the final step).

A live sidebar "Build Status" panel (`updateSidebarSummary`) mirrors current state (TOC/pages/images/contributors counts, title, ISBN, animated progress ring, confetti on completion) — it's presentation-only and re-runs on most input/click events plus a 600ms `setInterval` safety net.

# Features

- 3 build modes (radio-card picker on startup): **TOC NCX** only, **TOC + NAV**, or **Full Package** (adds OPF) — controls which wizard steps appear and what's bundled.
- Download a starter Excel template (`downloadExcelTemplate`) with the expected column layout and example rows.
- Master Excel upload: parses ISBN, per-entry page ranges, section flags, and a "no separate pagelist" flag; auto-derives roman vs. arabic page numbering by detecting where the page sequence restarts.
- Contents.xhtml upload with auto-detected TOC CSS class (based on which `toc*` class has the most `.xhtml` links), manual add/remove of extra classes to extract, detected `<title>` display.
- Live preview cards (TOC entry count, page-list count, section count) as data is uploaded.
- Step-locked wizard: each step validates required fields before unlocking the next; progress bar, per-step "Done/In progress/Locked" state badges.
- Generate NCX / Generate NAV as discrete, previewable steps (raw XML shown in a `<pre>` before continuing).
- Contributors list (add/remove, name + role dropdown mapped to MARC relator codes).
- Publisher + date fields (date auto-prefilled with current timestamp).
- Images folder upload via directory picker; auto image count, media-type guessing (`jpg/jpeg/png/gif`), cover image (`{ISBN}.jpg`) auto-excluded from manifest image entries.
- Review screen summarizing all captured data before generation (fields hidden/shown per selected mode via `REVIEW_HIDE_BY_MODE`).
- "Generate All Files" — downloads a single `.ncx` (mode 1) or an `output.zip` bundle (modes 2/3) via JSZip.
- Success panel: confetti animation, per-generated-file rows (view/download), "Download all" and "Start a new build" (resets all state back to the mode picker).
- File preview modals: tabular preview of parsed Excel rows and extracted Contents entries, plus a raw source-code viewer/copy/download modal for generated files and the raw uploaded Contents.xhtml.
- Dark/light theme toggle, persisted via `localStorage`, respects `prefers-color-scheme` on first load.
- Inline field validation (ISBN must be 13 digits, required-field checkmarks).

# Key Logic

- **Front-matter vs. body page numbering**: `parseMasterExcelRows` has no explicit "front matter" column — it infers the switch to arabic numerals purely by watching for `startPage < prevStart` (a decrease signals the page count restarted at the start of the book body). Fragile if the workbook isn't laid out in the expected monotonic order.
- **Auto-detected TOC class**: rather than asking the user to specify a CSS class up front, the code scans all `<p class="...">` elements, counts which `toc*`-named class most often wraps an `.xhtml` link, and defaults to that as the "primary" (locked) class. Any other `toc*` classes found are added as optional/toggle-able extras.
- **`flag` column semantics**: rows with `flag===1` in the Excel act as **part/section headers** — excluded from the flat NCX navPoint list (`getNcxEntries` filters them out) but used in NAV generation to open a nested `<ol>` block (labeled from `h2Entries`, i.e. matched against `<h2>` anchors in Contents.xhtml, not the Excel label).
- **ISBN identifier prefix**: `package.opf`'s `dc:identifier`/`unique-identifier` and `dc:source` are emitted as `urn:isbn: p{ISBN}` / `id="p{ISBN}"` — the leading `p` and space look like a leftover artifact rather than intentional EPUB convention (flagged already in `projects.md`).
- **Two escaping functions**: `escapeXml` (escapes everything incl. `&`) vs `escapeXmlPreserveEntities` (skips already-valid entities like `&#x2013;` or `&amp;`) — used inconsistently by design: titles/labels use the "preserve" variant so pre-existing HTML entities in the source Contents.xhtml survive; hrefs/ids/attributes use the strict variant.
- **Parsing is regex-only for content extraction**, not DOM-based, specifically to preserve raw HTML entities in labels — `DOMParser` is used only for class-detection scanning (`scanDoc`), not for the actual anchor/label extraction that feeds the generated files.

# Known Gaps / TODOs

- `p{ISBN}` prefix in `package.opf` identifiers looks like an unintentional typo, unverified against `epubcheck`.
- Regex-based block matching (`blockRe` = `<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>`) doesn't handle nested same-tag structures correctly (backreference `\1` breaks on nesting).
- No handling for malformed/invalid XHTML beyond a generic try/catch at the call site — errors just show a message, no detail on what failed to parse.
- No filename/label sanitization against illegal EPUB path characters before they're written into manifest `href`/`id` attributes.
- `setInterval(updateSidebarSummary, 600)` is an admitted polling "safety net" instead of fully event-driven state updates.
- No automated tests; `Testing/` folder contains sample EPUB QA fixtures, not unit tests for this tool's logic.
- Wizard state isn't persisted — a page reload loses all uploaded files/entered data (only the theme preference survives).
- No output validation (e.g. running generated files through an `epubcheck`-style check) before download.
- Front-matter reordering is Excel-row-order only — no in-UI drag/reorder for entries (the older `projects.md` notes describe up/down buttons that don't exist in the current `index.html`, and describe an 8-step wizard/separate "Meta"/"Front Matter" steps not present in the current code — `projects.md` is stale relative to the current implementation and should probably be reconciled or removed).
