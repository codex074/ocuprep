// ============================================================
// UTTH ED-Extemp - Google Apps Script Backend
//
// โครงสร้างการใช้งาน:
// - Frontend: React/Vite static site บน GitHub Pages
// - Backend: Google Apps Script Web App
// - Database: Google Spreadsheet ที่ GAS สร้างให้อัตโนมัติ
//
// การติดตั้งแบบเร็ว:
// 1. เปิด https://script.google.com แล้วสร้าง Standalone project ใหม่
// 2. วางไฟล์นี้ทับ Code.gs
// 3. Deploy > New deployment > Web app
// 4. Execute as: Me
// 5. Who has access: Anyone
// 6. คัดลอก Web app URL ไปใส่ใน VITE_GAS_URL ของ frontend
//
// หมายเหตุ:
// - เมื่อมี request แรกเข้ามา ระบบจะสร้าง Spreadsheet ให้อัตโนมัติ
// - ระบบจะสร้างบัญชี admin กลางแยกจากบัญชีเภสัชกร
// ============================================================

const APP_NAME = 'UTTH ED-Extemp';
const DEFAULT_SPREADSHEET_NAME = `${APP_NAME} Database`;
const SHEET_ID_PROPERTY = 'UTTH_ED_SHEET_ID';
const DEFAULT_PASSWORD = '1234';
const SYSTEM_ADMIN = { pha_id: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin' };

const HEADERS = {
  users: ['id', 'name', 'pha_id', 'password', 'role', 'active', 'must_change_password', 'profile_image', 'created_at'],
  formulas: ['id', 'code', 'name', 'short_name', 'description', 'concentration', 'expiry_days', 'category', 'price', 'storage', 'ingredients', 'method', 'short_prep', 'package_size', 'created_at'],
  preps: ['id', 'formula_id', 'formula_name', 'concentration', 'mode', 'target', 'hn', 'patient_name', 'dest_room', 'lot_no', 'date', 'expiry_date', 'qty', 'note', 'prepared_by', 'user_pha_id', 'location', 'created_at'],
};

const DEFAULT_USERS = [
  SYSTEM_ADMIN,
  { pha_id: 'pha0', name: 'ภญ.เทียมใจ ตั้งเจริญไพศาล', role: 'user' },
  { pha_id: 'pha51', name: 'ภญ.มัณทนา คันทะเรศร', role: 'user' },
  { pha_id: 'pha12', name: 'ภญ.นิภาพันธ์ มานักฆ้อง', role: 'user' },
  { pha_id: 'pha47', name: 'ภญ.แสงเธียร คณิตปัญญาเจริญ', role: 'user' },
  { pha_id: 'pha48', name: 'ภญ.ปราณี แสงรอด', role: 'user' },
  { pha_id: 'pha57', name: 'ภญ.นิธิมา เศรษฐธรกุล', role: 'user' },
  { pha_id: 'pha16', name: 'ภญ.พนิดา ชูประเสริฐสุข', role: 'user' },
  { pha_id: 'pha109', name: 'ภก.สมหมาย พิมพอูบ', role: 'user' },
  { pha_id: 'pha87', name: 'ภญ.เสาวภาคย์ ตั้งเจริญไพศาล', role: 'user' },
  { pha_id: 'pha154', name: 'ภญ.อรจิตรา จันทร์ตระกูล', role: 'user' },
  { pha_id: 'pha50', name: 'ภญ.ปรียานุช รอดทอง', role: 'user' },
  { pha_id: 'pha99', name: 'ภญ.ฑิฆัมพร ดวงอาทิตย์', role: 'user' },
  { pha_id: 'pha134', name: 'ภญ.สุฐิยาภรณ์ อยู่สุข', role: 'user' },
  { pha_id: 'pha71', name: 'ภญ.นรารักษ์ อยู่เกิด', role: 'user' },
  { pha_id: 'pha111', name: 'ภญ.กุลวดี ปรางทอง', role: 'user' },
  { pha_id: 'pha127', name: 'ภญ.กณิศบุศย์ ธนิกภาธร', role: 'user' },
  { pha_id: 'pha43', name: 'ภญ.เสาวนีย์ หวังปรีดาเลิศกุล', role: 'user' },
  { pha_id: 'pha49', name: 'ภญ.จอมขวัญ ชูคง', role: 'user' },
  { pha_id: 'pha96', name: 'ภญ.พัจนภา เอื้อประเสริฐ', role: 'user' },
  { pha_id: 'pha97', name: 'ภญ.นํ้าฝน ปัญญาแจ้', role: 'user' },
  { pha_id: 'pha72', name: 'ภก.รักสกุล พูนนารถ', role: 'user' },
  { pha_id: 'pha122', name: 'ภญ.อนัญญา ทาเสนาะ', role: 'user' },
  { pha_id: 'pha150', name: 'ภก.ประเจตน์ พุ่มเทียน', role: 'user' },
  { pha_id: 'pha139', name: 'ภก.กฤษณพงศ์ ไชยวงศ์', role: 'user' },
  { pha_id: 'pha106', name: 'ภญ.กฤษฎิยากรณ์ โตงิ้ว', role: 'user' },
  { pha_id: 'pha131', name: 'ภญ.อวัสดา สุขเกษม', role: 'user' },
  { pha_id: 'pha140', name: 'ภญ.นัดดา ปัญญาแจ้', role: 'user' },
  { pha_id: 'pha175', name: 'ภญ.ณิชา ปินตา', role: 'user' },
  { pha_id: 'pha176', name: 'ภญ.ชิดชนก อัมพวานนท์', role: 'user' },
  { pha_id: 'pha82', name: 'ภญ.สุกัลญา อินทโชติ', role: 'user' },
  { pha_id: 'pha149', name: 'ภญ.ธมลวรรณ ขัดจวง', role: 'user' },
  { pha_id: 'pha114', name: 'ภญ.ฐิติมา ทุ่งสวย', role: 'user' },
  { pha_id: 'pha155', name: 'ภญ.จิราภรณ์ สอนสิน', role: 'user' },
  { pha_id: 'pha138', name: 'ภญ.กิติยา นิติศักดิ์', role: 'user' },
  { pha_id: 'pha105', name: 'ภญ.จริยา ใจใหญ่', role: 'user' },
  { pha_id: 'pha130', name: 'ภญ.ภัทฐิชา หอมสร้อย', role: 'user' },
  { pha_id: 'pha167', name: 'ภญ.พิชญสินี ฝั้นจักรสาย', role: 'user' },
  { pha_id: 'pha178', name: 'ภญ.กาญจนา เมืองฟ้า', role: 'user' },
  { pha_id: 'pha188', name: 'ภญ.กัญญามาศ เศษวงศ์', role: 'user' },
  { pha_id: 'pha195', name: 'ภก.นิติรุจน์ กังวาลธีรโรจน์', role: 'user' },
  { pha_id: 'pha202', name: 'ภญ.เวธกา ศรีสมบัติ', role: 'user' },
  { pha_id: 'pha203', name: 'ภญ.นันทิชา ตักเตือน', role: 'user' },
  { pha_id: 'pha208', name: 'ภก.ธีรเดช วิชัย', role: 'user' },
  { pha_id: 'pha211', name: 'ภญ.ณัฐนิช ไชยมงคล', role: 'user' },
];

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizePhaId_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeBoolean_(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function isAdminUser_(user) {
  return String(user.role || '').toLowerCase() === 'admin' && normalizeBoolean_(user.active);
}

function styleHeader_(sheet, numCols) {
  sheet.getRange(1, 1, 1, numCols)
    .setFontWeight('bold')
    .setBackground('#2563EB')
    .setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, numCols);
}

function getSpreadsheet_() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const sheetId = scriptProperties.getProperty(SHEET_ID_PROPERTY);

  if (sheetId) {
    try {
      return SpreadsheetApp.openById(sheetId);
    } catch (error) {
      throw new Error(`เปิด Spreadsheet ไม่สำเร็จ กรุณาตรวจสอบ Script Property ${SHEET_ID_PROPERTY}: ${error.message}`);
    }
  }

  const ss = SpreadsheetApp.create(DEFAULT_SPREADSHEET_NAME);
  scriptProperties.setProperty(SHEET_ID_PROPERTY, ss.getId());
  return ss;
}

