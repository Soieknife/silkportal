import { layout, escapeHtml, footer } from './html';

export function renderLandingPage(): string {
  const body = `
<nav style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 20px">
<div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:56px">
<a href="/" style="font-size:20px;font-weight:700;color:#1a73e8;text-decoration:none">SilkPortal</a>
<div style="display:flex;align-items:center;gap:8px">
<a href="/docs" style="font-size:14px;color:#666">接入文档</a>
<a href="/login" style="font-size:14px;color:#1a73e8;margin-left:4px">登录</a>
<a href="/register" class="btn btn-sm btn-primary">注册</a>
</div>
</div>
</nav>
<div class="container" style="max-width:800px">
  <div style="text-align:center;padding:80px 20px 60px">
    <div style="font-size:56px;font-weight:800;color:#1a73e8;margin-bottom:16px">SilkPortal</div>
    <p style="font-size:18px;color:#555;margin-bottom:40px;line-height:1.6">轻量级 SSO 单点登录系统<br>基于 OAuth 2.0 + OpenID Connect 标准协议</p>
    <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
      <a href="/docs" class="btn btn-primary" style="padding:14px 36px;font-size:16px">查看接入文档</a>
      <a href="/register" class="btn" style="padding:14px 36px;font-size:16px;background:#f3f4f6;color:#555">注册使用</a>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;padding-bottom:60px">
    <div class="card" style="text-align:center;margin-bottom:0">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <h3 style="font-size:16px;margin-bottom:8px">OAuth 2.0 认证</h3><p style="font-size:13px">标准授权码流程，支持 PKCE 增强安全</p>
    </div>
    <div class="card" style="text-align:center;margin-bottom:0">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
      <h3 style="font-size:16px;margin-bottom:8px">OpenID Connect</h3><p style="font-size:13px">基于 JWT 的身份令牌，RS256 签名验证</p>
    </div>
    <div class="card" style="text-align:center;margin-bottom:0">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:8px"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
      <h3 style="font-size:16px;margin-bottom:8px">Refresh Token</h3><p style="font-size:13px">支持令牌刷新，延长会话有效期</p>
    </div>
  </div>
</div>
${footer()}`;
  return layout('首页', body);
}

export function renderLoginPage(error?: string, redirect?: string, siteKey?: string): string {
  const turnstileHtml = siteKey ? `
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<div class="form-group">
  <div class="cf-turnstile" data-sitekey="${escapeHtml(siteKey)}" data-theme="light"></div>
</div>` : '';
  return layout('登录', `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
<div class="card" style="width:400px;max-width:100%;padding:40px">
<div style="text-align:center;margin-bottom:32px">
<div style="font-size:40px;font-weight:800;color:#1a73e8;margin-bottom:8px">SilkPortal</div>
<p style="color:#666;font-size:15px">登录您的账户</p>
</div>
${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
<form method="POST" action="/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}">
<div class="form-group">
<label for="email">邮箱</label>
<input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
</div>
<div class="form-group">
<label for="password">密码</label>
<input type="password" id="password" name="password" placeholder="请输入密码" required>
</div>
${turnstileHtml}
<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">登录</button>
</form>
<div style="margin-top:24px;text-align:center;font-size:13px;color:#999">
<hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px">
没有账户？<a href="/register">注册新账户</a>
</div>
</div>
</div>`);
}

export function renderRegisterPage(error?: string): string {
  return layout('注册', `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
<div class="card" style="width:400px;max-width:100%;padding:40px">
<div style="text-align:center;margin-bottom:32px">
<div style="font-size:40px;font-weight:800;color:#1a73e8;margin-bottom:8px">SilkPortal</div>
<p style="color:#666;font-size:15px">创建新账户</p>
</div>
${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
<form method="POST" action="/api/register">
<div class="form-group">
<label for="name">姓名</label>
<input type="text" id="name" name="name" placeholder="您的姓名" required autofocus>
</div>
<div class="form-group">
<label for="email">邮箱</label>
<input type="email" id="email" name="email" placeholder="you@example.com" required>
</div>
<div class="form-group">
<label for="password">密码</label>
<input type="password" id="password" name="password" placeholder="至少 8 个字符" required minlength="8">
</div>
<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">注册</button>
</form>
<div style="margin-top:24px;text-align:center;font-size:13px;color:#999">
<hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:16px">
已有账户？<a href="/login">登录</a>
</div>
</div>
</div>`);
}

