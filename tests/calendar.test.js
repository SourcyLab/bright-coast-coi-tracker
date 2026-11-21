'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calendarEvents, writeCalendar } = require('../src/calendar.js');

const options = {
  now: new Date('2026-11-21T14:04:02.991Z'),
  labels: { expiry: 'Recorded COI expiry', request: 'COI request by' }
};
const row = {
  id: 'example-01',
  subcontractor: 'Example Roofing Co 01',
  job_name: 'Example, Phase; 2\\A\n' + 'á🧰'.repeat(25),
  job_start: '2028-03-01',
  coi_expiry: '2028-02-29',
  request_status: 'requested'
};
const unfold = file => file.replace(/\r\n /g, '');
const uids = file => unfold(file).match(/^UID:.+$/gm);

test('exports CRLF, all-day dates, text escapes, alarms, and UTF-8 line folding', () => {
  const events = calendarEvents([row], { includeRequests: true, leadDays: 1 });
  const file = writeCalendar(events, options);
  const plain = unfold(file);
  assert.match(file, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.ok(file.endsWith('END:VCALENDAR\r\n'));
  assert.doesNotMatch(file.replace(/\r\n/g, ''), /[\r\n]/);
  assert.ok(file.includes('\r\n '));
  for (const line of file.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
    assert.equal(Buffer.from(line, 'utf8').toString('utf8'), line);
  }
  assert.equal((plain.match(/DTSTART;VALUE=DATE:20280229\r\n/g) || []).length, 2);
  assert.equal((plain.match(/DTSTAMP:20261121T140402Z\r\n/g) || []).length, 2);
  assert.equal((plain.match(/BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-P1D\r\nDESCRIPTION:/g) || []).length, 2);
  assert.ok(plain.includes('Example\\, Phase\\; 2\\\\A\\n' + 'á🧰'.repeat(25)));
});

test('keeps identifiers stable across date and text edits and distinguishes event kinds', () => {
  const exportFor = row => writeCalendar(calendarEvents([row], { includeRequests: true }), options);
  const first = uids(exportFor(row));
  assert.deepEqual(first, ['UID:example-01-expiry@coi-deadline-tracker', 'UID:example-01-request@coi-deadline-tracker']);
  assert.deepEqual(uids(exportFor({ ...row, coi_expiry: '2028-03-02', subcontractor: 'Example Roofing Co 02' })), first);
});

test('omits invalid dates, optional requests, and requests for received certificates', () => {
  assert.deepEqual(calendarEvents([row]).map(event => event.kind), ['expiry']);
  assert.deepEqual(calendarEvents([{ ...row, request_status: 'received' }], { includeRequests: true })
    .map(event => event.kind), ['expiry']);
  const invalid = { ...row, coi_expiry: '2028-02-30', job_start: '0001-01-01' };
  assert.deepEqual(calendarEvents([invalid], { includeRequests: true }), []);
  assert.equal(writeCalendar([], options), '');
  assert.equal(calendarEvents([row], { includeRequests: true, leadDays: 0 })[1].date, row.job_start);
});
