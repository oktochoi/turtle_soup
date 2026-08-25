import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function keyFromEnv(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be set (use `openssl rand -hex 32`, 64 hex chars / 32 bytes)'
    );
  }
  // Accept 64-char hex or any string → sha256 to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw).digest();
}

/** Encrypt plaintext for DB storage. Format: iv:tag:ciphertext (hex). */
export function encryptSecret(plaintext: string): string {
  const key = keyFromEnv();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const key = keyFromEnv();
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted payload');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
