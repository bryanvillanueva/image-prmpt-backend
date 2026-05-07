'use strict';

const slugifyLib = require('slugify');

function slugify(value, maxLength = 80) {
  if (!value) return '';
  const slug = slugifyLib(String(value), {
    lower: true,
    strict: true,
    trim: true,
    locale: 'es',
  });
  return slug.length > maxLength ? slug.slice(0, maxLength) : slug;
}

module.exports = slugify;
