# SilkPortal Auth Worker

轻量级 SSO 单点登录系统，基于 OAuth 2.0 + OpenID Connect 标准协议，运行在 Cloudflare Workers 上。

## 功能特性

- **OAuth 2.0 Authorization Code 流程** — 标准授权码模式
- **PKCE 支持** — 增强安全性，防止授权码拦截攻击
- **OpenID Connect** — 基于 JWT 的身份认证，RS256 签名
- **Refresh Token** — 支持令牌刷新，延长会话有效期
- **用户自服务** — 注册用户可自行创建和管理应用
- **应用隔离** — 各用户的应用数据互相隔离
- **管理后台** — 用户管理、应用管理、封禁、访问限制
- **Cloudflare Turnstile** — 可选的人机验证，防止自动化攻击
- **速率限制** — 登录接口内置暴力破解防护

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Cloudflare Workers (workerd) |
| 语言 | TypeScript (strict mode) |
| 存储 | Cloudflare KV（6 个 Namespace） |
| 认证协议 | OAuth 2.0 + OpenID Connect |
| JWT | RS256 (RSA 2048-bit) |
| 密码哈希 | PBKDF2 (SHA-256, 100k 次迭代) |
| 前端 | 服务端渲染 HTML，手写 CSS |

## 部署

### 前置条件

- Node.js >= 18
- Cloudflare 账户
- Wrangler CLI

### 安装

```bash
npm install
```

### 配置

在 `wrangler.toml` 中配置 KV Namespace 绑定：

```toml
kv_namespaces = [
  { binding = "SESSIONS", id = "..." },
  { binding = "AUTH_CODES", id = "..." },
  { binding = "USERS", id = "..." },
  { binding = "APPS", id = "..." },
  { binding = "REFRESH_TOKENS", id = "..." },
  { binding = "RSA_KEYS", id = "..." }
]

[vars]
SSO_BASE_URL = "https://sso.yourdomain.com"

# 可选：Cloudflare Turnstile 人机验证
# TURNSTILE_SITE_KEY = "1x000000000..."
# TURNSTILE_SECRET_KEY = "0x000000000..."
```

### 本地开发

```bash
npm run dev
# 或
wrangler dev
```

### 部署

```bash
npm run deploy
# 或
wrangler deploy
```

首次访问 `/setup` 创建管理员账户。

## 项目结构

```
src/
├── index.ts        # 入口、路由分发
├── admin.ts        # 管理后台 + 用户应用管理
├── auth.ts         # OAuth/OIDC 认证逻辑
├── login.ts        # HTML 页面渲染（登录、注册、资料、首页）
├── html.ts         # 布局、导航栏、CSS 样式
├── store.ts        # KV 存储层
├── crypto.ts       # 密码学：JWT 签名、密码哈希、随机数生成
└── types.ts        # TypeScript 类型定义
```

## 接入文档

部署后访问 `/docs` 查看完整的 OAuth/OIDC 接入文档。

普通用户登录后访问 `/apps` 创建和管理自己的应用。管理员通过 `/admin/apps` 管理所有应用。

## 数据存储

使用 Cloudflare KV 存储，6 个 Namespace 分工：

| Namespace | 前缀 | 用途 | 过期 |
|---|---|---|---|
| `SESSIONS` | `session:{id}` | 登录会话 | 7 天 |
| `AUTH_CODES` | `code:{code}` | 授权码（一次性） | 10 分钟 |
| `USERS` | `user:{id}` + `email:{邮箱}` | 用户数据 + 邮箱索引 | 永久 |
| `APPS` | `app:{clientId}` | OAuth 应用 | 永久 |
| `REFRESH_TOKENS` | `refresh:{token}` | 刷新令牌 | 30 天 |
| `RSA_KEYS` | `rsa:current` | RSA 密钥对 | 永久 |

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/login` | GET/POST | 用户登录 |
| `/register` | GET | 注册页面 |
| `/api/register` | POST | 注册提交 |
| `/authorize` | GET | OAuth 授权 |
| `/token` | POST | 换取令牌 |
| `/userinfo` | GET | 用户信息 |
| `/.well-known/jwks.json` | GET | JWK 公钥 |
| `/logout` | GET | 退出登录 |
| `/profile` | GET | 个人资料 |
| `/api/profile` | POST | 更新资料 |
| `/api/profile/password` | POST | 修改密码 |
| `/docs` | GET | 接入文档 |
| `/apps` | GET | 我的应用列表 |
| `/api/apps` | POST | 创建应用 |
| `/apps/:clientId` | GET | 应用详情 |
| `/api/apps/:clientId/update` | POST | 更新应用 |
| `/api/apps/:clientId/delete` | POST | 删除应用 |
| `/api/apps/:clientId/regenerate-secret` | POST | 重生成密钥 |
| `/admin` | GET | 管理后台控制台 |
| `/admin/users` | GET | 用户管理 |
| `/admin/apps` | GET | 应用管理（管理员） |

## 安全特性

- 密码使用 PBKDF2 + 随机盐哈希存储
- 会话 Cookie 设置 HttpOnly、Secure、SameSite=Lax
- JWT 使用 RS256 签名，防止篡改
- 授权码一次性使用 + 短 TTL（10 分钟）
- Refresh Token 使用即销毁（防止重放）
- PKCE 支持，防止授权码拦截
- Open Redirect 防护：redirect 参数仅允许相对路径或同源 URL
- 登录速率限制：每个 IP 5 次失败 / 15 分钟
- 可选 Turnstile 人机验证
- 密码复杂度要求：大小写字母 + 数字 + 特殊字符
- 密码修改后自动失效其他设备会话
- 邮箱变更自动清理旧索引
- 恒定时间字符串比较，防止时序攻击
