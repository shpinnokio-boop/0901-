const AUTH_CONFIG = Object.freeze({
  apiVersion: '2.1.0',
  spreadsheetId: '14Mzq_UGsekSmy5IZCDn2CPE_EjVeFY_BDDn15FR4TL0',
  usersSheet: 'Users',
  sessionsSheet: 'Sessions',
  tokenHours: 24,
  maxLoginFailures: 5,
  lockMinutes: 15,
});

const USER_HEADERS = [
  'userId', 'email', 'name', 'passwordHash', 'salt', 'role', 'status',
  'failedAttempts', 'lockedUntil', 'createdAt', 'updatedAt', 'lastLoginAt',
];

const SESSION_HEADERS = [
  'sessionId', 'userId', 'expiresAt', 'revokedAt', 'createdAt',
];

/**
 * 최초 한 번 직접 실행합니다.
 * Users/Sessions 시트와 서버 전용 비밀값을 생성합니다.
 */
function setupAuth() {
  ensureAuthSetup_();
  const spreadsheet = SpreadsheetApp.openById(AUTH_CONFIG.spreadsheetId);
  const users = spreadsheet.getSheetByName(AUTH_CONFIG.usersSheet);
  const sessions = spreadsheet.getSheetByName(AUTH_CONFIG.sessionsSheet);

  users.setFrozenRows(1);
  sessions.setFrozenRows(1);
  users.getRange(1, 1, 1, USER_HEADERS.length).setFontWeight('bold');
  sessions.getRange(1, 1, 1, SESSION_HEADERS.length).setFontWeight('bold');
  users.hideColumns(4, 2); // passwordHash, salt

  console.log('인증 초기 설정이 완료되었습니다.');
}

function doGet() {
  try {
    ensureAuthSetup_();
    return json_({
      ok: true,
      service: 'gangaji-blog-auth',
      apiVersion: AUTH_CONFIG.apiVersion,
      ready: true,
      message: '인증 API가 실행 중입니다.',
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ ok: false, code: 'SETUP_FAILED', apiVersion: AUTH_CONFIG.apiVersion, message: '인증 저장소를 준비하지 못했습니다.' });
  }
}

function doPost(e) {
  try {
    ensureAuthSetup_();
    const input = parseRequest_(e);

    switch (String(input.action || '').toLowerCase()) {
      case 'signup':
        return json_(signup_(input));
      case 'login':
        return json_(login_(input));
      case 'verify':
        return json_(verify_(input));
      case 'logout':
        return json_(logout_(input));
      case 'diagnostic':
        return json_(diagnostic_());
      default:
        return json_({ ok: false, code: 'INVALID_ACTION', message: '지원하지 않는 요청입니다.' });
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ ok: false, code: 'SERVER_ERROR', apiVersion: AUTH_CONFIG.apiVersion, message: '요청을 처리하지 못했습니다.' });
  }
}

function diagnostic_() {
  const spreadsheet = SpreadsheetApp.openById(AUTH_CONFIG.spreadsheetId);
  const properties = PropertiesService.getScriptProperties();
  return {
    ok: true,
    service: 'gangaji-blog-auth',
    apiVersion: AUTH_CONFIG.apiVersion,
    ready: Boolean(
      spreadsheet.getSheetByName(AUTH_CONFIG.usersSheet) &&
      spreadsheet.getSheetByName(AUTH_CONFIG.sessionsSheet) &&
      properties.getProperty('PASSWORD_PEPPER') &&
      properties.getProperty('TOKEN_SECRET')
    ),
  };
}

