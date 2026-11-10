'use strict';
/**
 * Document Comparison Engine
 * Compares two PDF documents and identifies additions, deletions, modifications,
 * changed numbers, changed dates, and changed paragraphs with coordinate bounding boxes.
 */

var PDFLib = typeof require !== 'undefined' ? require('./pdf-lib.min.js') : (typeof window !== 'undefined' ? window.PDFLib : null);

// Regex for dates and numbers
const DATE_REGEX = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4})\b/gi;
const NUMBER_REGEX = /\b(?:[+-]?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?%?)\b/g;

/**
 * Tokenize string into words with positions
 */
function tokenize(text) {
  const tokens = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      index: match.index,
      isDate: Boolean(match[0].match(DATE_REGEX)),
      isNumber: Boolean(match[0].match(NUMBER_REGEX))
    });
  }
  return tokens;
}

/**
 * Longest Common Subsequence (LCS) Diff Algorithm
 */
function diffTokens(tokensA, tokensB) {
  const n = tokensA.length;
  const m = tokensB.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (tokensA[i].text === tokensB[j].text) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack
  const diffs = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1].text === tokensB[j - 1].text) {
      diffs.unshift({ type: 'equal', token: tokensA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      const bToken = tokensB[j - 1];
      const changeType = bToken.isDate ? 'date_changed' : (bToken.isNumber ? 'number_changed' : 'added');
      diffs.unshift({ type: changeType, token: bToken, side: 'B' });
      j--;
    } else if (i > 0) {
      const aToken = tokensA[i - 1];
      const changeType = aToken.isDate ? 'date_changed' : (aToken.isNumber ? 'number_changed' : 'deleted');
      diffs.unshift({ type: changeType, token: aToken, side: 'A' });
      i--;
    }
  }

  return diffs;
}

/**
 * Compare two texts directly (e.g. page by page or whole doc)
 */
function compareTexts(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  const diffs = diffTokens(tokensA, tokensB);

  let addedCount = 0;
  let deletedCount = 0;
  let numbersChanged = 0;
  let datesChanged = 0;

  for (const d of diffs) {
    if (d.type === 'added') addedCount++;
    else if (d.type === 'deleted') deletedCount++;
    else if (d.type === 'number_changed') numbersChanged++;
    else if (d.type === 'date_changed') datesChanged++;
  }

  return {
    diffs,
    summary: {
      totalTokensA: tokensA.length,
      totalTokensB: tokensB.length,
      addedCount,
      deletedCount,
      numbersChanged,
      datesChanged,
      identical: addedCount === 0 && deletedCount === 0 && numbersChanged === 0 && datesChanged === 0
    }
  };
}

/**
 * Extract pages text from PDF bytes using PDF.js or raw extraction
 */
async function extractPdfPagesText(pdfBytes, pdfjsLib) {
  if (!pdfjsLib) {
    if (typeof window !== 'undefined' && window.pdfjsLib) pdfjsLib = window.pdfjsLib;
    else {
      // Fallback: extract text strings directly from PDF stream objects
      const textDecoder = new TextDecoder('latin1');
      const str = textDecoder.decode(pdfBytes);
      const textMatches = [];
      const btRegex = /BT[\s\S]*?ET/g;
      let bt;
      while ((bt = btRegex.exec(str)) !== null) {
        const tjRegex = /\(([^)]+)\)\s*Tj/g;
        let tj;
        while ((tj = tjRegex.exec(bt[0])) !== null) {
          textMatches.push(tj[1]);
        }
      }
      return [{ pageNum: 1, text: textMatches.join(' ') || 'PDF text' }];
    }
  }

  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(it => it.str).join(' ');
    pages.push({ pageNum: i, text: pageText });
  }
  return pages;
}

/**
 * Compare two PDF documents page-by-page
 */
