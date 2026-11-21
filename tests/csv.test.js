'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { parseCsv, writeCsv } = require('../src/csv.js');
const { fields } = require('../src/roster.js');

const header = fields.join(',');
const fixture = readFileSync(join(__dirname, '../fixtures/sample-roster.csv'), 'utf8');

test('sample CSV tolerates BOM, CRLF, escaped quotes, commas, and multiline notes', () => {
  const { rows, issues } = parseCsv('\uFEFF' + fixture.replace(/\n/g, '\r\n'));
  assert.equal(rows.length, 12);
  assert.deepEqual(issues, [
    { line: 8, code: 'csvDate', field: 'coi_expiry' },
    { line: 9, code: 'csvDate', field: 'job_start' }
  ]);
  assert.equal(rows[10].job_name, 'Example Project K, Phase 2');
  assert.equal(rows[10].notes, 'Verify "Phase 2" reference\nSynthetic multiline note');
  assert.deepEqual(parseCsv(writeCsv(rows)).rows, rows);
});

test('reports malformed and unusable rows at their physical start lines and keeps others', () => {
  const input = [
    header,
    'Example Co,Roofing,,Example Job,,,Received,"Two',
    'lines"',
    'Example Co 2,Roofing',
    ',Roofing,,Example Job,,,Requested,',
    'Example Co 3,Roofing,,Example Job,,,Unknown,',
    'Example Co 4,Roofing,,Example Job,,,Received,"Note"extra',
    '',
    'Example Co 5,Roofing,,Example Job,,,requested,',
    'Example Co 6,Roofing,,Example Job,,,Received,"Open quote'
  ].join('\n');
  const { rows, issues } = parseCsv(input);
  assert.deepEqual(rows.map(row => row.subcontractor), ['Example Co', 'Example Co 5']);
  assert.deepEqual(issues.map(({ line, code }) => [line, code]), [
    [4, 'csvColumns'], [5, 'requiredName'], [6, 'csvStatus'], [7, 'csvQuotes'], [10, 'csvQuotes']
  ]);
});

test('supports reordered headers and rejects empty, missing, or duplicate headers', () => {
  const reversed = [...fields].reverse().join(', ');
  const record = ' ,RECEIVED,2028-02-29,,Example Job,,Roofing,Example Co';
  assert.equal(parseCsv(reversed.toUpperCase() + '\r' + record).rows[0].coi_expiry, '2028-02-29');
  for (const input of ['', header + ',extra', header.replace('trade', 'contact')]) {
    assert.equal(parseCsv(input).issues[0].code, 'csvHeader');
  }
  assert.deepEqual(parseCsv(header), { rows: [], issues: [] });
});
