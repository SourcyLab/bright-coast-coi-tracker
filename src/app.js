'use strict';

(() => {
  const { fields, statuses, flagKeys, flagsFor } = coiRoster;
  const { dayNumber, localToday } = coiDates;
  const storageKey = 'coi-deadline-tracker:v1';
  const $ = id => document.getElementById(id);
  const editor = $('editor');
  const importer = $('importer');
  const remember = $('remember');
  const entryFields = fields.map($);
  const editableDates = ['job_start', 'coi_expiry'];
  let language = 'en';
  let rows = [];
  let editingId = null;
  let sortField = 'subcontractor';
  let descending = false;
  let lookahead = 30;
  let today = localToday();
  let resultsTimer;

  function t(key, values = {}) {
    return coiMessages[language][key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
  }

  function node(tag, content, className) {
    const element = document.createElement(tag);
    if (content !== undefined) element.textContent = content;
    if (className) element.className = className;
    return element;
  }

  function renderOptions(select, keys) {
    const selected = select.value;
    select.replaceChildren(...keys.map(key => new Option(t(key), key)));
    if (keys.includes(selected)) select.value = selected;
  }

  function translate() {
    document.documentElement.lang = language;
    document.title = t('title');
    document.querySelectorAll('[data-t]').forEach(element => {
      element.textContent = t(element.dataset.t);
    });
    document.querySelectorAll('[data-placeholder]').forEach(element => {
      element.placeholder = t(element.dataset.placeholder);
    });
    renderOptions($('request_status'), Object.keys(statuses));
    renderOptions($('filter'), ['all', 'flagged', 'noFlag', ...flagKeys]);
    $('checklist').replaceChildren(...coiMessages[language].checklistItems.map(item => node('li', item)));
    $('results-status').textContent = '';
    $('data-status').textContent = '';
    $('checklist-status').textContent = '';
    if ($('storage-error').textContent) storageFeedback(true);
    render();
  }

  function renderMetrics(annotated) {
    const counts = Object.fromEntries(flagKeys.map(key => [key, 0]));
    for (const { flags } of annotated) {
      for (const key of flags) counts[key]++;
    }
    $('metrics').replaceChildren(...['total', ...flagKeys].map(key => {
      const tile = node('div', undefined, 'metric');
      tile.dataset.metric = key;
      tile.append(node('dt', t(key)), node('dd', key === 'total' ? rows.length : counts[key]));
      return tile;
    }));
  }

  function buildColumns() {
    $('columns').replaceChildren(...[...fields, 'flags', 'actions'].map(field => {
      const header = node('th');
      header.scope = 'col';
      if (!fields.includes(field)) {
        header.textContent = t(field);
        return header;
      }
      const button = node('button', undefined, 'column-sort');
      button.id = 'sort-' + field;
      button.type = 'button';
      button.append(t(field));
      if (field === sortField) {
        header.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
        const arrow = node('span', descending ? '↓' : '↑', 'sort-arrow');
        arrow.setAttribute('aria-hidden', 'true');
        button.append(arrow);
      }
      button.addEventListener('click', () => {
        descending = field === sortField && !descending;
        sortField = field;
        render();
        $('sort-' + field).focus();
      });
      header.append(button);
      return header;
    }));
  }

  function renderRow({ row, flags }) {
    const tr = node('tr');
    for (const field of fields) {
      const value = field === 'request_status' ? t(row[field]) : row[field];
      const cell = node(field === 'subcontractor' ? 'th' : 'td', value || '—');
      if (field === 'subcontractor') cell.scope = 'row';
      if (editableDates.includes(field) && dayNumber(value) !== null) cell.className = 'date-cell';
      if (field === 'notes') cell.className = 'notes-cell';
      tr.append(cell);
    }
    const flagCell = node('td');
    if (flags.length) {
      const list = node('ul', undefined, 'flags');
      list.append(...flags.map(key => {
        const item = node('li', t(key));
        item.dataset.flag = key;
        return item;
      }));
      flagCell.append(list);
    } else {
      flagCell.textContent = '—';
    }
    const actions = node('td');
    for (const [key, handler] of [['edit', () => openEditor(row)], ['remove', () => deleteRow(row)]]) {
      const button = node('button', t(key), 'row-button');
      button.type = 'button';
      button.id = key + '-' + row.id;
      button.setAttribute('aria-label', t('rowAction', { action: t(key), name: row.subcontractor }));
      button.addEventListener('click', handler);
      actions.append(button);
    }
    tr.append(flagCell, actions);
    return tr;
  }

  function render({ announceResults = false } = {}) {
    today = localToday();
    const annotated = rows.map(row => ({ row, flags: flagsFor(row, today, lookahead) }));
    const query = $('search').value.trim().toLocaleLowerCase(language);
    const filter = $('filter').value;
    const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
    const sortValue = row => sortField === 'request_status' ? t(row[sortField]) : row[sortField];
    const shown = annotated.filter(({ row, flags }) => {
      const matchesQuery = ['subcontractor', 'trade', 'job_name', 'contact'].some(field =>
        row[field].toLocaleLowerCase(language).includes(query));
      const matchesFlag = filter === 'all' || (filter === 'flagged' && flags.length > 0) ||
        (filter === 'noFlag' && !flags.length) || flags.includes(filter);
      return matchesQuery && matchesFlag;
    }).sort((a, b) => (descending ? -1 : 1) * collator.compare(sortValue(a.row), sortValue(b.row)));

    renderMetrics(annotated);
    buildColumns();
    const body = document.createDocumentFragment();
    for (const entry of shown) body.append(renderRow(entry));
    $('entries').replaceChildren(body);
    $('table-scroll').hidden = !shown.length;
    $('scroll-hint').hidden = !shown.length;
    $('empty').hidden = shown.length > 0;
    $('empty-title').textContent = t(rows.length ? 'noMatches' : 'emptyTitle');
    $('empty-help').hidden = rows.length > 0;
    $('shown').textContent = t('shown', { visible: shown.length, total: rows.length });
    if (announceResults) {
      clearTimeout(resultsTimer);
      resultsTimer = setTimeout(() => { $('results-status').textContent = $('shown').textContent; }, 250);
    }
  }

  function storageFeedback(failed) {
    $('storage-error').textContent = failed ? t('storageError') : '';
  }

  function readStorage() {
    remember.checked = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || !saved.every(row => row && typeof row.id === 'string' &&
        fields.every(field => typeof row[field] === 'string') && Object.hasOwn(statuses, row.request_status))) {
        throw new Error('Invalid roster');
      }
      rows = saved;
      remember.checked = true;
      storageFeedback(false);
    } catch {
      storageFeedback(true);
    }
  }

  function saveStorage() {
    try {
      if (remember.checked) localStorage.setItem(storageKey, JSON.stringify(rows));
      else localStorage.removeItem(storageKey);
      storageFeedback(false);
    } catch {
      storageFeedback(true);
    }
  }

  function saveRows() {
    if (remember.checked) saveStorage();
    render();
  }

  function validity(input, invalid, messageKey) {
    const error = $(input.dataset.error);
    if (messageKey) error.textContent = t(messageKey);
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/)
      .filter(id => id && id !== error.id);
    if (invalid) ids.push(error.id);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
    input.setAttribute('aria-invalid', String(invalid));
    error.hidden = !invalid;
    return !invalid;
  }

  function validateEntry(input) {
    const value = input.value.trim();
    return input.id === 'subcontractor'
      ? validity(input, !value)
      : validity(input, Boolean(value) && dayNumber(value) === null);
  }

  function validateNumber(input) {
    return validity(input, !input.validity.valid);
  }

  function validateAfterEditing(input, validate, region) {
    let edited = false;
    let timer;
    input.addEventListener('input', () => {
      edited = true;
      if (input.getAttribute('aria-invalid') === 'true' && validate(input)) {
        clearTimeout(timer);
        region.textContent = '';
      }
    });
    input.addEventListener('blur', () => {
      if (!edited || !input.getClientRects().length || validate(input)) return;
      clearTimeout(timer);
      region.textContent = '';
      timer = setTimeout(() => {
        if (input.getAttribute('aria-invalid') === 'true' && input.getClientRects().length) {
          region.textContent = input.labels[0].textContent + '. ' + $(input.dataset.error).textContent;
        }
      }, 500);
    });
    return () => {
      edited = false;
      clearTimeout(timer);
      validity(input, false);
    };
  }

  const validatedEntries = [$('subcontractor'), ...editableDates.map($)];
  const resetEntryErrors = validatedEntries.map(input =>
    validateAfterEditing(input, validateEntry, $('editor-status')));
  validateAfterEditing($('lookahead'), validateNumber, $('results-status'));
  validateAfterEditing($('lead-days'), validateNumber, $('data-status'));

  function openEditor(row) {
    editingId = row?.id ?? null;
    $('editor-title').textContent = t(row ? 'editHeading' : 'add');
    for (const input of entryFields) input.value = row?.[input.id] ?? '';
    if (!row) $('request_status').value = 'notRequested';
    resetEntryErrors.forEach(reset => reset());
    $('editor-status').textContent = '';
    editor.showModal();
  }

  function newId() {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)), part =>
      part.toString(16).padStart(8, '0')).join('');
  }

  function deleteRow(row) {
    if (!window.confirm(t('confirmDelete', { name: row.subcontractor }))) return;
    rows = rows.filter(entry => entry.id !== row.id);
    saveRows();
    $('add').focus();
    $('results-status').textContent = t('removed');
  }

  $('entry-form').addEventListener('submit', event => {
    event.preventDefault();
    const invalid = validatedEntries.filter(input => !validateEntry(input));
    if (invalid.length) {
      const first = invalid[0];
      if (document.activeElement === first) $('editor-status').textContent = $(first.dataset.error).textContent;
      else first.focus();
      return;
    }
    const row = Object.fromEntries(entryFields.map(input => [input.id, input.value.trim()]));
    const isEdit = editingId !== null;
    row.id = editingId ?? newId();
    if (isEdit) rows = rows.map(entry => entry.id === editingId ? row : entry);
    else rows.push(row);
    editor.close();
    saveRows();
    (isEdit ? $('edit-' + row.id) ?? $('add') : $('add')).focus();
    $('results-status').textContent = t(isEdit ? 'updated' : 'added');
  });

  function showImport(source, input) {
    const { rows: imported, issues } = coiCsv.parseCsv(source);
    if (imported.length) {
      for (const row of imported) rows.push({ ...row, id: newId() });
      input.value = '';
      saveRows();
    }
    const count = t('imported', { rows: imported.length, issues: issues.length });
    const messages = issues.map(({ line, code, field }) =>
      t('csvLine', { line, message: t(code, { field: field ? t(field) : '' }) }));
    if (!imported.length && !issues.length) messages.push(t('csvEmpty'));
    $('report').hidden = false;
    $('import-count').textContent = count;
    const list = document.createDocumentFragment();
    for (const message of messages) list.append(node('li', message));
    $('import-issues').replaceChildren(list);
    $('import-status').textContent = [count, ...messages.slice(0, 1)].join(' ');
  }

  $('open-import').addEventListener('click', () => {
    $('file-form').reset();
    $('paste-form').reset();
    validity($('csv-file'), false, 'importBlankFile');
    validity($('csv-text'), false);
    $('report').hidden = true;
    $('import-status').textContent = '';
    importer.showModal();
  });
  $('file-form').addEventListener('submit', async event => {
    event.preventDefault();
    const input = $('csv-file');
    const [file] = input.files;
    if (!validity(input, !file, 'importBlankFile')) {
      input.focus();
      return;
    }
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      const source = await file.text();
      if (importer.open && input.files[0] === file) showImport(source, input);
    } catch {
      if (importer.open && input.files[0] === file) {
        validity(input, true, 'importRead');
        $('import-status').textContent = t('importRead');
      }
    } finally {
      if (button) button.disabled = false;
    }
  });
  $('paste-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('csv-text');
    if (validity(input, !input.value.trim())) showImport(input.value, input);
    else input.focus();
  });
  $('csv-file').addEventListener('change', () => validity($('csv-file'), false, 'importBlankFile'));
  $('csv-text').addEventListener('input', () => {
    if ($('csv-text').value.trim()) validity($('csv-text'), false);
  });

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = node('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('export-csv').addEventListener('click', () =>
    download('coi-roster.csv', coiCsv.writeCsv(rows), 'text/csv;charset=utf-8'));
  $('export-ics').addEventListener('click', () => {
    const includeRequests = $('include-requests').checked;
    const lead = $('lead-days');
    if (includeRequests && !validateNumber(lead)) {
      lead.focus();
      return;
    }
    const events = coiCalendar.calendarEvents(rows, { includeRequests, leadDays: includeRequests ? lead.valueAsNumber : 7 });
    $('data-status').textContent = events.length ? '' : t('noEvents');
    if (!events.length) return;
    const content = coiCalendar.writeCalendar(events, {
      now: new Date(), labels: { expiry: t('expiryEvent'), request: t('requestEvent') }
    });
    download('coi-deadlines.ics', content, 'text/calendar;charset=utf-8');
  });

  $('copy').addEventListener('click', async () => {
    const items = coiMessages[language].checklistItems.map(item => '• ' + item);
    const content = [t('checklist'), '', ...items].join('\n');
    try {
      await navigator.clipboard.writeText(content);
      $('checklist-status').textContent = t('copied');
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStartBefore($('checklist-section').querySelector('h2'));
      range.setEndAfter($('checklist'));
      selection.removeAllRanges();
      selection.addRange(range);
      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        // The selection remains available for manual copying.
      }
      if (copied) selection.removeAllRanges();
      $('checklist-status').textContent = t(copied ? 'copied' : 'copyError');
    }
  });
  $('print').addEventListener('click', () => window.print());

  $('add').addEventListener('click', () => openEditor());
  $('cancel-edit').addEventListener('click', () => editor.close());
  $('close-import').addEventListener('click', () => importer.close());
  $('search').addEventListener('input', () => render({ announceResults: true }));
  $('filter').addEventListener('change', () => render({ announceResults: true }));
  $('lookahead').addEventListener('input', event => {
    if (!event.target.validity.valid) return;
    lookahead = event.target.valueAsNumber;
    render();
  });
  $('include-requests').addEventListener('change', event => {
    $('lead-field').hidden = !event.target.checked;
  });
  $('language').addEventListener('change', event => {
    language = event.target.value;
    translate();
  });
  remember.addEventListener('change', saveStorage);
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === storageKey || event.key === null) && !event.newValue) {
      remember.checked = false;
    }
  });
  $('clear').addEventListener('click', () => {
    if (!window.confirm(t('confirmClear'))) return;
    rows = [];
    saveStorage();
    render();
    $('data-status').textContent = t('cleared');
  });

  function refreshDate() {
    if (localToday() !== today) render();
  }

  window.addEventListener('focus', refreshDate);
  document.addEventListener('visibilitychange', refreshDate);
  setInterval(refreshDate, 60000);
  $('language').value = language;
  readStorage();
  translate();
  $('content').hidden = false;
})();