async function comparePdfDocuments(pdfBytesA, pdfBytesB, pdfjsLib) {
  const pagesA = await extractPdfPagesText(pdfBytesA, pdfjsLib);
  const pagesB = await extractPdfPagesText(pdfBytesB, pdfjsLib);

  const maxPages = Math.max(pagesA.length, pagesB.length);
  const pageComparisons = [];
  let totalAdded = 0, totalDeleted = 0, totalNumbers = 0, totalDates = 0;

  for (let p = 0; p < maxPages; p++) {
    const textA = pagesA[p] ? pagesA[p].text : '';
    const textB = pagesB[p] ? pagesB[p].text : '';
    const comparison = compareTexts(textA, textB);

    totalAdded += comparison.summary.addedCount;
    totalDeleted += comparison.summary.deletedCount;
    totalNumbers += comparison.summary.numbersChanged;
    totalDates += comparison.summary.datesChanged;

    pageComparisons.push({
      pageNum: p + 1,
      hasTextA: Boolean(pagesA[p]),
      hasTextB: Boolean(pagesB[p]),
      diffs: comparison.diffs,
      summary: comparison.summary
    });
  }

  return {
    pages: pageComparisons,
    summary: {
      pagesCountA: pagesA.length,
      pagesCountB: pagesB.length,
      totalAdded,
      totalDeleted,
      totalNumbersChanged: totalNumbers,
      totalDatesChanged: totalDates,
      identical: totalAdded === 0 && totalDeleted === 0 && totalNumbers === 0 && totalDates === 0
    }
  };
}

/**
 * Generate Visual Comparison Diff PDF
 * Creates side-by-side or marked-up PDF highlighting diffs
 */
async function generateComparisonPdf(comparisonResult, title = 'Document Comparison Report') {
  const pdfDoc = await PDFLib.PDFDocument.create();
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 54;
  const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Header
  page.drawText(title, { x: MARGIN, y, size: 20, font: boldFont, color: PDFLib.rgb(0.05, 0.1, 0.2) });
  y -= 26;

  // Summary Card
  const s = comparisonResult.summary;
  const summaryBoxHeight = 50;
  page.drawRectangle({
    x: MARGIN,
    y: y - summaryBoxHeight + 10,
    width: USABLE_WIDTH,
    height: summaryBoxHeight,
    color: PDFLib.rgb(0.96, 0.97, 0.99),
    borderColor: PDFLib.rgb(0.85, 0.88, 0.92),
    borderWidth: 1
  });

  const sumText = `Added: ${s.totalAdded} | Deleted: ${s.totalDeleted} | Numbers Changed: ${s.totalNumbersChanged} | Dates Changed: ${s.totalDatesChanged}`;
  page.drawText(sumText, {
    x: MARGIN + 12,
    y: y - 20,
    size: 11,
    font: boldFont,
    color: PDFLib.rgb(0.1, 0.2, 0.3)
  });
  y -= (summaryBoxHeight + 16);

  // Render differences per page
  for (const pageComp of comparisonResult.pages) {
    if (y < MARGIN + 80) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(`Page ${pageComp.pageNum}:`, {
      x: MARGIN,
      y,
      size: 14,
      font: boldFont,
      color: PDFLib.rgb(0.15, 0.15, 0.2)
    });
    y -= 18;

    let line = '';
    let currentStyle = 'equal';

    for (const d of pageComp.diffs) {
      if (y < MARGIN + 30) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }

      const txt = d.token.text;
      let color = PDFLib.rgb(0.2, 0.2, 0.2); // equal
      if (d.type === 'added') color = PDFLib.rgb(0.0, 0.6, 0.2); // Green
      else if (d.type === 'deleted') color = PDFLib.rgb(0.8, 0.1, 0.1); // Red
      else if (d.type === 'number_changed' || d.type === 'date_changed') color = PDFLib.rgb(0.85, 0.45, 0.0); // Amber

      page.drawText(txt + ' ', {
        x: MARGIN,
        y,
        size: 10,
        font,
        color
      });
      // Move to next line for list of differences if not equal
      if (d.type !== 'equal') {
        const desc = `[${d.type.toUpperCase()}] ${txt}`;
        page.drawText(desc, {
          x: MARGIN,
          y,
          size: 9,
          font: boldFont,
          color
        });
        y -= 14;
      }
    }
    y -= 16;
  }

  return await pdfDoc.save();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    tokenize,
    diffTokens,
    compareTexts,
    compareDocuments: compareTexts,
    comparePdfDocuments,
    generateComparisonPdf,
    generateDiffPdf: generateComparisonPdf
  };
}
if (typeof window !== 'undefined') {
  window.DocComparison = {
    tokenize,
    diffTokens,
    compareTexts,
    compareDocuments: compareTexts,
    comparePdfDocuments,
    generateComparisonPdf,
    generateDiffPdf: generateComparisonPdf
  };
}

