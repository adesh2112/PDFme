'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const VERIFICATION_FILE = 'google3ffbf14e3937e791.html';
const EXPECTED_CONTENT = 'google-site-verification: google3ffbf14e3937e791.html';

console.log('=== BUILD & VERIFICATION CHECK ===');

// 1. Verify verification file exists in root
const rootFilePath = path.join(ROOT, VERIFICATION_FILE);
if (!fs.existsSync(rootFilePath)) {
  console.error(`ERROR: ${VERIFICATION_FILE} does not exist in root directory.`);
  process.exit(1);
}

const content = fs.readFileSync(rootFilePath, 'utf8').trim();
if (!content.includes(EXPECTED_CONTENT)) {
  console.error(`ERROR: ${VERIFICATION_FILE} does not contain expected verification token.`);
  process.exit(1);
}
console.log(`[PASS] Root verification file verified: ${VERIFICATION_FILE}`);

// 2. Ensure verification file is copied to any potential publish/dist directories if they exist
const potentialPublishDirs = ['dist', 'build', 'public'];
if (process.env.PUBLISH_DIR) {
  potentialPublishDirs.push(process.env.PUBLISH_DIR);
}

for (const dirName of potentialPublishDirs) {
  const targetDir = path.resolve(ROOT, dirName);
  if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
    const destPath = path.join(targetDir, VERIFICATION_FILE);
    fs.copyFileSync(rootFilePath, destPath);
    console.log(`[PASS] Copied ${VERIFICATION_FILE} to publish directory: ${dirName}`);
  }
}

// 3. Confirm essential static assets exist
const requiredFiles = ['index.html', 'server.js', 'app.js', 'styles.css', 'manifest.json'];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    console.error(`ERROR: Missing required file: ${file}`);
    process.exit(1);
  }
}
console.log('[PASS] Essential published assets verified.');
console.log('=== BUILD VERIFICATION SUCCEEDED ===');
