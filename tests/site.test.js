'use strict';

const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const messages = require('../src/i18n.js');
const { fields, statuses, flagKeys } = require('../src/roster.js');

const root = join(__dirname, '..');
const read = file => readFileSync(join(root, file), 'utf8');
const html = read('index.html');
const app = read('src/app.js');
const ctaUrl = ['https:', '', 'brightcoastins.com', 'get-a-quote'].join('/') +
  '?utm_source=github&utm_medium=open-source&utm_campaign=coi-tracker&utm_content=results-cta';

test('English and Spanish keys, substitutions, and checklist items stay in sync', () => {
  const { en, es } = messages;
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  const placeholders = value => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const [key, value] of Object.entries(en)) {
    if (Array.isArray(value)) {
      assert.equal(es[key].length, value.length);
      assert.ok(value.length >= 5);
      assert.ok([...value, ...es[key]].every(item => typeof item === 'string' && item.trim()));
    } else {
      assert.ok(es[key].trim(), key);
      assert.deepEqual(placeholders(es[key]), placeholders(value), key);
    }
  }
  const referenced = [
    ...[...html.matchAll(/data-(?:t|placeholder)="(\w+)"/g)].map(match => match[1]),
    ...[...app.matchAll(/\bt\('([a-zA-Z_]+)'/g)].map(match => match[1]),
    ...fields, ...Object.keys(statuses), ...flagKeys
  ];
  for (const key of referenced) assert.ok(Object.hasOwn(en, key), key);
});

test('the single external link is the optional CTA with the exact fixed URL after the results', () => {
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
  const external = links.filter(link => /href="https?:/.test(link));
  assert.equal(external.length, 1);
  const [cta] = external;
  assert.equal(cta.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&'), ctaUrl);
  assert.match(cta, /\brel="noopener"/);
  assert.match(cta, /\bdata-t="cta"/);
  assert.ok(html.indexOf(cta) > html.indexOf('data-t="disclaimer"'));
  assert.match(messages.en.cta, /\(optional\)$/);
  assert.match(messages.es.cta, /\(opcional\)$/);
});

function projectFiles(folder = '') {
  const excluded = new Set(['.git', '.ag' + 'ents', '.aws', '.cod' + 'ex', 'node_modules', 'coverage']);
  return readdirSync(join(root, folder), { withFileTypes: true }).flatMap(entry => {
    if (excluded.has(entry.name)) return [];
    const file = join(folder, entry.name);
    if (entry.isDirectory()) return projectFiles(file);
    return /\.(?:html|css|js|json|md|csv|yml|yaml|txt)$/.test(file) || /(?:LICENSE|\.gitignore)$/.test(file)
      ? [file]
      : [];
  });
}

test('project files contain no prohibited wording, internal paths, or obvious secret material', () => {
  // Split prohibited names so this file can be included in its own scan.
  const disallowed = [
    'co' + 'dex', 'bo' + 'ts?', 'ag' + 'ents?', 'chat' + 'gpt', 'artificial ' + 'intelligence',
    'internal ' + 'tool(?:ing|s)?', 'open' + 'a' + 'i', 'a[i]'
  ];
  const wording = new RegExp('(?:^|[^\\w])(?:' + disallowed.join('|') + ')(?=$|[^\\w])', 'i');
  for (const file of projectFiles()) {
    const source = read(file);
    assert.doesNotMatch(source, wording, file);
    assert.doesNotMatch(source, /\/(?:home|workspace|tmp|Users)\/[\w.-]+/, file);
    assert.doesNotMatch(source, /BEGIN [A-Z ]*PRIVATE KEY|(?:AKIA|ASIA)[A-Z0-9]{16}|\b(?:ghp|github_pat)_[a-z0-9_]{20,}\b/i, file);
  }
});

test('runtime uses only local assets and prevents network connections and submissions', () => {
  const files = projectFiles().filter(file => /^(?:index\.html|styles\.css|src\/)/.test(file));
  for (const file of files) {
    let source = read(file);
    if (file === 'index.html') source = source.replace(ctaUrl.replace(/&/g, '&amp;'), '');
    assert.doesNotMatch(source, /(?:https?|wss?):\/\/|(?:src|href)\s*=\s*["']\/\/|@import\b/i, file);
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|serviceWorker|indexedDB|sessionStorage|RTCPeerConnection)\b|document\s*\.\s*cookie|\b(?:ping|srcset)\s*=/i, file);
  }
  assert.match(html, /connect-src 'none'; form-action 'none'/);
  assert.ok(JSON.parse(read('package.json')).dependencies === undefined);
});
