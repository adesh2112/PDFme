'use strict';
/**
 * AI PDF Tools Frontend Engine
 * Handles: AI Assistant Q&A, Multi-PDF Chat, Summarizer, Contract Analyzer, Translator.
 */

async function callAiApi(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI Request failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * 1. AI PDF Assistant: Ask a question about an uploaded document
 */
async function askDocumentQuestion(documentText, pages, question) {
  return await callAiApi('/api/ai/ask', { documentText, pages, question });
}

/**
 * 2. Chat with Multiple PDFs
 */
async function chatMultipleDocuments(documents, question) {
  return await callAiApi('/api/ai/chat-multi', { documents, question });
}

/**
 * 3. AI Document Summarizer
 */
async function summarizeDocument(documentText, pages) {
  return await callAiApi('/api/ai/summarize', { documentText, pages });
}

/**
 * 4. Contract Analyzer
 */
async function analyzeContract(documentText, pages) {
  return await callAiApi('/api/ai/contract-analysis', { documentText, pages });
}

/**
 * 5. Document Translator
 */
async function translateDocument(documentText, targetLanguage) {
  return await callAiApi('/api/ai/translate', { documentText, targetLanguage });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    callAiApi,
    askDocumentQuestion,
    chatMultipleDocuments,
    summarizeDocument,
    analyzeContract,
    translateDocument
  };
}
if (typeof window !== 'undefined') {
  window.AiPdfTools = {
    callAiApi,
    askDocumentQuestion,
    chatMultipleDocuments,
    summarizeDocument,
    analyzeContract,
    translateDocument
  };
}

