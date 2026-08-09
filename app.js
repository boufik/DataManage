(function () {
  'use strict';

  const state = {
    columns: [],
    rows: [],
    types: {}, // colName -> 'numeric' | 'text'
    previewSort: { column: null, clickCount: 0 } // clickCount: 1=desc, 2=asc, 3=original order
  };

  let conditionCounter = 0;
  let resultCounter = 0;
  let toastTimeout = null;

  const PREVIEW_ROW_LIMIT = 50;
  const UNIQUE_VALUE_DISPLAY_LIMIT = 50;

  const uploadScreen = document.getElementById('uploadScreen');
  const uploadDropzone = document.getElementById('uploadDropzone');
  const fileInput = document.getElementById('csvFile');
  const uploadError = document.getElementById('uploadError');

  const dataScreen = document.getElementById('dataScreen');
  const uploadSuccess = document.getElementById('uploadSuccess');
  const changeFileBtn = document.getElementById('changeFileBtn');

  const previewCard = document.getElementById('previewCard');
  const previewInfo = document.getElementById('previewInfo');
  const sortStatus = document.getElementById('sortStatus');
  const previewTable = document.getElementById('previewTable');

  const analysisCard = document.getElementById('analysisCard');
  const columnFunctionSelect = document.getElementById('columnFunctionSelect');
  const columnSelect = document.getElementById('columnSelect');
  const runColumnStatsBtn = document.getElementById('runColumnStatsBtn');

  const rowIndexInput = document.getElementById('rowIndexInput');
  const runRowStatsBtn = document.getElementById('runRowStatsBtn');

  const sqlFunctionSelect = document.getElementById('sqlFunctionSelect');
  const sqlInlineRow = document.getElementById('sqlInlineRow');
  const selectControl = document.getElementById('selectControl');
  const selectColumnsContainer = document.getElementById('selectColumns');
  const whereControl = document.getElementById('whereControl');
  const filterConditions = document.getElementById('filterConditions');
  const addConditionBtn = document.getElementById('addConditionBtn');
  const orderByControl = document.getElementById('orderByControl');
  const orderBySelect = document.getElementById('orderBySelect');
  const orderDirSelect = document.getElementById('orderDirSelect');
  const limitControl = document.getElementById('limitControl');
  const limitInput = document.getElementById('limitInput');
  const runSqlBtn = document.getElementById('runSqlBtn');

  const SQL_FUNCTION_FIELDS = {
    filterCount: ['where'],
    query: ['select', 'where', 'orderBy', 'limit']
  };

  const resultsCard = document.getElementById('resultsCard');
  const resultsOutput = document.getElementById('resultsOutput');
  const clearResultsBtn = document.getElementById('clearResultsBtn');

  const toastEl = document.getElementById('toast');

  fileInput.addEventListener('change', handleFileSelect);
  uploadDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadDropzone.classList.add('dragover');
  });
  uploadDropzone.addEventListener('dragleave', () => {
    uploadDropzone.classList.remove('dragover');
  });
  uploadDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadDropzone.classList.remove('dragover');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    processFile(file);
  });
  changeFileBtn.addEventListener('click', showUploadScreen);
  sqlFunctionSelect.addEventListener('change', updateSqlControlVisibility);
  addConditionBtn.addEventListener('click', () => addFilterCondition());
  runColumnStatsBtn.addEventListener('click', runColumnStats);
  runRowStatsBtn.addEventListener('click', runRowStats);
  runSqlBtn.addEventListener('click', runSqlOperation);
  clearResultsBtn.addEventListener('click', () => {
    resultsOutput.innerHTML = '';
    resultsCard.hidden = true;
  });

  function handleFileSelect(e) {
    processFile(e.target.files[0]);
  }

  function processFile(file) {
    if (!file) return;

    if (!/\.csv$/i.test(file.name)) {
      showUploadError(`"${file.name}" is not a CSV file.`);
      fileInput.value = '';
      return;
    }

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          showUploadError('Could not find any columns in this file.');
          return;
        }
        const { columns, rows } = ensureIdColumn(results.meta.fields, results.data);
        loadDataFrame(columns, rows);
        showDataScreen(`"${file.name}" loaded successfully.`);
      },
      error: (err) => {
        showUploadError(`Failed to parse file: ${err.message}`);
      }
    });
  }

  function showUploadError(message) {
    uploadError.textContent = message;
    uploadError.hidden = false;
  }

  function showDataScreen(successMessage) {
    uploadError.hidden = true;
    uploadSuccess.textContent = successMessage;
    uploadScreen.hidden = true;
    dataScreen.hidden = false;
  }

  function showUploadScreen() {
    dataScreen.hidden = true;
    uploadScreen.hidden = false;
    uploadError.hidden = true;
    fileInput.value = '';
  }

  function ensureIdColumn(columns, rows) {
    const hasId = columns.some((c) => String(c).trim().toLowerCase() === 'id');
    if (hasId) return { columns, rows };

    const columnsWithId = ['ID', ...columns];
    const rowsWithId = rows.map((row, i) => ({ ID: i + 1, ...row }));
    return { columns: columnsWithId, rows: rowsWithId };
  }

  function loadDataFrame(columns, rows) {
    state.columns = columns;
    state.rows = rows;
    state.types = {};
    state.previewSort = { column: null, clickCount: 0 };
    columns.forEach((col) => {
      state.types[col] = inferColumnType(col);
    });

    renderPreview();
    populateColumnSelects();
    analysisCard.hidden = false;
    updateSqlControlVisibility();
  }

  function inferColumnType(col) {
    const values = state.rows
      .map((r) => r[col])
      .filter((v) => v !== null && v !== undefined && v !== '');
    if (values.length === 0) return 'text';
    const numericCount = values.filter((v) => typeof v === 'number' && !Number.isNaN(v)).length;
    return numericCount / values.length >= 0.9 ? 'numeric' : 'text';
  }

  function getPreviewRows() {
    const { column, clickCount } = state.previewSort;
    if (!column || clickCount === 3) return state.rows;
    const dirMultiplier = clickCount === 1 ? -1 : 1; // 1st click = desc, 2nd click = asc
    return [...state.rows].sort((a, b) => compareValues(a[column], b[column]) * dirMultiplier);
  }

  function handlePreviewHeaderClick(col) {
    if (state.previewSort.column !== col) {
      state.previewSort.column = col;
      state.previewSort.clickCount = 1;
    } else {
      state.previewSort.clickCount = (state.previewSort.clickCount % 3) + 1;
    }
    renderPreview();
  }

  function updateSortStatus() {
    const { column, clickCount } = state.previewSort;
    if (column && clickCount === 1) {
      sortStatus.textContent = `Sorted in descending order based on "${column}".`;
    } else if (column && clickCount === 2) {
      sortStatus.textContent = `Sorted in ascending order based on "${column}".`;
    } else {
      sortStatus.textContent = '';
    }
  }

  function renderPreview() {
    const totalRows = state.rows.length;
    const totalCols = state.columns.length;
    const shown = Math.min(PREVIEW_ROW_LIMIT, totalRows);
    previewInfo.textContent = `Showing ${shown} of ${totalRows} rows, ${totalCols} columns.`;
    updateSortStatus();

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    state.columns.forEach((col) => {
      const th = document.createElement('th');
      th.className = 'sortable-th';
      const isSorted = state.previewSort.column === col && state.previewSort.clickCount !== 3;
      let icon = '⇅';
      if (isSorted) {
        icon = state.previewSort.clickCount === 1 ? '▼' : '▲';
        th.classList.add('sort-active');
      }
      th.innerHTML = `${escapeHtml(col)}<span class="sort-icon">${icon}</span>`;
      th.addEventListener('click', () => handlePreviewHeaderClick(col));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    getPreviewRows().slice(0, PREVIEW_ROW_LIMIT).forEach((row) => {
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
    orderBySelect.innerHTML = '<option value="">(none)</option>';
    selectColumnsContainer.innerHTML = '';

    state.columns.forEach((col) => {
      const opt = document.createElement('option');
      opt.value = col;
      opt.textContent = `${col} (${state.types[col]})`;
      columnSelect.appendChild(opt);

      const orderOpt = document.createElement('option');
      orderOpt.value = col;
      orderOpt.textContent = col;
      orderBySelect.appendChild(orderOpt);

      const checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'checkbox-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = col;
      checkbox.checked = true;
      checkboxLabel.appendChild(checkbox);
      checkboxLabel.appendChild(document.createTextNode(col));
      selectColumnsContainer.appendChild(checkboxLabel);
    });

    filterConditions.innerHTML = '';
    conditionCounter = 0;
    addFilterCondition();
  }

  function updateSqlControlVisibility() {
    const fn = sqlFunctionSelect.value;
    const activeFields = SQL_FUNCTION_FIELDS[fn] || [];
    selectControl.hidden = !activeFields.includes('select');
    whereControl.hidden = !activeFields.includes('where');
    orderByControl.hidden = !activeFields.includes('orderBy');
    limitControl.hidden = !activeFields.includes('limit');
    sqlInlineRow.classList.toggle(
      'single-where',
      !activeFields.includes('orderBy') && !activeFields.includes('limit')
    );
  }

  function renumberConditions() {
    [...filterConditions.querySelectorAll('.filter-condition')].forEach((row, i) => {
      const label = row.querySelector('.condition-label');
      if (label) label.textContent = `Condition ${i + 1}:`;
    });
  }

  function addFilterCondition() {
    conditionCounter += 1;

    const row = document.createElement('div');
    row.className = 'filter-condition';
    row.dataset.id = String(conditionCounter);

    const label = document.createElement('span');
    label.className = 'condition-label';
    row.appendChild(label);

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
    removeBtn.addEventListener('click', () => {
      row.remove();
      renumberConditions();
    });

    row.appendChild(colSelect);
    row.appendChild(opSelect);
    row.appendChild(valInput);
    row.appendChild(removeBtn);
    filterConditions.appendChild(row);
    renumberConditions();
  }

  function runColumnStats() {
    const fn = columnFunctionSelect.value;
    if (state.columns.length === 0) return;

    switch (fn) {
      case 'mode': runModeAnalysis(); break;
      case 'mean': runNumericAggregate('mean', 'Mean'); break;
      case 'median': runNumericAggregate('median', 'Median'); break;
      case 'std': runNumericAggregate('std', 'Standard Deviation'); break;
      case 'sum': runNumericAggregate('sum', 'Sum'); break;
      case 'unique': runUniqueAnalysis(); break;
      default: break;
    }
  }

  function runSqlOperation() {
    const fn = sqlFunctionSelect.value;
    if (state.columns.length === 0) return;

    switch (fn) {
      case 'filterCount': runFilterCountAnalysis(); break;
      case 'query': runQueryAnalysis(); break;
      default: break;
    }
  }

  function getWhereConditions() {
    return [...filterConditions.querySelectorAll('.filter-condition')].map((row) => ({
      col: row.querySelector('.filter-col').value,
      op: row.querySelector('.filter-op').value,
      val: row.querySelector('.filter-val').value
    }));
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
    else if (kind === 'sum') result = values.reduce((a, b) => a + b, 0);
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

  function formatNumber(n) {
    if (!Number.isFinite(n)) return 'N/A';
    return Number(n.toFixed(4)).toString();
  }

  function runRowStats() {
    const totalRows = state.rows.length;
    if (totalRows === 0) return;

    const rawIndex = rowIndexInput.value.trim();
    const rowNumber = parseInt(rawIndex, 10);
    if (rawIndex === '' || Number.isNaN(rowNumber) || rowNumber < 1 || rowNumber > totalRows) {
      appendResult('Stats across row', `<p>Enter a row number between 1 and ${totalRows}.</p>`);
      return;
    }

    const row = state.rows[rowNumber - 1];
    const numericCols = state.columns.filter((col) => state.types[col] === 'numeric');

    if (numericCols.length === 0) {
      appendResult(`Row #${rowNumber} — Stats across row`, '<p>No numeric columns available to compare.</p>');
      return;
    }

    const columnStats = numericCols.map((col) => {
      const cellValue = row[col];
      const thisValue = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue);
      const allValues = toNumericValues(col);

      if (Number.isNaN(thisValue) || allValues.length === 0) {
        return { col, value: 'N/A', avg: 'N/A', percentile: 'N/A', percentileValue: null, assessment: 'No numeric value in this row' };
      }

      const avg = mean(allValues);
      let assessment = 'Equal to average';
      if (thisValue > avg) assessment = 'Above average (higher)';
      else if (thisValue < avg) assessment = 'Below average (lower)';

      let percentile = 'N/A';
      let percentileValue = null;
      if (allValues.length > 1) {
        const countLess = allValues.filter((v) => v < thisValue).length;
        const countEqual = allValues.filter((v) => v === thisValue).length;
        percentileValue = ((countLess + 0.5 * countEqual) / allValues.length) * 100;
        percentile = `${percentileValue.toFixed(1)}th`;
      }

      return { col, value: formatNumber(thisValue), avg: formatNumber(avg), percentile, percentileValue, assessment };
    });

    const rankable = columnStats.filter((c) => typeof c.percentileValue === 'number');
    let summaryHtml = '';
    if (rankable.length > 0) {
      const bestCols = [...rankable].sort((a, b) => b.percentileValue - a.percentileValue).slice(0, 3);
      const worstCols = [...rankable].sort((a, b) => a.percentileValue - b.percentileValue).slice(0, 3);
      summaryHtml = `<p><strong>Relatively best columns:</strong> ${bestCols.map((c) => `${escapeHtml(c.col)} (${c.percentile} percentile)`).join(', ')}</p>` +
        `<p><strong>Relatively worst columns:</strong> ${worstCols.map((c) => `${escapeHtml(c.col)} (${c.percentile} percentile)`).join(', ')}</p>`;
    }

    const tableRows = columnStats.map((c) => `<tr><td>${escapeHtml(c.col)}</td><td>${escapeHtml(String(c.value))}</td><td>${escapeHtml(String(c.avg))}</td><td>${escapeHtml(c.percentile)}</td><td>${escapeHtml(c.assessment)}</td></tr>`).join('');
    const tableHtml = `<div class="table-scroll"><table><thead><tr><th>Column</th><th>Value</th><th>Average</th><th>Percentile</th><th>Assessment</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;

    appendResult(`Row #${rowNumber} — Stats across row`, summaryHtml + tableHtml);
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
    const conditions = getWhereConditions();

    const matchCount = state.rows.filter((row) =>
      conditions.every((c) => matchesCondition(row, c.col, c.op, c.val))
    ).length;

    const description = conditions.length
      ? conditions.map((c) => `${c.col} ${c.op} "${c.val}"`).join(' AND ')
      : '(no filters — counting all rows)';
    const rows = [
      ['Matching rows', String(matchCount)],
      ['Total rows', String(state.rows.length)],
      ['Conditions', description]
    ];
    appendResult('Count with Filters', buildKeyValueTable(rows));
  }

  function compareValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    const aStr = a === null || a === undefined ? '' : String(a);
    const bStr = b === null || b === undefined ? '' : String(b);
    return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
  }

  function formatSqlValue(rawValue) {
    const num = parseFloat(rawValue);
    return !Number.isNaN(num) && String(num) === rawValue.trim() ? num : `"${rawValue}"`;
  }

  function buildSqlString(cols, conditions, orderCol, orderDir, limitRaw) {
    let sql = `SELECT ${cols.length ? cols.join(', ') : '*'} FROM table`;
    if (conditions.length) {
      const opText = { '=': '==' };
      const whereParts = conditions.map(
        (c) => `${c.col} ${opText[c.op] || c.op} ${formatSqlValue(c.val)}`
      );
      sql += ` WHERE ${whereParts.join(' AND ')}`;
    }
    if (orderCol) sql += ` ORDER BY ${orderCol} ${orderDir}`;
    if (limitRaw !== '') sql += ` LIMIT ${limitRaw}`;
    return `${sql};`;
  }

  function runQueryAnalysis() {
    const selectedCols = [...selectColumnsContainer.querySelectorAll('input[type="checkbox"]:checked')]
      .map((cb) => cb.value);

    if (selectedCols.length === 0) {
      appendResult('SQL Query', '<p>Select at least one column in SELECT.</p>');
      return;
    }

    const conditions = getWhereConditions();
    const orderCol = orderBySelect.value;
    const orderDir = orderDirSelect.value;
    const limitRaw = limitInput.value.trim();

    let resultRows = state.rows.filter((row) =>
      conditions.every((c) => matchesCondition(row, c.col, c.op, c.val))
    );

    if (orderCol) {
      const dirMultiplier = orderDir === 'DESC' ? -1 : 1;
      resultRows = [...resultRows].sort(
        (a, b) => compareValues(a[orderCol], b[orderCol]) * dirMultiplier
      );
    }

    const totalMatched = resultRows.length;

    if (limitRaw !== '') {
      const n = parseInt(limitRaw, 10);
      if (!Number.isNaN(n) && n >= 0) resultRows = resultRows.slice(0, n);
    }

    const projectedRows = resultRows.map((row) => {
      const obj = {};
      selectedCols.forEach((col) => { obj[col] = row[col]; });
      return obj;
    });

    const sqlText = buildSqlString(selectedCols, conditions, orderCol, orderDir, limitRaw);
    appendQueryResult(sqlText, selectedCols, projectedRows, totalMatched);
  }

  function appendQueryResult(sqlText, cols, rows, totalMatched) {
    createResultCard('SQL Query', (body) => {
      const sqlEl = document.createElement('pre');
      sqlEl.className = 'sql-text';
      sqlEl.textContent = sqlText;
      body.appendChild(sqlEl);

      const info = document.createElement('p');
      info.className = 'status-text';
      info.textContent = `${rows.length} row(s) returned (${totalMatched} matched before LIMIT).`;
      body.appendChild(info);

      const scrollWrap = document.createElement('div');
      scrollWrap.className = 'table-scroll';
      const table = document.createElement('table');

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      cols.forEach((col) => {
        const th = document.createElement('th');
        th.textContent = col;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);

      const tbody = document.createElement('tbody');
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        cols.forEach((col) => {
          const td = document.createElement('td');
          const val = row[col];
          td.textContent = val === null || val === undefined ? '' : String(val);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      scrollWrap.appendChild(table);
      body.appendChild(scrollWrap);
    });
  }

  function buildKeyValueTable(pairs) {
    const rowsHtml = pairs
      .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
      .join('');
    return `<table class="kv-table">${rowsHtml}</table>`;
  }

  function createResultCard(operationLabel, buildBody) {
    resultCounter += 1;

    const card = document.createElement('div');
    card.className = 'result-item';

    const header = document.createElement('div');
    header.className = 'result-item-header';

    const heading = document.createElement('h3');
    heading.textContent = `Result ${resultCounter} — ${operationLabel}`;
    header.appendChild(heading);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'result-delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete this result');
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      const confirmed = window.confirm(
        "Delete this result? This only removes it from your current browser view — if you want it back, you'll need to run the same operation again."
      );
      if (confirmed) card.remove();
    });
    header.appendChild(deleteBtn);

    card.appendChild(header);

    const body = document.createElement('div');
    buildBody(body);
    card.appendChild(body);

    resultsOutput.prepend(card);
    resultsCard.hidden = false;
    showToast(`Result ${resultCounter} added to the results section at the bottom of the page.`);
  }

  function appendResult(title, html) {
    createResultCard(title, (body) => {
      body.innerHTML = html;
    });
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 4000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
