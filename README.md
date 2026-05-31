# SilkPortal 单点登录

基于 **Cloudflare Workers** 构建的完整单点登录（SSO）系统，采用 OAuth 2.0 / OpenID Connect 授权码流程，支持 PKCE 和 RS256 签名的 JWT。

## 架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   演示应用       │────>│   认证服务        │<────│   管理后台       │
│  (你的服务)      │     │  (SSO 服务器)     │     │  (Web 界面)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
               ┌────┴──┐ ┌────┴──┐ ┌────┴──┐
               │会话    │ │授权码  │ │用户    │
               │  KV    │ │  KV   │ │  KV    │
               ├────────┤ ├───────┤ ├───────┤
               │应用    │ │刷新    │ │RSA    │
               │  KV    │ │令牌    │ │密钥    │
               │        │ │  KV   │ │  KV    │
               └────────┘ └───────┘ └───────┘
```

### 组件

| 组件 | 目录 | 说明 |
|------|------|------|
| 认证服务 | `auth-worker/` | SSO 服务器 — 处理登录、OAuth2 流程、令牌签发、JWKS、用户信息、管理 API |
| 演示应用 | `example-app/` | 受保护的应用示例，展示 SSO 集成方式 |
| 管理后台 | (内置在 auth-worker 中) | Web 界面 — 管理用户、OAuth 应用、监控会话 |

## 功能特性

- **OAuth 2.0 授权码流程** — 标准安全协议
- **OpenID Connect** — 携带用户身份声明的 ID 令牌
- **PKCE 支持** — 面向公共客户端的代码交换验证密钥
- **RS256 签名 JWT** — RSA-256 签名的访问令牌与 ID 令牌
- **JWKS 端点** — `/.well-known/jwks.json` 用于令牌验证
- **刷新令牌** — 支持长期有效的刷新令牌轮换
- **会话管理** — 基于 Cookie 的 Web 会话，可配置有效期
- **管理仪表盘** — 管理用户、OAuth 应用，查看活跃会话
- **零运行时依赖** — 纯 Web Crypto API，无需 npm 运行时包

## 快速开始

### 1. 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：`npm install -g wrangler`
- 一个 [Cloudflare](https://cloudflare.com) 账户

### 2. 创建 KV 命名空间

```bash
cd auth-worker

npx wrangler kv:namespace create "SESSIONS"
npx wrangler kv:namespace create "AUTH_CODES"
npx wrangler kv:namespace create "USERS"
npx wrangler kv:namespace create "APPS"
npx wrangler kv:namespace create "REFRESH_TOKENS"
npx wrangler kv:namespace create "RSA_KEYS"
```

将返回的 ID 填入 `auth-worker/wrangler.toml`：

```toml
kv_namespaces = [
  { binding = "SESSIONS", id = "abc123..." },
  { binding = "AUTH_CODES", id = "def456..." },
  { binding = "USERS", id = "ghi789..." },
  { binding = "APPS", id = "jkl012..." },
  { binding = "REFRESH_TOKENS", id = "mno345..." },
  { binding = "RSA_KEYS", id = "pqr678..." }
]
```

### 3. 配置 SSO 基础 URL

在 `auth-worker/wrangler.toml` 中设置你的 SSO 域名：

```toml
[vars]
SSO_BASE_URL = "https://auth.yourdomain.com"
```

本地开发可使用：`SSO_BASE_URL = "http://localhost:8787"`

### 4. 部署认证服务

```bash
cd auth-worker
npm install
npx wrangler deploy
```

### 5. 初始设置

访问 `https://<your-worker>/setup` 创建第一个管理员用户。

也可先部署再在本地访问 `/setup`：

```bash
npx wrangler dev
# 打开 http://localhost:8787/setup
```

### 6. 创建 OAuth 应用

