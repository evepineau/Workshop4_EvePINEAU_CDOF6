import { webcrypto } from "crypto";

// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
export async function generateRsaKeyPair(): Promise<{ publicKey: webcrypto.CryptoKey; privateKey: webcrypto.CryptoKey }> {
  return await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export a crypto public key to a base64 string format
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exported);
}

// Export a crypto private key to a base64 string format
export async function exportPrvKey(key: webcrypto.CryptoKey): Promise<string> {
  const exported = await webcrypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(exported);
}

// Import a base64 string public key to its native format
export async function importPubKey(strKey: string): Promise<webcrypto.CryptoKey> {
  return await webcrypto.subtle.importKey(
    "spki",
    base64ToArrayBuffer(strKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Import a base64 string private key to its native format
export async function importPrvKey(strKey: string): Promise<webcrypto.CryptoKey> {
  return await webcrypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(strKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// Encrypt a message using an RSA public key
export async function rsaEncrypt(b64Data: string, publicKey: webcrypto.CryptoKey): Promise<string> {
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    base64ToArrayBuffer(b64Data)
  );
  return arrayBufferToBase64(encrypted);
}

// Decrypts a message using an RSA private key
export async function rsaDecrypt(data: string, privateKey: webcrypto.CryptoKey): Promise<string> {
  const decrypted = await webcrypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToArrayBuffer(data)
  );
  return new TextDecoder().decode(decrypted);
}

// Decrypts a message using an RSA private key
export async function decryptMessage(encryptedMessage: string, privateKey: webcrypto.CryptoKey): Promise<string> {
  return rsaDecrypt(encryptedMessage, privateKey);
}
