import dotenv from 'dotenv';

dotenv.config();

/**
 * @typedef {Object} AppConfig
 * @property {string} providerBaseUrl
 * @property {string} providerApiKey
 * @property {string[]} availableModels
 * @property {string} defaultModel
 * @property {number} port
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid
 * @property {string[]} errors
 */

const DEFAULT_FALLBACK_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'deepseek-chat',
  'deepseek-reasoner',
  'claude-3-5-sonnet'
];

/**
 * Clean URL trailing slash
 * @param {string} url
 * @returns {string}
 */
function cleanBaseUrl(url) {
  if (!url) return 'https://api.openai.com/v1';
  return url.trim().replace(/\/+$/, '');
}

/**
 * Parse models comma-separated string to clean array
 * @param {string | undefined} rawModels
 * @returns {string[]}
 */
function parseModels(rawModels) {
  if (!rawModels || typeof rawModels !== 'string') {
    return [...DEFAULT_FALLBACK_MODELS];
  }
  const parsed = rawModels
    .split(',')
    .map(m => m.trim())
    .filter(m => m.length > 0);

  return parsed.length > 0 ? parsed : [...DEFAULT_FALLBACK_MODELS];
}

/**
 * Parse environment variables into clean AppConfig object
 * @param {Record<string, string | undefined>} env
 * @returns {AppConfig}
 */
export function parseConfig(env = {}) {
  const providerBaseUrl = cleanBaseUrl(env.PROVIDER_BASE_URL);
  const providerApiKey = typeof env.PROVIDER_API_KEY === 'string' ? env.PROVIDER_API_KEY.trim() : '';
  const availableModels = parseModels(env.AVAILABLE_MODELS);
  const defaultModelCandidate = typeof env.DEFAULT_MODEL === 'string' ? env.DEFAULT_MODEL.trim() : '';
  const defaultModel = defaultModelCandidate || availableModels[0] || 'gpt-4o-mini';

  const rawPort = env.PORT ? Number.parseInt(env.PORT, 10) : 3000;
  const port = Number.isInteger(rawPort) && rawPort > 0 ? rawPort : 3000;

  return Object.freeze({
    providerBaseUrl,
    providerApiKey,
    availableModels: Object.freeze(availableModels),
    defaultModel,
    port
  });
}

/**
 * Validate configuration
 * @param {AppConfig} config
 * @returns {ValidationResult}
 */
export function validateConfig(config) {
  const errors = [];

  if (!config.providerBaseUrl || typeof config.providerBaseUrl !== 'string') {
    errors.push('providerBaseUrl must be a non-empty string');
  }

  if (typeof config.providerApiKey !== 'string') {
    errors.push('providerApiKey must be a string');
  }

  if (!Array.isArray(config.availableModels) || config.availableModels.length === 0) {
    errors.push('availableModels must contain at least one model');
  }

  if (!config.defaultModel || typeof config.defaultModel !== 'string') {
    errors.push('defaultModel must be a non-empty string');
  }

  if (typeof config.port !== 'number' || config.port <= 0 || config.port > 65535) {
    errors.push('port must be a valid port number (1-65535)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get current application config from process.env
 * @returns {AppConfig}
 */
export function getConfig() {
  return parseConfig(process.env);
}
