import { Env, Session, User, OAuthApp } from './types';
import { Store } from './store';
import { layout, navbar, adminNav, footer, escapeHtml } from './html';
import { generateUserId, hashPassword, generateClientId, generateClientSecret, validatePasswordStrength } from './crypto';
import { getSessionFromCookie, jsonResponse } from './auth';

async function requireAdmin(request: Request, env: Env): Promise<{ session: Session; user: User } | Response> {
  const store = new Store(env);
  const session = await getSessionFromCookie(request, store);
  if (!session) {
    return new Response(null, { status: 302, headers: { Location: '/login?redirect=/admin' } });
  }
  const user = await store.getUser(session.userId);
  if (!user || user.role !== 'admin') {
    return new Response('禁止访问', { status: 403 });
  }
  return { session, user };
}

// --- 控制台 ---

export async function handleAdminDashboard(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);

  const users = await store.listUsers();
  const apps = await store.listApps();
  const sessions = await store.listSessions();
  const bannedCount = users.filter(u => u.banned).length;

  const recentUsers = users.slice(-5).reverse();
  const recentApps = apps.slice(-5).reverse();

  const userRows = recentUsers.map(u => `
<tr><td>${escapeHtml(u.name)}</td><td class="text-muted">${new Date(u.createdAt).toLocaleDateString()}</td></tr>`).join('');

  const appRows = recentApps.map(a => `
<tr><td>${escapeHtml(a.name)}</td><td class="text-muted">${new Date(a.createdAt).toLocaleDateString()}</td></tr>`).join('');

  const body = `
${navbar('管理后台', user)}
${adminNav('/admin')}
<div class="container">
  <h1>控制台</h1>
  <p class="mb-4">欢迎使用 SilkPortal 管理后台。<a href="/docs" style="margin-left:8px">查看接入文档 &rarr;</a></p>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
    <div class="card" style="text-align:center;margin-bottom:0"><div style="font-size:32px;font-weight:700;color:#1a73e8">${users.length}</div><div style="color:#666;font-size:14px">用户总数</div></div>
    <div class="card" style="text-align:center;margin-bottom:0"><div style="font-size:32px;font-weight:700;color:#dc3545">${bannedCount}</div><div style="color:#666;font-size:14px">已封禁</div></div>
    <div class="card" style="text-align:center;margin-bottom:0"><div style="font-size:32px;font-weight:700;color:#1a73e8">${apps.length}</div><div style="color:#666;font-size:14px">应用数</div></div>
    <div class="card" style="text-align:center;margin-bottom:0"><div style="font-size:32px;font-weight:700;color:#1a73e8">${sessions.length}</div><div style="color:#666;font-size:14px">活跃会话</div></div>
  </div>

  <div style="display:flex;flex-wrap:wrap;gap:20px">
    <div class="card" style="margin-bottom:0;flex:1 1 340px;min-width:0">
      <div class="flex mb-4"><h2>最近用户</h2><a href="/admin/users" class="btn btn-sm" style="background:#eef2ff;color:#1a73e8">查看全部</a></div>
      <table>
        <thead><tr><th>姓名</th><th>创建时间</th></tr></thead>
        <tbody>${userRows || '<tr><td colspan="2" class="text-muted">暂无用户</td></tr>'}</tbody>
      </table>
    </div>
    <div class="card" style="margin-bottom:0;flex:1 1 340px;min-width:0">
      <div class="flex mb-4"><h2>最近应用</h2><a href="/admin/apps" class="btn btn-sm" style="background:#eef2ff;color:#1a73e8">查看全部</a></div>
      <table>
        <thead><tr><th>名称</th><th>创建时间</th></tr></thead>
        <tbody>${appRows || '<tr><td colspan="2" class="text-muted">暂无应用</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</div>
${footer()}`;
  return new Response(layout('控制台', body), { headers: { 'Content-Type': 'text/html' } });
}

// --- 用户管理 ---

