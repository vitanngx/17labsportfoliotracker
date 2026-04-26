import crypto from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_COOKIE = "portfolio_admin_session";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

function getAdminSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? `${getAdminPassword()}::portfolio`;
}

export function validateAdminPassword(password: string) {
  return password === getAdminPassword();
}

export function createAdminSessionToken() {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", getAdminSecret())
    .update(payload)
    .digest("hex");

  return `${payload}.${signature}`;
}

export function isValidAdminSession(token: string | undefined) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", getAdminSecret())
    .update(payload)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }

  return Number(payload) > Date.now();
}

export function isAdminFromCookieStore() {
  return isValidAdminSession(cookies().get(ADMIN_COOKIE)?.value);
}

export function getAdminCookieName() {
  return ADMIN_COOKIE;
}