function signup_(input) {
  const name = String(input.name || '').trim();
  const email = normalizeEmail_(input.email);
  const password = String(input.password || '');

  if (name.length < 2 || name.length > 30) {
    return { ok: false, code: 'INVALID_NAME', message: '이름은 2자 이상 30자 이하로 입력해 주세요.' };
  }
  if (!isValidEmail_(email)) {
    return { ok: false, code: 'INVALID_EMAIL', message: '올바른 이메일을 입력해 주세요.' };
  }
  if (!isValidPassword_(password)) {
    return { ok: false, code: 'WEAK_PASSWORD', message: '비밀번호는 영문과 숫자를 포함해 8자 이상 입력해 주세요.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const users = getSheet_(AUTH_CONFIG.usersSheet);
    if (findRowByValue_(users, USER_HEADERS, 'email', email)) {
      return { ok: false, code: 'EMAIL_EXISTS', message: '이미 가입된 이메일입니다.' };
    }

    const now = new Date();
    const user = {
      userId: Utilities.getUuid(),
      email,
      name,
      salt: randomSecret_(),
      role: 'reader',
      status: 'active',
      failedAttempts: 0,
      lockedUntil: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    user.passwordHash = hashPassword_(password, user.salt);

    users.appendRow(USER_HEADERS.map((header) => user[header] === undefined ? '' : user[header]));
    const auth = createSession_(user);

    return {
      ok: true,
      message: '회원가입이 완료되었습니다.',
      token: auth.token,
      expiresAt: auth.expiresAt.toISOString(),
      user: publicUser_(user),
    };
  } finally {
    lock.releaseLock();
  }
}

function login_(input) {
  const email = normalizeEmail_(input.email);
  const password = String(input.password || '');

  if (!isValidEmail_(email) || !password) {
    return invalidLogin_();
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const users = getSheet_(AUTH_CONFIG.usersSheet);
    const found = findRowByValue_(users, USER_HEADERS, 'email', email);
    if (!found) return invalidLogin_();

    const user = found.record;
    if (String(user.status) !== 'active') {
      return { ok: false, code: 'ACCOUNT_DISABLED', message: '사용할 수 없는 계정입니다.' };
    }

    const now = new Date();
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > now.getTime()) {
      return { ok: false, code: 'LOGIN_LOCKED', message: '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.' };
    }

    const actualHash = hashPassword_(password, String(user.salt));
    if (!constantTimeEquals_(actualHash, String(user.passwordHash))) {
      const attempts = Number(user.failedAttempts || 0) + 1;
      setCell_(users, found.row, USER_HEADERS, 'failedAttempts', attempts);
      setCell_(users, found.row, USER_HEADERS, 'updatedAt', now);

      if (attempts >= AUTH_CONFIG.maxLoginFailures) {
        const lockedUntil = new Date(now.getTime() + AUTH_CONFIG.lockMinutes * 60 * 1000);
        setCell_(users, found.row, USER_HEADERS, 'lockedUntil', lockedUntil);
        setCell_(users, found.row, USER_HEADERS, 'failedAttempts', 0);
      }
      return invalidLogin_();
    }

    user.failedAttempts = 0;
    user.lockedUntil = '';
    user.lastLoginAt = now;
    user.updatedAt = now;
    setCell_(users, found.row, USER_HEADERS, 'failedAttempts', 0);
    setCell_(users, found.row, USER_HEADERS, 'lockedUntil', '');
    setCell_(users, found.row, USER_HEADERS, 'lastLoginAt', now);
    setCell_(users, found.row, USER_HEADERS, 'updatedAt', now);

    const auth = createSession_(user);
    return {
      ok: true,
      message: '로그인되었습니다.',
      token: auth.token,
      expiresAt: auth.expiresAt.toISOString(),
      user: publicUser_(user),
    };
  } finally {
    lock.releaseLock();
  }
}

function verify_(input) {
  const verified = verifyToken_(String(input.token || ''));
  if (!verified.ok) return verified;

  return {
    ok: true,
    user: publicUser_(verified.user),
    expiresAt: new Date(verified.payload.exp * 1000).toISOString(),
  };
}

function logout_(input) {
  const verified = verifyToken_(String(input.token || ''));
  if (!verified.ok) return verified;

  const sessions = getSheet_(AUTH_CONFIG.sessionsSheet);
  const found = findRowByValue_(sessions, SESSION_HEADERS, 'sessionId', verified.payload.jti);
  if (found) setCell_(sessions, found.row, SESSION_HEADERS, 'revokedAt', new Date());

  return { ok: true, message: '로그아웃되었습니다.' };
}

function createSession_(user) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_CONFIG.tokenHours * 60 * 60 * 1000);
  const sessionId = Utilities.getUuid();
  const payload = {
    sub: String(user.userId),
    jti: sessionId,
    iat: Math.floor(now.getTime() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const body = base64UrlString_(JSON.stringify(payload));
  const signature = sign_(body);
  const token = body + '.' + signature;

  getSheet_(AUTH_CONFIG.sessionsSheet).appendRow([
    sessionId, user.userId, expiresAt, '', now,
  ]);

  return { token, expiresAt };
}

function verifyToken_(token) {
  const parts = token.split('.');
  if (parts.length !== 2 || !constantTimeEquals_(sign_(parts[0]), parts[1])) {
    return { ok: false, code: 'INVALID_TOKEN', message: '로그인이 필요합니다.' };
  }

  let payload;
  try {
    payload = JSON.parse(Utilities.newBlob(decodeBase64Url_(parts[0])).getDataAsString());
  } catch (error) {
    return { ok: false, code: 'INVALID_TOKEN', message: '로그인이 필요합니다.' };
  }

  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    return { ok: false, code: 'TOKEN_EXPIRED', message: '로그인이 만료되었습니다.' };
  }

  const session = findRowByValue_(getSheet_(AUTH_CONFIG.sessionsSheet), SESSION_HEADERS, 'sessionId', payload.jti);
  if (!session || session.record.revokedAt || new Date(session.record.expiresAt).getTime() <= Date.now()) {
    return { ok: false, code: 'SESSION_ENDED', message: '로그인이 종료되었습니다.' };
  }

  const user = findRowByValue_(getSheet_(AUTH_CONFIG.usersSheet), USER_HEADERS, 'userId', payload.sub);
  if (!user || String(user.record.status) !== 'active') {
    return { ok: false, code: 'ACCOUNT_DISABLED', message: '사용할 수 없는 계정입니다.' };
  }

  return { ok: true, payload, user: user.record };
}

