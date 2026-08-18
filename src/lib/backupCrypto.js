const NOVEXA_MAGIC = "NOVEXA_ENC_V1";

// ── Default encryption key (used when user skips password) ───────────────────
// Files encrypted with this key restore silently without asking for a password.
export const NOVEXA_DEFAULT_KEY = "novexa-backup-default-key-2026";

export function isDefaultEncrypted(fileName) {
  return fileName?.endsWith(".novexa") && !fileName?.includes(".pwenc.");
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(json, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const enc  = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(json));
  const magic = enc.encode(NOVEXA_MAGIC);
  const total = new Uint8Array(magic.length + salt.length + iv.length + encrypted.byteLength);
  let offset = 0;
  total.set(magic, offset);  offset += magic.length;
  total.set(salt,  offset);  offset += salt.length;
  total.set(iv,    offset);  offset += iv.length;
  total.set(new Uint8Array(encrypted), offset);
  return total.buffer;
}

export async function decryptFile(buffer, password) {
  const data  = new Uint8Array(buffer);
  const dec   = new TextDecoder();
  const magic = dec.decode(data.slice(0, 13));
  if (magic !== NOVEXA_MAGIC) throw new Error("Not an encrypted Novexa backup file.");
  const salt   = data.slice(13, 29);
  const iv     = data.slice(29, 41);
  const cipher = data.slice(41);
  const key    = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plaintext);
}

export function isEncryptedFile(fileName) {
  return fileName?.endsWith(".novexa");
}

export function encryptedFileName(baseFileName) {
  // User-password encrypted: .novexa (same as before)
  return baseFileName.replace(/\.json$/, "") + ".novexa";
}

export function defaultEncryptedFileName(baseFileName) {
  // Default-key encrypted (no user password): also .novexa
  // These are auto-decrypted on restore without asking password
  return baseFileName.replace(/\.json$/, "") + ".novexa";
}