1. 使用管理员账号登录管理后台 `/admin`
2. 进入 **应用管理** → **创建应用**
3. 输入名称和重定向 URI（例如 `http://localhost:8080/callback`）
4. 保存 **客户端 ID** 和 **客户端密钥** — 仅显示一次

### 7. 配置并部署演示应用

编辑 `example-app/wrangler.toml`：

```toml
[vars]
SSO_AUTH_URL = "https://<your-auth-worker>.workers.dev"
SSO_CLIENT_ID = "client_xxx..."
SSO_CLIENT_SECRET = "secret_yyy..."
```

```bash
cd example-app
npm install
npx wrangler deploy
```

访问你的演示应用，点击 **通过 SilkPortal 登录**。

## API 参考

### 授权端点

```
GET /authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=openid+email+profile&state={state}
```

| 参数 | 必需 | 说明 |
|------|------|------|
| `client_id` | 是 | 应用的客户端 ID |
| `redirect_uri` | 是 | 必须匹配已注册的 URI 之一 |
| `response_type` | 是 | 必须为 `code` |
| `scope` | 否 | 空格分隔的作用域（`openid`、`email`、`profile`） |
| `state` | 否 | 用于 CSRF 保护的不透明值（推荐） |
| `code_challenge` | 否 | PKCE 代码挑战（S256 哈希） |
| `code_challenge_method` | 否 | `S256`（推荐）或 `plain` |

### 令牌端点

```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={code}&redirect_uri={redirect_uri}&client_id={client_id}&client_secret={client_secret}
```

| 参数 | 使用场景 | 说明 |
|------|----------|------|
| `grant_type` | 全部 | `authorization_code` 或 `refresh_token` |
| `code` | 授权码 | 授权码 |
| `redirect_uri` | 授权码 | 必须与原始请求一致 |
| `client_id` | 全部 | 应用的客户端 ID |
| `client_secret` | 全部 | 应用的客户端密钥 |
| `code_verifier` | PKCE | PKCE 代码验证器 |
| `refresh_token` | 刷新 | 刷新令牌 |

#### 响应

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "eyJ...",
  "refresh_token": "ref_xxx..."
}
```

### 用户信息端点

```
GET /userinfo
Authorization: Bearer {access_token}
```

#### 响应

```json
{
  "sub": "user_xxx...",
  "email": "user@example.com",
  "name": "张三"
}
```

### JWKS 端点

```
GET /.well-known/jwks.json
```

返回用于验证 JWT 签名的 RSA 公钥。

### 退出登录

```
GET /logout
```

清除会话 Cookie。

## 令牌验证

服务可以使用 JWKS 端点验证访问令牌。Node.js 示例：

```javascript
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

const client = jwksClient({ jwksUri: 'https://auth.example.com/.well-known/jwks.json' });

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(null, key.getPublicKey());
  });
}

jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
  if (err) return console.error('令牌无效');
  console.log('已认证用户:', decoded.sub);
});
```

## 接入指南

本节说明如何将你的应用程序接入 SilkPortal SSO 进行身份认证。

### 接入流程概述

所有应用类型遵循同样的 OAuth 2.0 授权码流程：

```
用户 → 点击"登录" → 跳转到 SSO 登录页 → 输入凭证 → SSO 回调应用
                                                                ↓
应用 ← 获取用户信息 ← 用授权码换取令牌 ← code 参数在回调 URL 中
```

### 1. Web 服务端应用（推荐）

适用于传统的后端渲染 Web 应用（如 Node.js Express、Python Django、Java Spring Boot 等）。

**步骤：**

1. 在 SilkPortal 管理后台创建应用，填入重定向 URI（例如 `https://yourapp.com/auth/callback`）
2. 保存 `client_id` 和 `client_secret` 到服务器环境变量
3. 引导用户跳转到 SSO 授权页面：

```text
GET {SSO_BASE_URL}/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope=openid+email+profile&state={STATE}
```

4. 用户登录后，SSO 将用户重定向回你的回调地址，携带 `code` 和 `state` 参数
5. 在回调处理中，验证 `state` 后，用授权码换取令牌：