function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER');
  const bytes = Utilities.computeHmacSha256Signature(
    salt + ':' + password,
    pepper,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function sign_(body) {
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  const bytes = Utilities.computeHmacSha256Signature(body, secret, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function parseRequest_(e) {
  if (!e) return {};
  const contentType = e.postData && String(e.postData.type || '').toLowerCase();
  if (contentType && contentType.indexOf('application/json') !== -1) {
    return JSON.parse(e.postData.contents || '{}');
  }
  return Object.assign({}, e.parameter || {});
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (headers.some((header, index) => current[index] !== header)) {
      throw new Error(name + ' 시트의 첫 행 헤더가 예상 구조와 다릅니다.');
    }
  }
  return sheet;
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(AUTH_CONFIG.spreadsheetId).getSheetByName(name);
  if (!sheet) throw new Error(name + ' 시트가 없습니다. setupAuth를 먼저 실행하세요.');
  return sheet;
}

function findRowByValue_(sheet, headers, columnName, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const column = headers.indexOf(columnName);
  if (column < 0) throw new Error('알 수 없는 열: ' + columnName);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][column]) === String(value)) {
      const record = {};
      headers.forEach((header, headerIndex) => record[header] = values[index][headerIndex]);
      return { row: index + 2, record };
    }
  }
  return null;
}

function setCell_(sheet, row, headers, columnName, value) {
  const column = headers.indexOf(columnName);
  if (column < 0) throw new Error('알 수 없는 열: ' + columnName);
  sheet.getRange(row, column + 1).setValue(value);
}

function publicUser_(user) {
  return {
    userId: String(user.userId),
    email: String(user.email),
    name: String(user.name),
    role: String(user.role),
  };
}

function invalidLogin_() {
  return { ok: false, code: 'INVALID_LOGIN', message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPassword_(password) {
  return password.length >= 8 && password.length <= 72 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function constantTimeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function randomSecret_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function base64UrlString_(value) {
  return Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8).replace(/=+$/g, '');
}

function decodeBase64Url_(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  return Utilities.base64DecodeWebSafe(value + padding);
}

function ensureAuthSetup_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.openById(AUTH_CONFIG.spreadsheetId);
    ensureSheet_(spreadsheet, AUTH_CONFIG.usersSheet, USER_HEADERS);
    ensureSheet_(spreadsheet, AUTH_CONFIG.sessionsSheet, SESSION_HEADERS);

    const properties = PropertiesService.getScriptProperties();
    if (!properties.getProperty('PASSWORD_PEPPER')) {
      properties.setProperty('PASSWORD_PEPPER', randomSecret_());
    }
    if (!properties.getProperty('TOKEN_SECRET')) {
      properties.setProperty('TOKEN_SECRET', randomSecret_());
    }
  } finally {
    lock.releaseLock();
  }
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