export async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);
  const users = await store.listUsers();
  const apps = await store.listApps();

  const rows = users.map(u => {
    const bannedBadge = u.banned
      ? '<span class="badge badge-banned">已封禁</span>'
      : '<span class="badge badge-active">正常</span>';
    return `<tr>
  <td>${escapeHtml(u.email)}</td>
  <td class="hide-mobile">${escapeHtml(u.name)}</td>
  <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role === 'admin' ? '管理员' : '用户'}</span></td>
  <td class="hide-mobile">${bannedBadge}</td>
  <td class="hide-mobile text-muted">${new Date(u.createdAt).toLocaleDateString()}</td>
  <td>
    <a href="/admin/users/${u.id}" class="btn btn-sm" style="background:#eef2ff;color:#1a73e8">编辑</a>
    ${u.role !== 'admin' ? `<form method="POST" action="/api/admin/users/${u.id}/delete" style="display:inline"><button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('确定删除 ${escapeHtml(u.email)}？')">删除</button></form>` : ''}
  </td>
</tr>`;
  }).join('');

  const body = `
${navbar('管理后台', user)}
${adminNav('/admin/users')}
<div class="container">
  <div class="flex mb-4">
    <h1>用户管理</h1>
    <button onclick="document.getElementById('createUserForm').style.display='block'" class="btn btn-primary btn-sm">创建用户</button>
  </div>
  <div id="createUserForm" class="card" style="display:none;margin-bottom:20px">
    <h2>创建用户</h2>
    <form method="POST" action="/api/admin/users">
      <div class="form-group">
        <label for="name">姓名</label>
        <input type="text" id="name" name="name" required>
      </div>
      <div class="form-group">
        <label for="email">邮箱</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-group">
        <label for="password">密码</label>
        <input type="password" id="password" name="password" required minlength="8">
      </div>
      <button type="submit" class="btn btn-primary">创建</button>
      <button type="button" onclick="document.getElementById('createUserForm').style.display='none'" class="btn" style="background:#f3f4f6;color:#555">取消</button>
    </form>
  </div>
  <div class="card" style="overflow:auto">
    <table style="table-layout:fixed">
      <colgroup>
        <col style="width:25%">
        <col class="hide-mobile" style="width:15%">
        <col style="width:12%">
        <col class="hide-mobile" style="width:12%">
        <col class="hide-mobile" style="width:15%">
        <col style="width:21%">
      </colgroup>
      <thead><tr>
        <th>邮箱</th>
        <th class="hide-mobile">姓名</th>
        <th>角色</th>
        <th class="hide-mobile">状态</th>
        <th class="hide-mobile">创建时间</th>
        <th>操作</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>
${footer()}`;
  return new Response(layout('用户管理', body), { headers: { 'Content-Type': 'text/html' } });
}

// --- 用户详情 ---

export async function handleAdminUserDetail(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { user: admin } = auth;
  const store = new Store(env);

  const target = await store.getUser(userId);
  if (!target) {
    return new Response('用户未找到', { status: 404 });
  }

  const allApps = await store.listApps();
  const url = new URL(request.url);
  const error = url.searchParams.get('error') || '';
  const success = url.searchParams.get('success') || '';

  const appBanRows = allApps.map(a => {
    const isBanned = target.bannedApps?.includes(a.clientId);
    return `<tr>
  <td class="hide-mobile">${escapeHtml(a.clientId)}</td>
  <td>${escapeHtml(a.name)}</td>
  <td class="hide-mobile">${isBanned ? '<span class="badge badge-banned">已限制</span>' : '<span class="badge badge-active">正常</span>'}</td>
  <td>
    <form method="POST" action="/api/admin/users/${target.id}/app-ban" style="display:inline">
      <input type="hidden" name="clientId" value="${escapeHtml(a.clientId)}">
      <button type="submit" class="btn btn-sm ${isBanned ? 'btn-primary' : 'btn-warning'}">
        ${isBanned ? '解除限制' : '限制使用'}
      </button>
    </form>
  </td>
</tr>`;
  }).join('');

  const body = `
${navbar('管理后台', admin)}
${adminNav('/admin/users')}
<div class="container" style="max-width:800px">
  <a href="/admin/users" style="display:inline-block;margin-bottom:16px">&larr; 返回用户列表</a>
  ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
  ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}

  <div class="card">
    <div class="flex mb-4">
      <h1>${escapeHtml(target.name)}</h1>
      ${target.banned ? '<span class="badge badge-banned">已封禁</span>' : '<span class="badge badge-active">正常</span>'}
    </div>
    <table>
      <tr><th style="width:120px">用户 ID</th><td><code>${escapeHtml(target.id)}</code></td></tr>
      <tr><th>邮箱</th><td>${escapeHtml(target.email)}</td></tr>
      <tr><th>姓名</th><td>${escapeHtml(target.name)}</td></tr>
      <tr><th>角色</th><td><span class="badge ${target.role === 'admin' ? 'badge-admin' : 'badge-user'}">${target.role === 'admin' ? '管理员' : '普通用户'}</span></td></tr>
      <tr><th>创建时间</th><td>${new Date(target.createdAt).toLocaleString()}</td></tr>
      ${target.bannedAt ? `<tr><th>封禁时间</th><td>${new Date(target.bannedAt).toLocaleString()}</td></tr>` : ''}
      <tr><th>被限制的应用</th><td>${target.bannedApps?.length ? target.bannedApps.length + ' 个' : '无'}</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>编辑用户</h2>
    <form method="POST" action="/api/admin/users/${target.id}/update">
      <div class="form-group">
        <label for="name">姓名</label>
        <input type="text" id="name" name="name" value="${escapeHtml(target.name)}" required>
      </div>
      <div class="form-group">
        <label for="email">邮箱</label>
        <input type="email" id="email" name="email" value="${escapeHtml(target.email)}" required>
      </div>
      <div class="form-group">
        <label for="role">角色</label>
        <select id="role" name="role">
          <option value="user" ${target.role === 'user' ? 'selected' : ''}>普通用户</option>
          <option value="admin" ${target.role === 'admin' ? 'selected' : ''}>管理员</option>
        </select>
      </div>
      <div class="form-group">
        <label for="newPassword">新密码（留空不修改）</label>
        <input type="password" id="newPassword" name="newPassword" minlength="8">
      </div>
      <button type="submit" class="btn btn-primary">保存修改</button>
    </form>
  </div>

  <div class="card">
    <div class="flex mb-4">
      <h2>封禁管理</h2>
      ${target.banned
        ? `<form method="POST" action="/api/admin/users/${target.id}/ban" style="display:inline"><button type="submit" class="btn btn-sm btn-primary">解封用户</button></form>`
        : `<form method="POST" action="/api/admin/users/${target.id}/ban" style="display:inline"><button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('确定封禁 ${escapeHtml(target.email)}？')">封禁用户</button></form>`}
    </div>
    ${target.banned ? '<div class="alert alert-info">该用户已被封禁，无法登录和使用任何应用。</div>' : ''}
  </div>

  <div class="card" style="overflow:auto">
    <h2>应用访问限制</h2>
    <p class="mb-4 text-muted">限制此用户对特定应用的访问权限。</p>
    <table style="table-layout:fixed">
      <colgroup>
        <col class="hide-mobile" style="width:35%">
        <col style="width:30%">
        <col class="hide-mobile" style="width:15%">
        <col style="width:20%">
      </colgroup>
      <thead><tr>
        <th class="hide-mobile">客户端 ID</th>
        <th>应用名称</th>
        <th class="hide-mobile">状态</th>
        <th>操作</th>
      </tr></thead>
      <tbody>${appBanRows}</tbody>
    </table>
  </div>
</div>
${footer()}`;
  return new Response(layout('用户详情', body), { headers: { 'Content-Type': 'text/html' } });
}

// --- 应用管理 ---

export async function handleAdminApps(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { user: admin } = auth;
  const store = new Store(env);
  const allApps = await store.listApps();
  const allUsers = await store.listUsers();
  const userMap = new Map(allUsers.map(u => [u.id, u.name]));

  const rows = allApps.map(a => {
    const ownerName = a.userId ? userMap.get(a.userId) : '(继承)';
    return `<tr>
  <td style="font-family:monospace;font-size:13px" title="${escapeHtml(a.clientId)}">${escapeHtml(a.clientId.substring(0, 12))}...</td>
  <td>${escapeHtml(a.name)}</td>
  <td class="hide-mobile">${escapeHtml(ownerName || '未知')}</td>
  <td class="hide-mobile text-muted">${new Date(a.createdAt).toLocaleDateString()}</td>
  <td>
    <a href="/admin/apps/${a.clientId}" class="btn btn-sm" style="background:#eef2ff;color:#1a73e8">详情</a>
    <form method="POST" action="/api/admin/apps/${a.clientId}/delete" style="display:inline">
      <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('确定删除 ${escapeHtml(a.name)}？')">删除</button>
    </form>
  </td>
</tr>`;
  }).join('');

  const body = `
${navbar('管理后台', admin)}
${adminNav('/admin/apps')}
<div class="container">
  <div class="flex mb-4">
    <h1>应用管理</h1>
    <button onclick="document.getElementById('createAppForm').style.display='block'" class="btn btn-primary btn-sm" style="flex-shrink:0">创建应用</button>
  </div>
  <div id="createAppForm" class="card" style="display:none;margin-bottom:20px">
    <h2>创建应用</h2>
    <form method="POST" action="/api/admin/apps">
      <div class="form-group">
        <label for="name">应用名称</label>
        <input type="text" id="name" name="name" required>
      </div>
      <div class="form-group">
        <label for="redirectUris">重定向 URI（每行一个）</label>
        <textarea id="redirectUris" name="redirectUris" rows="3" required placeholder="https://app.example.com/callback"></textarea>
      </div>
      <button type="submit" class="btn btn-primary">创建</button>
      <button type="button" onclick="document.getElementById('createAppForm').style.display='none'" class="btn" style="background:#f3f4f6;color:#555">取消</button>
    </form>
  </div>
  <div class="card" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table style="table-layout:fixed;min-width:550px">
      <colgroup>
        <col style="width:22%">
        <col style="width:18%">
        <col class="hide-mobile" style="width:14%">
        <col class="hide-mobile" style="width:18%">
        <col style="width:28%">
      </colgroup>
      <thead><tr>
        <th>客户端 ID</th>
        <th>名称</th>
        <th class="hide-mobile">创建者</th>
        <th class="hide-mobile">创建时间</th>
        <th>操作</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>
${footer()}`;
  return new Response(layout('应用管理', body), { headers: { 'Content-Type': 'text/html' } });
}

// --- 应用详情 ---

export async function handleAdminAppDetail(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);

  const app = await store.getApp(clientId);
  if (!app) {
    return new Response('应用未找到', { status: 404 });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error') || '';
  const success = url.searchParams.get('success') || '';
  const newSecret = url.searchParams.get('newSecret') || '';

  const body = `
${navbar('管理后台', user)}
${adminNav('/admin/apps')}
<div class="container" style="max-width:800px">
  <a href="/admin/apps" style="display:inline-block;margin-bottom:16px">&larr; 返回应用列表</a>
  ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
  ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}

  <div class="card">
    <h1>${escapeHtml(app.name)}</h1>
    <table>
      <tr><th style="width:120px">客户端 ID</th><td><code>${escapeHtml(app.clientId)}</code></td></tr>
      <tr><th>名称</th><td>${escapeHtml(app.name)}</td></tr>
      <tr><th>创建时间</th><td>${new Date(app.createdAt).toLocaleString()}</td></tr>
      ${app.updatedAt ? `<tr><th>更新时间</th><td>${new Date(app.updatedAt).toLocaleString()}</td></tr>` : ''}
    </table>
  </div>

  <div class="card">
    <h2>客户端密钥</h2>
    ${newSecret ? `
    <div class="alert alert-warning" style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e">
      <strong>新密钥已生成！</strong> 请立即保存，此密钥将不再显示。
    </div>
    <div class="secret-box">${escapeHtml(newSecret)}</div>
    ` : `
    <p class="text-muted">密钥以 ${escapeHtml(app.clientSecret.substring(0, 20))}... 开头</p>
    `}
    <form method="POST" action="/api/admin/apps/${app.clientId}/regenerate-secret" style="margin-top:12px">
      <button type="submit" class="btn btn-sm btn-warning" onclick="return confirm('确定重新生成密钥？旧密钥将立即失效。')">重新生成密钥</button>
    </form>
  </div>

  <div class="card">
    <h2>编辑应用</h2>
    <form method="POST" action="/api/admin/apps/${app.clientId}/update">
      <div class="form-group">
        <label for="name">应用名称</label>
        <input type="text" id="name" name="name" value="${escapeHtml(app.name)}" required>
      </div>
      <div class="form-group">
        <label for="redirectUris">重定向 URI（每行一个）</label>
        <textarea id="redirectUris" name="redirectUris" rows="4" required>${app.redirectUris.map(uri => escapeHtml(uri)).join('\n')}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">保存修改</button>
    </form>
  </div>