```text
POST {SSO_BASE_URL}/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={CODE}&redirect_uri={REDIRECT_URI}&client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}
```

6. 从响应中获取 `access_token` 和 `id_token`，调用用户信息接口获取用户详情：

```text
GET {SSO_BASE_URL}/userinfo
Authorization: Bearer {ACCESS_TOKEN}
```

**Node.js (Express) 示例：**

```javascript
const express = require('express');
const app = express();
const SSO_BASE = 'https://auth.yourdomain.com';
const CLIENT_ID = process.env.SSO_CLIENT_ID;
const CLIENT_SECRET = process.env.SSO_CLIENT_SECRET;
const REDIRECT_URI = 'https://yourapp.com/auth/callback';

// 步骤 1：发起登录
app.get('/login', (req, res) => {
  const state = crypto.randomUUID();
  req.session.ssoState = state; // 存入会话，回调时验证
  const url = `${SSO_BASE}/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid+email+profile&state=${state}`;
  res.redirect(url);
});

// 步骤 2：处理回调
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.ssoState) return res.status(400).send('State mismatch');

  // 用授权码换取令牌
  const tokenRes = await fetch(`${SSO_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    }),
  });
  const tokens = await tokenRes.json();

  // 获取用户信息
  const userRes = await fetch(`${SSO_BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userRes.json();

  // 创建本地会话
  req.session.user = user;
  res.redirect('/dashboard');
});
```

### 2. 单页应用（SPA）

适用于浏览器端渲染的应用（如 React、Vue、Angular），不持有 `client_secret`，必须使用 PKCE。

**步骤：**

1. 在管理后台创建应用时勾选或确认使用 PKCE（授权码流程 + PKCE）
2. 前端生成 `code_verifier` 和 `code_challenge`（S256 哈希）
3. 将 `code_challenge` 随授权请求发送：

```text
GET {SSO_BASE_URL}/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope=openid+email+profile&state={STATE}&code_challenge={CHALLENGE}&code_challenge_method=S256
```

4. 回调时，用 `code_verifier` 换取令牌：

```text
POST {SSO_BASE_URL}/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={CODE}&redirect_uri={REDIRECT_URI}&client_id={CLIENT_ID}&code_verifier={VERIFIER}
```

**React 示例：**

```javascript
// PKCE 工具函数
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function generateRandomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 发起登录
async function login() {
  const verifier = generateRandomString(32);
  const challenge = await generateCodeChallenge(verifier);
  // 将 verifier 存入 localStorage 以便回调时使用
  localStorage.setItem('pkce_verifier', verifier);

  const state = generateRandomString(16);
  localStorage.setItem('sso_state', state);

  const params = new URLSearchParams({
    client_id: 'YOUR_CLIENT_ID',
    redirect_uri: `${window.location.origin}/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `${SSO_BASE_URL}/authorize?${params}`;
}

