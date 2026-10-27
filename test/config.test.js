import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, validateConfig } from '../src/config.js';

describe('config module', () => {
  it('parses environment variables with defaults', () => {
    const env = {
      PROVIDER_BASE_URL: 'https://llm.example.com/v1/',
      PROVIDER_API_KEY: 'test-key-123',
      AVAILABLE_MODELS: 'model-a, model-b , model-c',
      DEFAULT_MODEL: 'model-b',
      PORT: '8080'
    };

    const config = parseConfig(env);

    assert.equal(config.providerBaseUrl, 'https://llm.example.com/v1');
    assert.equal(config.providerApiKey, 'test-key-123');
    assert.deepEqual(config.availableModels, ['model-a', 'model-b', 'model-c']);
    assert.equal(config.defaultModel, 'model-b');
    assert.equal(config.port, 8080);
  });

  it('uses sensible fallbacks when env vars are missing', () => {
    const config = parseConfig({});

    assert.equal(config.providerBaseUrl, 'https://api.openai.com/v1');
    assert.equal(config.providerApiKey, '');
    assert.ok(Array.isArray(config.availableModels));
    assert.ok(config.availableModels.length > 0);
    assert.equal(config.defaultModel, config.availableModels[0]);
    assert.equal(config.port, 3000);
  });

  it('validates configuration correctly', () => {
    const valid = validateConfig({
      providerBaseUrl: 'https://api.openai.com/v1',
      providerApiKey: 'valid-key',
      availableModels: ['m1'],
      defaultModel: 'm1',
      port: 3000
    });
    assert.equal(valid.isValid, true);
    assert.equal(valid.errors.length, 0);

    const invalid = validateConfig({
      providerBaseUrl: '',
      providerApiKey: '',
      availableModels: [],
      defaultModel: '',
      port: -1
    });
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.errors.length >= 2);
  });
});