</div>
${footer()}`;
  return new Response(layout('应用详情', body), { headers: { 'Content-Type': 'text/html' } });
}

// --- 管理后台 API ---

export async function handleAdminCreateUser(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const password = formData.get('password') as string || '';

  if (!name || !email || !password) {
    return new Response(null, { status: 302, headers: { Location: '/admin/users?error=missing_fields' } });
  }

  const pwError = validatePasswordStrength(password);
  if (pwError) {
    return new Response(null, { status: 302, headers: { Location: `/admin/users?error=${encodeURIComponent(pwError)}` } });
  }

  const store = new Store(env);
  const existing = await store.getUserByEmail(email);
  if (existing) {
    return new Response(null, { status: 302, headers: { Location: '/admin/users?error=email_exists' } });
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
  return new Response(null, { status: 302, headers: { Location: '/admin/users' } });
}

export async function handleAdminDeleteUser(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  const targetUser = await store.getUser(userId);
  if (targetUser && targetUser.role === 'admin') {
    return new Response(null, { status: 302, headers: { Location: '/admin/users?error=cannot_delete_admin' } });
  }

  await store.deleteUser(userId);
  return new Response(null, { status: 302, headers: { Location: '/admin/users' } });
}

export async function handleAdminUpdateUser(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  const target = await store.getUser(userId);
  if (!target) {
    return new Response(null, { status: 302, headers: { Location: '/admin/users?error=user_not_found' } });
  }

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const role = formData.get('role') as string || target.role;
  const newPassword = formData.get('newPassword') as string || '';

  if (!name || !email) {
    return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?error=字段不能为空` } });
  }

  if (email !== target.email) {
    const existing = await store.getUserByEmail(email);
    if (existing && existing.id !== userId) {
      return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?error=邮箱已被使用` } });
    }
  }

  const oldEmail = target.email;
  target.name = name;
  target.email = email;
  target.role = role as 'admin' | 'user';

  if (newPassword) {
    const pwError = validatePasswordStrength(newPassword);
    if (pwError) {
      return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?error=${encodeURIComponent(pwError)}` } });
    }
    const { hash, salt } = await hashPassword(newPassword);
    target.passwordHash = hash;
    target.passwordSalt = salt;
  }

  await store.updateUser(target, oldEmail);

  if (newPassword) {
    await store.deleteUserSessions(target.id);
  }

  return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?success=用户已更新` } });
}

export async function handleAdminBanUser(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  const target = await store.getUser(userId);
  if (!target) {
    return new Response(null, { status: 302, headers: { Location: '/admin/users?error=user_not_found' } });
  }

  if (target.role === 'admin') {
    return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?error=不能封禁管理员` } });
  }

  target.banned = !target.banned;
  target.bannedAt = target.banned ? new Date().toISOString() : undefined;

  await store.updateUser(target);

  const msg = target.banned ? '用户已封禁' : '用户已解封';
  return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?success=${encodeURIComponent(msg)}` } });
}

export async function handleAdminUserAppBan(request: Request, env: Env, userId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  const target = await store.getUser(userId);
  if (!target) {
    return new Response(null, { status: 302, headers: { Location: '/admin/users?error=user_not_found' } });
  }

  const formData = await request.formData();
  const clientId = formData.get('clientId') as string || '';

  if (!target.bannedApps) {
    target.bannedApps = [];
  }

  const idx = target.bannedApps.indexOf(clientId);
  if (idx >= 0) {
    target.bannedApps.splice(idx, 1);
  } else {
    target.bannedApps.push(clientId);
  }

  await store.updateUser(target);
  return new Response(null, { status: 302, headers: { Location: `/admin/users/${userId}?success=应用访问权限已更新` } });
}

export async function handleAdminCreateApp(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const redirectUrisRaw = formData.get('redirectUris') as string || '';

  if (!name || !redirectUrisRaw) {
    return new Response(null, { status: 302, headers: { Location: '/admin/apps?error=missing_fields' } });
  }

  const redirectUris = redirectUrisRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);

  const app: OAuthApp = {
    clientId: generateClientId(),
    clientSecret: generateClientSecret(),
    name,
    redirectUris,
    createdAt: new Date().toISOString(),
    userId: user.id,
  };

  const store = new Store(env);
  await store.createApp(app);

  const body = `
