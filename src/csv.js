'use strict';

const coiCsv = (() => {
  const { fields, statuses } = typeof module === 'object' ? require('./roster.js') : coiRoster;
  const { dayNumber } = typeof module === 'object' ? require('./dates.js') : coiDates;

  function readRecords(source) {
    const input = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const records = [];
    let line = 1;
    let start = 1;
    let cells = [];
    let cell = '';
    let state = 'plain';
    let malformed = false;

    function finishRecord() {
      cells.push(cell);
      if (malformed || cells.length > 1 || cell.trim()) {
        records.push({ line: start, cells, malformed });
      }
      cells = [];
      cell = '';
      state = 'plain';
      malformed = false;
      start = line + 1;
    }

    for (let index = 0; index < input.length; index++) {
      const char = input[index];
      if (state === 'quoted') {
        if (char === '"' && input[index + 1] === '"') {
          cell += '"';
          index++;
        } else if (char === '"') {
          state = 'closed';
        } else {
          cell += char;
        }
      } else if (char === ',') {
        cells.push(cell);
        cell = '';
        state = 'plain';
      } else if (char === '\n') {
        finishRecord();
      } else if (state === 'closed') {
        if (char !== ' ' && char !== '\t') malformed = true;
      } else if (char === '"' && !cell.trim()) {
        cell = '';
        state = 'quoted';
      } else {
        if (char === '"') malformed = true;
        cell += char;
      }
      if (char === '\n') line++;
    }
    malformed ||= state === 'quoted';
    finishRecord();
    return records;
  }

  function parseCsv(source) {
    const [header, ...records] = readRecords(source);
    const rows = [];
    const issues = [];
    const issue = (line, code, field) => issues.push({ line, code, field });
    const names = header?.cells.map(value => value.trim().toLowerCase());
    if (!header || header.malformed || names.length !== fields.length ||
        fields.some(field => !names.includes(field))) {
      issue(header?.line ?? 1, 'csvHeader');
      return { rows, issues };
    }

    const statusKeys = Object.keys(statuses);
    for (const { line, cells, malformed } of records) {
      if (malformed || cells.length !== fields.length) {
        issue(line, malformed ? 'csvQuotes' : 'csvColumns');
        continue;
      }
      const row = Object.fromEntries(fields.map(field => [field, cells[names.indexOf(field)].trim()]));
      const statusLabel = row.request_status.toLowerCase();
      const status = statusKeys.find(key => statuses[key].toLowerCase() === statusLabel);
      if (!row.subcontractor) issue(line, 'requiredName');
      if (!status) issue(line, 'csvStatus');
      for (const field of ['job_start', 'coi_expiry']) {
        if (row[field] && dayNumber(row[field]) === null) issue(line, 'csvDate', field);
      }
      if (row.subcontractor && status) rows.push({ ...row, request_status: status });
    }
    return { rows, issues };
  }

  function writeCsv(rows) {
    const escape = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    return [fields.join(','), ...rows.map(row => fields.map(field => escape(
      field === 'request_status' ? statuses[row[field]] : row[field]
    )).join(','))].join('\r\n') + '\r\n';
  }

  return { parseCsv, writeCsv };
})();

if (typeof module === 'object') module.exports = coiCsv;