// 处理回调
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const storedState = localStorage.getItem('sso_state');

  if (!state || state !== storedState) throw new Error('State mismatch');
  localStorage.removeItem('sso_state');

  const verifier = localStorage.getItem('pkce_verifier');
  localStorage.removeItem('pkce_verifier');

  const res = await fetch(`${SSO_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code,
      redirect_uri: `${window.location.origin}/callback`,
      client_id: 'YOUR_CLIENT_ID',
      code_verifier: verifier,
    }),
  });
  const tokens = await res.json();
  // tokens.access_token 可用于后续 API 请求
}
```

### 3. 移动端 / 桌面应用

流程与 SPA 相同（使用 PKCE），区别在于：

- **重定向 URI**：使用自定义协议（如 `myapp://auth/callback`）或 `http://127.0.0.1:{PORT}`
- **浏览器**：使用系统浏览器或 WebView 打开 SSO 授权页
- **状态验证**：使用 Android `AppLinks` 或 iOS `Universal Links` 确保回调安全

推荐使用各平台的标准 OAuth 库：

| 平台 | 推荐库 |
|------|--------|
| Android | [AppAuth](https://github.com/openid/AppAuth-Android) |
| iOS / macOS | [AppAuth](https://github.com/openid/AppAuth-iOS) |
| Flutter | [flutter_appauth](https://pub.dev/packages/flutter_appauth) |
| React Native | [react-native-app-auth](https://github.com/FormidableLabs/react-native-app-auth) |
| Electron | [open](https://www.npmjs.com/package/open) + `openid-client` |

### 4. 后端服务内部认证

适用于微服务之间使用访问令牌验证身份，或资源服务器验证请求合法性。

**验证方式一：调用 UserInfo 端点**

```javascript
// 每次请求时调用 SSO 验证令牌
async function authenticate(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) throw new Error('Missing token');

  const res = await fetch(`${SSO_BASE_URL}/userinfo`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) throw new Error('Invalid token');
  return res.json(); // 返回 { sub, email, name }
}
```

**验证方式二：本地验证 JWT（推荐——无网络开销）**

使用 SSO 的 JWKS 端点获取公钥，在本地验证 JWT 签名。

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: 'https://auth.yourdomain.com/.well-known/jwks.json',
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(null, key.getPublicKey());
  });
}

// 验证中间件
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).end();

  jwt.verify(auth.slice(7), getSigningKey, { algorithms: ['RS256'] }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'invalid_token' });
    req.user = decoded; // { iss, sub, aud, exp, iat, scope }
    next();
  });
}
```

**Python 示例（本地验证）：**

```python
import jwt
import requests

# 获取 JWKS
jwks = requests.get('https://auth.yourdomain.com/.well-known/jwks.json').json()

# 从 JWKS 中获取公钥
def get_public_key(kid):
    for key in jwks['keys']:
        if key['kid'] == kid:
            from jwt.algorithms import RSAAlgorithm
            return RSAAlgorithm.from_jwk(json.dumps(key))
    return None

# 验证令牌
def verify_token(access_token):
    header = jwt.get_unverified_header(access_token)
    public_key = get_public_key(header['kid'])
    if not public_key:
        return None
    try:
        return jwt.decode(access_token, public_key, algorithms=['RS256'],
                          audience='YOUR_CLIENT_ID')
    except jwt.PyJWTError:
        return None
```

**Go 示例（本地验证）：**

```go
import (
    "context"
    "github.com/lestrrat-go/jwx/jwk"
    "github.com/lestrrat-go/jwx/jwt"
)

