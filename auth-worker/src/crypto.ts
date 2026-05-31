import { JwtHeader, IdTokenClaims, AccessTokenClaims, RsaKeySet } from './types';

// Base64url 编码（URL 安全的 Base64）
function base64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64url 解码
function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return new Uint8Array([...atob(str)].map(c => c.charCodeAt(0)));
}

export { base64urlEncode, base64urlDecode };

// 生成指定长度的随机字符串
export function generateRandomString(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64urlEncode(bytes);
}

// 生成 RSA 密钥对（RS256）
export async function generateRsaKeyPair(): Promise<RsaKeySet> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: 'SHA-256' },
    },
    true,
    ['sign', 'verify']
  ) as CryptoKeyPair;

  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey) as JsonWebKey;
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey) as JsonWebKey;
  const kid = generateRandomString(16);

  return {
    privateKeyJwk,
    publicKeyJwk,
    kid,
    createdAt: new Date().toISOString(),
  };
}

// 导入 RSA 私钥
async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['sign']
  );
}

// 导入 RSA 公钥
async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
    false,
    ['verify']
  );
}

// 签发 JWT
export async function signJwt(
  payload: IdTokenClaims | AccessTokenClaims,
  keySet: RsaKeySet
): Promise<string> {
  const header: JwtHeader = { alg: 'RS256', typ: 'JWT', kid: keySet.kid };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;

  const privateKey = await importPrivateKey(keySet.privateKeyJwk);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(data)
  );

  return `${data}.${base64urlEncode(signature)}`;
}

// 验证 JWT
export async function verifyJwt(
  token: string,
  keySet: RsaKeySet
): Promise<IdTokenClaims | AccessTokenClaims | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const publicKey = await importPublicKey(keySet.publicKeyJwk);
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      base64urlDecode(signatureB64),
      new TextEncoder().encode(data)
    );

    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    return payload as IdTokenClaims | AccessTokenClaims;
  } catch {
    return null;
  }
}

// PBKDF2 密码哈希
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = salt ? base64urlDecode(salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuf = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: { name: 'SHA-256' },
    },
    key,
    256
  ) as ArrayBuffer;
  return {
    hash: base64urlEncode(new Uint8Array(hashBuf)),
    salt: base64urlEncode(saltBytes),
  };
}

// 恒定时间字符串比较，防止时序攻击
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

// 验证密码（恒定时间比较）
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, salt);
  return timingSafeEqual(computedHash, hash);
}

// 密码强度验证：null 表示通过，字符串为错误信息
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return '密码至少需要 8 个字符';
  if (!/[A-Z]/.test(password)) return '密码需要包含至少一个大写字母';
  if (!/[a-z]/.test(password)) return '密码需要包含至少一个小写字母';
  if (!/[0-9]/.test(password)) return '密码需要包含至少一个数字';
  if (!/[^A-Za-z0-9]/.test(password)) return '密码需要包含至少一个特殊字符';
  return null;
}

// 生成会话 ID
export function generateSessionId(): string {
  return 'sess_' + generateRandomString(24);
}

// 生成用户 ID
export function generateUserId(): string {
  return 'user_' + generateRandomString(16);
}

// 生成客户端 ID
export function generateClientId(): string {
  return 'client_' + generateRandomString(16);
}

// 生成客户端密钥
export function generateClientSecret(): string {
  return 'secret_' + generateRandomString(32);
}

// 生成授权码
export function generateAuthCode(): string {
  return 'code_' + generateRandomString(24);
}

// 生成刷新令牌
export function generateRefreshToken(): string {
  return 'ref_' + generateRandomString(32);
}
