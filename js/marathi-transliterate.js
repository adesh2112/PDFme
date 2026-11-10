'use strict';
/**
 * Marathi Phonetic Transliteration Engine
 * Converts Roman phonetic input to Devanagari (e.g., namaskar -> नमस्कार)
 * Powered by vendored Sanscript (MIT license) with Marathi phonetic rules
 */

const Sanscript = typeof require !== 'undefined' ? require('../lib/sanscript.js') : window.Sanscript;

const MARATHI_DICTIONARY = {
  'namaskar': 'नमस्कार',
  'namaskara': 'नमस्कार',
  'namaste': 'नमस्ते',
  'aadesh': 'आदेश',
  'adesh': 'आदेश',
  'makasare': 'माकासरे',
  'makasre': 'माकासरे',
  'vidyarthi': 'विद्यार्थी',
  'vidyarthyaache': 'विद्यार्थ्याचे',
  'vidyarthyache': 'विद्यार्थ्याचे',
  'vidyarthyanche': 'विद्यार्थ्यांचे',
  'naav': 'नाव',
  'nav': 'नाव',
  'bharat': 'भारत',
  'maharashtra': 'महाराष्ट्र',
  'ksha': 'क्ष',
  'gya': 'ज्ञ',
  'dnya': 'ज्ञ',
  'shra': 'श्र',
  'dya': 'द्य',
  'rya': 'र्य'
};

function transliterateMarathi(word) {
  if (!word) return '';
  const lower = word.toLowerCase();
  if (MARATHI_DICTIONARY[lower]) {
    return MARATHI_DICTIONARY[lower];
  }

  // Handle common Marathi digraphs and conventions
  let processed = word
    .replace(/aa/g, 'A')
    .replace(/ee/g, 'I')
    .replace(/oo/g, 'U')
    .replace(/dny/g, 'j~n')
    .replace(/gy/g, 'j~n')
    .replace(/ksh/g, 'kSh')
    .replace(/sh/g, 'sh');

  let dev = Sanscript.t(processed, 'itrans', 'devanagari');

  // In Marathi typing, trailing virama is dropped on word-final consonants
  // unless explicitly requested
  if (!word.endsWith('q') && !word.endsWith('~')) {
    dev = dev.replace(/\u094D$/g, '');
  }

  return dev;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { transliterateMarathi, MARATHI_DICTIONARY };
}
if (typeof window !== 'undefined') {
  window.MarathiPhonetic = { transliterateMarathi, MARATHI_DICTIONARY };
}