<div class="container" style="max-width:600px;margin:40px auto">
<div class="card">
<h1>应用创建成功</h1>
<p style="margin-bottom:16px">请保存以下凭据。客户端密钥将不再显示。</p>
<div class="form-group"><label>客户端 ID</label><div class="secret-box">${escapeHtml(app.clientId)}</div></div>
<div class="form-group"><label>客户端密钥</label><div class="secret-box">${escapeHtml(app.clientSecret)}</div></div>
<div class="form-group"><label>重定向 URI</label><div>${redirectUris.map(uri => escapeHtml(uri)).join(', ')}</div></div>
<a href="/admin/apps/${app.clientId}" class="btn btn-primary mt-4">查看应用详情</a>
</div>
</div>`;

  return new Response(layout('应用创建成功', body), { headers: { 'Content-Type': 'text/html' } });
}

export async function handleAdminDeleteApp(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  await store.deleteApp(clientId);
  return new Response(null, { status: 302, headers: { Location: '/admin/apps' } });
}

export async function handleAdminUpdateApp(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  const app = await store.getApp(clientId);
  if (!app) {
    return new Response(null, { status: 302, headers: { Location: '/admin/apps?error=app_not_found' } });
  }

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const redirectUrisRaw = formData.get('redirectUris') as string || '';

  if (!name || !redirectUrisRaw) {
    return new Response(null, { status: 302, headers: { Location: `/admin/apps/${clientId}?error=字段不能为空` } });
  }

  app.name = name;
  app.redirectUris = redirectUrisRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  app.updatedAt = new Date().toISOString();

  await store.updateApp(app);
  return new Response(null, { status: 302, headers: { Location: `/admin/apps/${clientId}?success=应用已更新` } });
}

export async function handleAdminRegenerateSecret(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const store = new Store(env);
  const app = await store.getApp(clientId);
  if (!app) {
    return new Response(null, { status: 302, headers: { Location: '/admin/apps?error=app_not_found' } });
  }

  app.clientSecret = generateClientSecret();
  app.updatedAt = new Date().toISOString();

  await store.updateApp(app);

  const encodedSecret = encodeURIComponent(app.clientSecret);
  return new Response(null, { status: 302, headers: { Location: `/admin/apps/${clientId}?success=密钥已重新生成&newSecret=${encodedSecret}` } });
}

// --- 接入文档 ---

export async function handleDocs(request: Request, env: Env): Promise<Response> {
  const body = `
