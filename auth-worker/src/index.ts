import { Env } from './types';
import { Store } from './store';
import { generateRsaKeyPair } from './crypto';
import { renderSetupPage, renderLandingPage } from './login';
import { getSessionFromCookie } from './auth';
import {
  handleLoginGet, handleLoginPost, handleRegisterGet, handleRegisterPost,
  handleAuthorizeGet, handleToken,
  handleLogout, handleUserinfo, handleJwks, jsonResponse,
  handleProfileGet, handleProfilePost, handleProfilePassword,
} from './auth';
import {
  handleAdminDashboard, handleAdminUsers, handleAdminUserDetail,
  handleAdminApps, handleAdminAppDetail,
  handleAdminCreateUser, handleAdminDeleteUser,
  handleAdminUpdateUser, handleAdminBanUser, handleAdminUserAppBan,
  handleAdminCreateApp, handleAdminDeleteApp,
  handleAdminUpdateApp, handleAdminRegenerateSecret,
  handleSetupPost, handleDocs,
  handleUserApps, handleUserCreateApp, handleUserAppDetail,
  handleUserDeleteApp, handleUserUpdateApp, handleUserRegenerateSecret,
} from './admin';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

async function initializeIfNeeded(env: Env): Promise<void> {
  const store = new Store(env);
  const hasKeys = await store.getRsaKeys();
  if (!hasKeys) {
    const keySet = await generateRsaKeyPair();
    await store.saveRsaKeys(keySet);
  }
}

