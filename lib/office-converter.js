'use strict';
/**
 * Office Document Converter (DOCX, XLSX, PPTX)
 * Zero external dependencies. Uses standard Open XML and PKZip.
 */

const { createZip, readZip } = typeof require !== 'undefined' ? require('./zip-util.js') : window.ZipUtil;

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ─────────────────────────────────────────────────────────────
   1. PDF TEXT TO DOCX (Word)
   ───────────────────────────────────────────────────────────── */
function buildDocxXml(pagesData) {
  // pagesData is an array of pages, each page has items: [{ text, fontSize, isBold, x, y }]
  let paragraphsXml = '';

  for (let pIndex = 0; pIndex < pagesData.length; pIndex++) {
    const page = pagesData[pIndex];
    if (pIndex > 0) {
      // Page break between pages
      paragraphsXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }

    if (!page.lines || page.lines.length === 0) {
      if (page.text) {
        // Plain text fallback
        const lines = page.text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            paragraphsXml += `<w:p><w:r><w:t xml:space="preserve">${escapeXml(trimmed)}</w:t></w:r></w:p>`;
          }
        }
      }
      continue;
    }

    // Process structured lines
    for (const line of page.lines) {
      const lineText = line.text ? line.text.trim() : '';
      if (!lineText) continue;

      const isHeading = line.fontSize && line.fontSize >= 16;
      const isSubheading = line.fontSize && line.fontSize >= 13 && line.fontSize < 16;
      const isBold = line.isBold || isHeading;
      const fontSizeHalfPt = Math.round((line.fontSize || 11) * 2);

      let rPr = `<w:rPr>`;
      if (isBold) rPr += `<w:b/>`;
      if (fontSizeHalfPt) rPr += `<w:sz w:val="${fontSizeHalfPt}"/>`;
      rPr += `</w:rPr>`;

      let pPr = `<w:pPr>`;
      if (isHeading) pPr += `<w:pStyle w:val="Heading1"/>`;
      else if (isSubheading) pPr += `<w:pStyle w:val="Heading2"/>`;
      pPr += `</w:pPr>`;

      paragraphsXml += `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`;
    }
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return createZip({
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': relsXml,
    'word/document.xml': documentXml
  });
}

/* ─────────────────────────────────────────────────────────────
   2. PDF TEXT TO XLSX (Excel)
   ───────────────────────────────────────────────────────────── */
function buildXlsxXml(tableRows) {
  // tableRows: Array of rows, each row is Array of string cells
  let sheetDataXml = '';
  for (let r = 0; r < tableRows.length; r++) {
    const rowNum = r + 1;
    const row = tableRows[r];
    let rowXml = `<row r="${rowNum}">`;

    for (let c = 0; c < row.length; c++) {
      const colLetter = getColumnLetter(c + 1);
      const cellRef = `${colLetter}${rowNum}`;
      const val = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';

      // Check if numeric
      const isNum = val.trim() !== '' && !isNaN(val) && !isNaN(parseFloat(val));
      if (isNum) {
        rowXml += `<c r="${cellRef}"><v>${escapeXml(val.trim())}</v></c>`;
      } else {
        rowXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
      }
    }
    rowXml += `</row>`;
    sheetDataXml += rowXml;
  }

  function getColumnLetter(colIndex) {
    let letter = '';
    while (colIndex > 0) {
      let mod = (colIndex - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      colIndex = Math.floor((colIndex - mod) / 26);
    }
    return letter || 'A';
  }

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetDataXml}</sheetData>
</worksheet>`;

  return createZip({
    '[Content_Types].xml': contentTypesXml,
    '_rels/.rels': relsXml,
    'xl/_rels/workbook.xml.rels': workbookRelsXml,
    'xl/workbook.xml': workbookXml,
    'xl/worksheets/sheet1.xml': sheet1Xml
  });
}

/* ─────────────────────────────────────────────────────────────
   3. PDF TEXT TO PPTX (PowerPoint)
   ───────────────────────────────────────────────────────────── */
function buildPptxXml(pagesData) {
  // pagesData: Array of { title, lines: [{ text }] }
  const files = {
    '[Content_Types].xml': '',
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
    'ppt/presentation.xml': '',
    'ppt/_rels/presentation.xml.rels': ''
  };

  let contentTypesOverride = '';
  let presRels = '';
  let sldIdList = '';

  for (let i = 0; i < pagesData.length; i++) {
    const slideNum = i + 1;
    const rId = `rId${slideNum + 1}`;
    contentTypesOverride += `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
    presRels += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>\n`;
    sldIdList += `<p:sldId id="${255 + slideNum}" r:id="${rId}"/>\n`;

    const page = pagesData[i];
    const titleText = page.title || `Slide ${slideNum}`;
    let bodyParagraphs = '';

    const lines = page.lines || [];
    for (const line of lines) {
      const text = typeof line === 'string' ? line : (line.text || '');
      if (text.trim() && text.trim() !== titleText.trim()) {
        bodyParagraphs += `<a:p><a:r><a:rPr lang="en-US" sz="1600"/><a:t>${escapeXml(text.trim())}</a:t></a:r></a:p>\n`;
      }
    }
    if (!bodyParagraphs) {
      bodyParagraphs = `<a:p><a:r><a:rPr lang="en-US" sz="1600"/><a:t></a:t></a:r></a:p>`;
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:grpSpPr/></p:nvGrpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="609600"/><a:ext cx="7772400" cy="1143000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="3200" b="1"/><a:t>${escapeXml(titleText)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="2000000"/><a:ext cx="7772400" cy="4500000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>${bodyParagraphs}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

    files[`ppt/slides/slide${slideNum}.xml`] = slideXml;
  }

  files['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${contentTypesOverride}
</Types>`;

  files['ppt/_rels/presentation.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`;

  files['ppt/presentation.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst/>
  <p:sldIdLst>${sldIdList}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;

  return createZip(files);
}

/* ─────────────────────────────────────────────────────────────
   4. DOCX TO PLAIN TEXT / PARAGRAPHS
   ───────────────────────────────────────────────────────────── */
function extractDocxContent(docxBytes) {
  const files = readZip(docxBytes);
  const docXmlBytes = files['word/document.xml'];
  if (!docXmlBytes) throw new Error('Invalid DOCX: missing word/document.xml');

  const textDecoder = new TextDecoder();
  const xml = textDecoder.decode(docXmlBytes);

  // Parse paragraphs <w:p>
  const paragraphs = [];
  const pRegex = /<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g;
  let pMatch;

  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    let pText = '';
    const tRegex = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      pText += tMatch[1];
    }
    const isHeading = pContent.includes('Heading1') || pContent.includes('<w:b/>') || pContent.includes('<w:b ');
    paragraphs.push({ text: pText, isHeading });
  }

  return paragraphs;
}

