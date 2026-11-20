import test from 'node:test';
import assert from 'node:assert/strict';
import { productHttpStatusIssue } from './commerce-audit-status.mjs';

test('normal live product pages remain eligible for detailed safety inspection', () => {
  assert.equal(productHttpStatusIssue(200), null);
});

test('deliberately retired product pages are permitted', () => {
  for (const status of [404, 410]) assert.equal(productHttpStatusIssue(status), null);
});

test('WAF/403 cannot be counted as proof that sales are on hold', () => {
  assert.match(productHttpStatusIssue(403), /cannot be verified/i);
});

test('redirects, missing responses and server failures fail the status gate', () => {
  for (const status of [0, 301, 302, 429, 500, 502, 503]) {
    assert.match(productHttpStatusIssue(status), /Unexpected HTTP status/);
  }
});
