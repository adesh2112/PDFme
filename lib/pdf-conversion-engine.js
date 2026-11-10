'use strict';
/**
 * PDF Conversion Engine
 * High-fidelity conversion between PDF and Office documents, Images, and HTML.
 */

var PDFLib = typeof require !== 'undefined' ? (function() { try { return require('pdf-lib'); } catch(e) { return require('./pdf-lib.min.js'); } })() : (typeof window !== 'undefined' ? (window.PDFLib || window.pdfLib) : null);
var _oc = typeof require !== 'undefined' ? require('./office-converter.js') : (typeof window !== 'undefined' ? window.OfficeConverter : {});
var buildDocxXml = _oc ? _oc.buildDocxXml : null;
var buildXlsxXml = _oc ? _oc.buildXlsxXml : null;
var buildPptxXml = _oc ? _oc.buildPptxXml : null;
var extractDocxContent = _oc ? _oc.extractDocxContent : null;
var extractXlsxContent = _oc ? _oc.extractXlsxContent : null;
var extractPptxContent = _oc ? _oc.extractPptxContent : null;
var createZip = typeof require !== 'undefined' ? require('./zip-util.js').createZip : (typeof window !== 'undefined' && window.ZipUtil ? window.ZipUtil.createZip : null);

function getEffectivePdfjs(pdfjsLib) {
  if (pdfjsLib) return pdfjsLib;
  if (typeof window !== 'undefined' && window.pdfjsLib) return window.pdfjsLib;
  if (typeof require !== 'undefined') {
    try {
      return require('./pdf.min.js');
    } catch (e) {}
  }
  return null;
}

function sanitizeForPdf(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u2023]/g, '*')
    .replace(/\u00A0/g, ' ')
    .replace(/[\t\r]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

/**
 * 1. PDF TO WORD (DOCX)
 * Extracts structured text lines from PDF and formats into a genuine .docx file
 */
async function pdfToWord(pdfBytes, pdfjsLib) {
  const effectivePdfjs = getEffectivePdfjs(pdfjsLib);
  if (!effectivePdfjs) {
    throw new Error('PDF.js is required for PDF text extraction');
  }

  const doc = await effectivePdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableFontFace: true }).promise;
  const numPages = doc.numPages;
  const pagesData = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    // Group text items by line (clustering by Y coordinate)
    const items = textContent.items.map(item => {
      const transform = item.transform;
      return {
        text: item.str,
        x: transform[4],
        y: transform[5],
        fontSize: Math.hypot(transform[0], transform[1]) || 12,
        fontName: item.fontName || ''
      };
    });

    // Sort top to bottom, then left to right
    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 4) return yDiff;
      return a.x - b.x;
    });

    // Cluster into lines
    const lines = [];
    let currentLine = null;

    for (const item of items) {
      if (!currentLine || Math.abs(currentLine.y - item.y) > 4) {
        if (currentLine) lines.push(currentLine);
        currentLine = {
          text: item.text,
          y: item.y,
          fontSize: item.fontSize,
          isBold: item.fontName.toLowerCase().includes('bold')
        };
      } else {
        currentLine.text += (currentLine.text ? ' ' : '') + item.text;
        currentLine.fontSize = Math.max(currentLine.fontSize, item.fontSize);
      }
    }
    if (currentLine) lines.push(currentLine);

    pagesData.push({ lines });
  }

  return buildDocxXml(pagesData);
}

/**
 * 2. WORD (DOCX) TO PDF
 * Reads paragraphs and headings from DOCX, renders formatted vector PDF with pagination
 */
