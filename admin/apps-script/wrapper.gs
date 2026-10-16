// ---------------------------------------------------------------------------
// Apps Script glue. Container-bound: create the script from the admin's Google Sheet
// (Extensions → Apps Script), so SpreadsheetApp.getActiveSpreadsheet() is the sheet.
// Everything above this line is src/admin/sheetCore.js (pure, unit-tested).
// ---------------------------------------------------------------------------

const CODES_SHEET = 'Codes';
const UNITS_SHEET = 'Units';
const DASH_SHEET = 'Dashboard';
const CHECKBOX_ROWS = 5000; // pre-formatted data rows on the Codes sheet

/** Opening the web-app URL in a browser answers "ok" (a quick deployment check). */
function doGet() {
  return ContentService.createTextOutput('ok');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let result;
  if (!lock.tryLock(25000)) {
    result = { ok: false, error: 'busy' };
  } else {
    try {
      const body = e && e.postData ? e.postData.contents : '';
      result = handleUpload(body, makeAdapter_(SpreadsheetApp.getActiveSpreadsheet()), Date.now());
    } catch (err) {
      console.error(err);
      result = { ok: false, error: 'server' };
    } finally {
      lock.releaseLock();
    }
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function makeAdapter_(ss) {
  const codes = ss.getSheetByName(CODES_SHEET) || ss.insertSheet(CODES_SHEET);
  const units = ss.getSheetByName(UNITS_SHEET);

  function headers_() {
    const n = codes.getLastColumn();
    return n === 0 ? [] : codes.getRange(1, 1, 1, n).getValues()[0].map(String);
  }

  // Not getLastRow(): pre-inserted admin checkboxes make every row "used".
  function nextFreeRow_(h) {
    const c = h.indexOf('record_id') + 1;
    if (!c) return 2;
    const n = Math.max(1, codes.getMaxRows() - 1);
    const vals = codes.getRange(2, c, n, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i][0] !== '') return i + 3;
    return 2;
  }

  return {
    readHeaders: headers_,
    addHeaders: function (names) {
      codes.getRange(1, headers_().length + 1, 1, names.length).setValues([names]);
    },
    findRow: function (name, value) {
      const c = headers_().indexOf(name) + 1;
      if (!c) return null;
      const n = Math.max(1, codes.getMaxRows() - 1);
      const vals = codes.getRange(2, c, n, 1).getValues();
      for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === value) return i + 2;
      return null;
    },
    appendRow: function (cells) {
      const h = headers_();
      const row = nextFreeRow_(h);
      if (row > codes.getMaxRows()) codes.insertRowsAfter(codes.getMaxRows(), 100);
      const range = codes.getRange(row, 1, 1, h.length);
      const current = range.getValues()[0];
      range.setValues([
        h.map(function (n, i) {
          return Object.prototype.hasOwnProperty.call(cells, n) ? cells[n] : current[i]; // admin cells keep their value
        }),
      ]);
    },
    updateCells: function (row, cells) {
      const h = headers_();
      Object.keys(cells).forEach(function (n) {
        const c = h.indexOf(n) + 1;
        if (c) codes.getRange(row, c).setValue(cells[n]);
      });
    },
    readUnits: function () {
      if (!units || units.getLastRow() < 2) return [];
      const v = units.getDataRange().getValues();
      const hd = v[0].map(String);
      const k = hd.indexOf('enrollment_key');
      const u = hd.indexOf('unit_name');
      const a = hd.indexOf('active');
      return v.slice(1).map(function (r) {
        return { key: k < 0 ? '' : r[k], unit: u < 0 ? '' : r[u], active: a < 0 ? false : r[a] };
      });
    },
  };
}

function letter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Run once from the editor (Run → setupAdminSheet): creates the Codes / Units / Dashboard tabs,
 * headers, dropdowns, checkboxes and the Dashboard formulas. Safe to re-run: it never clears data.
 */
function setupAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const codes = ss.getSheetByName(CODES_SHEET) || ss.insertSheet(CODES_SHEET);
  const units = ss.getSheetByName(UNITS_SHEET) || ss.insertSheet(UNITS_SHEET);
  const dash = ss.getSheetByName(DASH_SHEET) || ss.insertSheet(DASH_SHEET);
  const last = CHECKBOX_ROWS + 1;

  // --- Codes ---
  const all = DEVICE_COLUMNS.concat(ADMIN_COLUMNS);
  if (codes.getLastColumn() === 0) codes.getRange(1, 1, 1, all.length).setValues([all]);
  codes.setFrozenRows(1);
  if (codes.getMaxRows() < last) codes.insertRowsAfter(codes.getMaxRows(), last - codes.getMaxRows());
  const header = codes.getRange(1, 1, 1, codes.getLastColumn()).getValues()[0].map(String);
  const col = function (name) {
    return header.indexOf(name) + 1;
  };
  ['record_id', 'device_id', 'start_iso', 'start_month'].forEach(function (n) {
    if (col(n)) codes.getRange(2, col(n), CHECKBOX_ROWS, 1).setNumberFormat('@'); // keep as text: no date parsing
  });
  const list = function (values) {
    return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  };
  if (col('issue_category')) codes.getRange(2, col('issue_category'), CHECKBOX_ROWS, 1).setDataValidation(list(ISSUE_CATEGORIES));
  if (col('action_status')) codes.getRange(2, col('action_status'), CHECKBOX_ROWS, 1).setDataValidation(list(ACTION_STATUSES));
  ['reviewed', 'exclude'].forEach(function (n) {
    if (col(n)) codes.getRange(2, col(n), CHECKBOX_ROWS, 1).insertCheckboxes();
  });

  // --- Units ---
  if (units.getLastColumn() === 0) units.getRange(1, 1, 1, 3).setValues([['enrollment_key', 'unit_name', 'active']]);
  units.setFrozenRows(1);
  units.getRange(2, 3, 200, 1).insertCheckboxes();

  // --- Dashboard (formulas; verify in Sheets after the first real upload) ---
  const R = function (name) {
    const c = letter_(col(name));
    return 'Codes!$' + c + '$2:$' + c + '$' + last;
  };
  const real =
    R('training') + '<>TRUE,' + R('void') + '<>TRUE,' + R('exclude') + '<>TRUE,' + R('outcome') + '<>"incomplete"';
  const grp = R('unit') + '=$A5,' + R('start_month') + '=$B5,' + real;
  const med = function (name) {
    return '=IF($A5="","",IFERROR(MEDIAN(FILTER(' + R(name) + '/1000,' + grp + ',' + R(name) + '<>"")),"—"))';
  };
  dash.getRange('A1').setValue('ResusCode — admin dashboard');
  dash.getRange('A2').setValue(
    'Training, void and "exclude" rows and incomplete codes are left out. ROSC = any ROSC (rosc or rosc_then_terminated). Times in seconds from activation, as logged.',
  );
  dash.getRange('A4:H4').setValues([['Unit', 'Month', 'Codes', 'Any ROSC', 'ROSC rate', 'Median first epi (s)', 'Median first shock (s)', 'Median arrest (s)']]);
  dash.getRange('A5').setFormula(
    '=IFERROR(SORT(UNIQUE(FILTER({' + R('unit') + ',' + R('start_month') + '},' + R('unit') + '<>"",' + real + '))),"")',
  );
  const rows = 200;
  const f = [];
  for (let i = 0; i < rows; i++) {
    const r = i + 5;
    const g = grp.replace(/\$A5/g, '$A' + r).replace(/\$B5/g, '$B' + r);
    const m = function (name) {
      return med(name).replace(/\$A5/g, '$A' + r).replace(/\$B5/g, '$B' + r);
    };
    f.push([
      '=IF($A' + r + '="","",IFERROR(ROWS(FILTER(' + R('record_id') + ',' + g + ')),0))',
      '=IF($A' + r + '="","",IFERROR(ROWS(FILTER(' + R('record_id') + ',' + g + ',((' + R('outcome') + '="rosc")+(' + R('outcome') + '="rosc_then_terminated"))>0)),0))',
      '=IF($A' + r + '="","",IF(C' + r + '=0,"",D' + r + '/C' + r + '))',
      m('first_epi_ms'),
      m('first_shock_ms'),
      m('arrest_ms'),
    ]);
  }
  dash.getRange(5, 3, rows, 6).setFormulas(f);
  dash.getRange(5, 5, rows, 1).setNumberFormat('0%');

  // issue categories (reviewed codes only)
  dash.getRange('J4:K4').setValues([['Issue category', 'Codes']]);
  dash.getRange(5, 10, ISSUE_CATEGORIES.length, 1).setValues(ISSUE_CATEGORIES.map(function (c) { return [c]; }));
  const issue = [];
  for (let i = 0; i < ISSUE_CATEGORIES.length; i++) {
    issue.push([
      '=COUNTIFS(' + R('issue_category') + ',$J' + (5 + i) + ',' + R('exclude') + ',"<>TRUE",' + R('training') + ',"<>TRUE",' + R('void') + ',"<>TRUE")',
    ]);
  }
  dash.getRange(5, 11, ISSUE_CATEGORIES.length, 1).setFormulas(issue);

  // last upload per unit (shows silent units, e.g. when replies are unreadable)
  dash.getRange('M4:N4').setValues([['Unit', 'Last upload']]);
  dash.getRange('M5').setFormula('=IFERROR(SORT(UNIQUE(FILTER(' + R('unit') + ',' + R('unit') + '<>""))),"")');
  const lastUp = [];
  for (let i = 0; i < 50; i++) {
    const r = i + 5;
    lastUp.push(['=IF($M' + r + '="","",IFERROR(INDEX(SORT(FILTER(' + R('last_upload_iso') + ',' + R('unit') + '=$M' + r + '),1,FALSE),1),""))']);
  }
  dash.getRange(5, 14, 50, 1).setFormulas(lastUp);
}
