'use strict';

const coiRoster = (() => {
  const { dayNumber } = typeof module === 'object' ? require('./dates.js') : coiDates;
  const fields = ['subcontractor', 'trade', 'contact', 'job_name', 'job_start', 'coi_expiry', 'request_status', 'notes'];
  const statuses = {
    notRequested: 'Not requested',
    requested: 'Requested',
    received: 'Received',
    renewalRequested: 'Expired-renewal requested'
  };
  const flagKeys = ['expired', 'expiring', 'beforeStart', 'missingExpiry', 'missingStart', 'invalidDate', 'requestDue'];

  function flagsFor(row, today, days = 30) {
    const now = dayNumber(today);
    if (now === null) throw new RangeError('Expected today as YYYY-MM-DD');
    if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('Expected a nonnegative day count');
    const expiry = dayNumber(row.coi_expiry);
    const start = dayNumber(row.job_start);
    const flags = [];
    if (expiry !== null && expiry < now) flags.push('expired');
    if (expiry !== null && expiry >= now && expiry - now <= days) flags.push('expiring');
    if (expiry !== null && start !== null && expiry < start) flags.push('beforeStart');
    if (!row.coi_expiry) flags.push('missingExpiry');
    if (!row.job_start) flags.push('missingStart');
    if ((row.coi_expiry && expiry === null) || (row.job_start && start === null)) flags.push('invalidDate');
    if (row.request_status !== 'received' && start !== null && start >= now && start - now <= days) {
      flags.push('requestDue');
    }
    return flags;
  }

  return { fields, statuses, flagKeys, flagsFor };
})();

if (typeof module === 'object') module.exports = coiRoster;