async function wordToPdf(docxBytes) {
  const paragraphs = extractDocxContent(docxBytes);
  const pdfDoc = await PDFLib.PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 54;
  const MARGIN_RIGHT = 54;
  const MARGIN_TOP = 54;
  const MARGIN_BOTTOM = 54;
  const USABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  for (const para of paragraphs) {
    const isHeading = para.isHeading;
    const font = isHeading ? boldFont : regularFont;
    const fontSize = isHeading ? 16 : 11;
    const lineHeight = fontSize * 1.35;

    // Word wrap
    const cleanText = sanitizeForPdf(para.text);
    const words = cleanText.split(/\s+/).filter(Boolean);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth <= USABLE_WIDTH) {
        currentLine = testLine;
      } else {
        if (currentY - lineHeight < MARGIN_BOTTOM) {
          currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          currentY = PAGE_HEIGHT - MARGIN_TOP;
        }
        currentPage.drawText(currentLine, {
          x: MARGIN_LEFT,
          y: currentY,
          size: fontSize,
          font,
          color: PDFLib.rgb(0.1, 0.1, 0.1)
        });
        currentY -= lineHeight;
        currentLine = word;
      }
    }

    if (currentLine) {
      if (currentY - lineHeight < MARGIN_BOTTOM) {
        currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - MARGIN_TOP;
      }
      currentPage.drawText(currentLine, {
        x: MARGIN_LEFT,
        y: currentY,
        size: fontSize,
        font,
        color: PDFLib.rgb(0.1, 0.1, 0.1)
      });
      currentY -= (lineHeight + (isHeading ? 8 : 4));
    }
  }

  return await pdfDoc.save();
}

/**
 * 3. PDF TO EXCEL (XLSX)
 * Clusters PDF text items by row and column and generates a real XLSX spreadsheet
 */
async function pdfToExcel(pdfBytes, pdfjsLib) {
  const effectivePdfjs = getEffectivePdfjs(pdfjsLib);
  if (!effectivePdfjs) {
    throw new Error('PDF.js is required for PDF table extraction');
  }

  const doc = await effectivePdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableFontFace: true }).promise;
  const numPages = doc.numPages;
  const allRows = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items.map(item => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5]
    })).filter(it => it.text);

    // Group items into rows by Y (within 6px)
    items.sort((a, b) => b.y - a.y);
    const rowsMap = [];

    for (const item of items) {
      let matchedRow = rowsMap.find(r => Math.abs(r.y - item.y) <= 6);
      if (!matchedRow) {
        matchedRow = { y: item.y, items: [] };
        rowsMap.push(matchedRow);
      }
      matchedRow.items.push(item);
    }

    // Sort items horizontally within each row
    for (const row of rowsMap) {
      row.items.sort((a, b) => a.x - b.x);
      allRows.push(row.items.map(it => it.text));
    }
  }

  return buildXlsxXml(allRows);
}

/**
 * 4. EXCEL (XLSX) TO PDF
 * Reads 2D spreadsheet data, renders formatted table with gridlines, headers, and pagination
 */
