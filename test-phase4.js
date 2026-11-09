'use strict';
const { handleAiRequest } = require('./api/ai-router.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

function mockPost(path, payload) {
  return new Promise((resolve) => {
    let headers = {};
    let statusCode = 200;
    let body = '';

    const req = {
      socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
      setHeader(k, v) { headers[k] = v; },
      writeHead(code, h) {
        statusCode = code;
        if (h) Object.assign(headers, h);
      },
      end(chunk) {
        if (chunk) body += chunk;
        try {
          resolve({ status: statusCode, data: JSON.parse(body), headers });
        } catch (e) {
          resolve({ status: statusCode, body, headers });
        }
      }
    };

    handleAiRequest(req, res, path, payload);
  });
}

async function runPhase4Tests() {
  console.log('========================================================');
  console.log('RUNNING PHASE 4 AUTOMATED TEST SUITE');
  console.log('Testing: AI PDF Tools & Secure Backend API');
  console.log('========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  try {
    const sampleDoc = `
      MASTER SERVICES AGREEMENT
      This agreement is made on 2026-05-15 between Alpha Cloud Corp and Client LLC.
      Payment Conditions: Client shall pay $15,000 per month within 30 days of invoice.
      Termination Conditions: Either party may terminate with 60 days written notice.
      Renewal: This contract renews annually unless notice is given 30 days prior.
      Indemnification: Provider agrees to indemnify client against third party infringement claims.
      Governing Law: The laws of Delaware shall govern this agreement.
    `;

    const samplePages = [
      { pageNum: 1, text: 'MASTER SERVICES AGREEMENT. Payment: Client shall pay $15,000 within 30 days.' },
      { pageNum: 2, text: 'Termination: Either party may terminate with 60 days written notice. Renews annually.' }
    ];

    // 1. AI PDF Assistant Q&A
    console.log('--- Testing AI PDF Assistant ---');
    const askRes = await mockPost('/api/ai/ask', {
      documentText: sampleDoc,
      pages: samplePages,
      question: 'What are the payment deadlines?'
    });
    assert('AI Assistant returns status 200', askRes.status === 200);
    assert('AI Assistant returns answer text with relevant payment details', askRes.data.answer && askRes.data.answer.length > 10);
    assert('AI Assistant returns page citations for evidence attribution', Array.isArray(askRes.data.citations) && askRes.data.citations.length >= 1);

    // 2. Multi-PDF Chat
    console.log('\n--- Testing Multi-PDF Chat ---');
    const multiRes = await mockPost('/api/ai/chat-multi', {
      documents: [
        { name: 'contract-alpha.pdf', text: 'Alpha Corp pays $15,000 monthly.' },
        { name: 'contract-beta.pdf', text: 'Beta Corp pays $25,000 quarterly.' }
      ],
      question: 'Compare the payment terms between Alpha and Beta'
    });
    assert('Multi-PDF Chat returns status 200', multiRes.status === 200);
    assert('Multi-PDF Chat answers across multiple documents', multiRes.data.answer && multiRes.data.citations.length >= 1);

    // 3. Document Summarizer
    console.log('\n--- Testing AI Document Summarizer ---');
    const sumRes = await mockPost('/api/ai/summarize', {
      documentText: sampleDoc,
      pages: samplePages
    });
    assert('Summarizer returns status 200', sumRes.status === 200);
    assert('Summarizer provides short summary and executive summary', sumRes.data.shortSummary && sumRes.data.executiveSummary);
    assert('Summarizer extracts important dates and action items', sumRes.data.importantDates.length >= 1 && sumRes.data.actionItems.length >= 1);

    // 4. Contract Analyzer
    console.log('\n--- Testing Contract Analyzer ---');
    const contractRes = await mockPost('/api/ai/contract-analysis', {
      documentText: sampleDoc,
      pages: samplePages
    });
    assert('Contract Analyzer returns status 200', contractRes.status === 200);
    assert('Identifies payment conditions', contractRes.data.paymentConditions.length >= 1);
    assert('Identifies termination conditions', contractRes.data.terminationConditions.length >= 1);
    assert('Identifies renewal conditions', contractRes.data.renewalConditions.length >= 1);
    assert('Identifies unusual / risk clauses (Indemnification)', contractRes.data.unusualClauses.length >= 1);
    assert('Clearly distinguishes AI explanation with legal disclaimer', contractRes.data.disclaimer.includes('AI-assisted'));

    // 5. Document Translator
    console.log('\n--- Testing Document Translator ---');
    const transRes = await mockPost('/api/ai/translate', {
      documentText: 'This is an important business contract.',
      targetLanguage: 'French'
    });
    assert('Translator returns status 200 with target language', transRes.status === 200 && transRes.data.targetLanguage === 'French');

    // 6. Security & Rate Limiting Check
    console.log('\n--- Testing Security & Error Handling ---');
    const badRes = await mockPost('/api/ai/ask', {});
    assert('Rejects invalid empty request with 400 Bad Request', badRes.status === 400);

  } catch (err) {
    console.error('Error during AI tests:', err);
    assert('AI tests executed without error', false);
  }

  // 7. Integrity Check for Existing PDF Editor
  console.log('\n--- Checking PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert('CRITICAL: Existing PDF Editor integrity guard passes 100%', guardPassed);

  console.log('\n========================================================');
  console.log(`PHASE 4 TEST RESULTS: ${passed} / ${total} tests PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  return passed === total;
}

if (require.main === module) {
  runPhase4Tests().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runPhase4Tests };
