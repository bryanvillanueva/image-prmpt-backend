'use strict';

const { query, getConnection } = require('../config/database');
const { normalizeText, hashText } = require('../utils/textNormalize');
const {
  MODERATION_ACTIONS,
  MODERATION_SEVERITY,
} = require('../config/constants');

const SEVERITY_SCORE = {
  [MODERATION_SEVERITY.LOW]: 10,
  [MODERATION_SEVERITY.MEDIUM]: 30,
  [MODERATION_SEVERITY.HIGH]: 60,
  [MODERATION_SEVERITY.CRITICAL]: 100,
};

async function loadActiveRules() {
  return query(
    `SELECT id, term, normalized_term, language, category, severity, match_type, action
       FROM moderation_words
      WHERE is_active = 1`
  );
}

function ruleMatches(rule, normalizedText) {
  const needle = (rule.normalized_term && rule.normalized_term.trim().length > 0
    ? rule.normalized_term
    : normalizeText(rule.term)
  ).trim();
  if (!needle) return false;

  switch (rule.match_type) {
    case 'exact': {
      const tokens = normalizedText.split(' ');
      return tokens.includes(needle);
    }
    case 'contains':
      return normalizedText.includes(needle);
    case 'regex': {
      try {
        const re = new RegExp(rule.term, 'i');
        return re.test(normalizedText);
      } catch (_) {
        return false;
      }
    }
    default:
      return false;
  }
}

function decideAction(matches) {
  if (matches.length === 0) {
    return { action: null, score: 0, reason: null };
  }
  let action = MODERATION_ACTIONS.FLAG;
  let score = 0;
  let topReason = null;
  let topRank = -1;

  const RANK = {
    [MODERATION_ACTIONS.FLAG]: 0,
    [MODERATION_ACTIONS.NEEDS_REVIEW]: 1,
    [MODERATION_ACTIONS.BLOCK]: 2,
  };
  const SEV_RANK = {
    [MODERATION_SEVERITY.LOW]: 0,
    [MODERATION_SEVERITY.MEDIUM]: 1,
    [MODERATION_SEVERITY.HIGH]: 2,
    [MODERATION_SEVERITY.CRITICAL]: 3,
  };

  for (const m of matches) {
    score += SEVERITY_SCORE[m.severity] || 0;

    let derived = m.action;
    if (m.severity === MODERATION_SEVERITY.CRITICAL) derived = MODERATION_ACTIONS.BLOCK;
    if (m.severity === MODERATION_SEVERITY.HIGH && derived === MODERATION_ACTIONS.FLAG) {
      derived = MODERATION_ACTIONS.NEEDS_REVIEW;
    }

    if (RANK[derived] > RANK[action]) action = derived;

    const rank = SEV_RANK[m.severity] ?? -1;
    if (rank > topRank) {
      topRank = rank;
      topReason = `${m.category}: ${m.term}`;
    }
  }

  if (score > 100) score = 100;
  return { action, score, reason: topReason };
}

async function runModeration({ title, prompt_text, negative_prompt, tags = [], style, model_name, description, category }) {
  const combined = [
    title,
    prompt_text,
    negative_prompt,
    style,
    model_name,
    description,
    category,
    Array.isArray(tags) ? tags.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ');
  const normalized = normalizeText(combined);
  const textHash = hashText(normalized);

  const rules = await loadActiveRules();
  const matches = [];
  for (const rule of rules) {
    if (ruleMatches(rule, normalized)) {
      matches.push({
        id: rule.id,
        term: rule.term,
        category: rule.category,
        severity: rule.severity,
        action: rule.action,
      });
    }
  }
  const decision = decideAction(matches);
  return { ...decision, matches, textHash };
}

async function persistLogs({ promptId, userId, textHash, matches }) {
  if (!matches || matches.length === 0) return;
  const conn = await getConnection();
  try {
    for (const m of matches) {
      await conn.execute(
        `INSERT INTO moderation_logs
           (prompt_id, user_id, checked_text_hash, matched_term, category, severity, action_taken, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          promptId,
          userId,
          textHash,
          m.term,
          m.category,
          m.severity,
          m.action,
          JSON.stringify({ rule_id: m.id }),
        ]
      );
    }
  } finally {
    conn.release();
  }
}

module.exports = { runModeration, persistLogs, loadActiveRules };