/* ─────────────────────────────────────────────────────────────
   5. XLSX TO 2D ARRAYS
   ───────────────────────────────────────────────────────────── */
function extractXlsxContent(xlsxBytes) {
  const files = readZip(xlsxBytes);
  const sheetXmlBytes = files['xl/worksheets/sheet1.xml'];
  if (!sheetXmlBytes) throw new Error('Invalid XLSX: missing xl/worksheets/sheet1.xml');

  const textDecoder = new TextDecoder();
  const xml = textDecoder.decode(sheetXmlBytes);

  const rows = [];
  const rowRegex = /<row(?: [^>]*)?>([\s\S]*?)<\/row>/g;
  let rMatch;

  while ((rMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rMatch[1];
    const cells = [];
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cMatch;

    while ((cMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cMatch[1];
      const cellData = cMatch[2];
      let val = '';

      if (attrs.includes('t="inlineStr"')) {
        const isMatch = /<t[^>]*>([\s\S]*?)<\/t>/.exec(cellData);
        if (isMatch) val = isMatch[1];
      } else {
        const vMatch = /<v[^>]*>([\s\S]*?)<\/v>/.exec(cellData);
        if (vMatch) val = vMatch[1];
      }
      cells.push(val);
    }
    rows.push(cells);
  }

  return rows;
}

/* ─────────────────────────────────────────────────────────────
   6. PPTX TO SLIDES
   ───────────────────────────────────────────────────────────── */
function extractPptxContent(pptxBytes) {
  const files = readZip(pptxBytes);
  const slides = [];
  const textDecoder = new TextDecoder();

  // Find all slide files
  const slideKeys = Object.keys(files).filter(k => k.startsWith('ppt/slides/slide') && k.endsWith('.xml'));
  slideKeys.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  for (const key of slideKeys) {
    const xml = textDecoder.decode(files[key]);
    const paragraphs = [];
    const pRegex = /<a:p(?: [^>]*)?>([\s\S]*?)<\/a:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[1];
      let pText = '';
      const tRegex = /<a:t(?: [^>]*)?>([^<]*)<\/a:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(pContent)) !== null) {
        pText += tMatch[1];
      }
      if (pText.trim()) {
        paragraphs.push(pText.trim());
      }
    }
    slides.push(paragraphs);
  }

  return slides;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildDocxXml,
    buildXlsxXml,
    buildPptxXml,
    extractDocxContent,
    extractXlsxContent,
    extractPptxContent
  };
}
if (typeof window !== 'undefined') {
  window.OfficeConverter = {
    buildDocxXml,
    buildXlsxXml,
    buildPptxXml,
    extractDocxContent,
    extractXlsxContent,
    extractPptxContent
  };
}
