import { Env, Session, AuthCode, User, OAuthApp, IdTokenClaims, AccessTokenClaims, RefreshToken } from './types';
import { Store } from './store';
import { generateSessionId, generateUserId, generateAuthCode, generateRefreshToken, signJwt, verifyPassword, verifyJwt, hashPassword, base64urlEncode, validatePasswordStrength } from './crypto';
import { renderLoginPage, renderProfilePage, renderRegisterPage, renderBannedPage } from './login';

const SESSION_TTL_SECONDS = 86400 * 7;
const AUTH_CODE_TTL_SECONDS = 600;
const ACCESS_TOKEN_TTL_SECONDS = 3600;
const REFRESH_TOKEN_TTL_SECONDS = 86400 * 30;

// Rate limiter: in-memory (per-isolate)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }
}

async function verifyTurnstile(token: string, secretKey: string): Promise<boolean> {
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });
    const data = await resp.json() as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}

function getCookie(name: string, header: string | null): string | null {
  if (!header) return null;
  for (const cookie of header.split(';')) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function deleteCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

async function getSessionFromCookie(request: Request, store: Store): Promise<Session | null> {
  const sessionId = getCookie('session_id', request.headers.get('Cookie'));
  if (!sessionId) return null;
  const session = await store.getSession(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    await store.deleteSession(sessionId);
    return null;
  }
  return session;
}

async function createSession(user: User, store: Store): Promise<Session> {
  const now = new Date();
  const session: Session = {
    sessionId: generateSessionId(),
    userId: user.id,
    email: user.email,
    name: user.name,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };
  await store.createSession(session);
  return session;
}

function isValidRedirect(redirect: string, baseUrl: string): boolean {
  if (!redirect) return false;
  if (redirect.startsWith('/')) return true;
  try {
    const url = new URL(redirect);
    const base = new URL(baseUrl);
    return url.origin === base.origin;
  } catch {
    return false;
  }
}

function safeRedirect(redirect: string | null, defaultPath: string, baseUrl: string): string {
  if (redirect && isValidRedirect(redirect, baseUrl)) return redirect;
  return defaultPath;
}

// --- 登录 ---

export async function handleLoginGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || '/authorize' + url.search;
  const safe = safeRedirect(redirect, '/', env.SSO_BASE_URL || '');
  return new Response(renderLoginPage(undefined, safe, env.TURNSTILE_SITE_KEY), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function handleLoginPost(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const url = new URL(request.url);
  const redirect = safeRedirect(url.searchParams.get('redirect'), '/', env.SSO_BASE_URL || '');

  // Rate limit check
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return new Response(renderLoginPage('登录尝试过于频繁，请 15 分钟后重试', redirect, env.TURNSTILE_SITE_KEY), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const formData = await request.formData();

  // Turnstile verification
  const turnstileToken = (formData.get('cf-turnstile-response') as string) || '';
  if (env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return new Response(renderLoginPage('请完成人机验证', redirect, env.TURNSTILE_SITE_KEY), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    const valid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY);
    if (!valid) {
      return new Response(renderLoginPage('请完成人机验证', redirect, env.TURNSTILE_SITE_KEY), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const password = formData.get('password') as string || '';

  const user = await store.getUserByEmail(email);
  if (!user) {
    recordLoginAttempt(ip, false);
    return new Response(renderLoginPage('邮箱或密码错误', redirect, env.TURNSTILE_SITE_KEY), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (user.banned) {
    recordLoginAttempt(ip, false);
    return new Response(renderBannedPage(), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!valid) {
    recordLoginAttempt(ip, false);
    return new Response(renderLoginPage('邮箱或密码错误', redirect, env.TURNSTILE_SITE_KEY), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  recordLoginAttempt(ip, true);
  const session = await createSession(user, store);
  const cookie = setCookie('session_id', session.sessionId, SESSION_TTL_SECONDS);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirect,
      'Set-Cookie': cookie,
    },
  });
}

// --- 注册 ---

export function handleRegisterGet(request: Request, env: Env): Promise<Response> {
  return Promise.resolve(new Response(renderRegisterPage(), {
    headers: { 'Content-Type': 'text/html' },
  }));
}

export async function handleRegisterPost(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const password = formData.get('password') as string || '';

  if (!name || !email || !password) {
    return new Response(renderRegisterPage('请填写所有字段'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const pwError = validatePasswordStrength(password);
  if (pwError) {
    return new Response(renderRegisterPage(pwError), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const existing = await store.getUserByEmail(email);
  if (existing) {
    return new Response(renderRegisterPage('该邮箱已被注册'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const { hash, salt } = await hashPassword(password);
  const user: User = {
    id: generateUserId(),
    email,
    name,
    passwordHash: hash,
    passwordSalt: salt,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  await store.createUser(user);

  const session = await createSession(user, store);
  const cookie = setCookie('session_id', session.sessionId, SESSION_TTL_SECONDS);

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/profile',
      'Set-Cookie': cookie,
    },
  });
}

export async function handleAuthorizeGet(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') || '';
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  const responseType = url.searchParams.get('response_type') || '';
  const state = url.searchParams.get('state') || '';
  const scope = url.searchParams.get('scope') || 'openid email';

  const app = await store.getApp(clientId);
  if (!app) {
    return new Response('无效的 client_id', { status: 400 });
  }
  if (!app.redirectUris.includes(redirectUri)) {
    return new Response('无效的 redirect_uri', { status: 400 });
  }
  if (responseType !== 'code') {
    return new Response('仅支持 authorization_code 流程', { status: 400 });
  }

  const session = await getSessionFromCookie(request, store);
  if (!session) {
    const loginRedirect = `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: loginRedirect },
    });
  }

  const user = await store.getUser(session.userId);
  if (user?.banned) {
    return new Response('账户已被封禁', { status: 403 });
  }
  if (user?.bannedApps?.includes(clientId)) {
    return new Response('您已被限制使用此应用', { status: 403 });
  }

  const code = generateAuthCode();
  const authCode: AuthCode = {
    code,
    clientId,
    redirectUri,
    userId: session.userId,
    expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
    scope,
  };

  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') as 'S256' | 'plain' | null;
  if (codeChallenge) {
    authCode.codeChallenge = codeChallenge;
    authCode.codeChallengeMethod = codeChallengeMethod || 'plain';
  }

  await store.createAuthCode(authCode, AUTH_CODE_TTL_SECONDS);

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
}

export async function handleToken(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);

  const contentType = request.headers.get('Content-Type') || '';
  let params: URLSearchParams;
  if (contentType.includes('application/json')) {
    const body = await request.json() as Record<string, string>;
    params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      params.set(k, v);
    }
  } else {
    const text = await request.text();
    params = new URLSearchParams(text);
  }

  const grantType = params.get('grant_type') || '';
  const code = params.get('code') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const clientId = params.get('client_id') || '';
  const clientSecret = params.get('client_secret') || '';
  const codeVerifier = params.get('code_verifier') || '';

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(store, env, code, redirectUri, clientId, clientSecret, codeVerifier);
  }

  if (grantType === 'refresh_token') {
    const refreshToken = params.get('refresh_token') || '';
    return handleRefreshTokenGrant(store, env, clientId, clientSecret, refreshToken);
  }

  return jsonResponse({ error: 'unsupported_grant_type' }, 400);
}

async function handleAuthorizationCodeGrant(
  store: Store, env: Env, code: string, redirectUri: string,
  clientId: string, clientSecret: string, codeVerifier: string
): Promise<Response> {
  const authCode = await store.getAuthCode(code);
  if (!authCode || new Date(authCode.expiresAt) < new Date()) {
    if (authCode) await store.deleteAuthCode(code);
    return jsonResponse({ error: 'invalid_grant', error_description: '授权码无效或已过期' }, 400);
  }

  const app = await store.getApp(clientId);
  if (!app || !timingSafeEqual(app.clientSecret, clientSecret)) {
    return jsonResponse({ error: 'invalid_client' }, 401);
  }
  if (authCode.clientId !== clientId) {
    return jsonResponse({ error: 'invalid_grant', error_description: '授权码不是为此客户端签发的' }, 400);
  }
  if (authCode.redirectUri !== redirectUri) {
    return jsonResponse({ error: 'invalid_grant', error_description: '重定向 URI 不匹配' }, 400);
  }

  if (authCode.codeChallenge) {
    if (!codeVerifier) {
      return jsonResponse({ error: 'invalid_grant', error_description: '需要 PKCE code_verifier' }, 400);
    }
    let challenge: string;
    if (authCode.codeChallengeMethod === 'S256') {
      const verifierBytes = new TextEncoder().encode(codeVerifier);
      const hashBuf = await crypto.subtle.digest('SHA-256', verifierBytes);
      challenge = base64urlEncode(new Uint8Array(hashBuf));
    } else {
      challenge = codeVerifier;
    }
    if (challenge !== authCode.codeChallenge) {
      return jsonResponse({ error: 'invalid_grant', error_description: 'PKCE 验证失败' }, 400);
    }
  }

  await store.deleteAuthCode(code);

  const user = await store.getUser(authCode.userId);
  if (!user) {
    return jsonResponse({ error: 'invalid_grant', error_description: '用户不存在' }, 400);
  }
  if (user.banned) {
    return jsonResponse({ error: 'invalid_grant', error_description: '账户已被封禁' }, 403);
  }
  if (user.bannedApps?.includes(clientId)) {
    return jsonResponse({ error: 'invalid_grant', error_description: '您已被限制使用此应用' }, 403);
  }

  const keySet = await store.getRsaKeys();
  if (!keySet) {
    return jsonResponse({ error: 'server_error', error_description: 'SSO 未初始化' }, 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const baseUrl = env.SSO_BASE_URL;
  const scope = authCode.scope || 'openid email';

  const idTokenClaims: IdTokenClaims = {
    iss: baseUrl,
    sub: user.id,
    aud: clientId,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    iat: now,
    email: user.email,
    name: user.name,
  };

  const accessTokenClaims: AccessTokenClaims = {
    iss: baseUrl,
    sub: user.id,
    aud: clientId,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    iat: now,
    scope,
  };

  const idToken = await signJwt(idTokenClaims, keySet);
  const accessToken = await signJwt(accessTokenClaims, keySet);
  const refreshTokenValue = generateRefreshToken();

  const rt: RefreshToken = {
    token: refreshTokenValue,
    userId: user.id,
    clientId,
    expiresAt: new Date((now + REFRESH_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
  await store.createRefreshToken(rt, REFRESH_TOKEN_TTL_SECONDS);

  return jsonResponse({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    id_token: idToken,
    refresh_token: refreshTokenValue,
  });
}

async function handleRefreshTokenGrant(
  store: Store, env: Env, clientId: string, clientSecret: string, refreshTokenValue: string
): Promise<Response> {
  const app = await store.getApp(clientId);
  if (!app || !timingSafeEqual(app.clientSecret, clientSecret)) {
    return jsonResponse({ error: 'invalid_client' }, 401);
  }

  const rt = await store.getRefreshToken(refreshTokenValue);
  if (!rt || new Date(rt.expiresAt) < new Date()) {
    return jsonResponse({ error: 'invalid_grant', error_description: '刷新令牌无效或已过期' }, 400);
  }
  if (rt.clientId !== clientId) {
    return jsonResponse({ error: 'invalid_grant', error_description: '令牌不是为此客户端签发的' }, 400);
  }

  await store.deleteRefreshToken(refreshTokenValue);

  const user = await store.getUser(rt.userId);
  if (!user) {
    return jsonResponse({ error: 'invalid_grant', error_description: '用户不存在' }, 400);
  }
  if (user.banned) {
    return jsonResponse({ error: 'invalid_grant', error_description: '账户已被封禁' }, 403);
  }
  if (user.bannedApps?.includes(clientId)) {
    return jsonResponse({ error: 'invalid_grant', error_description: '您已被限制使用此应用' }, 403);
  }

  const keySet = await store.getRsaKeys();
  if (!keySet) {
    return jsonResponse({ error: 'server_error' }, 500);
  }

  const now = Math.floor(Date.now() / 1000);
  const baseUrl = env.SSO_BASE_URL;

  const idTokenClaims: IdTokenClaims = {
    iss: baseUrl,
    sub: user.id,
    aud: clientId,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    iat: now,
    email: user.email,
    name: user.name,
  };

  const accessTokenClaims: AccessTokenClaims = {
    iss: baseUrl,
    sub: user.id,
    aud: clientId,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
    iat: now,
    scope: 'openid email profile',
  };

  const newRefreshTokenValue = generateRefreshToken();
  const newRt: RefreshToken = {
    token: newRefreshTokenValue,
    userId: user.id,
    clientId,
    expiresAt: new Date((now + REFRESH_TOKEN_TTL_SECONDS) * 1000).toISOString(),
  };
  await store.createRefreshToken(newRt, REFRESH_TOKEN_TTL_SECONDS);

  return jsonResponse({
    access_token: await signJwt(accessTokenClaims, keySet),
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    id_token: await signJwt(idTokenClaims, keySet),
    refresh_token: newRefreshTokenValue,
  });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const sessionId = getCookie('session_id', request.headers.get('Cookie'));
  if (sessionId) {
    await store.deleteSession(sessionId);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/login',
      'Set-Cookie': deleteCookie('session_id'),
    },
  });
}

export async function handleUserinfo(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return jsonResponse({ error: 'missing_token' }, 401);
  }

  const keySet = await store.getRsaKeys();
  if (!keySet) {
    return jsonResponse({ error: 'server_error' }, 500);
  }

  const claims = await verifyJwt(match[1], keySet);
  if (!claims) {
    return jsonResponse({ error: 'invalid_token' }, 401);
  }

  if (new Date(claims.exp * 1000) < new Date()) {
    return jsonResponse({ error: 'token_expired' }, 401);
  }

  const user = await store.getUser(claims.sub);
  if (!user) {
    return jsonResponse({ error: 'user_not_found' }, 404);
  }

  return jsonResponse({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
}

export async function handleJwks(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const keySet = await store.getRsaKeys();
  if (!keySet) {
    return jsonResponse({ error: 'not_initialized' }, 500);
  }

  const key = {
    kty: keySet.publicKeyJwk.kty,
    kid: keySet.kid,
    n: keySet.publicKeyJwk.n,
    e: keySet.publicKeyJwk.e,
    alg: 'RS256',
    use: 'sig',
  };

  return jsonResponse({ keys: [key] });
}

// --- 个人资料 ---

export async function handleProfileGet(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const session = await getSessionFromCookie(request, store);
  if (!session) {
    return new Response(null, { status: 302, headers: { Location: '/login?redirect=/profile' } });
  }

  const user = await store.getUser(session.userId);
  if (!user) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }

  const apps = await store.listApps();
  return new Response(renderProfilePage(user, apps), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function handleProfilePost(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const session = await getSessionFromCookie(request, store);
  if (!session) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const user = await store.getUser(session.userId);
  if (!user) {
    return jsonResponse({ error: 'user_not_found' }, 404);
  }

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const email = (formData.get('email') as string || '').toLowerCase().trim();

  if (!name || !email) {
    const apps = await store.listApps();
    return new Response(renderProfilePage(user, apps, '姓名和邮箱不能为空'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (email !== user.email) {
    const existing = await store.getUserByEmail(email);
    if (existing) {
      const apps = await store.listApps();
      return new Response(renderProfilePage(user, apps, '该邮箱已被使用'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  const oldEmail = user.email;
  user.name = name;
  user.email = email;

  await store.updateUser(user, oldEmail);

  const sessionCookie = setCookie('session_id', session.sessionId, SESSION_TTL_SECONDS);
  const apps = await store.listApps();
  return new Response(renderProfilePage(user, apps, undefined, '资料已更新'), {
    headers: { 'Content-Type': 'text/html', 'Set-Cookie': sessionCookie },
  });
}

export async function handleProfilePassword(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);
  const session = await getSessionFromCookie(request, store);
  if (!session) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  const user = await store.getUser(session.userId);
  if (!user) {
    return jsonResponse({ error: 'user_not_found' }, 404);
  }

  const formData = await request.formData();
  const currentPassword = formData.get('currentPassword') as string || '';
  const newPassword = formData.get('newPassword') as string || '';

  const valid = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
  if (!valid) {
    const apps = await store.listApps();
    return new Response(renderProfilePage(user, apps, '当前密码错误'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const pwError = validatePasswordStrength(newPassword);
  if (pwError) {
    const apps = await store.listApps();
    return new Response(renderProfilePage(user, apps, pwError), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const { hash, salt } = await hashPassword(newPassword);
  user.passwordHash = hash;
  user.passwordSalt = salt;
  await store.updateUser(user);

  // Fix 10: Invalidate all other sessions for this user on password change
  await store.deleteUserSessions(user.id, session.sessionId);

  const apps = await store.listApps();
  return new Response(renderProfilePage(user, apps, undefined, '密码已更新，其他设备已退出登录'), {
    headers: { 'Content-Type': 'text/html' },
  });
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    let result = aBytes.length ^ bBytes.length;
    const minLen = Math.min(aBytes.length, bBytes.length);
    for (let i = 0; i < minLen; i++) {
      result |= aBytes[i] ^ bBytes[i];
    }
    return result === 0;
  }
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export { getSessionFromCookie, jsonResponse };