export function renderSetupPage(error?: string, success?: string): string {
  return layout('初始化设置', `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
<div class="card" style="width:480px;max-width:100%;padding:40px">
<div style="text-align:center;margin-bottom:32px">
<div style="font-size:36px;font-weight:800;color:#1a73e8;margin-bottom:8px">SilkPortal</div>
<p style="color:#666;font-size:15px">初始设置 — 创建第一个管理员用户</p>
</div>
${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}
<form method="POST" action="/api/setup">
<div class="form-group">
<label for="name">姓名</label>
<input type="text" id="name" name="name" placeholder="管理员姓名" required>
</div>
<div class="form-group">
<label for="email">邮箱</label>
<input type="email" id="email" name="email" placeholder="admin@example.com" required>
</div>
<div class="form-group">
<label for="password">密码</label>
<input type="password" id="password" name="password" placeholder="请设置强密码" required minlength="8">
</div>
<button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">创建管理员</button>
</form>
</div>
</div>`);
}

export function renderBannedPage(): string {
  return layout('账户已限制', `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;background:#f0f2f5">
<div class="card" style="width:420px;max-width:100%;padding:48px 40px;text-align:center">
  <div style="width:72px;height:72px;margin:0 auto 24px;background:#fef2f2;border-radius:50%;display:flex;align-items:center;justify-content:center">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  </div>
  <h1 style="font-size:22px;margin-bottom:12px;color:#1f2937">账户已被限制</h1>
  <p style="color:#6b7280;margin-bottom:28px;line-height:1.7;font-size:15px">您的账户已被管理员限制登录。<br>如有疑问，请联系系统管理员。</p>
  <a href="/login" class="btn btn-primary" style="text-decoration:none;padding:12px 32px">返回登录</a>
</div>
</div>`);
}

export function renderProfilePage(
  user: { id: string; email: string; name: string; role: string; banned?: boolean; bannedApps?: string[] },
  apps?: { clientId: string; name: string }[],
  error?: string,
  success?: string
): string {
  const alertsHtml = error || success ? `
<div style="width:100%;margin-bottom:16px">
  ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
  ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}
</div>` : '';

  const appsCard = apps && apps.length > 0 ? `
<div class="card" style="margin-bottom:0;flex:1 1 280px;min-width:0">
  <h2>已接入的应用</h2>
  <ul style="margin:0">${apps.map(a => `<li style="padding:4px 0;color:#666">${escapeHtml(a.name)}</li>`).join('')}</ul>
</div>` : '';

  const body = `
<div class="container">
  <h1>个人资料</h1>
  <p class="mb-4">管理您的账户信息。</p>
  ${alertsHtml}
  <div style="display:flex;flex-wrap:wrap;gap:20px">
    <div class="card" style="margin-bottom:0;flex:1 1 280px;min-width:0">
      <h2>基本信息</h2>
      <form method="POST" action="/api/profile">
        <div class="form-group">
          <label>姓名</label>
          <input type="text" name="name" value="${escapeHtml(user.name)}" required>
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input type="email" name="email" value="${escapeHtml(user.email)}" required>
        </div>
        <button type="submit" class="btn btn-sm btn-primary">保存</button>
      </form>
    </div>

    <div class="card" style="margin-bottom:0;flex:1 1 280px;min-width:0">
      <h2>修改密码</h2>
      <form method="POST" action="/api/profile/password">
        <div class="form-group">
          <label>当前密码</label>
          <input type="password" name="currentPassword" required>
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input type="password" name="newPassword" required minlength="8">
        </div>
        <button type="submit" class="btn btn-sm btn-primary">更新</button>
      </form>
    </div>

    <div class="card" style="margin-bottom:0;flex:1 1 280px;min-width:0">
      <h2>账户状态</h2>
      <p style="margin-bottom:8px">角色：<span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role === 'admin' ? '管理员' : '普通用户'}</span></p>
      <p style="margin-bottom:8px;word-break:break-all">ID：<code>${escapeHtml(user.id)}</code></p>
      <p style="margin-bottom:8px">状态：${user.banned ? '<span class="badge badge-banned">已封禁</span>' : '<span class="badge badge-active">正常</span>'}</p>
      ${user.bannedApps && user.bannedApps.length > 0 ? `<p style="color:#999">${user.bannedApps.length} 个应用受限</p>` : ''}
    </div>

    ${appsCard}
  </div>

  <div style="text-align:center;margin:20px 0">
    <a href="/admin" class="btn btn-sm" style="background:#1a73e8;color:#fff">管理后台</a>
    <a href="/logout" class="btn btn-sm" style="background:#f3f4f6;color:#555">退出登录</a>
  </div>
</div>`;
  return layout('个人资料', body);
}