async function excelToPdf(xlsxBytes) {
  const rows = extractXlsxContent(xlsxBytes);
  const pdfDoc = await PDFLib.PDFDocument.create();

  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  // Landscape A4 for wide tabular data
  const PAGE_WIDTH = 841.89;
  const PAGE_HEIGHT = 595.28;
  const MARGIN = 36;
  const ROW_HEIGHT = 22;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN - 30;

  // Title
  currentPage.drawText('Spreadsheet Export', {
    x: MARGIN,
    y: PAGE_HEIGHT - MARGIN - 16,
    size: 16,
    font: boldFont,
    color: PDFLib.rgb(0.1, 0.1, 0.1)
  });

  const numCols = rows.length > 0 ? Math.max(...rows.map(r => r.length)) : 1;
  const colWidth = (PAGE_WIDTH - 2 * MARGIN) / Math.max(1, numCols);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const isHeader = r === 0;

    if (currentY - ROW_HEIGHT < MARGIN) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentY = PAGE_HEIGHT - MARGIN - ROW_HEIGHT;
    }

    // Row background (zebra striping)
    if (isHeader) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: currentY - ROW_HEIGHT + 4,
        width: PAGE_WIDTH - 2 * MARGIN,
        height: ROW_HEIGHT,
        color: PDFLib.rgb(0.9, 0.93, 0.98)
      });
    } else if (r % 2 === 1) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: currentY - ROW_HEIGHT + 4,
        width: PAGE_WIDTH - 2 * MARGIN,
        height: ROW_HEIGHT,
        color: PDFLib.rgb(0.97, 0.97, 0.97)
      });
    }

    // Cell borders & text
    for (let c = 0; c < row.length; c++) {
      const cellText = sanitizeForPdf(String(row[c] || ''));
      const cellX = MARGIN + c * colWidth;

      // Draw cell border
      currentPage.drawRectangle({
        x: cellX,
        y: currentY - ROW_HEIGHT + 4,
        width: colWidth,
        height: ROW_HEIGHT,
        borderColor: PDFLib.rgb(0.85, 0.85, 0.85),
        borderWidth: 0.5
      });

      // Truncate text if exceeds column width
      let display = cellText;
      const cellFont = isHeader ? boldFont : font;
      const fontSize = 9;
      while (display.length > 3 && cellFont.widthOfTextAtSize(display, fontSize) > colWidth - 8) {
        display = display.slice(0, -4) + '...';
      }

      currentPage.drawText(display, {
        x: cellX + 4,
        y: currentY - ROW_HEIGHT + 9,
        size: fontSize,
        font: cellFont,
        color: isHeader ? PDFLib.rgb(0.1, 0.1, 0.3) : PDFLib.rgb(0.2, 0.2, 0.2)
      });
    }

    currentY -= ROW_HEIGHT;
  }

  return await pdfDoc.save();
}

/**
 * 5. PDF TO POWERPOINT (PPTX)
 * Converts each page into a presentation slide
 */
async function pdfToPowerPoint(pdfBytes, pdfjsLib) {
  const effectivePdfjs = getEffectivePdfjs(pdfjsLib);
  if (!effectivePdfjs) {
    throw new Error('PDF.js is required for PDF extraction');
  }

  const doc = await effectivePdfjs.getDocument({ data: new Uint8Array(pdfBytes), disableFontFace: true }).promise;
  const numPages = doc.numPages;
  const pagesData = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(it => it.str.trim()).filter(Boolean);

    const title = strings[0] || `Slide ${i}`;
    const lines = strings.slice(1, 12); // up to 10 bullet points per slide

    pagesData.push({ title, lines });
  }

  return buildPptxXml(pagesData);
}

/**
 * 6. POWERPOINT (PPTX) TO PDF
 * Reads slides and renders landscape slides onto PDF
 */
async function powerPointToPdf(pptxBytes) {
  const slides = extractPptxContent(pptxBytes);
  const pdfDoc = await PDFLib.PDFDocument.create();

  const titleFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  // 16:9 widescreen slide in points (960 x 540)
  const SLIDE_WIDTH = 960;
  const SLIDE_HEIGHT = 540;

  for (let i = 0; i < slides.length; i++) {
    const slideItems = slides[i];
    const page = pdfDoc.addPage([SLIDE_WIDTH, SLIDE_HEIGHT]);

    // Slide background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      color: PDFLib.rgb(0.98, 0.98, 0.99)
    });

    // Top accent bar
    page.drawRectangle({
      x: 0,
      y: SLIDE_HEIGHT - 6,
      width: SLIDE_WIDTH,
      height: 6,
      color: PDFLib.rgb(0.13, 0.58, 0.95)
    });

    const isObj = slideItems && typeof slideItems === 'object' && !Array.isArray(slideItems);
    const rawTitle = isObj ? (slideItems.title || `Slide ${i + 1}`) : (slideItems[0] || `Slide ${i + 1}`);
    const title = sanitizeForPdf(rawTitle);
    page.drawText(title.slice(0, 70), {
      x: 60,
      y: SLIDE_HEIGHT - 80,
      size: 28,
      font: titleFont,
      color: PDFLib.rgb(0.1, 0.1, 0.15)
    });

    let bodyY = SLIDE_HEIGHT - 140;
    const bullets = isObj ? (slideItems.bullets || []) : slideItems.slice(1);
    for (let b = 0; b < bullets.length; b++) {
      const rawLine = bullets[b];
      if (!rawLine) continue;
      const line = sanitizeForPdf(rawLine);

      // Draw bullet point
      page.drawCircle({
        x: 68,
        y: bodyY + 4,
        size: 3,
        color: PDFLib.rgb(0.13, 0.58, 0.95)
      });

      page.drawText(line.slice(0, 95), {
        x: 84,
        y: bodyY,
        size: 16,
        font: bodyFont,
        color: PDFLib.rgb(0.2, 0.2, 0.25)
      });
      bodyY -= 32;
    }

    // Slide footer
    page.drawText(`${i + 1} / ${slides.length}`, {
      x: SLIDE_WIDTH - 80,
      y: 30,
      size: 11,
      font: bodyFont,
      color: PDFLib.rgb(0.6, 0.6, 0.6)
    });
  }

  return await pdfDoc.save();
}

