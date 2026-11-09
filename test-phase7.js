'use strict';
const { handleWorkspaceRequest, db } = require('./api/workspace-router.js');
const { verifyEditorGuard } = require('./verify-editor-guard.js');

function mockWorkspaceCall(method, path, body, token) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let headers = {};
    let responseBody = '';

    const req = {
      method,
      headers: {
        'authorization': token ? `Bearer ${token}` : '',
        'content-type': 'application/json'
      },
      socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
      setHeader(k, v) { headers[k] = v; },
      writeHead(code, h) {
        statusCode = code;
        if (h) Object.assign(headers, h);
      },
      end(chunk) {
        if (chunk) responseBody += chunk;
        try {
          resolve({ status: statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: statusCode, body: responseBody });
        }
      }
    };

    handleWorkspaceRequest(req, res, path, body);
  });
}

async function runPhase7Tests() {
  console.log('========================================================');
  console.log('RUNNING PHASE 7 AUTOMATED TEST SUITE');
  console.log('Testing: Corporate Workspace & Multi-Tenant Security');
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
    // 1. User Registration & Org Creation (Org 1)
    console.log('--- Testing User Registration & Organization 1 ---');
    const userAEmail = `alice_${Date.now()}@acme.com`;
    const regResA = await mockWorkspaceCall('POST', '/api/auth/register', {
      email: userAEmail,
      password: 'StrongPassword123!',
      name: 'Alice Admin',
      orgName: 'Acme Global Corp'
    });
    assert('User A registers successfully and receives JWT token', regResA.status === 201 && regResA.data.token);
    assert('User A is assigned ADMIN role in their organization', regResA.data.user.role === 'ADMIN');
    const tokenA = regResA.data.token;
    const orgIdA = regResA.data.organization.id;

    // 2. User Login
    console.log('\n--- Testing Authentication & Login ---');
    const loginRes = await mockWorkspaceCall('POST', '/api/auth/login', {
      email: userAEmail,
      password: 'StrongPassword123!'
    });
    assert('User logs in with password verification', loginRes.status === 200 && loginRes.data.token);

    const badLogin = await mockWorkspaceCall('POST', '/api/auth/login', {
      email: userAEmail,
      password: 'WrongPassword!'
    });
    assert('Rejects invalid password with 401 Unauthorized', badLogin.status === 401);

    // 3. Team Invitation
    console.log('\n--- Testing Team Invitation ---');
    const editorEmail = `bob_${Date.now()}@acme.com`;
    const inviteRes = await mockWorkspaceCall('POST', '/api/org/invite', {
      email: editorEmail,
      name: 'Bob Editor',
      role: 'EDITOR'
    }, tokenA);
    assert('Admin can invite team member with role EDITOR', inviteRes.status === 201 && inviteRes.data.member.role === 'EDITOR');

    // 4. Document Creation in Org 1
    console.log('\n--- Testing Workspace Document Creation ---');
    const docRes = await mockWorkspaceCall('POST', '/api/workspace/documents', {
      title: 'Q1 Financial Summary.pdf',
      size: 45020,
      hash: 'sha256-doc-1'
    }, tokenA);
    assert('Creates document record in organization workspace', docRes.status === 201 && docRes.data.document.id);
    const docIdA = docRes.data.document.id;

    // 5. Document Approval Workflow
    console.log('\n--- Testing Document Approval Workflow ---');
    const reqAppRes = await mockWorkspaceCall('POST', '/api/workspace/approvals/request', {
      docId: docIdA,
      notes: 'Please review and sign off on Q1 numbers.'
    }, tokenA);
    assert('Initiates approval workflow with PENDING status', reqAppRes.status === 200 && reqAppRes.data.approval.status === 'PENDING');
    const approvalId = reqAppRes.data.approval.id;

    const decideAppRes = await mockWorkspaceCall('POST', '/api/workspace/approvals/decide', {
      approvalId,
      decision: 'APPROVED',
      comments: 'Numbers verified against balance sheet.'
    }, tokenA);
    assert('Records document approval decision and comments', decideAppRes.status === 200 && decideAppRes.data.approval.status === 'APPROVED');

    // 6. Version History
    console.log('\n--- Testing Version History ---');
    const versRes = await mockWorkspaceCall('POST', '/api/workspace/versions', { docId: docIdA }, tokenA);
    assert('Tracks document version history (v1 recorded)', versRes.status === 200 && versRes.data.versions.length >= 1);

    // 7. Activity Logs
    console.log('\n--- Testing Activity Audit Trail ---');
    const actRes = await mockWorkspaceCall('GET', '/api/workspace/activity', {}, tokenA);
    assert('Records comprehensive chronological activity logs for the org', actRes.status === 200 && actRes.data.activityLogs.length >= 3);

    // 8. STRICT MULTI-TENANT ISOLATION TEST (Org 2 vs Org 1)
    console.log('\n--- Testing Multi-Tenant Organization Isolation ---');
    const userBEmail = `charlie_${Date.now()}@beta.com`;
    const regResB = await mockWorkspaceCall('POST', '/api/auth/register', {
      email: userBEmail,
      password: 'Password456!',
      name: 'Charlie Competitor',
      orgName: 'Beta Rival LLC'
    });
    const tokenB = regResB.data.token;

    // User B attempts to access Org A's document
    const crossAccessRes = await mockWorkspaceCall('POST', '/api/workspace/document-access', {
      docId: docIdA
    }, tokenB);

    assert('CRITICAL SECURITY: Cross-tenant document access is BLOCKED with 403 Forbidden', crossAccessRes.status === 403);

  } catch (err) {
    console.error('Error during Workspace tests:', err);
    assert('Workspace tests executed without error', false);
  }

  // 9. Integrity Check for Existing PDF Editor
  console.log('\n--- Checking PDF Editor Integrity Guard ---');
  const guardPassed = verifyEditorGuard();
  assert('CRITICAL: Existing PDF Editor integrity guard passes 100%', guardPassed);

  console.log('\n========================================================');
  console.log(`PHASE 7 TEST RESULTS: ${passed} / ${total} tests PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================');

  return passed === total;
}

if (require.main === module) {
  runPhase7Tests().then(ok => {
    process.exit(ok ? 0 : 1);
  });
}

module.exports = { runPhase7Tests };

