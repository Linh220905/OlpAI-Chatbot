import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Session, SessionStore, DEFAULT_MAX_TOKENS } from '../src/session.js';

describe('session module', () => {
  it('initializes session with 2000 max tokens by default', () => {
    const session = new Session('chat_1');
    assert.equal(session.id, 'chat_1');
    assert.equal(session.maxTokens, 2000);
    assert.equal(session.inputTokens, 0);
    assert.equal(session.outputTokens, 0);
    assert.equal(session.totalTokens, 0);
    assert.equal(session.remainingTokens, 2000);
    assert.equal(session.isExceeded, false);
    assert.equal(session.percentage, 0);
  });

  it('accumulates input and output tokens accurately', () => {
    const session = new Session('chat_2');
    session.addTokens(150, 350);

    assert.equal(session.inputTokens, 150);
    assert.equal(session.outputTokens, 350);
    assert.equal(session.totalTokens, 500);
    assert.equal(session.remainingTokens, 1500);
    assert.equal(session.percentage, 25);
    assert.equal(session.isExceeded, false);

    session.addTokens(200, 300);
    assert.equal(session.totalTokens, 1000);
    assert.equal(session.percentage, 50);
  });

  it('detects when limit of 2000 tokens is reached or exceeded', () => {
    const session = new Session('chat_3', 2000);
    session.addTokens(1000, 1000);

    assert.equal(session.totalTokens, 2000);
    assert.equal(session.remainingTokens, 0);
    assert.equal(session.isExceeded, true);
    assert.equal(session.percentage, 100);

    session.addTokens(50, 0);
    assert.equal(session.totalTokens, 2050);
    assert.equal(session.isExceeded, true);
    assert.equal(session.remainingTokens, 0);
  });

  it('SessionStore manages unlimited independent sessions', () => {
    const store = new SessionStore(2000);

    const s1 = store.getOrCreate('session_a');
    const s2 = store.getOrCreate('session_b');

    s1.addTokens(500, 500);
    s2.addTokens(100, 100);

    assert.equal(s1.totalTokens, 1000);
    assert.equal(s2.totalTokens, 200);

    assert.equal(store.get('session_a')?.totalTokens, 1000);
    assert.equal(store.get('session_b')?.totalTokens, 200);

    store.delete('session_a');
    assert.equal(store.get('session_a'), undefined);
    assert.equal(store.get('session_b')?.totalTokens, 200);
  });
});