/**
 * 7. PDF TO IMAGES (JPG / PNG)
 * Renders pages to canvas at high resolution (300 DPI equivalent)
 */
async function pdfToImages(pdfBytes, format = 'png', scale = 2.0, pdfjsLib) {
  if (!pdfjsLib) {
    if (typeof window !== 'undefined' && window.pdfjsLib) pdfjsLib = window.pdfjsLib;
    else throw new Error('PDF.js is required for image rendering');
  }

  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const numPages = doc.numPages;
  const images = [];
  const mimeType = format === 'jpg' || format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png';
  const zipFiles = {};

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    // Fill white background for JPG
    if (format === 'jpg' || format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL(mimeType, 0.92);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k);

    const filename = `page-${String(i).padStart(3, '0')}.${ext}`;
    images.push({ pageNum: i, dataUrl, bytes, filename });
    zipFiles[filename] = bytes;
  }

  const zipBytes = numPages > 1 ? createZip(zipFiles) : null;
  return { images, zipBytes, numPages };
}

/**
 * 8. IMAGES (JPG/PNG) TO PDF
 * images: array of { bytes: Uint8Array, type: 'png'|'jpg' }
 * pageSize: 'a4' | 'letter' | 'fit'
 */
async function imagesToPdf(images, pageSize = 'a4') {
  const lib = PDFLib || (typeof window !== 'undefined' && (window.PDFLib || window.pdfLib));
  const PDFDocument = lib.PDFDocument || lib.pdfDocument;
  const pdfDoc = await PDFDocument.create();

  for (const img of images) {
    let imgBytes = img.bytes || img.data;
    if (imgBytes) {
      imgBytes = new Uint8Array(imgBytes);
    }
    if (!imgBytes && img.dataUrl) {
      const base64 = img.dataUrl.replace(/^data:[^;]+;base64,/, '');
      imgBytes = typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64')
        : Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      imgBytes = new Uint8Array(imgBytes);
    }
    const isJpg = img.type === 'jpg' || img.type === 'jpeg' || (img.name && /\.(jpe?g)$/i.test(img.name)) || (img.dataUrl && img.dataUrl.includes('image/jpeg'));
    let embeddedImage;
    if (isJpg) {
      embeddedImage = await pdfDoc.embedJpg(imgBytes);
    } else {
      embeddedImage = await pdfDoc.embedPng(imgBytes);
    }

    const imgWidth = embeddedImage.width;
    const imgHeight = embeddedImage.height;

    let targetWidth, targetHeight;
    if (pageSize === 'letter') {
      targetWidth = 612;
      targetHeight = 792;
    } else if (pageSize === 'fit') {
      targetWidth = imgWidth;
      targetHeight = imgHeight;
    } else {
      // Default A4
      targetWidth = 595.28;
      targetHeight = 841.89;
    }

    if (pageSize !== 'fit') {
      if (imgWidth > imgHeight && targetWidth < targetHeight) {
        [targetWidth, targetHeight] = [targetHeight, targetWidth];
      } else if (imgWidth < imgHeight && targetWidth > targetHeight) {
        [targetWidth, targetHeight] = [targetHeight, targetWidth];
      }
    }

    const page = pdfDoc.addPage([targetWidth, targetHeight]);

    if (pageSize === 'fit') {
      page.drawImage(embeddedImage, { x: 0, y: 0, width: targetWidth, height: targetHeight });
    } else {
      // Scale to fit page while maintaining aspect ratio
      const margin = 36;
      const avW = targetWidth - margin * 2;
      const avH = targetHeight - margin * 2;
      const scale = Math.min(avW / imgWidth, avH / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const x = (targetWidth - drawWidth) / 2;
      const y = (targetHeight - drawHeight) / 2;

      page.drawImage(embeddedImage, { x, y, width: drawWidth, height: drawHeight });
    }
  }

  return await pdfDoc.save();
}

/**
 * 9. HTML TO PDF
 * Parses HTML text structure (headings, paragraphs, lists) and formats into a clean vector PDF
 */
async function htmlToPdf(htmlString) {
  const pdfDoc = await PDFLib.PDFDocument.create();
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 54;
  const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN;

  // Extract text blocks from HTML
  const cleanHtml = htmlString
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');

  const blockRegex = /<(h[1-6]|p|li|tr)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  let hasBlocks = false;

  while ((match = blockRegex.exec(cleanHtml)) !== null) {
    hasBlocks = true;
    const tag = match[1].toLowerCase();
    const rawContent = match[2];
    const text = rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const isH1 = tag === 'h1';
    const isHeading = tag.startsWith('h');
    const isListItem = tag === 'li';

    const currentFont = isHeading ? boldFont : font;
    const fontSize = isH1 ? 20 : (isHeading ? 14 : 11);
    const lineHeight = fontSize * 1.35;

    // Word wrap
    const prefix = isListItem ? '• ' : '';
    const words = (prefix + text).split(' ');
    let currentLine = '';

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (currentFont.widthOfTextAtSize(test, fontSize) <= USABLE_WIDTH) {
        currentLine = test;
      } else {
        if (currentY - lineHeight < MARGIN) {
          currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          currentY = PAGE_HEIGHT - MARGIN;
        }
        currentPage.drawText(currentLine, {
          x: MARGIN,
          y: currentY,
          size: fontSize,
          font: currentFont,
          color: PDFLib.rgb(0.15, 0.15, 0.15)
        });
        currentY -= lineHeight;
        currentLine = word;
      }
    }

    if (currentLine) {
      if (currentY - lineHeight < MARGIN) {
        currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - MARGIN;
      }
      currentPage.drawText(currentLine, {
        x: MARGIN,
        y: currentY,
        size: fontSize,
        font: currentFont,
        color: PDFLib.rgb(0.15, 0.15, 0.15)
      });
      currentY -= (lineHeight + (isHeading ? 10 : 5));
    }
  }

  if (!hasBlocks) {
    // Plain text fallback
    const plain = cleanHtml.replace(/<[^>]+>/g, ' ').trim();
    currentPage.drawText(plain.slice(0, 500), {
      x: MARGIN,
      y: currentY,
      size: 11,
      font,
      color: PDFLib.rgb(0.2, 0.2, 0.2)
    });
  }

  return await pdfDoc.save();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pdfToWord,
    wordToPdf,
    pdfToExcel,
    excelToPdf,
    pdfToPowerPoint,
    pdfToPpt: pdfToPowerPoint,
    powerPointToPdf,
    pptToPdf: powerPointToPdf,
    pdfToImages,
    imagesToPdf,
    htmlToPdf
  };
}
if (typeof window !== 'undefined') {
  window.PdfConversion = {
    pdfToWord,
    wordToPdf,
    pdfToExcel,
    excelToPdf,
    pdfToPowerPoint,
    pdfToPpt: pdfToPowerPoint,
    powerPointToPdf,
    pptToPdf: powerPointToPdf,
    pdfToImages,
    imagesToPdf,
    htmlToPdf
  };
}