<nav style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 20px">
<div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:56px">
<div style="display:flex;align-items:center;gap:12px">
<a href="/" style="font-size:20px;font-weight:700;color:#1a73e8;text-decoration:none">SilkPortal</a>
<span style="color:#999">|</span>
<span style="color:#555;font-weight:500">接入文档</span>
</div>
<a href="/" class="btn btn-sm" style="background:#eef2ff;color:#1a73e8">返回首页</a>
</div>
</nav>
<div class="container" style="max-width:800px">
  <h1 style="margin-bottom:8px">接入文档</h1>
  <p class="text-muted" style="margin-bottom:24px">SilkPortal 基于 OAuth 2.0 + OpenID Connect 标准协议，提供统一的身份认证服务。</p>

  <div class="card">
    <h2>一、概述</h2>
    <p>SilkPortal 是一个轻量级 SSO（单点登录）系统，支持以下标准协议：</p>
    <ul style="margin:12px 0 0 20px;color:#666;line-height:2">
      <li><strong>OAuth 2.0 Authorization Code 流程</strong> — 授权码模式，最安全的授权方式</li>
      <li><strong>PKCE（Proof Key for Code Exchange）</strong> — 增强安全性，防止授权码拦截攻击</li>
      <li><strong>OpenID Connect</strong> — 基于 OAuth 2.0 的身份认证层，提供 ID Token</li>
      <li><strong>Refresh Token</strong> — 支持令牌刷新，延长会话有效期</li>
    </ul>
  </div>

  <div class="card">
    <h2>二、创建应用</h2>
    <p>登录后进入 <a href="/apps">我的应用</a> 页面创建应用，获取以下凭据：</p>
    <ul style="margin:12px 0 0 20px;color:#666;line-height:2">
      <li><strong>client_id</strong> — 应用唯一标识</li>
      <li><strong>client_secret</strong> — 应用密钥（请妥善保存）</li>
      <li><strong>redirect_uri</strong> — 授权回调地址，需提前配置</li>
    </ul>
  </div>

  <div class="card">
    <h2>三、认证流程</h2>
    <h3 style="margin:16px 0 8px;font-size:15px">1. 构造授权链接</h3>
    <div class="secret-box" style="background:#f3f4f6;border:1px solid #d0d5dd;font-size:13px;word-break:break-all">
