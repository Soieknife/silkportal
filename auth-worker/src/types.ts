export interface Env {
  SESSIONS: KVNamespace;
  AUTH_CODES: KVNamespace;
  USERS: KVNamespace;
  APPS: KVNamespace;
  REFRESH_TOKENS: KVNamespace;
  RSA_KEYS: KVNamespace;
  SSO_BASE_URL: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  role: 'admin' | 'user';
  createdAt: string;
  banned?: boolean;
  bannedAt?: string;
  bannedApps?: string[];
}

export interface OAuthApp {
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUris: string[];
  createdAt: string;
  updatedAt?: string;
  userId?: string;
}

export interface Session {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  expiresAt: string;
}

export interface AuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  expiresAt: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  scope?: string;
}

export interface RefreshToken {
  token: string;
  userId: string;
  clientId: string;
  expiresAt: string;
}

export interface RsaKeySet {
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  kid: string;
  createdAt: string;
}

export interface JwtHeader {
  alg: 'RS256';
  typ: 'JWT';
  kid: string;
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  email: string;
  name: string;
}

export interface AccessTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  scope: string;
}

export interface CorsHeaders {
  [key: string]: string;
}