func verifyToken(ctx context.Context, tokenString string) (jwt.Token, error) {
    set, err := jwk.Fetch(ctx, "https://auth.yourdomain.com/.well-known/jwks.json")
    if err != nil {
        return nil, err
    }
    token, err := jwt.ParseString(tokenString, jwt.WithKeySet(set))
    if err != nil {
        return nil, err
    }
    return token, nil
}
```

### 5. 使用刷新令牌

`access_token` 有效期 1 小时，过期后可用 `refresh_token` 获取新的令牌（无需用户重新登录）。

```text
POST {SSO_BASE_URL}/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={REFRESH_TOKEN}&client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}
```

成功响应会返回新的 `access_token`、`id_token` 和 `refresh_token`（旧 refresh_token 立即失效——即轮换机制）。

**注意事项：**

- `refresh_token` 有效期 30 天，过期后用户需重新登录
- 刷新令牌应安全存储（服务器端 session、HttpOnly Cookie 等）
- SPA 和移动应用应使用 PKCE 流程配合刷新令牌

### 6. 令牌中包含的信息

**访问令牌（Access Token）** 解析后的内容：

```json
{
  "iss": "https://auth.yourdomain.com",
  "sub": "user_xxx...",
  "aud": "client_xxx...",
  "exp": 1700000000,
  "iat": 1699996400,
  "scope": "openid email profile"
}
```

**ID 令牌（ID Token）** 解析后的内容：

```json
{
  "iss": "https://auth.yourdomain.com",
  "sub": "user_xxx...",
  "aud": "client_xxx...",
  "exp": 1700000000,
  "iat": 1699996400,
  "email": "user@example.com",
  "name": "张三"
}
```

| 字段 | 说明 |
|------|------|
| `iss` | 签发者，即 SSO 的 base URL |
| `sub` | 用户唯一标识 |
| `aud` | 目标客户端 ID |
| `exp` | 过期时间戳 |
| `iat` | 签发时间戳 |
| `scope` | 授权作用域（仅 access token） |
| `email` | 用户邮箱（仅 id token） |
| `name` | 用户姓名（仅 id token） |

## 管理后台

使用管理员账号登录后可在 `/admin` 访问。

### 用户管理

- **创建**：点击"创建用户"，填写姓名/邮箱/密码
- **删除**：点击非管理员用户的"删除"
- 用户可以是普通用户或管理员（首次通过 `/setup` 创建的用户为管理员）

### 应用管理

- **创建**：点击"创建应用"，输入名称和重定向 URI（每行一个）
- **删除**：点击"删除"移除应用
- 客户端密钥仅在创建时显示一次

## 配置

### 会话时长

编辑 `auth-worker/src/auth.ts` 中的常量：

```typescript
const SESSION_TTL_SECONDS = 86400 * 7;        // 7 天
const AUTH_CODE_TTL_SECONDS = 600;            // 10 分钟
const ACCESS_TOKEN_TTL_SECONDS = 3600;        // 1 小时
const REFRESH_TOKEN_TTL_SECONDS = 86400 * 30; // 30 天
```

### 密码哈希

PBKDF2 算法，100,000 次迭代，SHA-256。可在 `auth-worker/src/crypto.ts` 中配置。

## 本地开发

```bash
# 终端 1 — 认证服务
cd auth-worker
npm install
npx wrangler dev

# 终端 2 — 演示应用
cd example-app
npm install
npx wrangler dev
```

使用 `curl` 测试令牌流程：

```bash
# 获取授权码（在浏览器中打开，从重定向 URL 中获取 code）
# 或者使用 curl 配合会话 Cookie...

# 用授权码换取令牌
curl -X POST http://localhost:8787/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=CODE_HERE&redirect_uri=YOUR_REDIRECT_URI&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET"

# 获取用户信息
curl http://localhost:8787/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN_HERE"

# 获取 JWKS
curl http://localhost:8787/.well-known/jwks.json
```

## 安全注意事项

- **HTTPS**：部署到 Cloudflare 后所有端点强制使用 HTTPS
- **客户端密钥**：安全存储（环境变量、密钥管理器）
- **PKCE**：公共客户端（SPA、移动应用）务必使用 PKCE
- **令牌存储**：访问令牌应存储在内存中，而非 localStorage
- **速率限制**：未实现 — 如需可添加 Cloudflare WAF 规则
- **密码策略**：最少 8 位，可按需增强

## 项目结构

```
myauth/
├── package.json                    # 工作区脚本
├── README.md                       # 本文件
├── auth-worker/                    # SSO 服务器 Worker
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml               # Worker 配置 + KV 绑定
│   └── src/
│       ├── index.ts                # 入口，路由
│       ├── types.ts                # TypeScript 接口
│       ├── crypto.ts               # RSA、JWT、密码哈希、随机数
│       ├── store.ts                # KV 存储层
│       ├── html.ts                 # HTML 布局模板
│       ├── login.ts                # 登录页面渲染
│       ├── auth.ts                 # OAuth2 流程处理
│       └── admin.ts                # 管理后台 + API
└── example-app/                    # 演示应用
    ├── package.json
    ├── tsconfig.json
    ├── wrangler.toml
    └── src/
        └── index.ts                # 集成 SSO 的示例应用
```