GET ${env.SSO_BASE_URL || 'https://sso.example.com'}/authorize?<br>
&nbsp;&nbsp;response_type=code<br>
&nbsp;&nbsp;client_id=&lt;your_client_id&gt;<br>
&nbsp;&nbsp;redirect_uri=&lt;your_redirect_uri&gt;<br>
&nbsp;&nbsp;scope=openid%20email<br>
&nbsp;&nbsp;state=&lt;random_state&gt;<br>
&nbsp;&nbsp;code_challenge=&lt;S256_challenge&gt;&amp;code_challenge_method=S256
    </div>

    <h3 style="margin:16px 0 8px;font-size:15px">2. 用户登录并授权</h3>
    <p>用户将被重定向到 SilkPortal 登录页面，登录后用户确认授权，浏览器将重定向回您的应用：</p>
    <div class="secret-box" style="background:#f3f4f6;border:1px solid #d0d5dd;font-size:13px">
GET &lt;your_redirect_uri&gt;?code=&lt;auth_code&gt;&amp;state=&lt;original_state&gt;
    </div>

    <h3 style="margin:16px 0 8px;font-size:15px">3. 换取令牌</h3>
    <p>使用授权码向令牌端点发起 POST 请求：</p>
    <div class="secret-box" style="background:#f3f4f6;border:1px solid #d0d5dd;font-size:13px;line-height:1.8">
POST ${env.SSO_BASE_URL || 'https://sso.example.com'}/token<br>
Content-Type: application/x-www-form-urlencoded<br><br>
grant_type=authorization_code<br>
code=&lt;auth_code&gt;<br>
redirect_uri=&lt;your_redirect_uri&gt;<br>
client_id=&lt;your_client_id&gt;<br>
client_secret=&lt;your_client_secret&gt;<br>
code_verifier=&lt;original_code_verifier&gt;
    </div>

    <h3 style="margin:16px 0 8px;font-size:15px">4. 获取用户信息</h3>
    <p>使用 access_token 调用 UserInfo 端点：</p>
    <div class="secret-box" style="background:#f3f4f6;border:1px solid #d0d5dd;font-size:13px;line-height:1.8">
GET ${env.SSO_BASE_URL || 'https://sso.example.com'}/userinfo<br>
Authorization: Bearer &lt;access_token&gt;
    </div>
    <p style="margin-top:8px">返回示例：</p>
    <div class="secret-box" style="background:#f3f4f6;border:1px solid #d0d5dd;font-size:13px;line-height:1.8">
{<br>
&nbsp;&nbsp;"sub": "user_xxx",<br>
&nbsp;&nbsp;"email": "user@example.com",<br>
&nbsp;&nbsp;"name": "用户名"<br>
}
    </div>
  </div>

  <div class="card">
    <h2>四、端点列表</h2>
    <table style="table-layout:fixed">
      <colgroup><col style="width:25%"><col style="width:50%"><col style="width:25%"></colgroup>
      <thead><tr><th>端点</th><th>说明</th><th>方法</th></tr></thead>
      <tbody>
        <tr><td><code>/authorize</code></td><td>OAuth 授权端点</td><td>GET</td></tr>
        <tr><td><code>/token</code></td><td>OAuth 令牌端点</td><td>POST</td></tr>
        <tr><td><code>/userinfo</code></td><td>用户信息端点</td><td>GET</td></tr>
        <tr><td><code>/.well-known/jwks.json</code></td><td>JWK 公钥端点</td><td>GET</td></tr>
        <tr><td><code>/login</code></td><td>用户登录页面</td><td>GET/POST</td></tr>
        <tr><td><code>/logout</code></td><td>退出登录</td><td>GET</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>五、curl 示例</h2>
    <h3 style="margin:16px 0 8px;font-size:15px">获取 JWK 公钥</h3>
    <div class="secret-box" style="background:#111;border:1px solid #333;font-size:13px;color:#e5e7eb">
curl -s ${env.SSO_BASE_URL || 'https://sso.example.com'}/.well-known/jwks.json | jq
    </div>

    <h3 style="margin:16px 0 8px;font-size:15px">验证 ID Token</h3>
    <p>ID Token 是 RS256 签名的 JWT，可使用 JWK 端点获取公钥进行验证。<br>
    Token 中包含 <code>iss</code>、<code>sub</code>、<code>aud</code>、<code>exp</code>、<code>email</code>、<code>name</code> 等声明。</p>
  </div>
