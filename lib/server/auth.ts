import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac, createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest, NextResponse } from 'next/server';
import type { AuthUser } from '@/lib/types/auth';

const AUTH_DIR = path.join(process.cwd(), 'data', 'auth');
const USERS_FILE = path.join(AUTH_DIR, 'users.json');
const PASSWORD_RESETS_FILE = path.join(AUTH_DIR, 'password-resets.json');
const AUTH_COOKIE_NAME = 'vc_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_RESET_TTL_MS = 1000 * 60 * 30;
const AUTH_SECRET =
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'change-me-in-production';

interface StoredUser extends AuthUser {
  passwordHash: string;
  passwordSalt: string;
  updatedAt: string;
}

interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  createdAt: string;
  exp: number;
}

async function ensureAuthDir() {
  await fs.mkdir(AUTH_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, data: unknown) {
  await ensureAuthDir();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}

async function readUsers(): Promise<StoredUser[]> {
  return readJsonFile<StoredUser[]>(USERS_FILE, []);
}

async function writeUsers(users: StoredUser[]) {
  await writeJsonFile(USERS_FILE, users);
}

async function readPasswordResets(): Promise<PasswordResetRecord[]> {
  return readJsonFile<PasswordResetRecord[]>(PASSWORD_RESETS_FILE, []);
}

async function writePasswordResets(records: PasswordResetRecord[]) {
  await writeJsonFile(PASSWORD_RESETS_FILE, records);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'La password deve contenere almeno 8 caratteri';
  }
  return null;
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signValue(value: string): string {
  return createHmac('sha256', AUTH_SECRET).update(value).digest('base64url');
}

function encodePayload(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf-8').toString('base64url');
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function sanitizeUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export function getAuthCookieName() {
  return AUTH_COOKIE_NAME;
}

export function createSessionToken(user: AuthUser): string {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = encodePayload(payload);
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function shouldUseSecureCookies(request?: NextRequest): boolean {
  const forceSecure = process.env.AUTH_COOKIE_SECURE;
  if (forceSecure === 'true') return true;
  if (forceSecure === 'false') return false;

  const forwardedProto = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedProto === 'https') return true;
  if (forwardedProto === 'http') return false;

  if (request?.nextUrl.protocol === 'https:') return true;
  if (request?.nextUrl.protocol === 'http:') return false;

  return process.env.NODE_ENV === 'production';
}

export function verifySessionToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;
  const expectedSignature = signValue(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  const payload = decodePayload(encodedPayload);
  if (!payload || payload.exp < Date.now()) return null;

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    createdAt: payload.createdAt,
  };
}

export function setAuthCookie(response: NextResponse, user: AuthUser, request?: NextRequest) {
  response.cookies.set(AUTH_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(request),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(request),
    path: '/',
    maxAge: 0,
  });
}

export function getAuthUserFromRequest(request: NextRequest): AuthUser | null {
  return verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const users = await readUsers();
  const user = users.find((entry) => entry.id === userId);
  return user ? sanitizeUser(user) : null;
}

export async function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ user?: AuthUser; error?: string }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const passwordError = validatePassword(input.password);

  if (!validateEmail(email)) {
    return { error: 'Inserire un indirizzo email valido' };
  }
  if (!name) {
    return { error: 'Inserire il nome' };
  }
  if (passwordError) {
    return { error: passwordError };
  }

  const users = await readUsers();
  if (users.some((user) => user.email === email)) {
    return { error: 'Esiste già un account con questa email' };
  }

  const now = new Date().toISOString();
  const { salt, hash } = hashPassword(input.password);
  const user: StoredUser = {
    id: randomUUID(),
    email,
    name,
    createdAt: now,
    updatedAt: now,
    passwordSalt: salt,
    passwordHash: hash,
  };

  users.push(user);
  await writeUsers(users);

  return { user: sanitizeUser(user) };
}

export async function authenticateUser(
  emailInput: string,
  password: string,
): Promise<{ user?: AuthUser; error?: string }> {
  const email = normalizeEmail(emailInput);
  const users = await readUsers();
  const user = users.find((entry) => entry.email === email);

  if (!user) {
    return { error: 'Credenziali non valide' };
  }

  const { hash } = hashPassword(password, user.passwordSalt);
  if (!safeEqual(hash, user.passwordHash)) {
    return { error: 'Credenziali non valide' };
  }

  return { user: sanitizeUser(user) };
}

export async function createPasswordResetToken(
  emailInput: string,
): Promise<{ resetToken?: string; user?: AuthUser }> {
  const email = normalizeEmail(emailInput);
  const users = await readUsers();
  const user = users.find((entry) => entry.email === email);
  if (!user) {
    return {};
  }

  const records = await readPasswordResets();
  const now = Date.now();
  const activeRecords = records.filter(
    (record) => !record.usedAt && new Date(record.expiresAt).getTime() > now,
  );

  const resetToken = randomBytes(24).toString('hex');
  activeRecords.push({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashResetToken(resetToken),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PASSWORD_RESET_TTL_MS).toISOString(),
  });

  await writePasswordResets(activeRecords);

  return {
    resetToken,
    user: sanitizeUser(user),
  };
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
): Promise<{ user?: AuthUser; error?: string }> {
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  const tokenHash = hashResetToken(token.trim());
  const records = await readPasswordResets();
  const now = Date.now();
  const record = records.find(
    (entry) =>
      !entry.usedAt &&
      entry.tokenHash === tokenHash &&
      new Date(entry.expiresAt).getTime() > now,
  );

  if (!record) {
    return { error: 'Link di recupero non valido o scaduto' };
  }

  const users = await readUsers();
  const userIndex = users.findIndex((entry) => entry.id === record.userId);
  if (userIndex === -1) {
    return { error: 'Utente non trovato' };
  }

  const { salt, hash } = hashPassword(password);
  users[userIndex] = {
    ...users[userIndex],
    passwordSalt: salt,
    passwordHash: hash,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users);

  const updatedRecords = records.map((entry) =>
    entry.id === record.id ? { ...entry, usedAt: new Date().toISOString() } : entry,
  );
  await writePasswordResets(updatedRecords);

  return { user: sanitizeUser(users[userIndex]) };
}