function ensureSheets_(ss) {
  Object.keys(HEADERS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS[name]);
      styleHeader_(sheet, HEADERS[name].length);
    } else if (sheet.getLastColumn() !== HEADERS[name].length) {
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      styleHeader_(sheet, HEADERS[name].length);
    }
  });
}

function ensureAdmin_(ss) {
  const sheet = getSheet_(ss, 'users');
  if (sheet.getLastRow() <= 1) {
    seedUsers_(sheet);
    return;
  }

  ensureSystemAdminAccount_(ss);
}

function seedUsers_(sheet) {
  const now = new Date().toISOString();
  const rows = DEFAULT_USERS.map(function(user, index) {
    return [
      index + 1,
      user.name,
      normalizePhaId_(user.pha_id),
      DEFAULT_PASSWORD,
      user.role || 'user',
      true,
      true,
      '',
      now,
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function findUserByPhaId_(users, phaId) {
  const normalizedPhaId = normalizePhaId_(phaId);
  return users.find(function(user) {
    return normalizePhaId_(user.pha_id) === normalizedPhaId;
  });
}

function findUserRowNumberById_(sheet, userId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === Number(userId)) {
      return i + 2;
    }
  }

  return -1;
}

function appendUserRow_(sheet, user) {
  const headers = HEADERS.users;
  const now = new Date().toISOString();
  const rowData = Object.assign({
    id: getNextId_(sheet),
    password: DEFAULT_PASSWORD,
    active: true,
    must_change_password: true,
    profile_image: '',
    created_at: now,
  }, user);

  const row = headers.map(function(header) {
    return rowData[header] != null ? rowData[header] : '';
  });

  sheet.appendRow(row);
}

function ensureSystemAdminAccount_(ss) {
  const sheet = getSheet_(ss, 'users');
  const users = getAll_(ss, 'users');
  const adminUser = findUserByPhaId_(users, SYSTEM_ADMIN.pha_id);

  if (!adminUser) {
    appendUserRow_(sheet, {
      name: SYSTEM_ADMIN.name,
      pha_id: SYSTEM_ADMIN.pha_id,
      role: 'admin',
    });
  } else {
    const adminRowNumber = findUserRowNumberById_(sheet, adminUser.id);
    if (adminRowNumber !== -1) {
      const roleCol = HEADERS.users.indexOf('role') + 1;
      const activeCol = HEADERS.users.indexOf('active') + 1;
      sheet.getRange(adminRowNumber, roleCol).setValue('admin');
      sheet.getRange(adminRowNumber, activeCol).setValue(true);
    }
  }

  const currentUsers = getAll_(ss, 'users');
  const pha0User = findUserByPhaId_(currentUsers, 'pha0');
  if (pha0User && String(pha0User.role || '').toLowerCase() === 'admin') {
    const pha0RowNumber = findUserRowNumberById_(sheet, pha0User.id);
    if (pha0RowNumber !== -1) {
      const roleCol = HEADERS.users.indexOf('role') + 1;
      sheet.getRange(pha0RowNumber, roleCol).setValue('user');
    }
  }
}

function setupSpreadsheet() {
  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  ensureAdmin_(ss);
  Logger.log(JSON.stringify({
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    adminUser: SYSTEM_ADMIN.pha_id,
    defaultPassword: DEFAULT_PASSWORD,
  }, null, 2));
}

function getSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet not found: ${name}`);
  return sheet;
}

function getAll_(ss, sheetName) {
  const sheet = getSheet_(ss, sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0];

  return data.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index] === '' || row[index] == null ? null : row[index];
    });
    return obj;
  });
}

function getNextId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(function(row) { return Number(row[0]); })
    .filter(function(id) { return id > 0; });

  return ids.length ? Math.max.apply(null, ids) + 1 : 1;
}

function sanitizeData_(sheetName, data) {
  const headers = HEADERS[sheetName];
  const clean = {};

  Object.keys(data || {}).forEach(function(key) {
    if (headers.indexOf(key) === -1) return;

    if (sheetName === 'users' && key === 'pha_id') {
      clean[key] = normalizePhaId_(data[key]);
      return;
    }

    if ((key === 'active' || key === 'must_change_password') && sheetName === 'users') {
      clean[key] = normalizeBoolean_(data[key]);
      return;
    }

    clean[key] = data[key];
  });

  return clean;
}

function ensureUniquePhaId_(ss, phaId, excludeId) {
  if (!phaId) return;
  const normalized = normalizePhaId_(phaId);
  const exists = getAll_(ss, 'users').some(function(user) {
    return normalizePhaId_(user.pha_id) === normalized && Number(user.id) !== Number(excludeId || 0);
  });

  if (exists) {
    throw new Error('รหัสผู้ใช้นี้มีอยู่แล้ว');
  }
}

function getActiveAdminCount_(ss) {
  return getAll_(ss, 'users').filter(isAdminUser_).length;
}

function create_(ss, sheetName, data) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = getSheet_(ss, sheetName);
    const headers = HEADERS[sheetName];
    const id = getNextId_(sheet);
    const now = new Date().toISOString();
    const cleanData = sanitizeData_(sheetName, data || {});

    if (sheetName === 'users') {
      ensureUniquePhaId_(ss, cleanData.pha_id);
    }

    const rowData = Object.assign({ id: id, created_at: now }, cleanData);
    const row = headers.map(function(header) {
      return rowData[header] != null ? rowData[header] : '';
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

    const allRows = getAll_(ss, sheetName);
    const rowIndex = allRows.findIndex(function(row) { return Number(row.id) === Number(id); });
    if (rowIndex === -1) return { error: 'Not found' };

    const existing = allRows[rowIndex];
    const cleanData = sanitizeData_(sheetName, data || {});

    if (sheetName === 'users') {
      if (cleanData.pha_id != null) {
        ensureUniquePhaId_(ss, cleanData.pha_id, id);
      }

      const nextRole = cleanData.role != null ? String(cleanData.role).toLowerCase() : String(existing.role || '').toLowerCase();
      const nextActive = cleanData.active != null ? normalizeBoolean_(cleanData.active) : normalizeBoolean_(existing.active);

      if (isAdminUser_(existing) && (nextRole !== 'admin' || !nextActive) && getActiveAdminCount_(ss) <= 1) {
        return { error: 'ระบบต้องมีผู้ดูแลอย่างน้อย 1 คน' };
      }
    }

    const rowNumber = rowIndex + 2;
    Object.keys(cleanData).forEach(function(key) {
      const colIndex = headers.indexOf(key);
      if (colIndex === -1) return;
      sheet.getRange(rowNumber, colIndex + 1).setValue(cleanData[key] != null ? cleanData[key] : '');
    });

    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function remove_(ss, sheetName, id) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = getSheet_(ss, sheetName);
    const allRows = getAll_(ss, sheetName);
    const rowIndex = allRows.findIndex(function(row) { return Number(row.id) === Number(id); });
    if (rowIndex === -1) return { error: 'Not found' };

    if (sheetName === 'users' && isAdminUser_(allRows[rowIndex]) && getActiveAdminCount_(ss) <= 1) {
      return { error: 'ไม่สามารถลบผู้ดูแลคนสุดท้ายได้' };
    }

    sheet.deleteRow(rowIndex + 2);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

function handle_(params) {
  const ss = getSpreadsheet_();
  ensureSheets_(ss);
  ensureAdmin_(ss);

  const action = params.action || 'ping';

  try {
    switch (action) {
      case 'ping': {
        const usersSheet = ss.getSheetByName('users');
        return {
          ok: true,
          users: usersSheet ? Math.max(usersSheet.getLastRow() - 1, 0) : 0,
          spreadsheet_id: ss.getId(),
          spreadsheet_url: ss.getUrl(),
        };
      }

      case 'debug': {
        return {
          users: getAll_(ss, 'users').length,
          formulas: getAll_(ss, 'formulas').length,
          preps: getAll_(ss, 'preps').length,
          spreadsheet_id: ss.getId(),
          spreadsheet_url: ss.getUrl(),
          admin_user: SYSTEM_ADMIN.pha_id,
          default_password: DEFAULT_PASSWORD,
        };
      }

      case 'login': {
        const phaId = normalizePhaId_(params.pha_id);
        const password = String(params.password == null ? '' : params.password);
        const found = getAll_(ss, 'users').find(function(user) {
          return normalizePhaId_(user.pha_id) === phaId &&
            String(user.password == null ? '' : user.password) === password &&
            normalizeBoolean_(user.active);
        });
        return found ? { data: found } : { error: 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      }

      case 'getUserById': {
        const user = getAll_(ss, 'users').find(function(row) { return Number(row.id) === Number(params.id); });
        return user ? { data: user } : { error: 'Not found' };
      }

      case 'getUsers':
        return getAll_(ss, 'users');
      case 'createUser':
        return create_(ss, 'users', JSON.parse(params.data || '{}'));
      case 'updateUser':
        return update_(ss, 'users', params.id, JSON.parse(params.data || '{}'));
      case 'deleteUser':
        return remove_(ss, 'users', params.id);

      case 'getFormulas':
        return getAll_(ss, 'formulas');
      case 'createFormula':
        return create_(ss, 'formulas', JSON.parse(params.data || '{}'));
      case 'updateFormula':
        return update_(ss, 'formulas', params.id, JSON.parse(params.data || '{}'));
      case 'deleteFormula':
        return remove_(ss, 'formulas', params.id);

      case 'getPreps':
        return getAll_(ss, 'preps');
      case 'createPrep':
        return create_(ss, 'preps', JSON.parse(params.data || '{}'));
      case 'updatePrep':
        return update_(ss, 'preps', params.id, JSON.parse(params.data || '{}'));
      case 'deletePrep':
        return remove_(ss, 'preps', params.id);

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { error: error.message || 'Unknown error' };
  }
}

function doGet(e) {
  return response(handle_(e.parameter || {}));
}

function doPost(e) {
  let params = {};
  try {
    params = JSON.parse(e.postData.contents);
  } catch (error) {}

  Object.keys(e.parameter || {}).forEach(function(key) {
    if (params[key] == null) params[key] = e.parameter[key];
  });

  return response(handle_(params));
}