</div>
${footer()}`;
  return new Response(layout('接入文档', body), { headers: { 'Content-Type': 'text/html' } });
}

// --- 用户应用管理 ---

async function requireUser(request: Request, env: Env): Promise<{ session: Session; user: User } | Response> {
  const store = new Store(env);
  const session = await getSessionFromCookie(request, store);
  if (!session) {
    return new Response(null, { status: 302, headers: { Location: '/login?redirect=/apps' } });
  }
  const user = await store.getUser(session.userId);
  if (!user) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  if (user.banned) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  return { session, user };
}

async function verifyAppOwnership(app: OAuthApp | null, userId: string): Promise<boolean> {
  return app !== null && app.userId === userId;
}

export async function handleUserApps(request: Request, env: Env): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);
  const allApps = await store.listApps();
  const myApps = allApps.filter(a => a.userId === user.id);

  const rows = myApps.map(a => `
<tr>
  <td style="font-family:monospace;font-size:13px" title="${escapeHtml(a.clientId)}">${escapeHtml(a.clientId.substring(0, 12))}...</td>
  <td>${escapeHtml(a.name)}</td>
  <td class="text-muted">${new Date(a.createdAt).toLocaleDateString()}</td>
  <td>
    <a href="/apps/${a.clientId}" class="btn btn-sm" style="background:#eef2ff;color:#1a73e8">详情</a>
    <form method="POST" action="/api/apps/${a.clientId}/delete" style="display:inline">
      <button type="submit" class="btn btn-sm btn-danger" onclick="return confirm('确定删除 ${escapeHtml(a.name)}？')">删除</button>
    </form>
  </td>
</tr>`).join('');

  const body = `
${navbar('我的应用', user)}
<div class="container">
  <div class="flex mb-4">
    <h1>我的应用</h1>
    <button onclick="document.getElementById('createAppForm').style.display='block'" class="btn btn-primary btn-sm" style="flex-shrink:0">创建应用</button>
  </div>
  <div id="createAppForm" class="card" style="display:none;margin-bottom:20px">
    <h2>创建应用</h2>
    <form method="POST" action="/api/apps">
      <div class="form-group">
        <label for="name">应用名称</label>
        <input type="text" id="name" name="name" required placeholder="我的应用名称">
      </div>
      <div class="form-group">
        <label for="redirectUris">重定向 URI（每行一个）</label>
        <textarea id="redirectUris" name="redirectUris" rows="3" required placeholder="https://app.example.com/callback"></textarea>
      </div>
      <button type="submit" class="btn btn-primary">创建</button>
      <button type="button" onclick="document.getElementById('createAppForm').style.display='none'" class="btn" style="background:#f3f4f6;color:#555">取消</button>
    </form>
  </div>
  ${myApps.length === 0 ? '<div class="card" style="text-align:center;padding:48px"><p class="text-muted" style="margin-bottom:16px;font-size:15px">您还没有创建任何应用</p><p style="font-size:13px">点击上方"创建应用"按钮开始接入 SSO</p></div>' : `
  <div class="card" style="overflow-x:auto;-webkit-overflow-scrolling:touch">
    <table style="table-layout:fixed;min-width:500px">
      <colgroup>
        <col style="width:30%">
        <col style="width:25%">
        <col class="hide-mobile" style="width:22%">
        <col style="width:23%">
      </colgroup>
      <thead><tr>
        <th>客户端 ID</th>
        <th>名称</th>
        <th class="hide-mobile">创建时间</th>
        <th>操作</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`}
</div>
${footer()}`;
  return new Response(layout('我的应用', body), { headers: { 'Content-Type': 'text/html' } });
}

export async function handleUserCreateApp(request: Request, env: Env): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const redirectUrisRaw = formData.get('redirectUris') as string || '';

  if (!name || !redirectUrisRaw) {
    return new Response(null, { status: 302, headers: { Location: '/apps?error=请填写所有字段' } });
  }

  const redirectUris = redirectUrisRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);

  const app: OAuthApp = {
    clientId: generateClientId(),
    clientSecret: generateClientSecret(),
    name,
    redirectUris,
    createdAt: new Date().toISOString(),
    userId: user.id,
  };

  const store = new Store(env);
  await store.createApp(app);

  const body = `
${navbar('我的应用', user)}
<div class="container" style="max-width:600px;margin:40px auto">
<div class="card">
<h1>应用创建成功</h1>
<p style="margin-bottom:16px">请保存以下凭据。客户端密钥将不再显示。</p>
<div class="form-group"><label>客户端 ID</label><div class="secret-box">${escapeHtml(app.clientId)}</div></div>
<div class="form-group"><label>客户端密钥</label><div class="secret-box">${escapeHtml(app.clientSecret)}</div></div>
<div class="form-group"><label>重定向 URI</label><div>${redirectUris.map(uri => escapeHtml(uri)).join(', ')}</div></div>
<a href="/apps/${app.clientId}" class="btn btn-primary mt-4">查看应用详情</a>
</div>
</div>
${footer()}`;
  return new Response(layout('应用创建成功', body), { headers: { 'Content-Type': 'text/html' } });
}

export async function handleUserAppDetail(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);

  const app = await store.getApp(clientId);
  if (!app || !(await verifyAppOwnership(app, user.id)) && user.role !== 'admin') {
    return new Response('应用未找到', { status: 404 });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error') || '';
  const success = url.searchParams.get('success') || '';
  const newSecret = url.searchParams.get('newSecret') || '';

  const body = `
