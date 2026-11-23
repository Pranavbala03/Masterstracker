/**
 * Masters tracker: Google Sheet as the database.
 * Paste this into the Sheet: Extensions > Apps Script. Set TOKEN, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into the tracker's Settings together with the same token.
 */
const TOKEN = 'CHANGE-ME-to-a-long-random-string';
// If this script is standalone (not opened from the sheet), paste the sheet's ID here (the long part of its URL). Leave empty when bound to the sheet.
const SHEET_ID = '';
function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActive(); }

// Each "table" is a header row plus the rows below it, read until column A is empty.
const CONFIG = {
  Programmes:   { sheet: 'Programmes',   headerRow: 1 },
  Scholarships: { sheet: 'Scholarships', headerRow: 1 },
  Timeline:     { sheet: 'Timeline',     headerRow: 1 },
  Documents:    { sheet: 'Documents',    headerRow: 1 },
  Cost:         { sheet: 'Cost',         headerRow: 11 },
  Rates:        { sheet: 'Cost',         headerRow: 4 },
  Profile:      { sheet: 'Profile',      headerRow: 3 }
};

// Columns the app may edit on existing rows. Everything else (including formulas) is left alone.
const WRITABLE = {
  Programmes:   ['Status', 'Next action', 'My notes'],
  Scholarships: ['Status', 'My notes'],
  Documents:    ['Status', 'Notes'],
  Cost:         ['Tuition per year (local)', 'Years', 'Living cost per year (INR)', 'Scholarship total (INR)']
};
const APPENDABLE = ['Programmes', 'Scholarships'];

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readTable_(name) {
  const c = CONFIG[name];
  const sh = ss_().getSheetByName(c.sheet);
  if (!sh) throw new Error('Missing sheet: ' + c.sheet);
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(c.headerRow, 1, 1, lastCol).getValues()[0];
  const n = sh.getLastRow() - c.headerRow;
  const rows = [];
  if (n > 0) {
    const vals = sh.getRange(c.headerRow + 1, 1, n, lastCol).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][0] === '' || vals[i][0] === null) break;
      const o = { _row: c.headerRow + 1 + i };
      headers.forEach(function (h, j) { if (h !== '') o[h] = vals[i][j]; });
      rows.push(o);
    }
  }
  return { headers: headers.filter(function (h) { return h !== ''; }), rows: rows };
}

// One-off: fill an empty spreadsheet with the starting data (sent from the tracker's Settings > Push starting data).
// Refuses to run if Programmes already has rows, unless body.force is true.
function seed_(body) {
  const ss = ss_();
  const existing = ss.getSheetByName('Programmes');
  if (existing && existing.getLastRow() > 1 && !body.force) return out_({ ok: false, error: 'Programmes already has data' });
  Object.keys(body.data).forEach(function (name) {
    const cfg = CONFIG[name]; if (!cfg) return;
    const t = body.data[name];
    const s = ss.getSheetByName(cfg.sheet) || ss.insertSheet(cfg.sheet);
    s.getRange(cfg.headerRow, 1, 1, t.headers.length).setValues([t.headers]).setFontWeight('bold');
    t.rows.forEach(function (r) {
      s.getRange(r._row, 1, 1, t.headers.length).setValues([t.headers.map(function (h) { const v = r[h]; return v === null || v === undefined ? '' : v; })]);
    });
    s.setFrozenRows(cfg.headerRow);
  });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  SpreadsheetApp.flush();
  return out_({ ok: true });
}

function doGet(e) {
  try {
    if (!e.parameter || e.parameter.token !== TOKEN) return out_({ ok: false, error: 'bad token' });
    const data = {};
    Object.keys(CONFIG).forEach(function (k) { data[k] = readTable_(k); });
    return out_({ ok: true, data: data, at: new Date().toISOString() });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return out_({ ok: false, error: 'bad token' });
    if (body.action === 'seed') return seed_(body);
    const c = CONFIG[body.table];
    if (!c) return out_({ ok: false, error: 'unknown table' });
    const sh = ss_().getSheetByName(c.sheet);
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(c.headerRow, 1, 1, lastCol).getValues()[0];

    if (body.action === 'update') {
      const allowed = WRITABLE[body.table] || [];
      if (body.row <= c.headerRow) return out_({ ok: false, error: 'bad row' });
      Object.keys(body.values || {}).forEach(function (h) {
        if (allowed.indexOf(h) === -1) return;
        const col = headers.indexOf(h) + 1;
        if (col < 1) return;
        const cell = sh.getRange(body.row, col);
        if (cell.getFormula()) return;
        cell.setValue(body.values[h]);
      });
      SpreadsheetApp.flush();
      return out_({ ok: true });
    }

    if (body.action === 'append') {
      if (APPENDABLE.indexOf(body.table) === -1) return out_({ ok: false, error: 'not appendable' });
      const t = readTable_(body.table);
      const lastRow = c.headerRow + t.rows.length;
      const newRow = lastRow + 1;
      sh.getRange(lastRow, 1, 1, lastCol).copyTo(sh.getRange(newRow, 1, 1, lastCol)); // keeps formulas and formatting
      headers.forEach(function (h, j) {
        const cell = sh.getRange(newRow, j + 1);
        if (cell.getFormula()) return;
        cell.setValue(h !== '' && body.values && body.values[h] !== undefined ? body.values[h] : '');
      });
      SpreadsheetApp.flush();
      return out_({ ok: true, row: newRow });
    }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
