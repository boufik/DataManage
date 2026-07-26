(function () {
  'use strict';

  const state = {
    columns: [],
    rows: [],
    types: {} // colName -> 'numeric' | 'text'
  };

  let conditionCounter = 0;

  const PREVIEW_ROW_LIMIT = 50;
  const UNIQUE_VALUE_DISPLAY_LIMIT = 50;

  const fileInput = document.getElementById('csvFile');
  const fileNameEl = document.getElementById('fileName');
  const uploadStatus = document.getElementById('uploadStatus');

  const previewCard = document.getElementById('previewCard');
  const previewInfo = document.getElementById('previewInfo');
  const previewTable = document.getElementById('previewTable');

  const analysisCard = document.getElementById('analysisCard');
  const functionSelect = document.getElementById('functionSelect');
  const columnControl = document.getElementById('columnControl');
  const columnSelect = document.getElementById('columnSelect');
  const filterControl = document.getElementById('filterControl');
  const filterConditions = document.getElementById('filterConditions');
  const addConditionBtn = document.getElementById('addConditionBtn');
  const runAnalysisBtn = document.getElementById('runAnalysisBtn');

  const resultsCard = document.getElementById('resultsCard');
  const resultsOutput = document.getElementById('resultsOutput');
  const clearResultsBtn = document.getElementById('clearResultsBtn');

  fileInput.addEventListener('change', handleFileSelect);
  functionSelect.addEventListener('change', updateControlVisibility);
  addConditionBtn.addEventListener('click', () => addFilterCondition());
  runAnalysisBtn.addEventListener('click', runAnalysis);
  clearResultsBtn.addEventListener('click', () => {
    resultsOutput.innerHTML = '';
    resultsCard.hidden = true;
  });

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    uploadStatus.textContent = 'Parsing...';

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          uploadStatus.textContent = 'Could not find any columns in this file.';
          return;
        }
        loadDataFrame(results.meta.fields, results.data);
        uploadStatus.textContent = `Loaded "${file.name}" successfully.`;
      },
      error: (err) => {
        uploadStatus.textContent = `Failed to parse file: ${err.message}`;
      }
    });
  }

  function loadDataFrame(columns, rows) {
    state.columns = columns;
    state.rows = rows;
    state.types = {};
    columns.forEach((col) => {
      state.types[col] = inferColumnType(col);
    });

    renderPreview();
    populateColumnSelects();
    analysisCard.hidden = false;
    updateControlVisibility();
  }

  function inferColumnType(col) {
    const values = state.rows
      .map((r) => r[col])
      .filter((v) => v !== null && v !== undefined && v !== '');
    if (values.length === 0) return 'text';
    const numericCount = values.filter((v) => typeof v === 'number' && !Number.isNaN(v)).length;
    return numericCount / values.length >= 0.9 ? 'numeric' : 'text';
  }

  function renderPreview() {
    const totalRows = state.rows.length;
    const totalCols = state.columns.length;
    const shown = Math.min(PREVIEW_ROW_LIMIT, totalRows);
    previewInfo.textContent = `Showing ${shown} of ${totalRows} rows, ${totalCols} columns.`;

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    state.columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    state.rows.slice(0, PREVIEW_ROW_LIMIT).forEach((row) => {
      const tr = document.createElement('tr');
      state.columns.forEach((col) => {
        const td = document.createElement('td');
        const val = row[col];
        td.textContent = val === null || val === undefined ? '' : String(val);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    previewTable.innerHTML = '';
    previewTable.appendChild(thead);
    previewTable.appendChild(tbody);
    previewCard.hidden = false;
  }

  function populateColumnSelects() {
    columnSelect.innerHTML = '';
    state.columns.forEach((col) => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = `${col} (${state.types[col]})`;
      columnSelect.appendChild(opt);
    });

    filterConditions.innerHTML = '';
    conditionCounter = 0;
    addFilterCondition();
  }

  function updateControlVisibility() {
    const fn = functionSelect.value;
    if (fn === 'filterCount') {
      columnControl.hidden = true;
      filterControl.hidden = false;
    } else {
      columnControl.hidden = false;
      filterControl.hidden = true;
    }
  }

  function addFilterCondition() {
    conditionCounter += 1;

    const row = document.createElement('div');
    row.className = 'filter-condition';
    row.dataset.id = String(conditionCounter);

    const colSelect = document.createElement('select');
    colSelect.className = 'filter-col';
    state.columns.forEach((col) => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = col;
      colSelect.appendChild(opt);
    });

    const opSelect = document.createElement('select');
    opSelect.className = 'filter-op';
    ['=', '!=', '>', '<', '>=', '<=', 'contains'].forEach((op) => {
      const opt = document.createElement('option');
      opt.value = op;
      opt.textContent = op;
      opSelect.appendChild(opt);
    });

    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.className = 'filter-val';
    valInput.placeholder = 'value';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-condition-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => row.remove());

    row.appendChild(colSelect);
    row.appendChild(opSelect);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    filterConditions.appendChild(row);
  }

  function runAnalysis() {
    const fn = functionSelect.value;
    if (state.columns.length === 0) return;

    switch (fn) {
      case 'mode': runModeAnalysis(); break;
      case 'mean': runNumericAggregate('mean', 'Mean'); break;
      case 'median': runNumericAggregate('median', 'Median'); break;
      case 'std': runNumericAggregate('std', 'Standard Deviation'); break;
      case 'unique': runUniqueAnalysis(); break;
      case 'filterCount': runFilterCountAnalysis(); break;
      default: break;
    }
  }

  function getColumnValues(col) {
    return state.rows
      .map((r) => r[col])
      .filter((v) => v !== null && v !== undefined && v !== '');
  }

  function runModeAnalysis() {
    const col = columnSelect.value;
    const values = getColumnValues(col);
    if (values.length === 0) {
      appendResult(`Mode — ${col}`, '<p>No data available in this column.</p>');
      return;
    }

    const freq = new Map();
    values.forEach((v) => {
      const key = String(v);
      freq.set(key, (freq.get(key) || 0) + 1);
    });

    let maxCount = 0;
    freq.forEach((count) => {
      if (count > maxCount) maxCount = count;
    });
    const modes = [...freq.entries()]
      .filter(([, count]) => count === maxCount)
      .map(([val]) => val);

    const rows = [
      ['Mode value(s)', modes.join(', ')],
      ['Frequency', String(maxCount)],
      ['Total non-empty values', String(values.length)]
    ];
    appendResult(`Mode — ${col}`, buildKeyValueTable(rows));
  }

  function toNumericValues(col) {
    return getColumnValues(col)
      .map((v) => (typeof v === 'number' ? v : parseFloat(v)))
      .filter((v) => !Number.isNaN(v));
  }

  function mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  function sampleStd(values) {
    if (values.length < 2) return NaN;
    const m = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  function runNumericAggregate(kind, label) {
    const col = columnSelect.value;

    if (state.types[col] !== 'numeric') {
      appendResult(`${label} — ${col}`, '<p>This column is not numeric, so this function does not apply.</p>');
      return;
    }

    const values = toNumericValues(col);
    if (values.length === 0) {
      appendResult(`${label} — ${col}`, '<p>No numeric data available in this column.</p>');
      return;
    }

    let result;
    if (kind === 'mean') result = mean(values);
    else if (kind === 'median') result = median(values);
    else result = sampleStd(values);

    const rows = [
      [label, Number.isNaN(result) ? 'N/A (need at least 2 values)' : result.toFixed(4)],
      ['Values used', String(values.length)]
    ];
    appendResult(`${label} — ${col}`, buildKeyValueTable(rows));
  }

  function runUniqueAnalysis() {
    const col = columnSelect.value;
    const values = getColumnValues(col).map((v) => String(v));
    const unique = [...new Set(values)];

    const rows = [['Unique value count', String(unique.length)]];
    let extra = '';
    if (unique.length > 0) {
      const shown = unique.slice(0, UNIQUE_VALUE_DISPLAY_LIMIT);
      const label = unique.length > shown.length
        ? `Values (first ${shown.length} of ${unique.length})`
        : 'Values';
      extra = `<p class="unique-values"><strong>${label}:</strong> ${shown.map(escapeHtml).join(', ')}</p>`;
    }
    appendResult(`Unique Values — ${col}`, buildKeyValueTable(rows) + extra);
  }

  function matchesCondition(row, col, op, rawValue) {
    const cellValue = row[col];
    const isNumericOp = ['>', '<', '>=', '<='].includes(op);

    if (isNumericOp) {
      const cellNum = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue);
      const targetNum = parseFloat(rawValue);
      if (Number.isNaN(cellNum) || Number.isNaN(targetNum)) return false;
      if (op === '>') return cellNum > targetNum;
      if (op === '<') return cellNum < targetNum;
      if (op === '>=') return cellNum >= targetNum;
      return cellNum <= targetNum;
    }

    const cellStr = cellValue === null || cellValue === undefined ? '' : String(cellValue);
    if (op === 'contains') return cellStr.toLowerCase().includes(rawValue.toLowerCase());
    if (op === '=') {
      if (typeof cellValue === 'number') return cellValue === parseFloat(rawValue);
      return cellStr.toLowerCase() === rawValue.toLowerCase();
    }
    if (op === '!=') {
      if (typeof cellValue === 'number') return cellValue !== parseFloat(rawValue);
      return cellStr.toLowerCase() !== rawValue.toLowerCase();
    }
    return false;
  }

  function runFilterCountAnalysis() {
    const conditionRows = [...filterConditions.querySelectorAll('.filter-condition')];
    const conditions = conditionRows.map((row) => ({
      col: row.querySelector('.filter-col').value,
      op: row.querySelector('.filter-op').value,
      val: row.querySelector('.filter-val').value
    }));

    if (conditions.length === 0) {
      appendResult('Count with Filters', '<p>Add at least one filter condition.</p>');
      return;
    }

    const matchCount = state.rows.filter((row) =>
      conditions.every((c) => matchesCondition(row, c.col, c.op, c.val))
    ).length;

    const description = conditions.map((c) => `${c.col} ${c.op} "${c.val}"`).join(' AND ');
    const rows = [
      ['Matching rows', String(matchCount)],
      ['Total rows', String(state.rows.length)],
      ['Conditions', description]
    ];
    appendResult('Count with Filters', buildKeyValueTable(rows));
  }

  function buildKeyValueTable(pairs) {
    const rowsHtml = pairs
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join('');
    return `<table class="kv-table">${rowsHtml}</table>`;
  }

  function appendResult(title, html) {
    const card = document.createElement('div');
    card.className = 'result-item';
    card.innerHTML = `<h3>${escapeHtml(title)}</h3>${html}`;
    resultsOutput.prepend(card);
    resultsCard.hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
