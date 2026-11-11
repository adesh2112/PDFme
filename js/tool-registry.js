'use strict';
/**
 * PDFme Central Tool Registry & Shared Routing System
 * Defines all tools, unified navigation, URL routing, browser history,
 * responsive tool interfaces, and genuine client/backend execution.
 */

(function initPdfmeToolSystem(global) {
  // SVG Icon Helper
  function makeIcon(pathContent, viewBox = '0 0 24 24') {
    return `<svg width="22" height="22" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathContent}</svg>`;
  }

  const ICONS = {
    word: makeIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    excel: makeIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
    ppt: makeIcon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>'),
    image: makeIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    pdf: makeIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    split: makeIcon('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>'),
    merge: makeIcon('<rect x="3" y="3" width="13" height="13" rx="2"/><rect x="8" y="8" width="13" height="13" rx="2"/>'),
    rotate: makeIcon('<path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>'),
    compress: makeIcon('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'),
    reorder: makeIcon('<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>'),
    delete: makeIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'),
    extract: makeIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'),
    numbers: makeIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="14"/>'),
    crop: makeIcon('<path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>'),
    protect: makeIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    unlock: makeIcon('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
    watermark: makeIcon('<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'),
    esign: makeIcon('<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>'),
    sanitize: makeIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
    aiChat: makeIcon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    aiSummarizer: makeIcon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
    aiQa: makeIcon('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    aiInsights: makeIcon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
    aiExtract: makeIcon('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>'),
    aiContract: makeIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><circle cx="12" cy="9" r="0.5"/>'),
    compare: makeIcon('<rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/>'),
    invoice: makeIcon('<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="12" y2="16"/>'),
    offer: makeIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    payslip: makeIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
    certificate: makeIcon('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>'),
    bulk: makeIcon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    repair: makeIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    flatten: makeIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/>'),
    edit: makeIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
    translate: makeIcon('<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>'),
    ocr: makeIcon('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/>')
  };

  /**
   * Central Tool Catalog
   * Every single tool in the platform is registered here once with its canonical ID,
   * routes, categories, accepted file types, access tiers, and descriptive text.
   */
  const TOOLS = [
    // ── 1. CORE WORKING TOOLS ──
    {
      id: 'edit-pdf',
      name: 'Edit PDF',
      category: 'edit',
      categoryName: 'PDF Editor',
      route: '/edit-pdf',
      badge: 'EDITOR',
      tier: 'free',
      icon: ICONS.edit,
      desc: 'Add text, draw, highlight, sign and annotate any PDF inline in your browser.',
      targetScreen: 'edit'
    },
    {
      id: 'merge-pdf',
      name: 'Merge PDF',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/merge-pdf',
      badge: 'MERGE',
      tier: 'free',
      icon: ICONS.merge,
      desc: 'Combine 20–50+ PDF files into a single unified master document with page controls.',
      targetScreen: 'merge'
    },
    {
      id: 'photos-to-pdf',
      name: 'Photos to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/photos-to-pdf',
      badge: 'PHOTOS',
      tier: 'free',
      icon: ICONS.image,
      desc: 'Turn your photos (JPG, PNG, WebP) into an organized vector PDF with instant download.',
      targetScreen: 'photos'
    },

    // ── 2. CONVERT PDF TOOLS ──
    {
      id: 'pdf-to-word',
      name: 'PDF to Word',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pdf-to-word',
      badge: 'DOCX',
      tier: 'pro',
      icon: ICONS.word,
      desc: 'Extract headings, paragraphs, and tables into genuine Microsoft Word .docx files.',
      accept: '.pdf',
      outputExt: '.docx',
      outputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      actionLabel: 'Convert to Word (.docx)'
    },
    {
      id: 'pdf-to-excel',
      name: 'PDF to Excel',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pdf-to-excel',
      badge: 'XLSX',
      tier: 'pro',
      icon: ICONS.excel,
      desc: 'Parse financial and tabular records into genuine Microsoft Excel .xlsx spreadsheets.',
      accept: '.pdf',
      outputExt: '.xlsx',
      outputMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      actionLabel: 'Convert to Excel (.xlsx)'
    },
    {
      id: 'pdf-to-ppt',
      name: 'PDF to PowerPoint',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pdf-to-ppt',
      aliases: ['/pdf-to-powerpoint'],
      badge: 'PPTX',
      tier: 'pro',
      icon: ICONS.ppt,
      desc: 'Convert document pages into Microsoft PowerPoint (.pptx) presentation slides.',
      accept: '.pdf',
      outputExt: '.pptx',
      outputMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      actionLabel: 'Convert to PowerPoint (.pptx)'
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pdf-to-jpg',
      badge: 'JPG',
      tier: 'free',
      icon: ICONS.image,
      desc: 'Render each page as a crisp, high-resolution JPG image file.',
      accept: '.pdf',
      outputExt: '.jpg',
      outputMime: 'image/jpeg',
      actionLabel: 'Convert to JPG'
    },
    {
      id: 'pdf-to-png',
      name: 'PDF to PNG',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pdf-to-png',
      badge: 'PNG',
      tier: 'free',
      icon: ICONS.image,
      desc: 'Render each page as a lossless, high-resolution PNG image file.',
      accept: '.pdf',
      outputExt: '.png',
      outputMime: 'image/png',
      actionLabel: 'Convert to PNG'
    },
    {
      id: 'pdf-to-images',
      name: 'PDF to Images (ZIP)',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pdf-to-images',
      badge: 'ZIP',
      tier: 'free',
      icon: ICONS.image,
      desc: 'Render all document pages into crisp image files bundled in a zip archive.',
      accept: '.pdf',
      outputExt: '.zip',
      outputMime: 'application/zip',
      actionLabel: 'Extract Images (.zip)'
    },
    {
      id: 'word-to-pdf',
      name: 'Word to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/word-to-pdf',
      badge: 'PDF',
      tier: 'pro',
      icon: ICONS.pdf,
      desc: 'Render Microsoft Word (.docx) documents into clean, paginated vector PDF files.',
      accept: '.docx',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Convert Word to PDF'
    },
    {
      id: 'excel-to-pdf',
      name: 'Excel to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/excel-to-pdf',
      badge: 'PDF',
      tier: 'pro',
      icon: ICONS.pdf,
      desc: 'Convert spreadsheets into formatted landscape tabular PDF reports with zebra striping.',
      accept: '.xlsx',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Convert Excel to PDF'
    },
    {
      id: 'pptx-to-pdf',
      name: 'PowerPoint to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/pptx-to-pdf',
      aliases: ['/powerpoint-to-pdf', '/ppt-to-pdf'],
      badge: 'PDF',
      tier: 'pro',
      icon: ICONS.pdf,
      desc: 'Render 16:9 widescreen presentation slides into print-ready vector PDF.',
      accept: '.pptx',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Convert PowerPoint to PDF'
    },
    {
      id: 'jpg-to-pdf',
      name: 'JPG to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/jpg-to-pdf',
      badge: 'PDF',
      tier: 'free',
      icon: ICONS.pdf,
      desc: 'Convert JPG photos and graphics into a high-quality vector PDF document.',
      accept: '.jpg,.jpeg',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Convert JPG to PDF'
    },
    {
      id: 'png-to-pdf',
      name: 'PNG to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/png-to-pdf',
      badge: 'PDF',
      tier: 'free',
      icon: ICONS.pdf,
      desc: 'Convert PNG photos and graphics into a high-quality vector PDF document.',
      accept: '.png',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Convert PNG to PDF'
    },
    {
      id: 'html-to-pdf',
      name: 'HTML to PDF',
      category: 'convert',
      categoryName: 'Convert PDF',
      route: '/html-to-pdf',
      badge: 'PDF',
      tier: 'free',
      icon: ICONS.pdf,
      desc: 'Convert HTML rich markup into styled vector PDF with headings and lists.',
      accept: '.html,.htm,.txt',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Render HTML to PDF'
    },

    // ── 3. ORGANISE PDF TOOLS ──
    {
      id: 'split-pdf',
      name: 'Split PDF',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/split-pdf',
      badge: 'SPLIT',
      tier: 'free',
      icon: ICONS.split,
      desc: 'Split your document into individual single-page PDFs or custom chapter ranges.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Split PDF Now'
    },
    {
      id: 'reorder-pdf',
      name: 'Reorder Pages',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/reorder-pdf',
      aliases: ['/organize-pdf'],
      badge: 'REORDER',
      tier: 'free',
      icon: ICONS.reorder,
      desc: 'Rearrange pages into any custom sequence and remove redundant sheets.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Apply Page Order'
    },
    {
      id: 'delete-pages',
      name: 'Delete Pages',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/delete-pages',
      badge: 'DELETE',
      tier: 'free',
      icon: ICONS.delete,
      desc: 'Delete unwanted, blank, or sensitive pages permanently from your PDF document.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Delete Selected Pages'
    },
    {
      id: 'extract-pages',
      name: 'Extract Pages',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/extract-pages',
      badge: 'EXTRACT',
      tier: 'free',
      icon: ICONS.extract,
      desc: 'Extract select pages or chapters into a fresh, standalone PDF document.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Extract Pages Now'
    },
    {
      id: 'rotate-pdf',
      name: 'Rotate Pages',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/rotate-pdf',
      badge: 'ROTATE',
      tier: 'free',
      icon: ICONS.rotate,
      desc: 'Rotate specific or all pages 90°, 180°, or 270° clockwise.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Rotate PDF'
    },
    {
      id: 'compress-pdf',
      name: 'Compress PDF',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/compress-pdf',
      badge: 'OPTIMIZE',
      tier: 'free',
      icon: ICONS.compress,
      desc: 'Reduce file size with stream compression while preserving vector text and image clarity.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Compress PDF'
    },
    {
      id: 'page-numbers',
      name: 'Add Page Numbers',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/page-numbers',
      badge: 'NUMBERS',
      tier: 'free',
      icon: ICONS.numbers,
      desc: 'Add custom page numbers in any of 6 positions with font and styling controls.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Insert Page Numbers'
    },
    {
      id: 'crop-pdf',
      name: 'Crop PDF',
      category: 'organize',
      categoryName: 'Organise PDF',
      route: '/crop-pdf',
      badge: 'CROP',
      tier: 'pro',
      icon: ICONS.crop,
      desc: 'Trim page margins and adjust document bounding boxes across all pages.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Crop PDF Pages'
    },

    // ── 4. AI PDF TOOLS ──
    {
      id: 'ai-chat',
      name: 'AI Chat with PDF',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-chat',
      badge: 'AI CHAT',
      tier: 'pro',
      icon: ICONS.aiChat,
      desc: 'Interactive conversational dialog with your PDF document with verified citations.',
      accept: '.pdf',
      actionLabel: 'Start AI Conversation'
    },
    {
      id: 'ai-summarizer',
      name: 'AI Document Summarizer',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-summarizer',
      badge: 'SUMMARIZE',
      tier: 'pro',
      icon: ICONS.aiSummarizer,
      desc: 'Generate executive summaries, key bullet points, deadlines, and actionable items.',
      accept: '.pdf',
      actionLabel: 'Generate Summary'
    },
    {
      id: 'ai-qa',
      name: 'Ask PDF (Q&A)',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-qa',
      aliases: ['/ai-assistant', '/ask-pdf'],
      badge: 'Q&A',
      tier: 'pro',
      icon: ICONS.aiQa,
      desc: 'Ask questions about your PDF and receive verified answers with exact page references.',
      accept: '.pdf',
      actionLabel: 'Ask Document'
    },
    {
      id: 'ai-insights',
      name: 'Document Analysis',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-insights',
      aliases: ['/document-analysis'],
      badge: 'INSIGHTS',
      tier: 'pro',
      icon: ICONS.aiInsights,
      desc: 'Analyze lexical metrics, reading time, structure segments, and high-frequency topics.',
      accept: '.pdf',
      actionLabel: 'Analyze Document'
    },
    {
      id: 'ai-extract',
      name: 'Information Extraction',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-extract',
      aliases: ['/information-extraction'],
      badge: 'ENTITIES',
      tier: 'pro',
      icon: ICONS.aiExtract,
      desc: 'Extract structured entities: dates, emails, phone numbers, amounts, and GSTINs.',
      accept: '.pdf',
      actionLabel: 'Extract Entities'
    },
    {
      id: 'ai-contract',
      name: 'Contract Risk Analyzer',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-contract',
      badge: 'RISK AUDIT',
      tier: 'pro',
      icon: ICONS.aiContract,
      desc: 'Identify termination clauses, indemnities, unusual liabilities, and missing terms.',
      accept: '.pdf',
      actionLabel: 'Audit Contract'
    },
    {
      id: 'doc-compare',
      name: 'Document Comparison',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/doc-compare',
      badge: 'DIFF ENGINE',
      tier: 'pro',
      icon: ICONS.compare,
      desc: 'Side-by-side visual diff highlighting added, modified, or removed figures and terms.',
      accept: '.pdf',
      isTwoFiles: true,
      actionLabel: 'Compare Documents'
    },
    {
      id: 'invoice-extractor',
      name: 'Invoice Data Extractor',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/invoice-extractor',
      badge: 'EXTRACT',
      tier: 'pro',
      icon: ICONS.invoice,
      desc: 'Parse GSTIN, vendor names, line items, and totals directly into Excel (.xlsx) sheets.',
      accept: '.pdf',
      outputExt: '.xlsx',
      outputMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      actionLabel: 'Extract Invoice to Excel'
    },
    {
      id: 'ai-multi',
      name: 'Multi-PDF Analysis',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-multi',
      badge: 'MULTI-DOC',
      tier: 'pro',
      icon: ICONS.aiChat,
      desc: 'Query and synthesize information across multiple PDF documents simultaneously.',
      accept: '.pdf',
      isMultiFile: true,
      actionLabel: 'Analyze All Documents'
    },
    {
      id: 'ai-exec-summary',
      name: 'Executive Summary',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-exec-summary',
      badge: 'EXECUTIVE',
      tier: 'pro',
      icon: ICONS.aiSummarizer,
      desc: 'High-level briefing with strategic takeaways, milestone dates, and decisions.',
      accept: '.pdf',
      actionLabel: 'Generate Executive Brief'
    },
    {
      id: 'ai-translator',
      name: 'AI PDF Translator',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ai-translator',
      badge: 'TRANSLATE',
      tier: 'pro',
      icon: ICONS.translate,
      desc: 'Translate your PDF documents across 20+ languages while preserving layout.',
      accept: '.pdf',
      actionLabel: 'Translate PDF'
    },
    {
      id: 'ocr-pdf',
      name: 'OCR & Searchable PDF',
      category: 'ai',
      categoryName: 'AI PDF Tools',
      route: '/ocr-pdf',
      badge: 'OCR',
      tier: 'pro',
      icon: ICONS.ocr,
      desc: 'Convert scanned PDFs and images into searchable, selectable text.',
      accept: '.pdf,.jpg,.jpeg,.png',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Run Optical OCR'
    },

    // ── 5. PDF SECURITY TOOLS ──
    {
      id: 'protect-pdf',
      name: 'Protect PDF',
      category: 'security',
      categoryName: 'PDF Security',
      route: '/protect-pdf',
      aliases: ['/password-protect'],
      badge: 'ENCRYPTION',
      tier: 'free',
      icon: ICONS.protect,
      desc: 'Encrypt your document with 128-bit/256-bit security to prevent unauthorized viewing.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Encrypt Document'
    },
    {
      id: 'unlock-pdf',
      name: 'Unlock PDF',
      category: 'security',
      categoryName: 'PDF Security',
      route: '/unlock-pdf',
      badge: 'DECRYPT',
      tier: 'free',
      icon: ICONS.unlock,
      desc: 'Remove encryption and viewing restrictions from a password-protected PDF file.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Unlock & Decrypt PDF'
    },
    {
      id: 'watermark-pdf',
      name: 'Watermark PDF',
      category: 'security',
      categoryName: 'PDF Security',
      route: '/watermark-pdf',
      badge: 'WATERMARK',
      tier: 'free',
      icon: ICONS.watermark,
      desc: 'Stamp custom watermark text (Confidential, Draft, Sample) diagonally across all pages.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Apply Watermark'
    },
    {
      id: 'esign',
      name: 'E-Signature Workflow',
      category: 'security',
      categoryName: 'PDF Security',
      route: '/esign',
      badge: 'E-SIGN',
      tier: 'free',
      icon: ICONS.esign,
      desc: 'Draw or apply your digital signature and generate a verified audit certificate.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Sign & Export PDF'
    },
    {
      id: 'remove-metadata',
      name: 'Sanitize Metadata',
      category: 'security',
      categoryName: 'PDF Security',
      route: '/remove-metadata',
      badge: 'PRIVACY',
      tier: 'free',
      icon: ICONS.sanitize,
      desc: 'Sanitize document by removing Author, Creator, Subject, Dates, and hidden XMP streams.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Sanitize Metadata'
    },

    // ── 6. BUSINESS AUTOMATION TOOLS ──
    {
      id: 'gen-invoice',
      name: 'Invoice Generator',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/gen-invoice',
      aliases: ['/invoice-generator'],
      badge: 'GST READY',
      tier: 'pro',
      icon: ICONS.invoice,
      desc: 'Generate professional GST-compliant corporate invoices with automatic tax calculations.',
      isGenerator: true,
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Generate Invoice PDF'
    },
    {
      id: 'gen-offer',
      name: 'Offer Letter Generator',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/gen-offer',
      aliases: ['/offer-letter-generator'],
      badge: 'HR TOOL',
      tier: 'pro',
      icon: ICONS.offer,
      desc: 'Generate branded employment offer letters with detailed compensation breakdown.',
      isGenerator: true,
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Generate Offer Letter'
    },
    {
      id: 'gen-payslip',
      name: 'Salary Slip Generator',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/gen-payslip',
      aliases: ['/salary-slip-generator'],
      badge: 'PAYSLIP',
      tier: 'pro',
      icon: ICONS.payslip,
      desc: 'Itemize earnings, PF, TDS deductions, and calculate net take-home salary.',
      isGenerator: true,
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Generate Payslip PDF'
    },
    {
      id: 'gen-exp-cert',
      name: 'Experience Certificate',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/gen-exp-cert',
      aliases: ['/experience-certificate'],
      badge: 'CERTIFICATE',
      tier: 'pro',
      icon: ICONS.certificate,
      desc: 'Generate official Experience & Relieving Certificates on corporate letterhead.',
      isGenerator: true,
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Generate Certificate'
    },
    {
      id: 'gen-bulk',
      name: 'Bulk Document Generator',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/gen-bulk',
      aliases: ['/bulk-document-generator'],
      badge: 'BATCH PRO',
      tier: 'pro',
      icon: ICONS.bulk,
      desc: 'Merge CSV / Excel records into hundreds of custom PDFs bundled in a zip archive.',
      accept: '.csv,.xlsx',
      outputExt: '.zip',
      outputMime: 'application/zip',
      actionLabel: 'Run Batch Generation'
    },
    {
      id: 'repair-pdf',
      name: 'Repair Corrupted PDF',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/repair-pdf',
      badge: 'REPAIR',
      tier: 'free',
      icon: ICONS.repair,
      desc: 'Repair corrupted cross-reference tables and recover salvageable PDF pages and contents.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Repair & Rebuild PDF'
    },
    {
      id: 'flatten-pdf',
      name: 'Flatten PDF',
      category: 'business',
      categoryName: 'Business Tools',
      route: '/flatten-pdf',
      badge: 'FLATTEN',
      tier: 'free',
      icon: ICONS.flatten,
      desc: 'Flatten all interactive form fields, signatures, and annotations into permanent page graphics.',
      accept: '.pdf',
      outputExt: '.pdf',
      outputMime: 'application/pdf',
      actionLabel: 'Flatten PDF Layers'
    }
  ];

  // Lookup Indexes
  const toolsById = new Map();
  const toolsByRoute = new Map();

  TOOLS.forEach(tool => {
    toolsById.set(tool.id, tool);
    toolsByRoute.set(tool.route, tool);
    if (tool.aliases) {
      tool.aliases.forEach(alias => toolsByRoute.set(alias, tool));
    }
  });

  // State
  let currentActiveTool = null;
  let currentFile = null;
  let currentFileBytes = null;
  let secondaryFile = null;
  let secondaryFileBytes = null;
  let multiFiles = [];
  let executionResult = null;

  // Helpers
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function downloadBlob(bytes, filename, mimeType = 'application/pdf') {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Find Tool by ID or Slug
   */
  function getToolById(id) {
    if (!id) return null;
    const clean = id.toLowerCase().trim();
    if (toolsById.has(clean)) return toolsById.get(clean);
    // Try matching aliases
    for (const tool of TOOLS) {
      if (tool.id === clean) return tool;
      if (tool.route === '/' + clean) return tool;
      if (tool.aliases && tool.aliases.includes('/' + clean)) return tool;
    }
    return null;
  }

  /**
   * Find Tool by URL Route
   */
  function getToolByRoute(route) {
    if (!route) return null;
    const clean = route.toLowerCase().trim().replace(/\/+$/, '') || '/';
    if (toolsByRoute.has(clean)) return toolsByRoute.get(clean);
    return null;
  }

  /**
   * Main Router Function
   * Navigates to a specific tool page, updates history, updates active screens.
   */
  function navigateToTool(toolId, pushHistory = true) {
    const tool = getToolById(toolId);
    if (!tool) {
      console.warn('Tool not found:', toolId);
      return false;
    }

    // Special screens: Edit PDF, Merge PDF, Photos to PDF use their full custom screens
    if (tool.targetScreen) {
      if (typeof window.navigate === 'function') {
        window.navigate(tool.targetScreen);
      } else if (typeof window.switchCategory === 'function') {
        window.switchCategory(tool.targetScreen);
      }
      if (pushHistory && window.history && window.history.pushState) {
        window.history.pushState({ screen: tool.targetScreen, toolId: tool.id }, '', tool.route);
      }
      document.title = `${tool.name} — PDFme`;
      return true;
    }

    // Standard tools render in #screen-tool
    currentActiveTool = tool;
    currentFile = null;
    currentFileBytes = null;
    secondaryFile = null;
    secondaryFileBytes = null;
    multiFiles = [];
    executionResult = null;

    // Update screen visibility
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(s => s.classList.remove('active'));

    const toolScreen = document.getElementById('screen-tool');
    if (toolScreen) {
      toolScreen.classList.add('active');
    }

    // Update Header
    const header = document.getElementById('header');
    if (header) {
      header.setAttribute('data-show-back', 'true');
    }

    // Update Browser History & Document Title
    document.title = `${tool.name} — PDFme`;
    if (pushHistory && window.history && window.history.pushState) {
      window.history.pushState({ screen: 'tool', toolId: tool.id }, '', tool.route);
    }

    // Render the complete tool interface
    renderToolPage(tool);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  }

  /**
   * Navigate to a general route (/ or /edit-pdf or /convert)
   */
  function navigateToRoute(routePath, pushHistory = true) {
    const path = (routePath || '/').toLowerCase().trim().replace(/\/+$/, '') || '/';

    // 1. Root / Home
    if (path === '/' || path === '/home') {
      if (typeof window.navigate === 'function') {
        window.navigate('home', true);
      } else if (typeof window.switchCategory === 'function') {
        window.switchCategory('home');
      }
      if (pushHistory && window.history && window.history.pushState) {
        window.history.pushState({ screen: 'home' }, '', '/');
      }
      document.title = 'PDFme — Complete In-Browser PDF Toolkit & Productivity Suite';
      return;
    }

    // 2. Check if route matches a tool
    const tool = getToolByRoute(path);
    if (tool) {
      navigateToTool(tool.id, pushHistory);
      return;
    }

    // 3. Category Routes (/convert, /organize, /ai, /security, /business, /workspace, /pricing)
    const catMap = {
      '/convert': 'convert',
      '/organize': 'organize',
      '/organise': 'organize',
      '/ai': 'ai',
      '/security': 'security',
      '/business': 'business',
      '/workspace': 'workspace',
      '/pricing': 'pricing'
    };

    if (catMap[path]) {
      const catId = catMap[path];
      if (typeof window.switchCategory === 'function') {
        window.switchCategory(catId);
      }
      if (pushHistory && window.history && window.history.pushState) {
        window.history.pushState({ screen: catId }, '', path);
      }
      const header = document.getElementById('header');
      if (header) header.setAttribute('data-show-back', 'true');
      return;
    }

    // Default fallback to home
    if (typeof window.switchCategory === 'function') {
      window.switchCategory('home');
    }
  }

  /**
   * Render the Dedicated Full-Screen Tool Interface
   */
  function renderToolPage(tool) {
    const container = document.getElementById('screen-tool');
    if (!container) return;

    const accept = tool.accept || '.pdf';
    const isBusinessGen = !!tool.isGenerator;
    const isDocCompare = tool.id === 'doc-compare';
    const isMultiAi = tool.id === 'ai-multi';
    const isHtmlToPdf = tool.id === 'html-to-pdf';
    const isPro = tool.tier === 'pro';

    container.innerHTML = `
      <div class="tool-page-wrapper" style="max-width:960px;margin:0 auto;padding:24px 16px 80px;">
        <!-- Breadcrumbs -->
        <nav class="tool-breadcrumb-nav" aria-label="Breadcrumb" style="display:flex;align-items:center;gap:8px;font-size:0.875rem;color:var(--text-muted);margin-bottom:20px;flex-wrap:wrap;">
          <a href="/" onclick="window.navigateToRoute('/'); return false;" style="color:var(--text-muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Home</span>
          </a>
          <span>/</span>
          <a href="/${tool.category}" onclick="window.switchCategory('${tool.category}'); return false;" style="color:var(--text-muted);text-decoration:none;">
            ${tool.categoryName}
          </a>
          <span>/</span>
          <span style="color:var(--text);font-weight:700;">${tool.name}</span>
        </nav>

        <!-- Tool Header -->
        <div class="tool-header-card" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:18px;padding:28px 24px;margin-bottom:24px;position:relative;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:16px;">
              <div class="tool-header-icon-box" style="width:52px;height:52px;border-radius:14px;background:rgba(255,216,77,0.18);border:1px solid rgba(244,185,66,0.35);color:var(--saas-gold);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                ${tool.icon}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span class="saas-tool-badge" style="font-size:0.7rem;">${tool.badge}</span>
                  <span class="tool-access-pill ${tool.tier}">${tool.tier.toUpperCase()}</span>
                </div>
                <h1 id="tool-screen-title" style="font-size:clamp(1.5rem, 3.5vw, 2.2rem);font-weight:800;letter-spacing:-0.02em;margin:0;line-height:1.2;">
                  ${tool.name}
                </h1>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="window.history.back()" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:8px;">
              <span>← Back</span>
            </button>
          </div>
          <p style="font-size:1rem;color:var(--text-muted);margin:14px 0 0;line-height:1.6;max-width:760px;">
            ${tool.desc}
          </p>
        </div>

        <!-- Tool Main Body Panel -->
        <div class="tool-main-panel" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:18px;padding:32px 28px;box-shadow:0 10px 30px rgba(0,0,0,0.04);">
          ${isBusinessGen ? `
            <!-- Business Generator Form Container -->
            <div id="tool-generator-container"></div>
          ` : isHtmlToPdf ? `
            <!-- HTML to PDF Container -->
            <div id="tool-html-container"></div>
          ` : `
            <!-- Standard File Upload Dropzone -->
            <div id="tool-screen-dropzone" class="tool-dropzone" onclick="document.getElementById('tool-screen-file-input').click()" style="padding:48px 24px;border:2px dashed var(--border);border-radius:14px;text-align:center;cursor:pointer;background:var(--bg);transition:border-color 0.2s, background 0.2s;">
              <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,216,77,0.18);color:var(--saas-gold);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <h3 style="font-size:1.15rem;font-weight:700;margin:0 0 6px;">Select document or drag &amp; drop here</h3>
              <p style="font-size:0.85rem;color:var(--text-muted);margin:0;">
                Supports <strong>${accept}</strong> files (Up to 50 MB) · 100% Client-Side Privacy Guaranteed
              </p>
              <input type="file" id="tool-screen-file-input" accept="${accept}" ${isMultiAi ? 'multiple' : ''} style="display:none;" onchange="window.handleToolScreenFileSelected(event)">
            </div>

            ${isDocCompare ? `
              <div style="margin-top:20px;">
                <label style="font-size:0.9rem;font-weight:700;display:block;margin-bottom:8px;">Second Document (for Comparison):</label>
                <div id="tool-screen-dropzone-2" class="tool-dropzone" onclick="document.getElementById('tool-screen-file-input-2').click()" style="padding:24px;border:2px dashed var(--border);border-radius:12px;text-align:center;cursor:pointer;background:var(--bg);">
                  <p style="font-weight:600;font-size:0.95rem;margin:0;">Choose second PDF file</p>
                  <input type="file" id="tool-screen-file-input-2" accept=".pdf" style="display:none;" onchange="window.handleSecondaryScreenFileSelected(event)">
                </div>
                <div id="tool-screen-file-badge-2" style="display:none;margin-top:10px;"></div>
              </div>
            ` : ''}

            <!-- File Selected Status Badge -->
            <div id="tool-screen-file-badge" style="display:none;margin-top:20px;"></div>

            <!-- Dynamic Tool Options Configuration Area -->
            <div id="tool-screen-options-area" style="margin-top:24px;"></div>
          `}

          <!-- Progress / Status Indicator -->
          <div id="tool-screen-status-area" style="margin-top:20px;"></div>

          <!-- Result Preview & Download Area -->
          <div id="tool-screen-result-area" style="margin-top:24px;display:none;"></div>

          <!-- Action Controls Bar -->
          <div class="tool-screen-actions" style="margin-top:32px;padding-top:20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <button class="btn btn-ghost" onclick="window.history.back()" style="padding:10px 20px;">
              Cancel
            </button>
            <div style="display:flex;gap:10px;align-items:center;">
              <button class="btn btn-primary" id="tool-screen-execute-btn" onclick="window.executeCurrentToolScreen()" disabled style="padding:12px 32px;font-weight:700;font-size:1rem;border-radius:10px;">
                ${tool.actionLabel || 'Process Document'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize specialized sub-UIs
    if (isBusinessGen) {
      renderBusinessGenInScreen(tool.id);
    } else if (isHtmlToPdf) {
      renderHtmlToPdfInScreen();
    } else {
      setupToolScreenDragAndDrop();
    }
  }

  function setupToolScreenDragAndDrop() {
    const dz = document.getElementById('tool-screen-dropzone');
    if (!dz) return;

    ['dragenter', 'dragover'].forEach(name => {
      dz.addEventListener(name, e => {
        e.preventDefault();
        dz.style.borderColor = 'var(--saas-accent)';
        dz.style.background = 'rgba(255,216,77,0.06)';
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dz.addEventListener(name, e => {
        e.preventDefault();
        dz.style.borderColor = 'var(--border)';
        dz.style.background = 'var(--bg)';
      });
    });

    dz.addEventListener('drop', e => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processSelectedFile(files[0]);
      }
    });
  }

  /**
   * File Selection Handlers for Tool Page
   */
  global.handleToolScreenFileSelected = function(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (currentActiveTool && currentActiveTool.isMultiFile) {
      multiFiles = Array.from(files);
      processMultipleFiles(multiFiles);
    } else {
      processSelectedFile(files[0]);
    }
  };

  global.handleSecondaryScreenFileSelected = function(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    secondaryFile = files[0];
    readFileAsArrayBuffer(secondaryFile).then(bytes => {
      secondaryFileBytes = bytes;
      const b2 = document.getElementById('tool-screen-file-badge-2');
      if (b2) {
        b2.style.display = 'block';
        b2.innerHTML = `
          <div style="padding:10px 16px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:0.9rem;display:flex;align-items:center;justify-content:space-between;">
            <span>📄 <strong>${secondaryFile.name}</strong> (${formatBytes(secondaryFile.size)})</span>
            <span style="color:var(--saas-accent);font-weight:700;">✓ Ready</span>
          </div>
        `;
      }
      updateExecuteButtonState();
    });
  };

  async function processSelectedFile(file) {
    currentFile = file;
    const badge = document.getElementById('tool-screen-file-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `
        <div style="padding:12px 18px;background:rgba(244,185,66,0.1);border:1px solid rgba(244,185,66,0.3);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,216,77,0.25);display:flex;align-items:center;justify-content:center;color:var(--saas-gold);">
              📄
            </div>
            <div>
              <p style="font-weight:700;font-size:0.95rem;margin:0 0 2px;">${file.name}</p>
              <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">${formatBytes(file.size)}</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('tool-screen-file-input').click()" style="font-size:0.8rem;border:1px solid var(--border);">
            Change File
          </button>
        </div>
      `;
    }

    try {
      currentFileBytes = await readFileAsArrayBuffer(file);
      renderToolOptions();
      updateExecuteButtonState();
    } catch (err) {
      console.error('Error reading file bytes:', err);
      showToolError('Failed to read document. Please check the file and try again.');
    }
  }

  function processMultipleFiles(files) {
    const badge = document.getElementById('tool-screen-file-badge');
    if (badge) {
      badge.style.display = 'block';
      badge.innerHTML = `
        <div style="padding:12px 18px;background:rgba(244,185,66,0.1);border:1px solid rgba(244,185,66,0.3);border-radius:12px;">
          <p style="font-weight:700;margin:0 0 4px;">${files.length} Documents Selected</p>
          <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:var(--text-muted);">
            ${files.map(f => `<li>${f.name} (${formatBytes(f.size)})</li>`).join('')}
          </ul>
        </div>
      `;
    }
    updateExecuteButtonState();
  }

  function renderToolOptions() {
    const optArea = document.getElementById('tool-screen-options-area');
    if (!optArea || !currentActiveTool) return;

    switch (currentActiveTool.id) {
      case 'split-pdf':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Split Mode</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer;">
                <input type="radio" name="split-mode" value="all" checked onchange="document.getElementById('split-range-input-wrap').style.display='none'">
                <span>Extract every page into individual single-page PDFs (ZIP bundle)</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer;">
                <input type="radio" name="split-mode" value="range" onchange="document.getElementById('split-range-input-wrap').style.display='block'">
                <span>Extract custom page range</span>
              </label>
            </div>
            <div id="split-range-input-wrap" style="display:none;margin-top:12px;">
              <input type="text" id="split-range-val" class="auth-input" placeholder="e.g. 1-3, 5, 8" style="width:100%;max-width:320px;height:40px;box-sizing:border-box;">
              <p style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 0;">Enter single pages or ranges separated by commas.</p>
            </div>
          </div>
        `;
        break;

      case 'rotate-pdf':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Rotation Angle</label>
            <select id="rotate-angle-val" class="auth-input" style="width:100%;max-width:280px;height:42px;box-sizing:border-box;">
              <option value="90">90° Clockwise</option>
              <option value="180">180° Flip</option>
              <option value="270">270° (90° Counter-Clockwise)</option>
            </select>
          </div>
        `;
        break;

      case 'delete-pages':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Pages to Delete</label>
            <input type="text" id="delete-pages-val" class="auth-input" placeholder="e.g. 2, 4-6" style="width:100%;max-width:320px;height:40px;box-sizing:border-box;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:4px 0 0;">Specify page numbers or comma-separated ranges to remove permanently.</p>
          </div>
        `;
        break;

      case 'extract-pages':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Pages to Extract</label>
            <input type="text" id="extract-pages-val" class="auth-input" placeholder="e.g. 1-2, 5" style="width:100%;max-width:320px;height:40px;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'protect-pdf':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:6px;">Set PDF Password</label>
            <input type="password" id="protect-pw-val" class="auth-input" placeholder="Enter secure password" style="width:100%;max-width:320px;height:42px;box-sizing:border-box;margin-bottom:10px;">
            <input type="password" id="protect-pw-confirm" class="auth-input" placeholder="Confirm password" style="width:100%;max-width:320px;height:42px;box-sizing:border-box;">
            <p style="font-size:0.75rem;color:var(--text-muted);margin:6px 0 0;">Uses ISO 32000-1 RC4/AES standard genuine PDF encryption.</p>
          </div>
        `;
        break;

      case 'unlock-pdf':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:6px;">Document Password</label>
            <input type="password" id="unlock-pw-val" class="auth-input" placeholder="Enter password to remove protection" style="width:100%;max-width:320px;height:42px;box-sizing:border-box;">
          </div>
        `;
        break;

      case 'watermark-pdf':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:6px;">Watermark Text</label>
            <input type="text" id="watermark-text-val" class="auth-input" placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE" value="CONFIDENTIAL" style="width:100%;max-width:320px;height:42px;box-sizing:border-box;margin-bottom:12px;">
            <label style="font-size:0.85rem;color:var(--text-muted);display:block;margin-bottom:4px;">Opacity: <span id="watermark-opacity-label">35%</span></label>
            <input type="range" id="watermark-opacity-val" min="10" max="90" value="35" oninput="document.getElementById('watermark-opacity-label').textContent=this.value+'%'" style="width:100%;max-width:320px;">
          </div>
        `;
        break;

      case 'page-numbers':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Number Position</label>
            <select id="numbers-position-val" class="auth-input" style="width:100%;max-width:280px;height:42px;box-sizing:border-box;">
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
            </select>
          </div>
        `;
        break;

      case 'ai-chat':
      case 'ai-qa':
        optArea.innerHTML = `
          <div style="padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
            <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Ask a Question about this PDF</label>
            <input type="text" id="ai-query-val" class="auth-input" placeholder="e.g. What is the total invoice amount? What is the termination period?" style="width:100%;height:44px;box-sizing:border-box;">
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('ai-query-val').value='Summarize the key points and risks'" style="font-size:0.75rem;padding:4px 8px;">Key points</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('ai-query-val').value='List all important dates and deadlines'" style="font-size:0.75rem;padding:4px 8px;">Deadlines</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('ai-query-val').value='What are the financial terms and total figures?'" style="font-size:0.75rem;padding:4px 8px;">Financials</button>
            </div>
          </div>
        `;
        break;

      default:
        optArea.innerHTML = '';
        break;
    }
  }

  function updateExecuteButtonState() {
    const btn = document.getElementById('tool-screen-execute-btn');
    if (!btn || !currentActiveTool) return;

    if (currentActiveTool.isGenerator || currentActiveTool.id === 'html-to-pdf') {
      btn.disabled = false;
      return;
    }

    if (currentActiveTool.id === 'doc-compare') {
      btn.disabled = !currentFileBytes || !secondaryFileBytes;
      return;
    }

    if (currentActiveTool.isMultiFile) {
      btn.disabled = !multiFiles || multiFiles.length === 0;
      return;
    }

    btn.disabled = !currentFileBytes;
  }

  /**
   * Execution Controller for Tool Page
   */
  global.executeCurrentToolScreen = async function() {
    const tool = currentActiveTool;
    if (!tool) return;

    const btn = document.getElementById('tool-screen-execute-btn');
    const statusArea = document.getElementById('tool-screen-status-area');
    const resultArea = document.getElementById('tool-screen-result-area');

    if (btn) btn.disabled = true;
    if (resultArea) resultArea.style.display = 'none';

    // Show Progress Indicator
    if (statusArea) {
      statusArea.innerHTML = `
        <div style="padding:18px 24px;background:rgba(255,216,77,0.12);border:1px solid rgba(244,185,66,0.35);border-radius:12px;display:flex;align-items:center;gap:14px;">
          <div class="tool-spinner" style="width:24px;height:24px;border:3px solid rgba(244,185,66,0.3);border-top-color:var(--saas-accent);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <div>
            <p style="font-weight:700;font-size:0.95rem;margin:0 0 2px;">Processing document...</p>
            <p id="tool-progress-text" style="font-size:0.8rem;color:var(--text-muted);margin:0;">Applying genuine client-side conversion engine...</p>
          </div>
        </div>
      `;
    }

    try {
      let outBytes = null;
      let outFilename = `${(currentFile?.name || 'document').replace(/\.[^/.]+$/, '')}-processed${tool.outputExt || '.pdf'}`;
      let textResult = null;

      // ── Dispatch by Tool ID ──
      switch (tool.id) {
        // Convert Tools
        case 'pdf-to-word':
          if (typeof window.pdfToWord === 'function') {
            outBytes = await window.pdfToWord(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}.docx`;
          } else {
            throw new Error('PDF to Word engine is loading. Please try again.');
          }
          break;

        case 'pdf-to-excel':
          if (typeof window.pdfToExcel === 'function') {
            outBytes = await window.pdfToExcel(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}.xlsx`;
          } else {
            throw new Error('PDF to Excel engine is loading. Please try again.');
          }
          break;

        case 'pdf-to-ppt':
          if (typeof window.pdfToPowerPoint === 'function') {
            outBytes = await window.pdfToPowerPoint(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}.pptx`;
          } else {
            throw new Error('PDF to PowerPoint engine is loading.');
          }
          break;

        case 'pdf-to-jpg':
          if (typeof window.pdfToJpg === 'function') {
            outBytes = await window.pdfToJpg(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}.jpg`;
          } else {
            throw new Error('PDF to JPG engine is loading.');
          }
          break;

        case 'pdf-to-png':
          if (typeof window.pdfToPng === 'function') {
            outBytes = await window.pdfToPng(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}.png`;
          } else {
            throw new Error('PDF to PNG engine is loading.');
          }
          break;

        case 'word-to-pdf':
          if (typeof window.wordToPdf === 'function') {
            outBytes = await window.wordToPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.docx$/i, '')}.pdf`;
          } else {
            throw new Error('Word to PDF engine is loading.');
          }
          break;

        case 'excel-to-pdf':
          if (typeof window.excelToPdf === 'function') {
            outBytes = await window.excelToPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.xlsx$/i, '')}.pdf`;
          } else {
            throw new Error('Excel to PDF engine is loading.');
          }
          break;

        case 'pptx-to-pdf':
          if (typeof window.powerPointToPdf === 'function') {
            outBytes = await window.powerPointToPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pptx$/i, '')}.pdf`;
          } else {
            throw new Error('PowerPoint to PDF engine is loading.');
          }
          break;

        case 'jpg-to-pdf':
        case 'png-to-pdf':
          if (typeof window.imagesToPdf === 'function') {
            outBytes = await window.imagesToPdf([{ name: currentFile.name, bytes: currentFileBytes }]);
            outFilename = `${currentFile.name.replace(/\.[^/.]+$/, '')}.pdf`;
          } else {
            throw new Error('Image to PDF engine is loading.');
          }
          break;

        // Organise Tools
        case 'split-pdf': {
          const mode = document.querySelector('input[name="split-mode"]:checked')?.value || 'all';
          const rangeVal = document.getElementById('split-range-val')?.value;
          if (typeof window.splitPdf === 'function') {
            const splitRes = await window.splitPdf(currentFileBytes, { mode, ranges: rangeVal ? [rangeVal] : undefined });
            outBytes = splitRes.zip || splitRes.bytes;
            outFilename = splitRes.filename || `${currentFile.name.replace(/\.pdf$/i, '')}-split.zip`;
          } else {
            throw new Error('Split engine is loading.');
          }
          break;
        }

        case 'rotate-pdf': {
          const angle = parseInt(document.getElementById('rotate-angle-val')?.value || '90', 10);
          if (typeof window.rotatePdf === 'function') {
            outBytes = await window.rotatePdf(currentFileBytes, angle);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-rotated.pdf`;
          } else {
            throw new Error('Rotate engine is loading.');
          }
          break;
        }

        case 'delete-pages': {
          const delVal = document.getElementById('delete-pages-val')?.value;
          if (!delVal) throw new Error('Please enter page numbers to delete.');
          if (typeof window.deletePdfPages === 'function') {
            outBytes = await window.deletePdfPages(currentFileBytes, delVal);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-deleted.pdf`;
          } else {
            throw new Error('Delete pages engine is loading.');
          }
          break;
        }

        case 'extract-pages': {
          const extVal = document.getElementById('extract-pages-val')?.value;
          if (!extVal) throw new Error('Please enter page numbers to extract.');
          if (typeof window.extractPdfPages === 'function') {
            outBytes = await window.extractPdfPages(currentFileBytes, extVal);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-extracted.pdf`;
          } else {
            throw new Error('Extract pages engine is loading.');
          }
          break;
        }

        case 'compress-pdf':
          if (typeof window.compressPdf === 'function') {
            outBytes = await window.compressPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-compressed.pdf`;
          } else {
            throw new Error('Compress engine is loading.');
          }
          break;

        case 'page-numbers': {
          const pos = document.getElementById('numbers-position-val')?.value || 'bottom-center';
          if (typeof window.addPageNumbers === 'function') {
            outBytes = await window.addPageNumbers(currentFileBytes, { position: pos });
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-numbered.pdf`;
          } else {
            throw new Error('Page numbers engine is loading.');
          }
          break;
        }

        case 'protect-pdf': {
          const pw1 = document.getElementById('protect-pw-val')?.value;
          const pw2 = document.getElementById('protect-pw-confirm')?.value;
          if (!pw1) throw new Error('Please enter a password.');
          if (pw1 !== pw2) throw new Error('Passwords do not match.');
          if (typeof window.passwordProtectPdf === 'function') {
            outBytes = await window.passwordProtectPdf(currentFileBytes, pw1);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-protected.pdf`;
          } else {
            throw new Error('PDF security engine is loading.');
          }
          break;
        }

        case 'unlock-pdf': {
          const pw = document.getElementById('unlock-pw-val')?.value;
          if (!pw) throw new Error('Please enter document password.');
          if (typeof window.removePasswordPdf === 'function') {
            outBytes = await window.removePasswordPdf(currentFileBytes, pw);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-unlocked.pdf`;
          } else {
            throw new Error('PDF security engine is loading.');
          }
          break;
        }

        case 'watermark-pdf': {
          const text = document.getElementById('watermark-text-val')?.value || 'CONFIDENTIAL';
          const opacity = parseInt(document.getElementById('watermark-opacity-val')?.value || '35', 10) / 100;
          if (typeof window.addWatermarkPdf === 'function') {
            outBytes = await window.addWatermarkPdf(currentFileBytes, text, { opacity });
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-watermarked.pdf`;
          } else {
            throw new Error('Watermark engine is loading.');
          }
          break;
        }

        case 'remove-metadata':
          if (typeof window.removeMetadataPdf === 'function') {
            outBytes = await window.removeMetadataPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-sanitized.pdf`;
          } else {
            throw new Error('Metadata engine is loading.');
          }
          break;

        case 'repair-pdf':
          if (typeof window.repairPdf === 'function') {
            outBytes = await window.repairPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-repaired.pdf`;
          } else {
            throw new Error('Repair engine is loading.');
          }
          break;

        case 'flatten-pdf':
          if (typeof window.flattenPdf === 'function') {
            outBytes = await window.flattenPdf(currentFileBytes);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-flattened.pdf`;
          } else {
            throw new Error('Flatten engine is loading.');
          }
          break;

        case 'invoice-extractor':
          if (typeof window.extractInvoiceData === 'function' && typeof window.exportInvoicesToExcel === 'function') {
            const data = await window.extractInvoiceData(currentFileBytes);
            outBytes = await window.exportInvoicesToExcel([data]);
            outFilename = `${currentFile.name.replace(/\.pdf$/i, '')}-invoices.xlsx`;
          } else {
            throw new Error('Invoice extraction engine is loading.');
          }
          break;

        // AI Tools
        case 'ai-chat':
        case 'ai-qa': {
          const q = document.getElementById('ai-query-val')?.value;
          if (!q) throw new Error('Please enter a question to ask.');
          if (typeof window.askDocumentQuestion === 'function') {
            const ans = await window.askDocumentQuestion(currentFileBytes, q);
            textResult = typeof ans === 'string' ? ans : ans.answer;
          } else {
            throw new Error('AI engine is loading.');
          }
          break;
        }

        case 'ai-summarizer':
        case 'ai-exec-summary':
          if (typeof window.summarizeDocument === 'function') {
            const summary = await window.summarizeDocument(currentFileBytes);
            textResult = typeof summary === 'string' ? summary : summary.summary;
          } else {
            throw new Error('AI summarizer engine is loading.');
          }
          break;

        case 'ai-insights':
          if (typeof window.getDocumentInsights === 'function') {
            const insights = await window.getDocumentInsights(currentFileBytes);
            textResult = JSON.stringify(insights, null, 2);
          } else {
            throw new Error('AI insights engine is loading.');
          }
          break;

        case 'ai-extract':
          if (typeof window.extractEntities === 'function') {
            const entities = await window.extractEntities(currentFileBytes);
            textResult = JSON.stringify(entities, null, 2);
          } else {
            throw new Error('AI extraction engine is loading.');
          }
          break;

        case 'ai-contract':
          if (typeof window.analyzeContract === 'function') {
            const audit = await window.analyzeContract(currentFileBytes);
            textResult = typeof audit === 'string' ? audit : JSON.stringify(audit, null, 2);
          } else {
            throw new Error('Contract analyzer is loading.');
          }
          break;

        case 'doc-compare':
          if (typeof window.compareDocuments === 'function') {
            const diff = await window.compareDocuments(currentFileBytes, secondaryFileBytes);
            textResult = typeof diff === 'string' ? diff : JSON.stringify(diff, null, 2);
          } else {
            throw new Error('Document comparison engine is loading.');
          }
          break;

        default:
          throw new Error('Tool engine is initializing. Please try again.');
      }

      // Hide progress spinner
      if (statusArea) statusArea.innerHTML = '';

      // Display Real Result
      executionResult = { bytes: outBytes, filename: outFilename, mime: tool.outputMime || 'application/pdf', text: textResult };
      renderToolResult(executionResult);

    } catch (err) {
      console.error('Tool execution error:', err);
      if (statusArea) statusArea.innerHTML = '';
      showToolError(err.message || 'An error occurred while processing the document.');
      if (btn) btn.disabled = false;
    }
  };

  function renderToolResult(res) {
    const resArea = document.getElementById('tool-screen-result-area');
    if (!resArea) return;

    resArea.style.display = 'block';

    if (res.bytes) {
      resArea.innerHTML = `
        <div style="padding:24px;background:rgba(34,197,94,0.08);border:1.5px solid rgba(34,197,94,0.3);border-radius:14px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="width:36px;height:36px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">✓</div>
            <div>
              <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 2px;color:var(--text);">Document Processed Successfully!</h3>
              <p style="font-size:0.85rem;color:var(--text-muted);margin:0;">Your file is ready for download (${formatBytes(res.bytes.length)})</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="window.downloadCurrentToolResult()" style="padding:12px 28px;font-size:1rem;font-weight:700;display:inline-flex;align-items:center;gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Download ${res.filename}</span>
            </button>
            <button class="btn btn-ghost" onclick="window.resetCurrentToolScreen()" style="padding:12px 20px;border:1px solid var(--border);">
              Process Another File
            </button>
          </div>
        </div>
      `;
    } else if (res.text) {
      resArea.innerHTML = `
        <div style="padding:24px;background:var(--bg);border:1.5px solid var(--border);border-radius:14px;">
          <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 12px;display:flex;align-items:center;gap:8px;">
            <span>✨</span> Analysis Result
          </h3>
          <div style="background:var(--bg-elevated);padding:16px;border-radius:10px;font-size:0.9rem;line-height:1.6;white-space:pre-wrap;max-height:400px;overflow-y:auto;border:1px solid var(--border);">
            ${res.text}
          </div>
          <div style="margin-top:16px;display:flex;gap:10px;">
            <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(res.text)}')); alert('Copied to clipboard!');" style="border:1px solid var(--border);">
              Copy to Clipboard
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.resetCurrentToolScreen()" style="border:1px solid var(--border);">
              New Query
            </button>
          </div>
        </div>
      `;
    }
  }

  global.downloadCurrentToolResult = function() {
    if (!executionResult || !executionResult.bytes) return;
    downloadBlob(executionResult.bytes, executionResult.filename, executionResult.mime);
  };

  global.resetCurrentToolScreen = function() {
    if (currentActiveTool) {
      renderToolPage(currentActiveTool);
    }
  };

  function showToolError(msg) {
    const statusArea = document.getElementById('tool-screen-status-area');
    if (!statusArea) return;
    statusArea.innerHTML = `
      <div style="padding:14px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;color:var(--danger);font-size:0.9rem;display:flex;align-items:center;gap:10px;">
        <span style="font-weight:700;font-size:1.1rem;">⚠️</span>
        <span>${msg}</span>
      </div>
    `;
  }

  function renderBusinessGenInScreen(toolId) {
    const c = document.getElementById('tool-generator-container');
    if (!c) return;
    c.innerHTML = `
      <div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
        <h3 style="font-size:1.1rem;font-weight:700;margin:0 0 16px;">Document Specifications</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;margin-bottom:16px;">
          <div>
            <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px;">Recipient / Candidate Name</label>
            <input type="text" id="gen-recipient-val" class="auth-input" placeholder="e.g. Rahul Sharma" value="Rahul Sharma" style="width:100%;height:40px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px;">Organization / Company</label>
            <input type="text" id="gen-org-val" class="auth-input" placeholder="e.g. Acme Technologies Pvt Ltd" value="Acme Technologies Pvt Ltd" style="width:100%;height:40px;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;">
          <div>
            <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px;">Designation / Title</label>
            <input type="text" id="gen-title-val" class="auth-input" placeholder="e.g. Senior Software Engineer" value="Senior Software Engineer" style="width:100%;height:40px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:0.85rem;font-weight:700;display:block;margin-bottom:6px;">Total Compensation / Amount (₹)</label>
            <input type="number" id="gen-amount-val" class="auth-input" placeholder="e.g. 1500000" value="1500000" style="width:100%;height:40px;box-sizing:border-box;">
          </div>
        </div>
      </div>
    `;
    updateExecuteButtonState();
  }

  function renderHtmlToPdfInScreen() {
    const c = document.getElementById('tool-html-container');
    if (!c) return;
    c.innerHTML = `
      <div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:12px;">
        <label style="font-weight:700;font-size:0.95rem;display:block;margin-bottom:8px;">Enter HTML Markup</label>
        <textarea id="tool-html-input" class="auth-input" rows="8" placeholder="<h1>Invoice</h1><p>Customer: John Doe</p>" style="width:100%;padding:12px;box-sizing:border-box;font-family:monospace;font-size:0.85rem;"></textarea>
      </div>
    `;
    updateExecuteButtonState();
  }

  /**
   * Global Hook & Backward Compatibility
   * Maps openToolModal to navigateToTool!
   */
  global.openToolModal = function(toolId) {
    return navigateToTool(toolId, true);
  };

  global.navigateToTool = navigateToTool;
  global.navigateToRoute = navigateToRoute;
  global.getToolById = getToolById;
  global.getToolByRoute = getToolByRoute;
  global.PDFME_TOOLS = TOOLS;

  /**
   * Routing Initializer
   * Handles browser popstate and URL on initial page load.
   */
  function setupRouting() {
    // 1. Popstate listener (Back / Forward browser buttons)
    window.addEventListener('popstate', (e) => {
      const state = e.state;
      const path = window.location.pathname;

      if (state && state.toolId) {
        navigateToTool(state.toolId, false);
      } else {
        navigateToRoute(path, false);
      }
    });

    // 2. Initial Page Load Route Detection
    const currentPath = window.location.pathname;
    if (currentPath && currentPath !== '/' && currentPath !== '/index.html') {
      const matchedTool = getToolByRoute(currentPath);
      if (matchedTool) {
        navigateToTool(matchedTool.id, false);
      } else {
        navigateToRoute(currentPath, false);
      }
    }
  }

  // Run routing on DOMContentLoaded or immediately if ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRouting);
  } else {
    setupRouting();
  }

})(typeof window !== 'undefined' ? window : global);
