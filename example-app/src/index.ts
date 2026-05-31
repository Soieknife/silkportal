interface Env {
  SSO_AUTH_URL: string;
  SSO_CLIENT_ID: string;
  SSO_CLIENT_SECRET: string;
}

// HTML 实体转义，防止 XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 从 Cookie 中读取值
function getCookie(name: string, header: string | null): string | null {
  if (!header) return null;
  for (const cookie of header.split(';')) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '/home') {
      return handleHome(request, env);
    }

    if (path === '/login') {
      return handleLogin(request, env);
    }

    if (path === '/callback') {
      return handleCallback(request, env);
    }

    if (path === '/api/me') {
      return handleApiMe(request, env);
    }

    return new Response('未找到', { status: 404 });
  },
};

interface UserInfo {
  sub: string;
  email: string;
  name: string;
}

// 首页
function handleHome(request: Request, env: Env): Promise<Response> {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>演示应用 - SilkPortal</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.card { background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 40px; text-align: center; max-width: 480px; width: 90%; }
h1 { font-size: 24px; margin-bottom: 8px; color: #1a73e8; }
p { color: #666; margin-bottom: 24px; line-height: 1.6; }
.btn { display: inline-block; padding: 12px 32px; border-radius: 6px; border: none; font-size: 15px; font-weight: 500; cursor: pointer; text-decoration: none; background: #1a73e8; color: #fff; transition: background 0.2s; }
.btn:hover { background: #1558b0; }
</style>
</head>
<body>
<div class="card">
<h1>演示应用</h1>
<p>这是一个由 SilkPortal 保护的示例应用程序。<br>点击下方按钮登录。</p>
<a href="/login" class="btn">通过 SilkPortal 登录</a>
<div style="margin-top:24px;padding:12px;background:#f9fafb;border-radius:6px;font-size:12px;color:#999">
由 <strong>SilkPortal</strong> 保护 &mdash; Cloudflare Workers
</div>
</div>
</body>
</html>`;

  return Promise.resolve(new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  }));
}

// 发起 SSO 登录，生成 state 并存入 Cookie
function handleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/callback`;
  const ssoUrl = new URL(`${env.SSO_AUTH_URL}/authorize`);
  ssoUrl.searchParams.set('client_id', env.SSO_CLIENT_ID);
  ssoUrl.searchParams.set('redirect_uri', redirectUri);
  ssoUrl.searchParams.set('response_type', 'code');
  ssoUrl.searchParams.set('scope', 'openid email profile');
  const state = generateState();
  ssoUrl.searchParams.set('state', state);

  // 将 state 存入 Cookie 以便回调时验证（防止 CSRF）
  const stateCookie = `sso_state=${state}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;

  return Promise.resolve(new Response(null, {
    status: 302,
    headers: {
      Location: ssoUrl.toString(),
      'Set-Cookie': stateCookie,
    },
  }));
}

// SSO 回调处理
async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response('缺少授权码', { status: 400 });
  }

  // 验证 state 防止 CSRF
  const storedState = getCookie('sso_state', request.headers.get('Cookie'));
  if (!state || !storedState || state !== storedState) {
    return new Response('state 不匹配 — 可能存在 CSRF 攻击', { status: 400 });
  }

  // 清除 state Cookie
  const clearStateCookie = 'sso_state=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0';

  // 用授权码换取令牌
  const tokenResponse = await fetch(`${env.SSO_AUTH_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${url.origin}/callback`,
      client_id: env.SSO_CLIENT_ID,
      client_secret: env.SSO_CLIENT_SECRET,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    return new Response(`令牌交换失败: ${error}`, {
      status: 500,
      headers: { 'Set-Cookie': clearStateCookie },
    });
  }

  const tokens = await tokenResponse.json() as any;
  const accessToken = tokens.access_token;

  // 获取用户信息
  const userResponse = await fetch(`${env.SSO_AUTH_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userResponse.ok) {
    return new Response('获取用户信息失败', {
      status: 500,
      headers: { 'Set-Cookie': clearStateCookie },
    });
  }

  const user = await userResponse.json() as UserInfo;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>演示应用 - 已登录</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
.card { background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 40px; max-width: 560px; width: 100%; }
h1 { font-size: 24px; margin-bottom: 8px; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: #1a73e8; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 600; margin: 0 auto 16px; }
.info { margin: 20px 0; }
.info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
.info-row:last-child { border-bottom: none; }
.label { color: #999; }
.value { font-weight: 500; color: #333; }
.btn { display: inline-block; padding: 10px 24px; border-radius: 6px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; transition: background 0.2s; margin-top: 20px; }
.btn-primary { background: #1a73e8; color: #fff; }
.btn-primary:hover { background: #1558b0; }
.btn-secondary { background: #f3f4f6; color: #555; margin-left: 8px; }
</style>
</head>
<body>
<div class="card">
<div style="text-align:center;margin-bottom:24px">
<div class="avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</div>
<h1>欢迎，${escapeHtml(user.name)}</h1>
<p style="color:#666;font-size:14px">您已通过 SilkPortal 登录</p>
</div>
<div class="info">
<div class="info-row"><span class="label">用户 ID</span><span class="value">${escapeHtml(user.sub)}</span></div>
<div class="info-row"><span class="label">邮箱</span><span class="value">${escapeHtml(user.email)}</span></div>
<div class="info-row"><span class="label">姓名</span><span class="value">${escapeHtml(user.name)}</span></div>
</div>
<div style="text-align:center">
<a href="${env.SSO_AUTH_URL}/logout" class="btn btn-primary">退出登录</a>
</div>
</div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Set-Cookie': clearStateCookie,
    },
  });
}

// API 代理 — 将请求转发到 SSO 验证
async function handleApiMe(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userResponse = await fetch(`${env.SSO_AUTH_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${match[1]}` },
  });

  if (!userResponse.ok) {
    return new Response(JSON.stringify({ error: 'invalid_token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await userResponse.json();
  return new Response(JSON.stringify(user, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// 生成随机 state 值
function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
