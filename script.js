(function () {
  "use strict";

  const XHTML_PREFIX = "xhtml/";

  let extractedEntries = [];
  let allExtractedEntries = [];
  let h2Entries = [];
  let docTitle = "";
  let extractClasses = [];
  let detectedClasses = ["toc1"];
  let rawContentsText = "";

  const classBadgesWrap = document.getElementById("classBadgesWrap");
  const classCount = document.getElementById("classCount");
  const newClassInput = document.getElementById("newClass");
  const addClassBtn = document.getElementById("addClassBtn");
  const fileInput = document.getElementById("fileInput");
  const fileNameSpan = document.getElementById("fileName");
  const contentsViewBtn = document.getElementById("contentsViewBtn");
  const viewContentsBtn = document.getElementById("viewContentsBtn");
  const extractedList = document.getElementById("extractedList");
  const docTitlePreview = document.getElementById("docTitlePreview");
  const docTitleText = document.getElementById("docTitleText");
  const statusMsg = document.getElementById("statusMsg");
  const themeToggle = document.getElementById("themeToggle");

  const isbnInput = document.getElementById("isbn");
  const totalPageCountInput = document.getElementById("totalPageCount");
  const maxPageNumberInput = document.getElementById("maxPageNumber");

  const xlsxFileInput = document.getElementById("xlsxFileInput");
  const xlsxFileName = document.getElementById("xlsxFileName");
  const excelConfirm = document.getElementById("excelConfirm");
  const excelViewBtn = document.getElementById("excelViewBtn");
  const tocCountPreview = document.getElementById("previewToc");
  const pageCountPreview = document.getElementById("previewPages");
  const sectionsCountPreview = document.getElementById("previewSections");
  const generateAllBtn = document.getElementById("generateAllBtn");
  const generateNcxBtn = document.getElementById("generateNcxBtn");
  const ncxStatusMsg = document.getElementById("ncxStatusMsg");
  const ncxPreview = document.getElementById("ncxPreview");
  const ncxNextBtn = document.getElementById("ncxNextBtn");

  let ncxData = null;
  let lastNavXhtml = null;
  let lastPackageOpf = null;
  let navTocEntries = [];
  let navPageEntries = [];
  let excelRows = [];
  let navDocTitle = "";

  let contributors = [{ name: "", role: "Author" }];
  let imageFiles = [];

  const contributorList = document.getElementById("contributorList");
  const addContributorBtn = document.getElementById("addContributorBtn");
  const publisherInput = document.getElementById("publisherInput");
  const dateInput = document.getElementById("dateInput");
  const imagesFolderInput = document.getElementById("imagesFolderInput");
  const imagesFolderName = document.getElementById("imagesFolderName");
  const imagesCountPreview = document.getElementById("imagesCountPreview");

  const ROLE_CODES = {
    Author: "aut",
    Editor: "edt",
    Illustrator: "ill",
    Translator: "trl",
    Contributor: "ctb"
  };

  function pad2(n) { return String(n).padStart(2, "0"); }

  function defaultDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  dateInput.value = defaultDateString();

  function renderContributors() {
    contributorList.innerHTML = "";
    contributors.forEach((c, idx) => {
      const li = document.createElement("li");
      li.className = "entry-item";

      const fields = document.createElement("div");
      fields.className = "entry-fields";

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "Name";
      nameInput.value = c.name;
      nameInput.addEventListener("input", () => {
        c.name = nameInput.value;
      });

      const roleSelect = document.createElement("select");
      Object.keys(ROLE_CODES).forEach((role) => {
        const opt = document.createElement("option");
        opt.value = role;
        opt.textContent = role;
        if (role === c.role) opt.selected = true;
        roleSelect.appendChild(opt);
      });
      roleSelect.addEventListener("change", () => {
        c.role = roleSelect.value;
      });

      fields.appendChild(nameInput);
      fields.appendChild(roleSelect);
      li.appendChild(fields);

      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.title = "Delete";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => {
        contributors.splice(idx, 1);
        renderContributors();
      });
      li.appendChild(delBtn);

      contributorList.appendChild(li);
    });
  }

  addContributorBtn.addEventListener("click", () => {
    contributors.push({ name: "", role: "Author" });
    renderContributors();
  });

  imagesFolderInput.addEventListener("change", () => {
    imageFiles = Array.from(imagesFolderInput.files).map((f) => f.name.split("/").pop());
    imagesFolderName.textContent = `${imageFiles.length} images found`;
    imagesCountPreview.hidden = false;
    imagesCountPreview.innerHTML = `<strong>${imageFiles.length}</strong> images found`;
  });

  function guessMediaType(filename) {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "gif") return "image/gif";
    return "application/octet-stream";
  }

  function stripExt(filename) {
    return filename.replace(/\.[^./\\]+$/, "");
  }

  function buildPackageOpf() {
    const isbn = isbnInput.value.trim();
    const totalPageCount = totalPageCountInput.value.trim();
    const publisher = publisherInput.value.trim();
    const date = dateInput.value.trim();
    const title = docTitle || "Untitled";
    const allEntries = getExcelEntries();

    let contributorBlocks = "";
    contributors.forEach((c, idx) => {
      if (!c.name.trim()) return;
      const seq = idx + 1;
      const id = "creator" + seq;
      const roleCode = ROLE_CODES[c.role] || "ctb";
      contributorBlocks += `<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/" id="${id}">${escapeXmlPreserveEntities(c.name.trim())}</dc:creator>\n`;
      contributorBlocks += `<meta refines="#${id}" property="role" scheme="marc:relators">${roleCode}</meta>\n`;
      contributorBlocks += `<meta refines="#${id}" property="display-seq">${seq}</meta>\n`;
    });

    let manifestItems = "";
    allEntries.forEach((entry) => {
      const id = stripExt(entry.filename);
      manifestItems += `<item id="${escapeXml(id)}" href="${XHTML_PREFIX}${escapeXml(entry.filename)}" media-type="application/xhtml+xml"/>\n`;
    });

    let imageItems = "";
    imageFiles.forEach((filename) => {
      if (filename === `${isbn}.jpg`) return;
      const id = stripExt(filename);
      imageItems += `<item id="${escapeXml(id)}" href="images/${escapeXml(filename)}" media-type="${guessMediaType(filename)}"/>\n`;
    });

    let spineItems = "";
    allEntries.forEach((entry) => {
      const id = stripExt(entry.filename);
      spineItems += `<itemref idref="${escapeXml(id)}" linear="yes"/>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:File="java:java.io.File" xmlns:file="http://expath.org/ns/file" version="3.0" xml:lang="en" unique-identifier="p${escapeXml(isbn)}">
<metadata>
<dc:identifier xmlns:dc="http://purl.org/dc/elements/1.1/" id="p${escapeXml(isbn)}">urn:isbn: p${escapeXml(isbn)}</dc:identifier>
${contributorBlocks}<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/" id="main_1">${escapeXmlPreserveEntities(title)}</dc:title>
<meta refines="#main_1" property="title-type">main</meta>
<meta refines="#main_1" property="display-seq">1</meta>
<meta refines="#main_1" property="group-position">1</meta>
<dc:source xmlns:dc="http://purl.org/dc/elements/1.1/">urn:isbn: p${escapeXml(isbn)}</dc:source>
<dc:publisher xmlns:dc="http://purl.org/dc/elements/1.1/">${escapeXmlPreserveEntities(publisher)}</dc:publisher>
<dc:language xmlns:dc="http://purl.org/dc/elements/1.1/">en</dc:language>
<dc:type xmlns:dc="http://purl.org/dc/elements/1.1/">Text</dc:type>
<dc:format xmlns:dc="http://purl.org/dc/elements/1.1/">${escapeXml(totalPageCount)} pages</dc:format>
<dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">${escapeXml(date)}</dc:date>
<meta property="dcterms:modified">${escapeXml(date)}Z</meta>
<meta name="cover" content="cover-image"/>
</metadata>

<manifest>
<item id="toc" properties="nav" href="nav.xhtml" media-type="application/xhtml+xml"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="styles/stylesheet.css" media-type="text/css"/>
<item id="cover-image" href="images/${escapeXml(isbn)}.jpg" media-type="image/jpeg"/>
${manifestItems}${imageItems}</manifest>

<spine page-progression-direction="ltr" toc="ncx">
${spineItems}</spine>

<guide>
<reference type="cover" title="Cover Image" href="xhtml/Cover.xhtml"/>
<reference type="title" title="Title Page" href="xhtml/Title.xhtml"/>
<reference type="toc" title="Contents" href="xhtml/Contents.xhtml"/>
</guide>
</package>`;
  }

  function showNcxStatus(msg, type) {
    ncxStatusMsg.textContent = msg;
    ncxStatusMsg.className = "status-msg" + (type ? " " + type : "");
  }

  function toRoman(num) {
    const map = [
      [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
      [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
      [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]
    ];
    let result = "";
    let n = num;
    for (const [value, symbol] of map) {
      while (n >= value) {
        result += symbol;
        n -= value;
      }
    }
    return result;
  }

  function parseNcxData(text) {
    const titleMatch = text.match(/<docTitle[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/docTitle>/i);
    navDocTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

    const entries = [];
    const navPointRe = /<navPoint\b[^>]*>[\s\S]*?<\/navPoint>/gi;
    const labelRe = /<navLabel[^>]*>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/navLabel>/i;
    const srcRe = /<content\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*\/?>/i;
    let m;
    while ((m = navPointRe.exec(text)) !== null) {
      const block = m[0];
      const labelMatch = block.match(labelRe);
      const srcMatch = block.match(srcRe);
      if (labelMatch && srcMatch) {
        const label = labelMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const src = srcMatch[1].trim();
        entries.push({ label, src });
      }
    }
    navTocEntries = entries;
    tocCountPreview.textContent = String(navTocEntries.length);
  }

  function getExcelEntries() {
    return [...excelRows]
      .sort((a, b) => a.number - b.number)
      .map((row) => ({ label: row.label, filename: row.filename }));
  }

  function getNcxEntries() {
    return [...excelRows]
      .sort((a, b) => a.number - b.number)
      .filter((row) => row.flag !== 1)
      .map((row) => {
        const matched = extractedEntries.find((e) => e.filename === row.filename);
        return { label: matched ? matched.label : row.label, filename: row.filename };
      });
  }

  function loadMasterExcel(file) {
    if (!file) return;
    xlsxFileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        parseMasterExcelRows(rows);
        excelConfirm.hidden = false;
        document.getElementById("confirmIsbn").textContent = isbnInput.value.trim() || "—";
        document.getElementById("confirmEntries").textContent = String(excelRows.length);
        document.getElementById("confirmPages").textContent = totalPageCountInput.value.trim() || "—";
        if (excelViewBtn) excelViewBtn.hidden = false;
        showStatus(`Loaded ${excelRows.length} entries from ${file.name}.`, "success");
      } catch (err) {
        showStatus("Failed to parse Excel file: " + err.message, "error");
      }
    };
    reader.onerror = () => showStatus("Failed to read Excel file.", "error");
    reader.readAsArrayBuffer(file);
  }

  xlsxFileInput.addEventListener("change", () => {
    const file = xlsxFileInput.files[0];
    loadMasterExcel(file);
  });

  function downloadExcelTemplate() {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["ISBN", "9780000000000"],
      ["#", "File Name", "Start Page", "End Page", "flag", "pagelist"],
      [1, "Cover", 1, 1, 0, 0],
      [2, "Title", 2, 2, 0, 0],
      [3, "Copyright", 3, 3, 0, 0],
      [4, "Contents", 4, 5, 0, 0],
      [5, "filename_0001", 1, 10, 0, 0],
      [6, "Part_one", 11, 11, 1, 1],
      [7, "filename_0002", 12, 25, 0, 0],
      [8, "filename_0003", 26, 40, 0, 0]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "PageData");
    XLSX.writeFile(wb, "EPUB_PageList_Template.xlsx");
  }

  const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener("click", downloadExcelTemplate);
  }

  function parseMasterExcelRows(rows) {
    const isbn = rows[0] && rows[0][1] !== undefined ? String(rows[0][1]).trim() : "";
    isbnInput.value = isbn;

    const dataRows = rows.slice(2).filter((r) => r && r.length && r[1] !== undefined && r[1] !== "");

    const entries = [];
    const rawRows = [];
    let inBody = false;
    let prevStart = 0;
    let lastEndPage = 0;

    dataRows.forEach((row, idx) => {
      const fileNameRaw = String(row[1]).trim();
      const startPage = Number(row[2]);
      const endPage = Number(row[3]);
      const flag = Number(row[4]) === 1 ? 1 : 0;
      const pagelist = Number(row[5]) === 1 ? 1 : 0;
      const number = Number(row[0]);
      if (!fileNameRaw || Number.isNaN(startPage) || Number.isNaN(endPage)) return;

      if (!inBody) {
        if (startPage < prevStart) {
          inBody = true;
        }
      }
      prevStart = startPage;
      lastEndPage = endPage;

      const label = fileNameRaw.replace(/\.xhtml$/i, "");
      const filename = label + ".xhtml";

      rawRows.push({ number: Number.isNaN(number) ? idx + 1 : number, label, filename, startPage, endPage, flag, pagelist });

      if (pagelist !== 1) {
        for (let p = startPage; p <= endPage; p++) {
          const pageLabel = inBody ? String(p) : toRoman(p);
          entries.push({ filename, label: pageLabel });
        }
      }
    });

    navPageEntries = entries;
    excelRows = rawRows;
    totalPageCountInput.value = String(lastEndPage);
    maxPageNumberInput.value = String(lastEndPage);
    pageCountPreview.textContent = String(navPageEntries.length);
    tocCountPreview.textContent = String(rawRows.filter((r) => r.flag === 0).length);
    sectionsCountPreview.textContent = String(rawRows.filter((r) => r.flag === 1).length);
  }

  function buildNavXhtml() {
    if (navTocEntries.length === 0) {
      showStatus("Upload toc.ncx before generating.", "error");
      return null;
    }
    if (navPageEntries.length === 0) {
      showStatus("Upload the page list Excel file before generating.", "error");
      return null;
    }

    const sortedRows = [...excelRows].sort((a, b) => a.number - b.number);

    let tocItems = "";
    let openParent = false;
    sortedRows.forEach((row) => {
      const href = XHTML_PREFIX + row.filename;
      if (row.flag === 1) {
        if (openParent) tocItems += "</ol></li>\n";
        const matched = h2Entries.find((e) => e.filename === row.filename);
        const label = matched ? matched.label : row.label;
        tocItems += `<li><a href="${escapeXml(href)}">${escapeXmlPreserveEntities(label)}</a>\n<ol>\n`;
        openParent = true;
      } else {
        const matched = extractedEntries.find((e) => e.filename === row.filename);
        const label = matched ? matched.label : row.label;
        tocItems += `<li><a href="${escapeXml(href)}">${escapeXmlPreserveEntities(label)}</a></li>\n`;
      }
    });
    if (openParent) tocItems += "</ol></li>\n";

    let pageItems = "";
    navPageEntries.forEach((entry) => {
      pageItems += `<li><a href="${XHTML_PREFIX}${escapeXml(entry.filename)}#pagebreak_${entry.label}">${entry.label}</a></li>\n`;
    });

    const title = docTitle || "Untitled";

    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
<meta http-equiv="default-style" content="text/html; charset=utf-8"/>
<title>${escapeXmlPreserveEntities(title)}</title>
<link rel="stylesheet" type="text/css" href="../styles/stylesheet.css"/>
</head>
<body>
<nav epub:type="toc" id="toc">
<h1 class="title">Table of Contents</h1>
<ol>
${tocItems}</ol>
</nav>

<nav epub:type="page-list">
<ol>
${pageItems}</ol>
</nav>
</body>
</html>`;
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function escapeXmlPreserveEntities(str) {
    return String(str)
      .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderClasses() {
    if (!classBadgesWrap) return;
    classBadgesWrap.innerHTML = "";
    const orderedClasses = detectedClasses;
    orderedClasses.forEach((cls) => {
      const isLocked = cls === detectedClasses[0];
      const isSelected = extractClasses.includes(cls);
      const badge = document.createElement("span");
      badge.className = "class-badge" + (isSelected ? " selected" : "") + (isLocked ? " locked" : "");
      badge.dataset.class = cls;
      badge.textContent = cls + (isLocked ? " 🔒" : "");
      if (!isLocked) {
        badge.addEventListener("click", () => {
          const i = extractClasses.indexOf(cls);
          if (i === -1) {
            extractClasses.push(cls);
          } else {
            extractClasses.splice(i, 1);
          }
          renderClasses();
          recomputeExtracted();
        });
      }
      classBadgesWrap.appendChild(badge);
    });
    if (classCount) {
      classCount.textContent = `${extractClasses.length} class${extractClasses.length === 1 ? "" : "es"} selected`;
    }
  }

  if (addClassBtn) {
    addClassBtn.addEventListener("click", () => {
      const cls = newClassInput.value.trim();
      if (!cls) {
        showStatus("Enter a class name to add.", "error");
        return;
      }
      if (!detectedClasses.includes(cls)) detectedClasses.push(cls);
      if (!extractClasses.includes(cls)) extractClasses.push(cls);
      newClassInput.value = "";
      renderClasses();
      recomputeExtracted();
    });
  }

  function renderExtracted() {
    extractedList.innerHTML = "";
    extractedEntries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "entry-item";
      const fields = document.createElement("div");
      fields.className = "entry-fields";

      const labelDiv = document.createElement("div");
      labelDiv.textContent = entry.label;

      const pathDiv = document.createElement("div");
      pathDiv.textContent = XHTML_PREFIX + entry.filename;

      fields.appendChild(labelDiv);
      fields.appendChild(pathDiv);
      li.appendChild(fields);
      extractedList.appendChild(li);
    });
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileNameSpan.textContent = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        parseContentsFile(reader.result);
        showStatus(`Extracted ${allExtractedEntries.length} entries from ${file.name}.`, "success");
      } catch (err) {
        showStatus("Failed to parse file: " + err.message, "error");
      }
    };
    reader.onerror = () => showStatus("Failed to read file.", "error");
    reader.readAsText(file);
  });

  const blockRe = /<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const anchorRe = /<a\b[^>]*\bhref\s*=\s*["']([^"']+\.xhtml[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i;

  function recomputeExtracted() {
    const entries = allExtractedEntries.filter((entry) => {
      const tagClasses = entry.className ? entry.className.split(/\s+/) : [];
      return extractClasses.some((cls) => tagClasses.includes(cls));
    });

    extractedEntries = entries;
    renderExtracted();

    const contentsConfirm = document.getElementById("contentsConfirm");
    const confirmContentsEntries = document.getElementById("confirmContentsEntries");
    if (contentsConfirm && confirmContentsEntries) {
      contentsConfirm.hidden = false;
      confirmContentsEntries.textContent = String(extractedEntries.length);
    }
    if (contentsViewBtn) contentsViewBtn.hidden = false;
  }

  function getInnerText(el) {
    return el.innerHTML
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseContentsFile(text) {
    rawContentsText = text;
    if (viewContentsBtn) viewContentsBtn.hidden = !rawContentsText;

    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    docTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
    docTitleText.textContent = docTitle || "(none found)";
    docTitlePreview.hidden = false;

    const confirmTitle = document.getElementById("confirmTitle");
    if (confirmTitle) confirmTitle.textContent = docTitle || "—";

    const classSet = new Set();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "application/xhtml+xml");
    const hasParserError = doc.querySelector("parsererror");
    const scanDoc = hasParserError ? parser.parseFromString(text, "text/html") : doc;
    scanDoc.querySelectorAll("p, h1, h2, h3, h4, h5, h6").forEach((el) => {
      String(el.className || "").split(/\s+/).forEach((cls) => {
        if (cls) classSet.add(cls);
      });
    });
    // Auto-detect primary class (most used on <p> tags)
// Smart detection: Find toc classes with the most links
const classWithLinks = {};
const allTocClasses = new Set();

scanDoc.querySelectorAll("p[class]").forEach((p) => {
    const classes = String(p.className || "").trim().split(/\s+/);
    const tocClasses = classes.filter(c => c.includes('toc'));
    
    if (tocClasses.length === 0) return;
    
    tocClasses.forEach(c => allTocClasses.add(c));
    
    // Check if this paragraph has a link to .xhtml
    const hasLink = p.querySelector('a[href$=".xhtml"]');
    if (hasLink) {
        tocClasses.forEach(c => {
            classWithLinks[c] = (classWithLinks[c] || 0) + 1;
        });
    }
});

// Pick the toc class with the most links as primary
const primaryClass = Object.entries(classWithLinks)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'toc1a';

// Use ALL toc classes, with primary first
detectedClasses = [primaryClass, ...[...allTocClasses].filter(c => c !== primaryClass)];
extractClasses = [primaryClass];
renderClasses();

allExtractedEntries = [];

// Use regex on raw text to preserve entities like &#x2013;
const tagRe = /<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
let tagMatch;
while ((tagMatch = tagRe.exec(text)) !== null) {
    const attrs = tagMatch[2];
    const inner = tagMatch[3];

    // Extract class from tag attributes
    const classMatch = attrs.match(/class=["']([^"']*)["']/);
    const className = classMatch ? classMatch[1].trim() : "";
    
    // Skip if this element doesn't have a toc class
    if (!className || !className.split(/\s+/).some(c => c.includes('toc'))) {
        continue;
    }

    // Extract href and label from inner <a href="*.xhtml">
    const anchorRe2 = /<a\b[^>]*href=["']([^"']*\.xhtml[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i;
    const aMatch = anchorRe2.exec(inner);
    if (!aMatch) continue;

    const href = aMatch[1].replace(/^xhtml\//, "").trim();
    // Use full <p> inner content, not just <a> inner content
    const label = inner
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (href && label) {
        allExtractedEntries.push({ filename: href, label, className });
    }
}

    recomputeExtracted();

    const h2List = [];
    const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
    let h2Match;
    while ((h2Match = h2Re.exec(text)) !== null) {
      const anchorMatch = anchorRe.exec(h2Match[1]);
      if (!anchorMatch) continue;
      const href = anchorMatch[1].trim();
      const label = anchorMatch[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (label && href) {
        h2List.push({ label, filename: href });
      }
    }
    h2Entries = h2List;
  }

  function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = "status-msg" + (type ? " " + type : "");
  }

  function buildNcx() {
    const isbn = isbnInput.value.trim();
    const totalPageCount = totalPageCountInput.value.trim();
    const maxPageNumber = maxPageNumberInput.value.trim();

    const allEntries = getNcxEntries();

    if (allEntries.length === 0) {
      showStatus("No entries to generate. Upload the Excel file before continuing.", "error");
      return null;
    }

    let navPoints = "";
    allEntries.forEach((entry, idx) => {
      const id = "toc" + (idx + 1);
      const playOrder = idx + 1;
      const src = XHTML_PREFIX + entry.filename;
      navPoints += `<navPoint id="${id}" playOrder="${playOrder}"><navLabel><text>${escapeXmlPreserveEntities(entry.label)}</text></navLabel><content src="${escapeXml(src)}"/></navPoint>\n`;
    });

    const title = docTitle || "Untitled";

    const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">
<head>
<meta name="dtb:uid" content="urn:isbn: ${escapeXml(isbn)}"/>
<meta name="dtb:depth" content="2"/>
<meta name="dtb:totalPageCount" content="${escapeXml(totalPageCount)}"/>
<meta name="dtb:maxPageNumber" content="${escapeXml(maxPageNumber)}"/>
</head>
<docTitle>
<text>${escapeXmlPreserveEntities(title)}</text>
</docTitle>
<navMap>
${navPoints}</navMap>
</ncx>`;

    return ncx;
  }

  generateNcxBtn.addEventListener("click", () => {
    const ncx = buildNcx();
    if (!ncx) {
      showNcxStatus("Failed to generate toc.ncx.", "error");
      return;
    }
    ncxData = ncx;
    parseNcxData(ncxData);
    ncxPreview.textContent = ncxData;
    tocCountPreview.textContent = String(navTocEntries.length);
    ncxNextBtn.disabled = false;
    showNcxStatus("toc.ncx ready ✅", "success");
  });

  const generateNavBtn = document.getElementById("generateNavBtn");
  const navStatusMsgEl = document.getElementById("navStatusMsg");
  const navPreviewEl = document.getElementById("navPreview");
  const navNextBtn = document.getElementById("navNextBtn");

  function showNavStatus(msg, type) {
    if (!navStatusMsgEl) return;
    navStatusMsgEl.textContent = msg;
    navStatusMsgEl.className = "status-msg" + (type ? " " + type : "");
  }

  if (generateNavBtn) {
    generateNavBtn.addEventListener("click", () => {
      if (!ncxData) {
        showNavStatus("Generate toc.ncx before continuing.", "error");
        return;
      }
      const navXhtml = buildNavXhtml();
      if (!navXhtml) {
        showNavStatus("Failed to generate nav.xhtml.", "error");
        return;
      }
      lastNavXhtml = navXhtml;
      if (navPreviewEl) navPreviewEl.textContent = navXhtml;
      if (navNextBtn) navNextBtn.disabled = false;
      showNavStatus("nav.xhtml ready ✅", "success");
    });
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  generateAllBtn.addEventListener("click", async () => {
    if (selectedMode === 1) {
      const ncx = buildNcx();
      if (!ncx) {
        showStatus("Failed to generate toc.ncx.", "error");
        return;
      }
      ncxData = ncx;
      parseNcxData(ncxData);
      ncxPreview.textContent = ncxData;
      tocCountPreview.textContent = String(navTocEntries.length);
      downloadBlob(ncxData, "toc.ncx", "application/x-dtbncx+xml");
      showStatus("toc.ncx generated and downloaded.", "success");
      revealSuccessPanel(["toc.ncx"]);
      return;
    }

    if (!ncxData) {
      showStatus("Generate toc.ncx before continuing.", "error");
      return;
    }

    const navXhtml = buildNavXhtml();
    if (!navXhtml) return;
    lastNavXhtml = navXhtml;

    if (selectedMode === 2) {
      const zip = new JSZip();
      zip.file("toc.ncx", ncxData);
      zip.file("nav.xhtml", navXhtml);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "output.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus("output.zip generated. Files: toc.ncx, nav.xhtml", "success");
      revealSuccessPanel(["toc.ncx", "nav.xhtml"]);
      return;
    }

    const packageData = buildPackageOpf();
    lastPackageOpf = packageData;

    const zip = new JSZip();
    zip.file("toc.ncx", ncxData);
    zip.file("nav.xhtml", navXhtml);
    zip.file("package.opf", packageData);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "output.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus("output.zip generated. Files: toc.ncx, nav.xhtml, package.opf", "success");
    revealSuccessPanel(["toc.ncx", "nav.xhtml", "package.opf"]);
  });

  function revealSuccessPanel(files) {
    const panel = document.getElementById("successPanel");
    if (!panel) return;
    panel.hidden = false;
    panel.querySelectorAll(".file-row[data-file]").forEach((row) => {
      row.hidden = !files.includes(row.dataset.file);
    });
    fireConfetti(document.getElementById("successConfetti"), 34, 340);
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const downloadAllBtn = document.getElementById("downloadAllBtn");
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener("click", () => generateAllBtn.click());
  }
  const startOverBtn = document.getElementById("startOverBtn");
  if (startOverBtn) {
    startOverBtn.addEventListener("click", () => resetToStartup());
  }

  const themeLabel = themeToggle.querySelector(".tt-label");
  themeToggle.addEventListener("click", () => {
    const root = document.documentElement;
    const isDark = root.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    root.setAttribute("data-theme", nextTheme);
    if (themeLabel) themeLabel.textContent = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
    localStorage.setItem("ncx-theme", nextTheme);
  });

  (function initTheme() {
    const saved = localStorage.getItem("ncx-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    if (themeLabel) themeLabel.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
  })();

  const MODE_TAB_ORDERS = {
    1: ["excel", "contents", "classes", "generate"],
    2: ["excel", "contents", "classes", "generatencx", "nav", "generate"],
    3: ["excel", "contents", "classes", "generatencx", "nav", "package", "generate"]
  };
  let selectedMode = 3;
  let tabOrder = MODE_TAB_ORDERS[selectedMode];
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const nextBtns = document.querySelectorAll(".next-btn");
  let unlockedIndex = 0;

  function applyMode(mode) {
    selectedMode = mode;
    tabOrder = MODE_TAB_ORDERS[mode];
    unlockedIndex = 0;

    tabBtns.forEach((btn) => {
      const inMode = tabOrder.includes(btn.dataset.tab);
      btn.hidden = !inMode;
      btn.style.display = inMode ? "" : "none";
      if (inMode) {
        const idx = tabOrder.indexOf(btn.dataset.tab);
        const numEl = btn.querySelector(".badge-num");
        if (numEl) numEl.textContent = String(idx + 1);
      }
    });

    ncxNextBtn.dataset.next = (mode === 1) ? "generate" : "nav";

    const classesNextBtn = document.querySelector("#tab-classes .next-btn");
    if (classesNextBtn) {
      classesNextBtn.dataset.next = (mode === 1) ? "generate" : "generatencx";
    }

    if (navNextBtn) {
      navNextBtn.dataset.next = (mode === 3) ? "package" : "generate";
    }

    const navRow = document.querySelector('[data-file="nav.xhtml"]');
    const pkgRow = document.querySelector('[data-file="package.opf"]');
    if (navRow) navRow.hidden = mode < 2;
    if (pkgRow) pkgRow.hidden = mode < 3;

    updateTabLocks();
    switchTab("excel");
    refreshChrome();
    updateSidebarSummary();
  }

  function resetToStartup() {
    ncxData = null;
    lastNavXhtml = null;
    lastPackageOpf = null;
    ncxPreview.textContent = "";
    ncxNextBtn.disabled = true;
    showNcxStatus("", "");
    if (navPreviewEl) navPreviewEl.textContent = "";
    if (navNextBtn) navNextBtn.disabled = true;
    showNavStatus("", "");
    showStatus("", "");
    const successPanel = document.getElementById("successPanel");
    if (successPanel) successPanel.hidden = true;

    document.querySelectorAll(".mode-card").forEach((c) => {
      c.classList.remove("selected");
      c.setAttribute("aria-checked", "false");
    });
    startBuildingBtn.disabled = true;
    pendingMode = null;

    const appRoot = document.getElementById("appRoot");
    if (appRoot) appRoot.hidden = true;
    startupScreen.hidden = false;
    startupScreen.classList.remove("leaving");
  }

  const startupScreen = document.getElementById("startupScreen");
  const startBuildingBtn = document.getElementById("startBuildingBtn");
  const modeCards = document.querySelectorAll(".mode-card");
  let pendingMode = null;

  modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      pendingMode = Number(card.dataset.mode);
      modeCards.forEach((c) => {
        const isSel = c === card;
        c.classList.toggle("selected", isSel);
        c.setAttribute("aria-checked", String(isSel));
      });
      startBuildingBtn.disabled = false;
    });
  });

  startBuildingBtn.addEventListener("click", () => {
    if (!pendingMode) return;
    startupScreen.classList.add("leaving");
    setTimeout(() => {
      startupScreen.hidden = true;
      const appRoot = document.getElementById("appRoot");
      if (appRoot) appRoot.hidden = false;
      applyMode(pendingMode);
    }, 380);
  });

  const changeSelectionLink = document.getElementById("changeSelectionLink");
  if (changeSelectionLink) {
    changeSelectionLink.addEventListener("click", (e) => {
      e.preventDefault();
      resetToStartup();
    });
  }

  function updateTabLocks() {
    tabBtns.forEach((btn) => {
      const idx = tabOrder.indexOf(btn.dataset.tab);
      btn.classList.toggle("locked", idx > unlockedIndex);
    });
    updateStepStates();
  }

  function updateStepStates() {
    tabBtns.forEach((btn) => {
      const idx = tabOrder.indexOf(btn.dataset.tab);
      if (idx === -1) return;
      btn.classList.remove("completed", "current", "locked");
      if (idx < unlockedIndex) {
        btn.classList.add("completed");
      } else if (idx === unlockedIndex) {
        btn.classList.add("current");
      } else {
        btn.classList.add("locked");
      }
    });
  }

  function switchTab(tabName) {
    tabBtns.forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    tabPanels.forEach((p) => p.classList.remove("active"));
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add("active");
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).setAttribute("aria-selected", "true");
    document.getElementById("tab-" + tabName).classList.add("active");
  }

  function validateStep(tabName) {
    if (tabName === "excel") {
      if (excelRows.length === 0 || !isbnInput.value.trim()) {
        showStatus("Upload and parse the Excel file before continuing.", "error");
        return false;
      }
    }
    if (tabName === "classes") {
      if (extractClasses.length === 0) {
        showStatus("Add at least one class before continuing.", "error");
        return false;
      }
    }
    if (tabName === "contents") {
      if (!rawContentsText) {
        showStatus("Upload a Contents.xhtml file before continuing.", "error");
        return false;
      }
    }
    if (tabName === "generatencx") {
      if (!ncxData) {
        showNcxStatus("Generate NCX before continuing.", "error");
        return false;
      }
    }
    if (tabName === "nav") {
      if (!lastNavXhtml) {
        showNavStatus("Generate NAV before continuing.", "error");
        return false;
      }
    }
    if (tabName === "package") {
      if (!contributors.some((c) => c.name.trim())) {
        showStatus("Add at least one contributor with a name before continuing.", "error");
        return false;
      }
      if (!publisherInput.value.trim()) {
        showStatus("Enter a publisher before continuing.", "error");
        return false;
      }
      if (imageFiles.length === 0) {
        showStatus("Select the images folder before continuing.", "error");
        return false;
      }
    }
    return true;
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = tabOrder.indexOf(btn.dataset.tab);
      if (idx > unlockedIndex) return;
      switchTab(btn.dataset.tab);
    });
  });

  nextBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const currentPanel = btn.closest(".tab-panel");
      const currentTab = currentPanel.id.replace("tab-", "");
      if (!validateStep(currentTab)) return;
      const currentIdx = tabOrder.indexOf(currentTab);
      const fallback = tabOrder.indexOf(btn.dataset.next);
      const nextIdx = tabOrder.includes(btn.dataset.next) ? fallback : currentIdx + 1;
      if (nextIdx < 0 || nextIdx >= tabOrder.length) return;
      const nextTab = tabOrder[nextIdx];
      if (nextIdx > unlockedIndex) unlockedIndex = nextIdx;
      updateTabLocks();
      switchTab(nextTab);
      showStatus("", "");
    });
  });

  updateTabLocks();
  renderClasses();
  renderContributors();

  /* ---------- Presentation-only UI enhancements (no logic change) ---------- */
  const stepTitleEl = document.getElementById("stepTitle");
  const stepDescEl = document.getElementById("stepDesc");
  const progressCountEl = document.getElementById("progressCount");
  const progressFillEl = document.getElementById("progressFill");
  const canvasBody = document.querySelector(".canvas-body");
  const reviewSummary = document.getElementById("reviewSummary");
  const successPanel = document.getElementById("successPanel");

  function refreshChrome() {
    const activePanel = document.querySelector(".tab-panel.active");
    if (!activePanel) return;
    const name = activePanel.id.replace("tab-", "");
    const idx = tabOrder.indexOf(name);

    updateStepStates();

    if (stepTitleEl) stepTitleEl.innerHTML = activePanel.dataset.title || "";
    if (stepDescEl) stepDescEl.textContent = activePanel.dataset.desc || "";
    if (progressCountEl) progressCountEl.textContent = `Step ${idx + 1} of ${tabOrder.length}`;
    if (progressFillEl) progressFillEl.style.width = `${((idx + 1) / tabOrder.length) * 100}%`;

    if (name === "generate") renderReview();
  }

  if (canvasBody) {
    const mo = new MutationObserver(refreshChrome);
    document.querySelectorAll(".tab-panel").forEach((p) =>
      mo.observe(p, { attributes: true, attributeFilter: ["class"] })
    );
  }

  /* Inline validation ticks */
  function setTick(input, valid) {
    const field = input.closest(".field");
    if (!field) return;
    field.classList.toggle("valid", valid);
    const tick = field.querySelector(".tick");
    if (tick) tick.hidden = !valid;
  }

  const isbnHint = document.getElementById("isbnHint");
  function validateIsbn() {
    const v = isbnInput.value.trim();
    const ok = /^\d{13}$/.test(v);
    setTick(isbnInput, ok);
    if (isbnHint) {
      if (v && !ok) {
        isbnHint.textContent = "ISBN should be 13 digits.";
        isbnHint.classList.add("warn");
      } else {
        isbnHint.textContent = "Stored as urn:isbn: {value}";
        isbnHint.classList.remove("warn");
      }
    }
  }
  function validateFilled(input) { setTick(input, input.value.trim().length > 0); }

  isbnInput.addEventListener("input", validateIsbn);
  totalPageCountInput.addEventListener("input", () => validateFilled(totalPageCountInput));
  maxPageNumberInput.addEventListener("input", () => validateFilled(maxPageNumberInput));
  publisherInput.addEventListener("input", () => validateFilled(publisherInput));
  validateIsbn();
  validateFilled(totalPageCountInput);
  validateFilled(maxPageNumberInput);
  validateFilled(publisherInput);

  /* Review summary */
  const REVIEW_HIDE_BY_MODE = {
    1: ["pages", "images", "contributors", "publisher"],
    2: ["images", "contributors", "publisher"],
    3: []
  };

  function renderReview() {
    if (!reviewSummary) return;
    const namedContributors = contributors.filter((c) => c.name.trim()).length;
    const hideKeys = REVIEW_HIDE_BY_MODE[selectedMode] || [];
    const rows = [
      ["Title", docTitle || "—", null],
      ["ISBN", isbnInput.value.trim() || "—", null],
      ["TOC entries", String(navTocEntries.length), null],
      ["Page list entries", String(navPageEntries.length), "pages"],
      ["Images", String(imageFiles.length), "images"],
      ["Contributors", String(namedContributors), "contributors"],
      ["Publisher", publisherInput.value.trim() || "—", "publisher"]
    ];
    reviewSummary.innerHTML = "";
    rows.forEach(([k, v, key]) => {
      const isHidden = key && hideKeys.includes(key);
      const dt = document.createElement("dt");
      dt.className = "rk";
      dt.textContent = k;
      if (key) dt.dataset.review = key;
      dt.hidden = isHidden;
      const dd = document.createElement("dd");
      dd.className = "rv";
      dd.style.margin = "0";
      dd.textContent = v;
      if (key) dd.dataset.review = key;
      dd.hidden = isHidden;
      reviewSummary.appendChild(dt);
      reviewSummary.appendChild(dd);
    });

    const reviewSub = document.querySelector("#tab-generate .card .sub");
    if (reviewSub) {
      if (selectedMode === 1) {
        reviewSub.textContent = "Confirm before generating. Downloads as toc.ncx.";
      } else if (selectedMode === 2) {
        reviewSub.textContent = "Confirm before generating. Bundled as output.zip (toc.ncx + nav.xhtml).";
      } else {
        reviewSub.textContent = "Confirm before generating. Bundled as output.zip (toc.ncx + nav.xhtml + package.opf).";
      }
    }
  }


  /* ---------- File view modal (Excel / Contents preview) ---------- */
  const fileViewModal = document.getElementById("fileViewModal");
  const fvTitle = document.getElementById("fvTitle");
  const fvBody = document.getElementById("fvBody");
  const fvClose = document.getElementById("fvClose");

  function openFileViewModal(title, tableHtml) {
    if (!fileViewModal) return;
    fvTitle.textContent = title;
    fvBody.innerHTML = tableHtml;
    fileViewModal.classList.add("open");
  }

  function closeFileViewModal() {
    if (!fileViewModal) return;
    fileViewModal.classList.remove("open");
  }

  function openExcelView() {
    const rows = [...excelRows].sort((a, b) => a.number - b.number);
    let rowsHtml = "";
    rows.forEach((row) => {
      const rowClass = row.flag === 1 ? ' class="flag-row"' : "";
      const pagesBadge = row.pagelist === 1 ? '<span class="fv-badge-nopages">no pages</span>' : "";
      rowsHtml += `<tr${rowClass}>
        <td>${escapeXml(row.number)}</td>
        <td title="${escapeXml(row.label)}">${escapeXml(row.label)}</td>
        <td>${escapeXml(row.startPage)}</td>
        <td>${escapeXml(row.endPage)}</td>
        <td>${escapeXml(row.flag)}</td>
        <td>${escapeXml(row.pagelist)}${pagesBadge}</td>
      </tr>\n`;
    });
    const tableHtml = `<table class="fv-table">
      <thead><tr><th>#</th><th>File Name</th><th>Start Page</th><th>End Page</th><th>Flag</th><th>Pagelist</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
    openFileViewModal("Excel Preview", tableHtml);
  }

  function openContentsView() {
    let rowsHtml = "";
    extractedEntries.forEach((entry, idx) => {
      rowsHtml += `<tr>
        <td>${idx + 1}</td>
        <td title="${escapeXml(entry.label)}">${escapeXml(entry.label)}</td>
        <td title="${escapeXml(entry.filename)}">${escapeXml(entry.filename)}</td>
      </tr>\n`;
    });
    const tableHtml = `<table class="fv-table">
      <thead><tr><th>#</th><th>Label</th><th>Href</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
    openFileViewModal("Contents.xhtml Preview", tableHtml);
  }

  function openContentsRawView() {
    const tableHtml = `<div class="fv-code-wrap"><pre><code id="fvCodeContent">${escapeXml(rawContentsText)}</code></pre></div>`;
    openFileViewModal("Contents.xhtml", tableHtml);
  }

  if (excelViewBtn) excelViewBtn.addEventListener("click", openExcelView);
  if (contentsViewBtn) contentsViewBtn.addEventListener("click", openContentsView);
  if (viewContentsBtn) viewContentsBtn.addEventListener("click", openContentsRawView);
  if (fvClose) fvClose.addEventListener("click", closeFileViewModal);
  if (fileViewModal) {
    fileViewModal.addEventListener("click", (e) => {
      if (e.target === fileViewModal) closeFileViewModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fileViewModal && fileViewModal.classList.contains("open")) {
      closeFileViewModal();
    }
  });

  /* ---------- Code preview modal (presentation-only) ---------- */
  const codeModal = document.getElementById("codeModal");
  if (codeModal) {
    const modalTitle = document.getElementById("codeModalTitle");
    const modalCode = document.getElementById("codeModalCode");
    const modalCopy = document.getElementById("codeModalCopy");
    const modalDownload = document.getElementById("codeModalDownload");
    const modalClose = document.getElementById("codeModalClose");

    const fileSources = {
      "toc.ncx": () => ncxData,
      "nav.xhtml": () => lastNavXhtml,
      "package.opf": () => lastPackageOpf
    };
    let currentName = "";
    let currentContent = "";

    function openModal(name) {
      const getter = fileSources[name];
      currentContent = (getter && getter()) || "";
      currentName = name;
      modalTitle.textContent = name;
      modalCode.textContent = currentContent;
      modalCopy.textContent = "Copy";
      codeModal.hidden = false;
      requestAnimationFrame(() => codeModal.classList.add("open"));
      modalClose.focus();
    }

    function closeModal() {
      codeModal.classList.remove("open");
      const done = () => { codeModal.hidden = true; codeModal.removeEventListener("transitionend", done); };
      codeModal.addEventListener("transitionend", done);
      // fallback if transitions disabled (reduced motion)
      setTimeout(() => { if (!codeModal.classList.contains("open")) codeModal.hidden = true; }, 260);
    }

    document.querySelectorAll(".file-row").forEach((row) => {
      const name = row.dataset.file;
      if (!name) return;
      row.addEventListener("click", () => openModal(name));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(name); }
      });
    });

    modalClose.addEventListener("click", closeModal);
    codeModal.addEventListener("click", (e) => { if (e.target === codeModal) closeModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !codeModal.hidden) closeModal();
    });

    modalCopy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentContent);
      } catch (err) {
        const ta = document.createElement("textarea");
        ta.value = currentContent;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e2) {}
        document.body.removeChild(ta);
      }
      modalCopy.textContent = "Copied ✓";
      setTimeout(() => { modalCopy.textContent = "Copy"; }, 1600);
    });

    modalDownload.addEventListener("click", () => {
      const blob = new Blob([currentContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  /* ---------- Live sidebar summary (presentation-only, reads state) ---------- */
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ringFg = document.getElementById("ringFg");
  const ringNum = document.getElementById("ringNum");
  const ringWrap = document.getElementById("ringWrap");
  const confettiBox = document.getElementById("confetti");
  const sumTitle = document.getElementById("sumTitle");
  const sumIsbn = document.getElementById("sumIsbn");
  const qsToc = document.getElementById("qsToc");
  const qsPages = document.getElementById("qsPages");
  const qsImages = document.getElementById("qsImages");
  const qsContribs = document.getElementById("qsContribs");

  const RING_R = 34;
  const RING_C = 2 * Math.PI * RING_R;
  if (ringFg) {
    ringFg.style.strokeDasharray = String(RING_C);
    ringFg.style.strokeDashoffset = String(RING_C);
  }
  let confettiFired = false;

  function setStat(row, n, singular, plural) {
    if (!row) return;
    const on = n > 0;
    row.classList.toggle("on", on);
    row.querySelector(".qs-ic").textContent = on ? "✓" : "○";
    row.querySelector(".qs-t").textContent = `${n} ${n === 1 ? singular : plural}`;
  }

  function fireConfetti(box, count, spread) {
    const target = box || confettiBox;
    if (!target || reducedMotion) return;
    const colors = ["#F97316", "#16A34A", "#FFFFFF"];
    const n = count || 22;
    const sx = spread || 130;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.setProperty("--x", (Math.random() * sx - sx / 2).toFixed(0) + "px");
      p.style.setProperty("--y", (-45 - Math.random() * (sx * 0.55)).toFixed(0) + "px");
      p.style.setProperty("--r", (Math.random() * 540 - 270).toFixed(0) + "deg");
      p.style.background = colors[i % 3];
      p.style.animationDelay = (Math.random() * 0.15).toFixed(2) + "s";
      target.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  function updateSidebarSummary() {
    const completed = Math.min(unlockedIndex + 1, tabOrder.length);
    const frac = completed / tabOrder.length;

    if (ringFg) ringFg.style.strokeDashoffset = String(RING_C * (1 - frac));
    if (ringNum) ringNum.textContent = `${completed}/${tabOrder.length}`;

    if (completed >= tabOrder.length) {
      if (ringWrap) ringWrap.classList.add("complete");
      if (!confettiFired) { confettiFired = true; fireConfetti(); }
    } else if (ringWrap) {
      ringWrap.classList.remove("complete");
    }

    if (sumTitle) sumTitle.textContent = docTitle && docTitle.trim() ? docTitle.trim() : "—";
    if (sumIsbn) {
      const v = isbnInput.value.trim();
      sumIsbn.textContent = v || "—";
      sumIsbn.classList.toggle("muted", !v);
    }
    if (sumTitle) sumTitle.classList.toggle("muted", !(docTitle && docTitle.trim()));

    const tocCount = navTocEntries.length > 0
      ? navTocEntries.length
      : excelRows.length + extractedEntries.length;
    setStat(qsToc, tocCount, "TOC entry", "TOC entries");
    setStat(qsPages, navPageEntries.length, "page", "pages");
    setStat(qsImages, imageFiles.length, "image", "images");
    setStat(qsContribs, contributors.filter((c) => c.name.trim()).length, "contributor", "contributors");
  }

  /* Add-only reactive hooks (never modify existing handlers) */
  [isbnInput, totalPageCountInput, maxPageNumberInput, publisherInput].forEach((el) =>
    el.addEventListener("input", updateSidebarSummary)
  );
  contributorList.addEventListener("input", updateSidebarSummary);
  [fileInput, xlsxFileInput, imagesFolderInput].forEach((el) =>
    el.addEventListener("change", () => setTimeout(updateSidebarSummary, 60))
  );
  [generateNcxBtn, addContributorBtn, generateAllBtn].forEach((el) =>
    el.addEventListener("click", () => setTimeout(updateSidebarSummary, 0))
  );
  document.querySelectorAll(".next-btn, .tab-btn, .icon-btn").forEach((el) =>
    el.addEventListener("click", () => setTimeout(updateSidebarSummary, 0))
  );
  /* Safety net for async parse (xlsx FileReader) + dynamic rows */
  setInterval(updateSidebarSummary, 600);
  updateSidebarSummary();

  refreshChrome();
})();
