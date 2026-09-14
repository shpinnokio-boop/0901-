import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const PASSWORD_ITERATIONS = 120_000;
const MAX_LOGIN_FAILURES = 5;
const LOCK_MINUTES = 15;

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  role: string;
  status: string;
  failed_attempts: number;
  locked_until: string | null;
};

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function database() {
  if (!env.DB) throw new Error('D1 database binding is unavailable.');
  return env.DB;
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(byteLength: number) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PASSWORD_ITERATIONS,
    salt: encoder.encode(salt),
  }, key, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function publicUser(user: Pick<UserRow, 'id' | 'email' | 'name' | 'role'>) {
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}

async function findUser(email: string) {
  return database().prepare('SELECT * FROM blog_users WHERE email = ?').bind(email).first<UserRow>();
}

async function createSession(user: UserRow, remember: boolean) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const now = new Date();
  const hours = remember ? 24 * 30 : 24;
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  await database().prepare('INSERT INTO blog_sessions (token_hash, user_id, expires_at, revoked_at, created_at) VALUES (?, ?, ?, NULL, ?)')
    .bind(tokenHash, user.id, expiresAt.toISOString(), now.toISOString()).run();
  return { token, expiresAt: expiresAt.toISOString(), user: publicUser(user) };
}

export async function signup(input: Record<string, unknown>) {
  const name = String(input.name || '').trim();
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  if (name.length < 2 || name.length > 30) throw new AuthError(400, 'INVALID_NAME', '이름은 2자 이상 30자 이하로 입력해 주세요.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthError(400, 'INVALID_EMAIL', '올바른 이메일을 입력해 주세요.');
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AuthError(400, 'WEAK_PASSWORD', '비밀번호는 영문과 숫자를 포함해 8자 이상 입력해 주세요.');
  }
  if (await findUser(email)) throw new AuthError(409, 'EMAIL_EXISTS', '이미 가입된 이메일입니다.');

  const id = crypto.randomUUID();
  const salt = randomToken(16);
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  try {
    await database().prepare('INSERT INTO blog_users (id, email, name, password_hash, password_salt, role, status, failed_attempts, locked_until, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)')
      .bind(id, email, name, passwordHash, salt, 'reader', 'active', now, now, now).run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) throw new AuthError(409, 'EMAIL_EXISTS', '이미 가입된 이메일입니다.');
    throw error;
  }
  const user = await findUser(email);
  if (!user) throw new Error('Created user could not be loaded.');
  return createSession(user, true);
}

export async function login(input: Record<string, unknown>) {
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  const user = await findUser(email);
  if (!user || !password) throw new AuthError(401, 'INVALID_LOGIN', '이메일 또는 비밀번호가 올바르지 않습니다.');
  if (user.status !== 'active') throw new AuthError(403, 'ACCOUNT_DISABLED', '사용할 수 없는 계정입니다.');

  const now = new Date();
  if (user.locked_until && new Date(user.locked_until).getTime() > now.getTime()) {
    throw new AuthError(423, 'LOGIN_LOCKED', '로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
  }
  const actualHash = await hashPassword(password, user.password_salt);
  if (!constantTimeEquals(actualHash, user.password_hash)) {
    const attempts = Number(user.failed_attempts || 0) + 1;
    const shouldLock = attempts >= MAX_LOGIN_FAILURES;
    const lockedUntil = shouldLock ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString() : null;
    await database().prepare('UPDATE blog_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?')
      .bind(shouldLock ? 0 : attempts, lockedUntil, now.toISOString(), user.id).run();
    throw new AuthError(401, 'INVALID_LOGIN', '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  await database().prepare('UPDATE blog_users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(now.toISOString(), now.toISOString(), user.id).run();
  return createSession(user, Boolean(input.remember));
}

export async function verify(token: string) {
  if (!token) throw new AuthError(401, 'INVALID_TOKEN', '로그인이 필요합니다.');
  const tokenHash = await sha256(token);
  const row = await database().prepare(`SELECT u.* FROM blog_sessions s
    JOIN blog_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'`)
    .bind(tokenHash, new Date().toISOString()).first<UserRow>();
  if (!row) throw new AuthError(401, 'SESSION_ENDED', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
  return publicUser(row);
}

export async function logout(token: string) {
  if (!token) return;
  await database().prepare('UPDATE blog_sessions SET revoked_at = ? WHERE token_hash = ?')
    .bind(new Date().toISOString(), await sha256(token)).run();
}