async function handleCors(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  const response = await handleRequest(request, env);
  if (request.headers.get('Origin')) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  await initializeIfNeeded(env);

  // 公开端点
  if (path === '/login' || path === '/login/') {
    return method === 'GET' ? handleLoginGet(request, env) : handleLoginPost(request, env);
  }

  if (path === '/register') {
    return method === 'GET' ? handleRegisterGet(request, env) : new Response('不允许的方法', { status: 405 });
  }

  if (path === '/api/register' && method === 'POST') {
    return handleRegisterPost(request, env);
  }

  if (path === '/authorize' || path === '/authorize/') {
    if (method !== 'GET') return new Response('不允许的方法', { status: 405 });
    return handleAuthorizeGet(request, env);
  }

  if (path === '/token') {
    if (method !== 'POST') return new Response('不允许的方法', { status: 405 });
    return handleToken(request, env);
  }

  if (path === '/userinfo') {
    if (method !== 'GET') return new Response('不允许的方法', { status: 405 });
    return handleUserinfo(request, env);
  }

  if (path === '/.well-known/jwks.json') {
    if (method !== 'GET') return new Response('不允许的方法', { status: 405 });
    return handleJwks(request, env);
  }

  if (path === '/logout') {
    return handleLogout(request, env);
  }

  // 个人资料
  if (path === '/profile') {
    if (method === 'GET') return handleProfileGet(request, env);
    return new Response('不允许的方法', { status: 405 });
  }

  if (path === '/api/profile' && method === 'POST') {
    return handleProfilePost(request, env);
  }

  if (path === '/api/profile/password' && method === 'POST') {
    return handleProfilePassword(request, env);
  }

  // 初始设置
  if (path === '/setup') {
    const store = new Store(env);
    if (await store.hasUsers()) {
      return new Response('设置已完成', { status: 404 });
    }
    return new Response(renderSetupPage(), { headers: { 'Content-Type': 'text/html' } });
  }

  if (path === '/api/setup') {
    const store = new Store(env);
    if (await store.hasUsers()) {
      return jsonResponse({ error: 'already_initialized' }, 400);
    }
    return handleSetupPost(request, env);
  }

  // 用户应用管理
  if (path === '/apps' || path === '/apps/') {
    if (method === 'GET') return handleUserApps(request, env);
    return new Response('不允许的方法', { status: 405 });
  }

  if (path === '/api/apps' && method === 'POST') {
    return handleUserCreateApp(request, env);
  }

  const userAppDeleteMatch = path.match(/^\/api\/apps\/(.+?)\/delete$/);
  if (userAppDeleteMatch && method === 'POST') {
    return handleUserDeleteApp(request, env, userAppDeleteMatch[1]);
  }

  const userAppUpdateMatch = path.match(/^\/api\/apps\/(.+?)\/update$/);
  if (userAppUpdateMatch && method === 'POST') {
    return handleUserUpdateApp(request, env, userAppUpdateMatch[1]);
  }

  const userAppRegenMatch = path.match(/^\/api\/apps\/(.+?)\/regenerate-secret$/);
  if (userAppRegenMatch && method === 'POST') {
    return handleUserRegenerateSecret(request, env, userAppRegenMatch[1]);
  }

  const userAppDetailMatch = path.match(/^\/apps\/(.+)$/);
  if (userAppDetailMatch) {
    return handleUserAppDetail(request, env, userAppDetailMatch[1]);
  }

  // 管理后台
  if (path === '/admin' || path === '/admin/') {
    return handleAdminDashboard(request, env);
  }

  if (path === '/admin/users') {
    return handleAdminUsers(request, env);
  }

  if (path === '/admin/apps') {
    return handleAdminApps(request, env);
  }

  // 管理后台 — 用户详情 / 应用详情
  const userDetailMatch = path.match(/^\/admin\/users\/(.+)$/);
  if (userDetailMatch) {
    return handleAdminUserDetail(request, env, userDetailMatch[1]);
  }

  const appDetailMatch = path.match(/^\/admin\/apps\/(.+)$/);
  if (appDetailMatch) {
    return handleAdminAppDetail(request, env, appDetailMatch[1]);
  }

  // 管理后台 API — 用户
  if (path === '/api/admin/users' && method === 'POST') {
    return handleAdminCreateUser(request, env);
  }

  const deleteUserMatch = path.match(/^\/api\/admin\/users\/(.+?)\/delete$/);
  if (deleteUserMatch && method === 'POST') {
    return handleAdminDeleteUser(request, env, deleteUserMatch[1]);
  }

  const updateUserMatch = path.match(/^\/api\/admin\/users\/(.+?)\/update$/);
  if (updateUserMatch && method === 'POST') {
    return handleAdminUpdateUser(request, env, updateUserMatch[1]);
  }

  const banUserMatch = path.match(/^\/api\/admin\/users\/(.+?)\/ban$/);
  if (banUserMatch && method === 'POST') {
    return handleAdminBanUser(request, env, banUserMatch[1]);
  }

  const appBanUserMatch = path.match(/^\/api\/admin\/users\/(.+?)\/app-ban$/);
  if (appBanUserMatch && method === 'POST') {
    return handleAdminUserAppBan(request, env, appBanUserMatch[1]);
  }

  // 管理后台 API — 应用
  if (path === '/api/admin/apps' && method === 'POST') {
    return handleAdminCreateApp(request, env);
  }

  const deleteAppMatch = path.match(/^\/api\/admin\/apps\/(.+?)\/delete$/);
  if (deleteAppMatch && method === 'POST') {
    return handleAdminDeleteApp(request, env, deleteAppMatch[1]);
  }

  const updateAppMatch = path.match(/^\/api\/admin\/apps\/(.+?)\/update$/);
  if (updateAppMatch && method === 'POST') {
    return handleAdminUpdateApp(request, env, updateAppMatch[1]);
  }

  const regenSecretMatch = path.match(/^\/api\/admin\/apps\/(.+?)\/regenerate-secret$/);
  if (regenSecretMatch && method === 'POST') {
    return handleAdminRegenerateSecret(request, env, regenSecretMatch[1]);
  }

  // 接入文档
  if (path === '/docs' || path === '/docs/') {
    return handleDocs(request, env);
  }

  // 根路径 — 已登录用户跳转，未登录用户显示首页
  if (path === '/' || path === '') {
    const store = new Store(env);
    const session = await getSessionFromCookie(request, store);
    if (session) {
      const user = await store.getUser(session.userId);
      if (user && user.role === 'admin') {
        return new Response(null, { status: 302, headers: { Location: '/admin' } });
      }
      return new Response(null, { status: 302, headers: { Location: '/apps' } });
    }
    return new Response(renderLandingPage(), { headers: { 'Content-Type': 'text/html' } });
  }

  return new Response('未找到', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleCors(request, env);
  },
};
