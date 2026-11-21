'use strict';

const coiCalendar = (() => {
  const { dayNumber, shiftDate } = typeof module === 'object' ? require('./dates.js') : coiDates;
  const encoder = new TextEncoder();

  function escapeText(text) {
    return text.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n')
      .replace(/[,;]/g, '\\$&').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
  }

  function fold(line) {
    let result = '';
    let bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) {
        result += '\r\n ';
        bytes = 1;
      }
      result += char;
      bytes += size;
    }
    return result;
  }

  function calendarEvents(rows, { includeRequests = false, leadDays = 7 } = {}) {
    if (!Number.isSafeInteger(leadDays) || leadDays < 0) throw new RangeError('Expected a nonnegative day count');
    const events = [];
    for (const row of rows) {
      if (dayNumber(row.coi_expiry) !== null) events.push({ row, kind: 'expiry', date: row.coi_expiry });
      if (includeRequests && row.request_status !== 'received') {
        const date = shiftDate(row.job_start, -leadDays);
        if (date) events.push({ row, kind: 'request', date });
      }
    }
    return events;
  }

  function writeCalendar(events, { now, labels }) {
    if (!events.length) return '';
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bright Coast Insurance//COI Deadline Tracker//EN',
      'CALSCALE:GREGORIAN'];
    for (const { row, kind, date } of events) {
      const name = row.job_name ? row.subcontractor + ' / ' + row.job_name : row.subcontractor;
      const summary = escapeText(labels[kind] + ' · ' + name);
      lines.push('BEGIN:VEVENT', 'UID:' + escapeText(row.id) + '-' + kind + '@coi-deadline-tracker',
        'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + date.replace(/-/g, ''),
        'SUMMARY:' + summary, 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', 'DESCRIPTION:' + summary, 'END:VALARM',
        'END:VEVENT');
    }
    return lines.concat('END:VCALENDAR', '').map(fold).join('\r\n');
  }

  return { calendarEvents, writeCalendar };
})();

if (typeof module === 'object') module.exports = coiCalendar;
