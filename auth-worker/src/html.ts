export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - SilkPortal</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; min-height: 100vh; display: flex; flex-direction: column; }
a { color: #1a73e8; text-decoration: none; }
a:hover { text-decoration: underline; }
.container { max-width: 960px; margin: 0 auto; padding: 20px; flex: 1; }
.card { background: #fff; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 32px; margin-bottom: 20px; }
.btn { display: inline-block; padding: 10px 24px; border-radius: 6px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; transition: background 0.2s; }
.btn-primary { background: #1a73e8; color: #fff; }
.btn-primary:hover { background: #1558b0; text-decoration: none; }
.btn-danger { background: #dc3545; color: #fff; }
.btn-danger:hover { background: #b02a37; text-decoration: none; }
.btn-warning { background: #f59e0b; color: #fff; }
.btn-warning:hover { background: #d97706; text-decoration: none; }
.btn-sm { padding: 6px 14px; font-size: 13px; }
input[type="text"], input[type="email"], input[type="password"], input[type="url"], textarea, select { width: 100%; padding: 10px 14px; border: 1px solid #d0d5dd; border-radius: 6px; font-size: 14px; outline: none; transition: border-color 0.2s; }
input:focus, textarea:focus { border-color: #1a73e8; box-shadow: 0 0 0 3px rgba(26,115,232,0.15); }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px; color: #555; }
.alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; }
.alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.alert-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.alert-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
th { font-weight: 600; color: #555; background: #f9fafb; }
tr:hover { background: #f9fafb; }
@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
  .card { padding: 20px; }
  th, td { padding: 10px 8px; font-size: 13px; }
  .container { padding: 12px; }
  .flex { gap: 12px; }
}
@media (min-width: 769px) and (max-width: 1024px) {
  .hide-tablet { display: none !important; }
}
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 500; }
.badge-admin { background: #fef3c7; color: #92400e; }
.badge-user { background: #dbeafe; color: #1e40af; }
.badge-banned { background: #fef2f2; color: #b91c1c; }
.badge-active { background: #f0fdf4; color: #15803d; }
h1 { font-size: 24px; margin-bottom: 8px; }
h2 { font-size: 20px; margin-bottom: 16px; }
p { color: #666; line-height: 1.6; }
.text-muted { color: #999; font-size: 13px; }
.text-sm { font-size: 13px; }
.mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; }
.mb-4 { margin-bottom: 16px; }
.flex { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
@media (max-width: 480px) { .flex { flex-direction: column; align-items: stretch; } .flex .btn { text-align: center; } }
.gap-2 { gap: 8px; }
.secret-box { background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:16px;margin:16px 0;word-break:break-all;font-family:monospace;font-size:14px }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function navbar(title: string, user?: { name: string; email: string }): string {
  return `<nav style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 20px">
<div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:56px">
<div style="display:flex;align-items:center;gap:12px">
<a href="/" style="font-size:20px;font-weight:700;color:#1a73e8;text-decoration:none">SilkPortal</a>
<span style="color:#999">|</span>
<span style="color:#555;font-weight:500">${escapeHtml(title)}</span>
</div>
<div style="display:flex;align-items:center;gap:8px">
<a href="/docs" style="font-size:14px;color:#666">接入文档</a>
${user ? `<a href="/apps" style="font-size:14px;color:#666;margin-left:4px">我的应用</a><a href="/profile" style="font-size:14px;color:#1a73e8;margin-left:4px">${escapeHtml(user.name)}</a><a href="/logout" class="btn btn-sm" style="background:#f3f4f6;color:#555">退出登录</a>` : `<a href="/login" style="font-size:14px;color:#1a73e8">登录</a><a href="/register" class="btn btn-sm btn-primary">注册</a>`}
</div>
</div>
</nav>`;
}

export function adminNav(current: string): string {
  const items = [
    { href: '/admin', label: '控制台' },
    { href: '/admin/users', label: '用户管理' },
    { href: '/admin/apps', label: '应用管理' },
  ];
  return `<nav style="background:#fff;border-bottom:1px solid #e5e7eb;padding:0 20px">
<div style="max-width:960px;margin:0 auto;display:flex;gap:4px;height:44px;align-items:center">
${items.map(i => `<a href="${i.href}" style="padding:8px 16px;border-radius:6px;font-size:14px;font-weight:500;color:${current === i.href ? '#1a73e8' : '#666'};background:${current === i.href ? '#eef2ff' : 'transparent'}">${escapeHtml(i.label)}</a>`).join('')}
</div>
</nav>`;
}

export function footer(): string {
  return `<footer style="text-align:center;padding:20px;color:#999;font-size:13px;border-top:1px solid #e5e7eb;margin-top:20px">
SilkPortal &middot; Cloudflare Workers
</footer>`;
}
