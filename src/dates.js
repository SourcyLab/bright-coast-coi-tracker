'use strict';

const coiDates = (() => {
  const dayMs = 86400000;

  // UTC acts as a day-number calculator. Roster dates never represent instants.
  function dayNumber(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    return date.toISOString().slice(0, 10) === value ? date.getTime() / dayMs : null;
  }

  function shiftDate(value, days) {
    const day = dayNumber(value);
    if (day === null || !Number.isSafeInteger(days)) return null;
    const result = new Date((day + days) * dayMs);
    if (!(result.getUTCFullYear() >= 1 && result.getUTCFullYear() <= 9999)) return null;
    return result.toISOString().slice(0, 10);
  }

  function localToday(now = new Date()) {
    const pad = (part, length = 2) => String(part).padStart(length, '0');
    return [pad(now.getFullYear(), 4), pad(now.getMonth() + 1), pad(now.getDate())].join('-');
  }

  return { dayNumber, shiftDate, localToday };
})();

if (typeof module === 'object') module.exports = coiDates;
