const mongoose = require('mongoose');
const AppError = require('./AppError');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

/** Throws a 400 if the value is not a valid ObjectId string. */
function ensureId(value, label = 'ID') {
  if (!isId(String(value || ''))) throw new AppError(`Invalid ${label}`, 400);
  return String(value);
}

/** Trim a string input; returns '' for null/undefined. */
const cleanStr = (v) => (v === undefined || v === null ? '' : String(v).trim());

/** Empty string / null / undefined -> undefined (so optional ObjectId fields are skipped). */
const optId = (v, label) => (v === undefined || v === null || v === '' ? undefined : ensureId(v, label));

const optUrl = (v, label = 'URL') => {
  const s = cleanStr(v);
  if (!s) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(s)) throw new AppError(`${label} must start with http:// or https://`, 400);
  return s;
};

const toInt = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

module.exports = { asyncHandler, escapeRegex, isId, ensureId, cleanStr, optId, optUrl, toInt };