${navbar('我的应用', user)}
<div class="container" style="max-width:800px">
  <a href="/apps" style="display:inline-block;margin-bottom:16px">&larr; 返回应用列表</a>
  ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
  ${success ? `<div class="alert alert-success">${escapeHtml(success)}</div>` : ''}

  <div class="card">
    <h1>${escapeHtml(app.name)}</h1>
    <table>
      <tr><th style="width:120px">客户端 ID</th><td><code>${escapeHtml(app.clientId)}</code></td></tr>
      <tr><th>名称</th><td>${escapeHtml(app.name)}</td></tr>
      <tr><th>创建时间</th><td>${new Date(app.createdAt).toLocaleString()}</td></tr>
      ${app.updatedAt ? `<tr><th>更新时间</th><td>${new Date(app.updatedAt).toLocaleString()}</td></tr>` : ''}
    </table>
  </div>

  <div class="card">
    <h2>客户端密钥</h2>
    ${newSecret ? `
    <div class="alert alert-warning" style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e">
      <strong>新密钥已生成！</strong> 请立即保存，此密钥将不再显示。
    </div>
    <div class="secret-box">${escapeHtml(newSecret)}</div>
    ` : `
    <p class="text-muted">密钥以 ${escapeHtml(app.clientSecret.substring(0, 20))}... 开头</p>
    `}
    <form method="POST" action="/api/apps/${app.clientId}/regenerate-secret" style="margin-top:12px">
      <button type="submit" class="btn btn-sm btn-warning" onclick="return confirm('确定重新生成密钥？旧密钥将立即失效。')">重新生成密钥</button>
    </form>
  </div>

  <div class="card">
    <h2>编辑应用</h2>
    <form method="POST" action="/api/apps/${app.clientId}/update">
      <div class="form-group">
        <label for="name">应用名称</label>
        <input type="text" id="name" name="name" value="${escapeHtml(app.name)}" required>
      </div>
      <div class="form-group">
        <label for="redirectUris">重定向 URI（每行一个）</label>
        <textarea id="redirectUris" name="redirectUris" rows="4" required>${app.redirectUris.map(uri => escapeHtml(uri)).join('\n')}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">保存修改</button>
    </form>
  </div>
</div>
${footer()}`;
  return new Response(layout('应用详情', body), { headers: { 'Content-Type': 'text/html' } });
}

export async function handleUserDeleteApp(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);

  const app = await store.getApp(clientId);
  if (!app || !(await verifyAppOwnership(app, user.id))) {
    return new Response(null, { status: 302, headers: { Location: '/apps?error=应用未找到' } });
  }

  await store.deleteApp(clientId);
  return new Response(null, { status: 302, headers: { Location: '/apps' } });
}

export async function handleUserUpdateApp(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);

  const app = await store.getApp(clientId);
  if (!app || !(await verifyAppOwnership(app, user.id))) {
    return new Response(null, { status: 302, headers: { Location: '/apps?error=应用未找到' } });
  }

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const redirectUrisRaw = formData.get('redirectUris') as string || '';

  if (!name || !redirectUrisRaw) {
    return new Response(null, { status: 302, headers: { Location: `/apps/${clientId}?error=字段不能为空` } });
  }

  app.name = name;
  app.redirectUris = redirectUrisRaw.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  app.updatedAt = new Date().toISOString();

  await store.updateApp(app);
  return new Response(null, { status: 302, headers: { Location: `/apps/${clientId}?success=应用已更新` } });
}

export async function handleUserRegenerateSecret(request: Request, env: Env, clientId: string): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  const store = new Store(env);

  const app = await store.getApp(clientId);
  if (!app || !(await verifyAppOwnership(app, user.id))) {
    return new Response(null, { status: 302, headers: { Location: '/apps?error=应用未找到' } });
  }

  app.clientSecret = generateClientSecret();
  app.updatedAt = new Date().toISOString();

  await store.updateApp(app);

  const encodedSecret = encodeURIComponent(app.clientSecret);
  return new Response(null, { status: 302, headers: { Location: `/apps/${clientId}?success=密钥已重新生成&newSecret=${encodedSecret}` } });
}

export async function handleSetupPost(request: Request, env: Env): Promise<Response> {
  const store = new Store(env);

  if (await store.hasUsers()) {
    return new Response('设置已完成', { status: 400 });
  }

  const formData = await request.formData();
  const name = (formData.get('name') as string || '').trim();
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const password = formData.get('password') as string || '';

  if (!name || !email || !password) {
    return new Response('输入无效', { status: 400 });
  }
  const pwError = validatePasswordStrength(password);
  if (pwError) {
    return new Response(pwError, { status: 400 });
  }

  const { hash, salt } = await hashPassword(password);
  const user: User = {
    id: generateUserId(),
    email,
    name,
    passwordHash: hash,
    passwordSalt: salt,
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  await store.createUser(user);
  return new Response(null, { status: 302, headers: { Location: '/admin' } });
}
