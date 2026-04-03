// ============================================================
// UTTH ED-Extemp — Google Apps Script Backend
// Sheet ID: 1aICDq9Ag0AECN2nIuJAnlmXx8pQvGcuLHOVI4T0-Kws
//
// วิธี Deploy:
//   1. เปิด https://script.google.com → สร้าง Project ใหม่
//   2. วางโค้ดทั้งหมดนี้แทนที่ Code.gs
//   3. Deploy > New deployment > Web App
//   4. Execute as: Me | Who has access: Anyone
//   5. Copy Web App URL ไปใส่ใน .env ที่ VITE_GAS_URL
//
//   *** Sheets จะถูกสร้างอัตโนมัติเมื่อมี request แรกเข้ามา ***
// ============================================================

const SHEET_ID = '1aICDq9Ag0AECN2nIuJAnlmXx8pQvGcuLHOVI4T0-Kws';
const PROP_KEY = 'sheets_initialized';   // PropertiesService cache key

const HEADERS = {
  users:    ['id','name','pha_id','password','role','active','must_change_password','profile_image','created_at'],
  formulas: ['id','code','name','short_name','description','concentration','expiry_days','category','price','storage','ingredients','method','short_prep','package_size','created_at'],
  preps:    ['id','formula_id','formula_name','concentration','mode','target','hn','patient_name','dest_room','lot_no','date','expiry_date','qty','note','prepared_by','user_pha_id','location','created_at'],
};

// ---- Response helper ----
function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------
// ensureSheets_()
//   - ตรวจ PropertiesService ก่อน (เร็ว, ไม่ต้องเปิด Spreadsheet)
//   - ถ้ายังไม่เคย init หรือ sheet หายไป → สร้างใหม่
//   - บันทึก flag ลง PropertiesService เพื่อข้าม check ครั้งต่อไป
// ----------------------------------------------------------------
function ensureSheets_(ss) {
  const props = PropertiesService.getScriptProperties();

  // ถ้าเคย init แล้วและ sheet ยังอยู่ครบ → ข้ามทันที
  if (props.getProperty(PROP_KEY) === 'true') {
    const allExist = Object.keys(HEADERS).every(function(name) {
      return ss.getSheetByName(name) !== null;
    });
    if (allExist) return;
  }

  // สร้าง / ซ่อม sheet ที่หายไป
  var created = [];
  for (var name in HEADERS) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(HEADERS[name]);
      // ตั้ง header row ให้ดูง่าย
      sheet.getRange(1, 1, 1, HEADERS[name].length)
        .setFontWeight('bold')
        .setBackground('#4A90D9')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      created.push(name);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS[name]);
      sheet.getRange(1, 1, 1, HEADERS[name].length)
        .setFontWeight('bold')
        .setBackground('#4A90D9')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      created.push(name + ' (header only)');
    }
  }

  // บันทึก flag
  props.setProperty(PROP_KEY, 'true');
  if (created.length > 0) {
    Logger.log('Created sheets: ' + created.join(', '));
  }
}

// ---- Reset flag (ใช้เมื่อต้องการ re-init) ----
function resetInitFlag() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_KEY);
}

// ---- Helpers ----
function getSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function getAll_(ss, sheetName) {
  const sheet = getSheet_(ss, sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = (row[i] === '' || row[i] === null || row[i] === undefined) ? null : row[i];
    });
    return obj;
  });
}

function getNextId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(function(r) { return Number(r[0]); })
    .filter(function(n) { return n > 0; });
  return ids.length ? Math.max.apply(null, ids) + 1 : 1;
}

function create_(ss, sheetName, data) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = getSheet_(ss, sheetName);
    const headers = HEADERS[sheetName];
    const id = getNextId_(sheet);
    const now = new Date().toISOString();
    const rowData = Object.assign({ id: id, created_at: now }, data);
    const row = headers.map(function(h) {
      return (rowData[h] !== undefined && rowData[h] !== null) ? rowData[h] : '';
    });
    sheet.appendRow(row);
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function update_(ss, sheetName, id, data) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = getSheet_(ss, sheetName);
    const headers = HEADERS[sheetName];
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { error: 'Not found' };
    const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idCol.length; i++) {
      if (Number(idCol[i][0]) === Number(id)) {
        const rowNum = i + 2;
        for (const key in data) {
          const colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            const val = (data[key] !== null && data[key] !== undefined) ? data[key] : '';
            sheet.getRange(rowNum, colIndex + 1).setValue(val);
          }
        }
        return { success: true };
      }
    }
    return { error: 'Not found' };
  } finally {
    lock.releaseLock();
  }
}

function remove_(ss, sheetName, id) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const sheet = getSheet_(ss, sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { error: 'Not found' };
    const idCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < idCol.length; i++) {
      if (Number(idCol[i][0]) === Number(id)) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { error: 'Not found' };
  } finally {
    lock.releaseLock();
  }
}

// ---- GET Handler ----
function doGet(e) {
  const action = e.parameter.action;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureSheets_(ss);   // ← auto-init ทุก request

    switch (action) {
      case 'ping':
        return response({ ok: true, initialized: true });
      case 'getUsers':
        return response(getAll_(ss, 'users'));
      case 'getFormulas':
        return response(getAll_(ss, 'formulas'));
      case 'getPreps':
        return response(getAll_(ss, 'preps'));
      default:
        return response({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return response({ error: err.message });
  }
}

// ---- POST Handler ----
function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    ensureSheets_(ss);   // ← auto-init ทุก request

    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const id     = body.id;
    const data   = body.data;

    switch (action) {
      // Auth
      case 'login': {
        const users = getAll_(ss, 'users');
        const user = users.find(function(u) {
          return u.pha_id === data.pha_id &&
                 u.password === data.password &&
                 u.active === true;
        });
        return response(user ? { data: user } : { error: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }
      case 'getUserById': {
        const users = getAll_(ss, 'users');
        const user = users.find(function(u) { return Number(u.id) === Number(id); });
        return response(user ? { data: user } : { error: 'Not found' });
      }

      // Users
      case 'createUser':    return response(create_(ss, 'users', data));
      case 'updateUser':    return response(update_(ss, 'users', id, data));
      case 'deleteUser':    return response(remove_(ss, 'users', id));

      // Formulas
      case 'createFormula': return response(create_(ss, 'formulas', data));
      case 'updateFormula': return response(update_(ss, 'formulas', id, data));
      case 'deleteFormula': return response(remove_(ss, 'formulas', id));

      // Preps
      case 'createPrep':    return response(create_(ss, 'preps', data));
      case 'updatePrep':    return response(update_(ss, 'preps', id, data));
      case 'deletePrep':    return response(remove_(ss, 'preps', id));

      default:
        return response({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return response({ error: err.message });
  }
}
