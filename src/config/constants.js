'use strict';

const ROLES = Object.freeze({
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
});

const PROMPT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  BLOCKED: 'blocked',
  HIDDEN: 'hidden',
});

const PROMPT_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
  UNLISTED: 'unlisted',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
});

const REPORT_STATUS = Object.freeze({
  PENDING: 'pending',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
});

const REPORT_REASONS = Object.freeze([
  'sexual_content',
  'violent_content',
  'hate_or_harassment',
  'copyright_issue',
  'spam',
  'misleading',
  'other',
]);

const MODERATION_ACTIONS = Object.freeze({
  FLAG: 'flag',
  NEEDS_REVIEW: 'needs_review',
  BLOCK: 'block',
});

const MODERATION_SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

const MODERATION_MATCH_TYPE = Object.freeze({
  EXACT: 'exact',
  CONTAINS: 'contains',
  REGEX: 'regex',
});

const ALLOWED_IMAGE_MIME = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const DEFAULT_UPLOAD_LIMIT_PER_DAY = 50;
const COOKIE_NAME = 'auth_token';

module.exports = {
  ROLES,
  PROMPT_STATUS,
  PROMPT_VISIBILITY,
  USER_STATUS,
  REPORT_STATUS,
  REPORT_REASONS,
  MODERATION_ACTIONS,
  MODERATION_SEVERITY,
  MODERATION_MATCH_TYPE,
  ALLOWED_IMAGE_MIME,
  MAX_IMAGE_BYTES,
  DEFAULT_UPLOAD_LIMIT_PER_DAY,
  COOKIE_NAME,
};
