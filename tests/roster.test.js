'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { dayNumber, shiftDate } = require('../src/dates.js');
const { flagsFor } = require('../src/roster.js');

const dates = (coi_expiry, job_start, request_status = 'requested') => ({ coi_expiry, job_start, request_status });
const today = '2026-11-21';

test('expiry and job-start look-ahead are inclusive at zero and thirty days', () => {
  assert.deepEqual(flagsFor(dates(today, today), today, 0), ['expiring', 'requestDue']);
  assert.deepEqual(flagsFor(dates('2026-12-21', '2026-12-21'), today), ['expiring', 'requestDue']);
  assert.deepEqual(flagsFor(dates('2026-12-22', '2026-12-22'), today), []);
  assert.deepEqual(flagsFor(dates('2026-12-21', '2026-12-22'), today, 31), ['expiring', 'beforeStart', 'requestDue']);
});

test('distinguishes expired, missing, invalid, past starts and received status', () => {
  assert.deepEqual(flagsFor(dates('2026-11-20', today), today), ['expired', 'beforeStart', 'requestDue']);
  assert.deepEqual(flagsFor(dates('', ''), today), ['missingExpiry', 'missingStart']);
  assert.deepEqual(flagsFor(dates('2027-02-29', ''), today), ['missingStart', 'invalidDate']);
  assert.deepEqual(flagsFor(dates('2026-12-20', '2026-11-20'), today), ['expiring']);
  assert.deepEqual(flagsFor(dates('', today, 'received'), today), ['missingExpiry']);
  assert.deepEqual(flagsFor(dates('', today, 'renewalRequested'), today), ['missingExpiry', 'requestDue']);
  assert.throws(() => flagsFor(dates('', ''), '2026-02-29'), RangeError);
});

test('canonical Gregorian dates round-trip across leap, century, and year boundaries', () => {
  for (const value of ['2026-02-29', '1900-02-29', '2026-13-01', '2026-01-32', '2026-01-00',
    '0000-01-01', '2026-1-01', '2026-11-21T00:00:00Z']) assert.equal(dayNumber(value), null, value);
  assert.equal(shiftDate('2000-02-28', 1), '2000-02-29');
  assert.equal(shiftDate('2028-03-01', -1), '2028-02-29');
  assert.equal(shiftDate('0099-12-31', 1), '0100-01-01');
  assert.equal(shiftDate('0001-01-01', -1), null);
  assert.equal(shiftDate('9999-12-31', 1), null);
});

test('DST changes keep calendar-day distances, and today uses the local date', () => {
  const script = `
    const assert = require('node:assert/strict');
    const { dayNumber, shiftDate, localToday } = require('./src/dates.js');
    assert.equal(dayNumber('2026-03-09') - dayNumber('2026-03-07'), 2);
    assert.equal(dayNumber('2026-11-02') - dayNumber('2026-10-31'), 2);
    assert.equal(shiftDate('2026-03-09', -2), '2026-03-07');
    assert.equal(shiftDate('2026-11-02', -2), '2026-10-31');
    assert.equal(localToday(new Date('2026-03-08T04:30:00Z')), '2026-03-07');
    assert.deepEqual(require('./src/roster.js').flagsFor({
      job_start: '2026-11-02', coi_expiry: '2026-11-02', request_status: 'requested'
    }, '2026-10-31', 2), ['expiring', 'requestDue']);
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, TZ: 'America/New_York' },
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
});
