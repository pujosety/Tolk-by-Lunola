import crypto from 'node:crypto';
import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'tolk_session';

export function hashSecret(secret: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

export function verifySecret(secret: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(secret, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

export function verifyMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length < 4) return mime.startsWith('text/') || mime === 'application/json';
  const b0 = buf[0], b1 = buf[1], b2 = buf[2], b3 = buf[3];
  if (mime === 'image/png') return b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47;
  if (mime === 'image/jpeg' || mime === 'image/jpg') return b0 === 0xff && b1 === 0xd8 && b2 === 0xff;
  if (mime === 'image/gif') return b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38;
  if (mime === 'image/webp') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mime === 'application/pdf') return buf.subarray(0, 4).toString('ascii') === '%PDF';
  if (mime === 'application/zip') {
    return b0 === 0x50 && b1 === 0x4b && (b2 === 0x03 || b2 === 0x05 || b2 === 0x07);
  }
  if (mime === 'video/mp4' || mime === 'audio/mp4' || mime === 'audio/x-m4a') {
    return buf.length >= 8 && buf.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  if (mime === 'video/webm' || mime === 'audio/webm') {
    return b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3;
  }
  if (mime === 'audio/ogg') return buf.subarray(0, 4).toString('ascii') === 'OggS';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') {
    return (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) || (b0 === 0xff && (b1 & 0xe0) === 0xe0);
  }
  if (mime === 'audio/wav' || mime === 'audio/x-wav') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WAVE'
    );
  }
  if (mime.startsWith('text/') || mime === 'application/json') {
    return !buf.subarray(0, Math.min(buf.length, 512)).includes(0);
  }
  return true;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function setSessionCookie(res: Response, token: string, isProd: boolean): void {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (isProd) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res: Response, isProd: boolean): void {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}
