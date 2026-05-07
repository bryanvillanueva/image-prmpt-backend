'use strict';

const crypto = require('crypto');

const DIACRITICS_REGEX = /[̀-ͯ]/g;
const NON_ALPHANUM_REGEX = /[^a-z0-9\s]/g;

function normalizeText(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .toLowerCase()
    .replace(NON_ALPHANUM_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashText(input) {
  return crypto.createHash('sha256').update(input || '').digest('hex');
}

module.exports = { normalizeText, hashText };
