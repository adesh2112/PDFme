'use strict';
/**
 * AI PDF Tools Frontend Engine
 * Handles: AI Assistant Q&A, Multi-PDF Chat, Summarizer, Contract Analyzer, Translator.
 */

async function callAiApi(endpoint, payload) {
  if (typeof window === 'undefined') {
    // Node test harness execution
    try {
      const { semanticAnalyze } = require('../api/ai-router.js');
      if (endpoint === '/api/ai/ask' || endpoint === '/api/ai/chat' || endpoint === '/api/ai/qa') {
        return semanticAnalyze(payload.documentText || '', payload.pages || [], 'ask', payload.question || '');
      }
      if (endpoint === '/api/ai/summarize') {
        return semanticAnalyze(payload.documentText || '', payload.pages || [], 'summarize');
      }
      if (endpoint === '/api/ai/contract-analysis') {
        return semanticAnalyze(payload.documentText || '', payload.pages || [], 'contract');
      }
      if (endpoint === '/api/ai/extract') {
        return semanticAnalyze(payload.documentText || '', payload.pages || [], 'extract');
      }
      if (endpoint === '/api/ai/insights') {
        return semanticAnalyze(payload.documentText || '', payload.pages || [], 'insights');
      }
    } catch (e) {}
  }

  const fetcher = (typeof window !== 'undefined' && window.apiFetch) ? window.apiFetch : fetch;
  const response = await fetcher(endpoint, {
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

/**
 * 6. Information Extraction
 */
async function extractEntities(documentText, pages) {
  return await callAiApi('/api/ai/extract', { documentText, pages });
}

/**
 * 7. Document Insights
 */
async function getDocumentInsights(documentText, pages) {
  return await callAiApi('/api/ai/insights', { documentText, pages });
}

/**
 * 8. Get AI Config / Env status
 */
async function getAiConfig() {
  const fetcher = (typeof window !== 'undefined' && window.apiFetch) ? window.apiFetch : fetch;
  const res = await fetcher('/api/ai/config');
  return await res.json();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    callAiApi,
    askDocumentQuestion,
    chatMultipleDocuments,
    summarizeDocument,
    analyzeContract,
    translateDocument,
    extractEntities,
    getDocumentInsights,
    getAiConfig
  };
}
if (typeof window !== 'undefined') {
  window.AiPdfTools = {
    callAiApi,
    askDocumentQuestion,
    chatMultipleDocuments,
    summarizeDocument,
    analyzeContract,
    translateDocument,
    extractEntities,
    getDocumentInsights,
    getAiConfig
  };
}

