# SilkPortal 单点登录系统 — 从零到一学习指南

> 本文档面向**计算机初学者**，从最基础的概念开始，逐步深入理解这个 SSO（单点登录）项目的每一行代码。如果你对 Web 开发、认证协议还不熟悉，这是为你准备的。

---

## 目录

1. [前言：什么是 SSO？](#1-前言什么是-sso)
2. [你需要先了解的基础知识](#2-你需要先了解的基础知识)
3. [项目整体架构](#3-项目整体架构)
4. [核心概念详解](#4-核心概念详解)
5. [代码逐模块讲解](#5-代码逐模块讲解)
6. [部署与测试](#6-部署与测试)
7. [如何为你的应用接入 SSO](#7-如何为你的应用接入-sso)
8. [遇到问题怎么办](#8-遇到问题怎么办)
9. [进阶学习资源](#9-进阶学习资源)

---

## 1. 前言：什么是 SSO？

### 1.1 一个生活中的例子

想象一个大公司有多个网站：

- 考勤系统 `attendance.company.com`
- 邮件系统 `mail.company.com`
- 项目管理系统 `project.company.com`

如果没有 SSO，每个系统都要独立注册账号、记住不同的密码，员工每天要登录三次。

有了 SSO，你**只需要登录一次**，就可以访问所有系统。

这就像——你去购物中心（SSO 服务器），在入口办一张**通用的会员卡（会话/Session）**，然后你拿着这张卡可以去里面的任何一家店（各个应用），店家看到卡就知道你是谁了。

### 1.2 这个项目实现了什么

SilkPortal 就是一个**你自己搭建的"购物中心入口"**。它是基于 Cloudflare Workers（一种"无服务器"的运行环境）构建的，用来帮你的各个应用统一管理用户登录。

它主要做三件事：

1. **帮用户登录** — 提供一个登录页面，验证用户名密码
2. **给应用发"通行证"** — 用户登录后，给各个应用签发 JWT（一种加密的令牌）
3. **管理用户和应用** — 提供一个后台页面，管理员可以增删用户、管理接入的应用

### 1.3 关键术语速查

| 术语 | 通俗解释 | 类比 |
|------|---------|------|
| **OAuth 2.0** | 一种让应用"代表用户"访问资源的协议 | 你给酒店前台一张授权卡，让清洁工进你的房间 |
| **OpenID Connect (OIDC)** | 在 OAuth 2.0 基础上增加了"告诉你是谁"的功能 | 在授权卡上加了你照片和姓名 |
| **JWT** | 一种加密的"数字通行证"，包含用户信息 | 带防伪标识的会员卡 |
| **PKCE** | 让没有密码的应用也能安全使用 OAuth 的增强 | 手机 App 进门时对一句暗号 |
| **RS256** | 一种加密算法，用"私钥签名、公钥验证" | 用印章盖印（私钥），任何人可用印泥对比（公钥） |
| **Cloudflare Workers** | 在 Cloudflare 全球服务器上运行的代码 | 你在全世界各地都有"代办点" |
| **KV 存储** | 一种简单的键值对数据库 | 一个巨大的寄存柜，每个柜子有编号和物品 |

---

## 2. 你需要先了解的基础知识

如果你是零基础，不要急。下面列出这个项目涉及的知识点，**不需要全部精通再开始**，遇到不懂的回头查就行。

### 2.1 必须掌握

| 知识点 | 说明 | 学习链接 |
|--------|------|----------|
| **JavaScript / TypeScript 基础** | 变量、函数、异步、类、接口 | [MDN JavaScript 教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide) |
| **HTTP 基础** | GET/POST、状态码、请求头/响应头 | [MDN HTTP 概述](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Overview) |
| **JSON** | 数据交换格式 | [MDN JSON](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Objects/JSON) |
| **Promise 和 async/await** | JavaScript 异步编程 | [MDN 异步编程](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Asynchronous) |

### 2.2 建议了解

| 知识点 | 说明 | 学习链接 |
|--------|------|----------|
| **npm 和 Node.js** | JavaScript 的包管理器和运行环境 | [npm 官方文档](https://docs.npmjs.com/) |
| **Web Crypto API** | 浏览器/Workers 中的加密接口 | [MDN Web Crypto API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Crypto_API) |
| **RSA 非对称加密** | 公钥加密、私钥解密 | [RSA 算法浅析](https://zh.wikipedia.org/zh-cn/RSA%E5%8A%A0%E5%AF%86%E6%BC%94%E7%AE%97%E6%B3%95) |
| **Base64 编码** | 二进制数据的文本表示 | [Base64 维基百科](https://zh.wikipedia.org/zh-cn/Base64) |
| **Cloudflare Workers** | 边缘计算平台 | [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/) |
| **Wrangler CLI** | Workers 的命令行工具 | [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/) |

### 2.3 不要求掌握（但学了更好）

- Docker / 容器技术
- CI/CD 持续集成
- 密码学算法细节
- 网络协议栈

> **给初学者的建议**：先通读本文档，有个整体印象。然后打开代码对照着看。遇到不懂的概念，点开上面的链接花 10 分钟了解。不要试图一次性理解所有内容——这是正常的。每次读都会比上次多理解一点。

---

## 3. 项目整体架构

### 3.1 目录结构

```
myauth/
│
├── package.json                # 根目录的 npm 配置（整个项目的工作区）
├── .gitignore                  # Git 忽略规则
├── README.md                   # 项目说明文档（中文）
├── GUIDE.md                    # 你正在看的这个学习指南
│
├── auth-worker/                # ★ SSO 认证服务器（核心）
│   ├── package.json            # 依赖配置
│   ├── tsconfig.json           # TypeScript 编译配置
│   ├── wrangler.toml           # Cloudflare Workers 配置文件
│   └── src/
│       ├── index.ts            # ★ 入口文件 + 路由器
│       ├── types.ts            # ★ 所有 TypeScript 类型定义
│       ├── crypto.ts           # ★ 密码学相关（加密、签名、哈希）
│       ├── store.ts            # ★ 数据存储层（KV 操作）
│       ├── html.ts             # HTML 模板 + 转义函数
│       ├── login.ts            # 登录页面渲染
│       ├── auth.ts             # ★ OAuth2 核心业务流程
│       └── admin.ts            # 管理后台
│
└── example-app/                # 演示应用（演示如何接入 SSO）
    ├── package.json
    ├── tsconfig.json
    ├── wrangler.toml
    └── src/
        └── index.ts            # ★ 演示应用的代码
```

### 3.2 数据流全景

```
你的浏览器                        SilkPortal 服务器                  Cloudflare KV
    │                                │                              │
    │  1. 访问 example.com           │                              │
    │  ──────────────────────────>   │                              │
    │                                │                              │
    │  2. 重定向到 SSO 登录页         │                              │
    │  <──────────────────────────   │                              │
    │                                │                              │
    │  3. 输入邮箱密码                │                              │
    │  ──────────────────────────>   │  4. 查用户是否存在            │
    │                                │  ──────────────────────────> │
    │                                │  <────────────────────────── │
    │                                │                              │
    │  5. 创建会话，设置 Cookie       │  6. 将会话存入 KV            │
    │  <──────────────────────────   │  ──────────────────────────> │
    │                                │                              │
    │  7. 生成授权码，重定向回应用     │                              │
    │  <──────────────────────────   │                              │
    │                                │                              │
    │  8. 应用用授权码换令牌（API 调用，浏览器看不到）                │
    │                                │  9. 验证授权码，生成 JWT      │
    │                                │  ──────────────────────────> │
    │                                │  <────────────────────────── │
    │                                │                              │
    │  10. 返回 access_token + id_token                            │
    │                                │                              │
    │  11. 应用展示用户信息给浏览器                                 │
    │  <──────────────────────────   │                              │
```

### 3.3 使用了 6 个 KV 命名空间

KV 是 Cloudflare 提供的一种键值对数据库，就像一个大号的 JavaScript `Map`（或者 Python 的 `dict`）。

| KV 命名空间 | 用来存什么 | 类比 |
|------------|-----------|------|
| `SESSIONS` | 用户登录后的会话信息 | 商场会员卡的数据库 |
| `AUTH_CODES` | 临时的授权码（用一次就删） | 一次性入场券 |
| `USERS` | 用户名密码等 | 会员名册 |
| `APPS` | 注册接入的应用信息 | 合作商家列表 |
| `REFRESH_TOKENS` | 长期有效的刷新令牌 | 会员续期卡 |
| `RSA_KEYS` | RSA 密钥对（用于 JWT 签名） | 商场的印章 |

### 3.4 零运行时依赖

这个项目一个非常重要的设计特点：**没有使用任何第三方 npm 包**。

加密操作全部使用 Cloudflare Workers 内置的 [Web Crypto API](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Crypto_API)。这意味着：
- 不需要安装 `jsonwebtoken`、`bcrypt`、`uuid` 等常见包
- 没有依赖漏洞风险
- 代码量更小、部署更快

`package.json` 中只有开发工具依赖（TypeScript、Wrangler、类型定义），不包含运行时依赖。

---

## 4. 核心概念详解

### 4.1 OAuth 2.0 授权码流程

#### 为什么需要 OAuth？

想象你有一个"照片打印服务"，想打印你存在 Google 相册里的照片。你**不想把 Google 密码告诉打印服务**，但又希望它能看到你的照片。

OAuth 2.0 解决了这个问题——它设计了一套"授权"协议，让应用可以**有限度地访问你的数据**，而不用交出密码。

#### 授权码流程的四个角色

```
 +--------+                               +---------------+
 |        |                               |   资源所有者    |
 |   你的  |                               |   (用户)       |
 |   应用  |                               +---------------+
 |        |                                     │
 |  (客户端)│     +---------------+              │
 +----+---+     │               │               │
      │         │   SilkPortal SSO  │               │
      │  (1)    │  (授权服务器)   │<──────────────│ (2) 用户登录
      ├────────>│               │               │
      │         │               │               │
      │  (3) 授权码 ───────────>│               │
      │         │               │               │
      │  (4) 令牌 <─────────── │               │
      │         │               │               │
      │  (5) 用令牌获取数据      │               │
      │         │               │               │
      │  (6) 返回用户信息        │               │
      │         │               │               │
      +---------+---------------+---------------+
```

- **资源所有者**：用户本人
- **客户端**：想要访问用户数据的应用
- **授权服务器**：SilkPortal 认证服务，负责验证用户并签发令牌
- **资源服务器**：持有用户数据的 API（这个项目中，SilkPortal 自己也承担了这个角色，提供了 `/userinfo` 端点）

#### 详细步骤

**第 1 步：应用引导用户跳转到 SSO**

用户点击"登录"后，应用将用户浏览器重定向到：

```
GET https://auth.myapp.com/authorize?client_id=xxx&redirect_uri=https://app.myapp.com/callback&response_type=code&scope=openid+email&state=abc123
```

各参数含义：
- `client_id`：应用的唯一标识（在管理后台注册时生成）
- `redirect_uri`：用户登录成功后要跳转回哪个地址
- `response_type=code`：告诉 SSO 服务器"我要用授权码模式"
- `scope`：请求的权限范围
- `state`：一个随机字符串，用于防止 CSRF 攻击（回调时校验）

**第 2 步：用户登录**

用户在 SSO 的登录页面输入邮箱和密码。

**第 3 步：SSO 生成授权码，重定向回应用**

SSO 验证用户身份后，生成一个一次性授权码，将浏览器重定向回应用：

```
302 Location: https://app.myapp.com/callback?code=code_xxx&state=abc123
```

**第 4 步：应用用授权码换取令牌**

**这一步是服务器到服务器的通信，用户浏览器不参与**。应用的后端拿着授权码，直接向 SSO 发起请求：

```
POST https://auth.myapp.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=code_xxx&redirect_uri=...&client_id=...&client_secret=...
```

**第 5 步：SSO 返回令牌**

SSO 验证授权码有效后，返回三个东西：
- `access_token`：访问令牌，用来调用 API
- `id_token`：ID 令牌，包含用户身份信息
- `refresh_token`：刷新令牌，access_token 过期后用来获取新的

**第 6 步：应用获取用户信息**

应用拿着 `access_token` 调用 SSO 的 `/userinfo` 端点：

```
GET https://auth.myapp.com/userinfo
Authorization: Bearer eyJxxx...
```

> **深入学习**：[OAuth 2.0 授权框架 — RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)（英文，建议先看中文博客再读 RFC）

### 4.2 OpenID Connect (OIDC)

OAuth 2.0 解决的是"授权"问题（"允许你做什么"），而 OIDC 在 OAuth 2.0 之上解决了"认证"问题（"你是谁"）。

OIDC 增加了一个 **ID Token (id_token)**，它是一个 JWT，里面包含了用户的基本信息（用户 ID、邮箱、姓名等）。

打个比方：
- OAuth 2.0：酒店前台给你一张房卡（可以开门）
- OIDC：房卡上印了你的名字和照片（开门的同时还能确认你是你）

> **深入学习**：[OpenID Connect 官方文档](https://openid.net/developers/how-connect-works/)（英文）

### 4.3 JWT (JSON Web Token)

JWT 是这个项目中最核心的技术之一。它是一种**紧凑的、自包含的**信息传递方式。

#### JWT 长什么样？

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsIm5hbWUiOiLlvKDkuIkiLCJleHAiOjE3MDAwMDAwMDB9.abc123signature
```

上面这一长串由三个部分组成，用 `.` 分隔：

```
[头部].[载荷].[签名]
```

#### 第一部分：头部 (Header)

```json
{ "alg": "RS256", "typ": "JWT", "kid": "abc123" }
```

说明用什么算法签名（这里是 RS256），以及密钥的 ID（kid）。

#### 第二部分：载荷 (Payload)

```json
{
  "iss": "https://auth.myapp.com",    // 签发者
  "sub": "user_xxx...",               // 用户唯一标识
  "aud": "client_xxx...",             // 目标客户端
  "exp": 1700000000,                  // 过期时间
  "iat": 1699996400,                  // 签发时间
  "email": "user@example.com",
  "name": "张三"
}
```

这些字段叫做 **Claims（声明）**，就是关于用户的一些事实陈述。

#### 第三部分：签名 (Signature)

签名是最关键的部分。它是由：

```
RSASSA-PKCS1-v1_5(
  SHA256( base64(header) + "." + base64(payload) ),
  私钥
)
```

计算得到的。任何拥有**公钥**的人都可以验证签名是否有效，但只有持有**私钥**的人才能生成签名。

#### 为什么 JWT 安全？

JWT 的优势在于：
1. **完整性**：签名确保内容没有被篡改
2. **自包含**：不需要查数据库就知道用户是谁（解码 payload 即可）
3. **无状态**：服务器不需要保存会话信息（但本项目中同时用了传统的 session + JWT）

> **安全警告**：JWT 的 payload 只是 Base64 编码，不是加密！任何人解码后都能看到内容。所以**不要把密码等敏感信息放在 JWT 中**。

> **深入学习**：
> - [JWT 官方介绍](https://jwt.io/introduction)（英文，有中文翻译）
> - [jwt.io 调试器](https://jwt.io/)（在线解码 JWT，非常有用）

### 4.4 RS256 和 RSA 非对称加密

#### 什么是对称加密？

```
传统方式（对称加密）：
  你写一封信 → 放进保险箱 → 用锁锁上 → 快递给朋友
  朋友用同一把钥匙开锁 → 读信

  问题是：你怎么安全地把钥匙给朋友？
```

#### 什么是非对称加密？

```
非对称加密（RSA）：
  你生成两把钥匙：公钥（可以公开）和私钥（自己藏好）

  签名场景（本项目使用）：
  你写一封信 → 用私钥"盖章" → 寄出去
  任何人可以用你的公钥验证章是真的

  加密场景（反过来）：
  朋友用你的公钥加密一封信 → 寄给你
  只有你能用私钥解密
```

在 SilkPortal 中：
- **私钥**由 SSO 服务器保存，用于签发 JWT
- **公钥**通过 `/.well-known/jwks.json` 公开，供任何应用验证 JWT

这就像：
- SilkPortal 有一个独特的印章（私钥），在每个人的通行证上盖印
- 各个应用拿着印章样张（公钥），检查通行证上的印是否匹配

#### 密钥对是如何生成的？

代码在 `crypto.ts:32-55`：

```typescript
const keyPair = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,  // 2048 位，目前工业标准
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),  // 65537，固定值
    hash: { name: 'SHA-256' },
  },
  true,  // 可导出
  ['sign', 'verify']  // 私钥签名、公钥验证
);
```

> **深入学习**：
> - [RSA 算法简介 — 阮一峰](https://www.ruanyifeng.com/blog/2013/07/rsa_algorithm_part_two.html)
> - [Web Crypto API 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/SubtleCrypto/generateKey)

### 4.5 PKCE (Proof Key for Code Exchange)

#### 为什么要 PKCE？

传统的 OAuth 2.0 要求应用有一个 `client_secret`（客户端密钥）来证明自己的身份。但**单页应用（SPA）和手机 App** 的代码是完全暴露给用户的——任何人都能看到你的 `client_secret`。

PKCE 解决了这个问题：不需要 `client_secret`，而是使用一个"一次性暗号"。

#### PKCE 的工作原理

```
第 1 步：应用生成一个随机字符串 code_verifier（暗号）
        然后计算它的 SHA-256 哈希，得到 code_challenge（暗号提示）

第 2 步：应用将 code_challenge 随授权请求发给 SSO
        /authorize?client_id=xxx&code_challenge=xxxx&code_challenge_method=S256

第 3 步：用户登录后，SSO 存储 code_challenge

第 4 步：应用用授权码换令牌时，把原版的 code_verifier 发过去
        /token?code=xxx&code_verifier=yyyyy

第 5 步：SSO 计算 code_verifier 的 SHA-256，和之前存的 code_challenge 对比
        如果一致 → 证明是同一个应用 → 签发令牌
```

这就像：你知道一句暗号（verifier），但第一次见 SSO 时只说了暗号的 MD5（challenge）。第二次见面时你说出暗号本身，SSO 验证 MD5 是否匹配，就知道你是同一个人了。

> **深入学习**：[PKCE — RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)（英文）

### 4.6 PBKDF2 密码哈希

存储密码时**绝对不能存明文**。如果数据库泄露，用户的密码就全暴露了。SilkPortal 使用 PBKDF2 算法。

#### 什么是密码哈希？

```
用户输入的密码："hello123"

经过哈希计算（PBKDF2 + 随机盐 + 100000 次迭代）：

结果： "a1b2c3d4e5f6..." （一个看起来随机的字符串）
```

这个过程是**单向的**：
- ✅ 给定密码，可以计算哈希
- ❌ 给定哈希，无法还原出原密码

每次存储密码时，还会生成一个**随机盐（salt）**：
- 盐是一个随机字符串，和密码一起参与哈希计算
- 即使用户 A 和用户 B 的密码相同，哈希结果也不同

#### 为什么需要 100000 次迭代？

迭代次数越多，暴力破解需要的计算量越大：
- 1 次迭代：每秒可尝试 10 亿次密码
- 100000 次迭代：每秒只能尝试 1 万次

这就是为什么登录时会感觉到"微微的延迟"——这是故意的，为了安全。

> **深入学习**：[PBKDF2 维基百科](https://zh.wikipedia.org/zh-cn/PBKDF2)

---

## 5. 代码逐模块讲解

### 5.1 `types.ts` — 类型定义（89 行）

**文件位置**：`auth-worker/src/types.ts`

这是整个项目的基础，定义了所有数据结构。你可以把它看作是"蓝图"。

```typescript
// 环境变量绑定接口
export interface Env {
  SESSIONS: KVNamespace;       // 6 个 KV 命名空间
  AUTH_CODES: KVNamespace;
  USERS: KVNamespace;
  APPS: KVNamespace;
  REFRESH_TOKENS: KVNamespace;
  RSA_KEYS: KVNamespace;
  SSO_BASE_URL: string;         // 比如 https://auth.myapp.com
}
```

> **关于 `interface`**：TypeScript 的 `interface`（接口）用来定义一个对象"应该长什么样"。它只描述结构，不包含实现。任何对象只要包含这些字段，就"符合"这个接口。

接下来看用户（User）的定义：

```typescript
export interface User {
  id: string;              // 唯一 ID，比如 "user_a1b2c3..."
  email: string;           // 邮箱（登录用）
  name: string;            // 显示名称
  passwordHash: string;    // 密码哈希值（不是明文密码！）
  passwordSalt: string;    // 密码哈希用的盐
  role: 'admin' | 'user'; // 角色：管理员 or 普通用户
  createdAt: string;       // 创建时间
}
```

> **`'admin' | 'user'`** 表示这个字段只能取这两个值之一，这叫**联合类型（Union Type）**。

会话（Session）的定义：

```typescript
export interface Session {
  sessionId: string;       // 唯一标识
  userId: string;          // 关联的用户
  email: string;
  name: string;
  createdAt: string;
  expiresAt: string;       // 过期时间
}
```

**为什么同时有 session 和 JWT？**
- **Session**：用于 Web 登录页面（基于 Cookie）
- **JWT**：用于应用之间的认证（基于 Token）

### 5.2 `crypto.ts` — 密码学核心（176 行）

**文件位置**：`auth-worker/src/crypto.ts`

这个文件实现了所有的加密操作，是整个项目的"安全基石"。

#### Base64url 编码

```typescript
function base64urlEncode(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);     // 字符串 → 字节
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);               // ArrayBuffer → Uint8Array
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);     // 每个字节转成字符
  }
  return btoa(binary)                            // 标准 Base64
    .replace(/\+/g, '-')                         // + 变成 -
    .replace(/\//g, '_')                         // / 变成 _
    .replace(/=+$/, '');                         // 去掉末尾的 =
}
```

> **为什么不用标准 Base64？** JWT 要求在 URL 中传递，但标准 Base64 包含 `+`、`/`、`=` 等 URL 特殊字符。Base64url 把 `+` 换成 `-`，`/` 换成 `_`，去掉 `=`，使其可以安全放在 URL 中。

#### 恒定时间比较

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;  // 长度不同就直接返回 false
  }
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];  // XOR 运算，只要有一位不同 result 就不为 0
  }
  return result === 0;
}
```

> **为什么不用 `===`？** 普通的字符串比较一旦发现第一个不同的字符就立即返回。这个时间差虽然很短，但攻击者可以反复测量，逐步猜出密码——这叫**时序攻击**。恒定时间比较保证无论结果如何，耗时都一样。

#### JWT 签名

```typescript
export async function signJwt(payload, keySet): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT', kid: keySet.kid };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;  // 待签名的数据

  const privateKey = await importPrivateKey(keySet.privateKeyJwk);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(data)
  );

  return `${data}.${base64urlEncode(signature)}`;  // header.payload.signature
}
```

**`crypto.subtle.sign`** 是 Web Crypto API 提供的签名函数。它使用 RSA 私钥，对数据进行签名。

### 5.3 `store.ts` — 存储层（143 行）

**文件位置**：`auth-worker/src/store.ts`

这个文件封装了对 Cloudflare KV 的所有操作。

```typescript
export class Store {
  constructor(private env: Env) {}  // 构造函数，保存 env

  // 获取会话
  async getSession(sessionId: string): Promise<Session | null> {
    const data = await this.env.SESSIONS.get(`session:${sessionId}`, 'json');
    return data as Session | null;
  }

  async createSession(session: Session): Promise<void> {
    await this.env.SESSIONS.put(
      `session:${session.sessionId}`,       // 键
      JSON.stringify(session),              // 值（转为 JSON 字符串）
      { expirationTtl: ... }                // 过期时间（秒）
    );
  }
}
```

> **关于 KV 的键名设计**：注意键名都以 `session:`、`email:`、`app:` 等为前缀。这是因为 KV 是一个扁平的命名空间，加前缀可以实现"模拟目录"的效果，方便用 `list({ prefix: 'session:' })` 列出所有会话。

### 5.4 `html.ts` — HTML 模板（82 行）

**文件位置**：`auth-worker/src/html.ts`

这个文件包含 HTML 转义函数和页面布局模板。

#### HTML 转义

```typescript
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')   // & → &amp;
    .replace(/</g, '&lt;')    // < → &lt;
    .replace(/>/g, '&gt;')    // > → &gt;
    .replace(/"/g, '&quot;')  // " → &quot;
    .replace(/'/g, '&#39;');  // ' → &#39;
}
```

> **为什么需要转义？** 如果用户输入的姓名是 `<script>alert('xss')</script>`，直接嵌入 HTML 就会执行这段脚本。转义后变成 `&lt;script&gt;alert('xss')&lt;/script&gt;`，浏览器会把它显示为普通文本。

**这就是 XSS（跨站脚本攻击）的防范手段**。你的应用有任何地方把用户输入插到 HTML 中，都是 XSS 漏洞。

### 5.5 `login.ts` — 登录页面（58 行）

**文件位置**：`auth-worker/src/login.ts`

渲染登录页面和初始设置页面。代码很简单，就是用 `layout()` 函数包裹 HTML 内容。

```typescript
export function renderLoginPage(error?: string, redirect?: string): string {
  return layout('登录', `
    <form method="POST" action="/login${redirect ? `?redirect=...` : ''}">
      <label>邮箱</label>
      <input type="email" name="email" required>
      <label>密码</label>
      <input type="password" name="password" required>
      <button>登录</button>
    </form>
  `);
}
```

注意：**所有页面 UI 文本已翻译为中文**，包括按钮文字、提示信息、错误信息等。

### 5.6 `auth.ts` — OAuth2 核心逻辑（442 行）

**文件位置**：`auth-worker/src/auth.ts`

这是最复杂的文件，实现了 OAuth 2.0 的完整流程。我们从函数调用链来理解：

#### 登录流程

```
用户访问 /login (GET)
  → handleLoginGet()
    → 渲染登录页面

用户提交表单 (POST /login)
  → handleLoginPost()
    → 查邮箱 → Store.getUserByEmail()
    → 验证密码 → crypto.verifyPassword()
    → 创建会话 → Store.createSession()
    → 设置 Cookie → setCookie('session_id', ...)
    → 重定向回原地址
```

#### 授权码流程

```
用户访问 /authorize?client_id=xxx&redirect_uri=yyy (GET)
  → handleAuthorizeGet()
    → 验证 client_id → Store.getApp()
    → 验证 redirect_uri
    → 检查用户是否已登录（从 Cookie 中读 session）
    → 如果未登录 → 重定向到 /login
    → 生成授权码 → generateAuthCode()
    → 保存授权码 → Store.createAuthCode()
    → 重定向回 redirect_uri?code=xxx&state=yyy
```

#### 令牌签发流程

```
应用调用 /token (POST)
  → handleToken()
    → 解析请求体（JSON 或表单）
    → 判断 grant_type
      │
      ├── authorization_code：
      │   → handleAuthorizationCodeGrant()
      │     → 验证授权码 → Store.getAuthCode()
      │     → 验证客户端密钥
      │     → 验证 PKCE（如果有）
      │     → 删除授权码（一次性的）
      │     → 读 RSA 密钥 → Store.getRsaKeys()
      │     → 签发 JWT → signJwt()
      │     → 生成刷新令牌
      │     → 返回 { access_token, id_token, refresh_token }
      │
      └── refresh_token：
          → handleRefreshTokenGrant()
            → 验证刷新令牌
            → 删除旧的刷新令牌（轮换）
            → 签发新的 JWT + 新的刷新令牌
```

#### 用户信息流程

```
应用调用 /userinfo (GET)
  → handleUserinfo()
    → 从 Authorization header 中提取 access_token
    → 验证 JWT → crypto.verifyJwt()
    → 查询完整用户信息 → Store.getUser()
    → 返回 { sub, email, name }
```

#### Cookie 操作

```typescript
function getCookie(name: string, header: string | null): string | null {
  if (!header) return null;
  for (const cookie of header.split(';')) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) return rest.join('=');  // 值中可能包含 =，所以用 ...rest
  }
  return null;
}
```

> **Cookie 的 `HttpOnly` 和 `Secure` 标志**：
> - `HttpOnly`：JavaScript 无法读取这个 Cookie（防止 XSS 窃取）
> - `Secure`：只在 HTTPS 连接中传输
> - `SameSite=Lax`：防止 CSRF 攻击

### 5.7 `admin.ts` — 管理后台（289 行）

**文件位置**：`auth-worker/src/admin.ts`

实现了管理员后台的所有功能。

#### 身份验证中间件

```typescript
async function requireAdmin(request, env) {
  const store = new Store(env);
  const session = await getSessionFromCookie(request, store);
  if (!session) return new Response(null, { status: 302, headers: { Location: '/login' } });

  const user = await store.getUser(session.userId);
  if (!user || user.role !== 'admin') return new Response('禁止访问', { status: 403 });

  return { session, user };  // 验证通过
}
```

这是一个设计模式，叫做**中间件（Middleware）**。它先"拦截"请求做权限检查，通过后才让后续代码执行。

#### 用户管理

```typescript
export async function handleAdminCreateUser(request, env) {
  const auth = await requireAdmin(request, env);  // 权限检查
  if (auth instanceof Response) return auth;       // 未通过直接返回

  // 从表单读取数据
  const formData = await request.formData();
  const name = formData.get('name') || '';
  const email = (formData.get('email') || '').toLowerCase().trim();
  const password = formData.get('password') || '';

  // 校验
  if (!name || !email || !password) return redirect with error;
  if (password.length < 8) return redirect with error;  // 后端也校验

  // 哈希密码
  const { hash, salt } = await hashPassword(password);

  // 创建用户
  const user = { id: generateUserId(), email, name, passwordHash: hash, passwordSalt: salt, role: 'user', ... };
  await store.createUser(user);
}
```

### 5.8 `index.ts` — 路由器（145 行）

**文件位置**：`auth-worker/src/index.ts`

这是整个程序的"大门"，所有请求先进这里，然后被分发到不同的处理函数。

```typescript
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;     // 比如 "/login"
  const method = request.method; // "GET" 或 "POST"

  // 确保 RSA 密钥存在
  await initializeIfNeeded(env);

  // 路由分发（根据 path + method）
  if (path === '/login')  → handleLoginGet / handleLoginPost
  if (path === '/authorize') → handleAuthorizeGet
  if (path === '/token') → handleToken
  if (path === '/userinfo') → handleUserinfo
  if (path === '/.well-known/jwks.json') → handleJwks
  if (path === '/logout') → handleLogout
  if (path === '/setup') → renderSetupPage
  if (path.startsWith('/admin')) → admin handlers
  if (path === '/' ) → redirect to /admin
  else → 404 Not Found
}
```

### 5.9 `example-app/src/index.ts` — 演示应用（216 行）

**文件位置**：`example-app/src/index.ts`

这个文件演示了如何接入 SSO。它本身也是一个 Cloudflare Worker，展示了完整的接入过程。

关键代码分析：

```typescript
// 发起 SSO 登录
function handleLogin(request, env) {
  const ssoUrl = new URL(`${env.SSO_AUTH_URL}/authorize`);
  ssoUrl.searchParams.set('client_id', env.SSO_CLIENT_ID);
  ssoUrl.searchParams.set('redirect_uri', `${url.origin}/callback`);
  ssoUrl.searchParams.set('response_type', 'code');
  ssoUrl.searchParams.set('scope', 'openid email profile');

  const state = generateState();
  ssoUrl.searchParams.set('state', state);

  // 将 state 存入 Cookie 以便回调时验证
  const stateCookie = `sso_state=${state}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return new Response(null, {
    status: 302,
    headers: { Location: ssoUrl.toString(), 'Set-Cookie': stateCookie },
  });
}
```

> **关于 `state` 验证**：这是 CSRF 攻击的关键防御措施。攻击者可能诱骗用户点击一个恶意链接，带上攻击者自己的 `code` 来你的应用。通过 state 验证可以确保这个回调确实是你发起的请求。

```typescript
// 处理 SSO 回调
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // ★ 验证 state 防止 CSRF
  const storedState = getCookie('sso_state', request.headers.get('Cookie'));
  if (!state || !storedState || state !== storedState) {
    return new Response('state 不匹配 — 可能存在 CSRF 攻击', { status: 400 });
  }

  // 用授权码换令牌
  const tokenResponse = await fetch(`${env.SSO_AUTH_URL}/token`, { ... });

  // 获取用户信息
  const userResponse = await fetch(`${env.SSO_AUTH_URL}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 显示欢迎页面
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
```

---

## 6. 部署与测试

### 6.1 前置条件

1. **注册 Cloudflare 账户**（免费）：https://dash.cloudflare.com/sign-up
2. **安装 Node.js 18+**：https://nodejs.org/（建议下载 LTS 版本）
3. **安装 Wrangler CLI**：
   ```bash
   npm install -g wrangler
   ```
4. **登录 Wrangler**：
   ```bash
   npx wrangler login
   ```
   会打开浏览器，授权 Wrangler 访问你的 Cloudflare 账户。

### 6.2 创建 KV 命名空间

每个 Cloudflare Workers 项目需要用到的 KV 命名空间都需要提前创建：

```bash
cd auth-worker

wrangler kv:namespace create "SESSIONS"
# 输出： ✅ Success! Add the following to your wrangler.toml:
#        { binding = "SESSIONS", id = "abc123..." }

wrangler kv:namespace create "AUTH_CODES"
wrangler kv:namespace create "USERS"
wrangler kv:namespace create "APPS"
wrangler kv:namespace create "REFRESH_TOKENS"
wrangler kv:namespace create "RSA_KEYS"
```

将每个命令返回的 ID 填入 `wrangler.toml`。

### 6.3 安装依赖

```bash
cd auth-worker
npm install
# 这会安装 TypeScript、Wrangler 和类型定义
```

### 6.4 本地开发

```bash
cd auth-worker
npx wrangler dev
# 输出：⬣ Listening on http://localhost:8787
```

打开浏览器访问 `http://localhost:8787/setup`，按照引导创建第一个管理员账户。

### 6.5 部署到生产

```bash
cd auth-worker
npx wrangler deploy
```

部署后你会得到一个 `.workers.dev` 域名，例如 `myauth-auth.xxxx.workers.dev`。

### 6.6 验证部署是否成功

```bash
# 验证 JWKS 端点
curl https://your-worker.workers.dev/.well-known/jwks.json
# 应该返回一个包含 RSA 公钥的 JSON

# 验证设置页面
curl https://your-worker.workers.dev/setup
# 应该返回初始设置页面
```

---

## 7. 如何为你的应用接入 SSO

### 7.1 快速接入步骤

1. **在管理后台创建一个应用**：
   - 登录 `/admin` → 应用管理 → 创建应用
   - 填写应用名称和重定向 URI（例如 `https://yourapp.com/callback`）
   - 保存返回的 `client_id` 和 `client_secret`

2. **在你的应用中添加"通过 SSO 登录"按钮**：
   ```html
   <a href="https://your-sso-domain.com/authorize?client_id=xxx&redirect_uri=...&response_type=code&scope=openid+email+profile&state=yyy">
     通过 SSO 登录
   </a>
   ```

3. **实现回调处理**（在你的应用后端）：
   - 接收 `code` 和 `state` 参数
   - 验证 `state` 与之前存储的一致
   - 用 `code` 换取 `access_token`
   - 用 `access_token` 获取用户信息
   - 在应用中创建本地会话

详细的代码示例请参考 `example-app/src/index.ts` 或 `README.md` 中的"接入指南"章节。

### 7.2 各语言接入示例

参考 README 中"接入指南"章节，里面包含了 **Node.js、Python、Go** 的完整示例代码。

---

## 8. 遇到问题怎么办

### 8.1 常见问题

| 问题 | 可能的原因 | 解决方案 |
|------|-----------|----------|
| `Invalid client_id` | KV 中还没有创建应用 | 先去管理后台 `/admin/apps` 创建 |
| `Invalid redirect_uri` | 回调地址与注册的不一致 | 检查你重定向回的和注册时的地址（包括协议、端口、路径） |
| 授权码换令牌失败 | 授权码已过期（10 分钟）| 重新走一遍登录流程 |
| 提示未登录 | 会话过期 | 重新登录 |
| `wrangler dev` 启动失败 | 端口被占用 | `npx wrangler dev --port 8788` |
| TypeScript 编译报错 | 类型不匹配 | 检查 `types.ts` 中的接口定义是否正确 |

### 8.2 调试技巧

1. **查看 JWT 内容**：
   访问 https://jwt.io，把你的 token 粘进去，可以解码查看 payload

2. **查看请求详情**：
   使用浏览器的开发者工具（F12）→ Network 标签，可以看到每个请求的 Headers 和参数

3. **使用 curl 测试 API**：
   ```bash
   # 测试令牌端点
   curl -X POST http://localhost:8787/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code&code=xxx&redirect_uri=yyy&client_id=zzz&client_secret=www"
   ```

### 8.3 寻求帮助

- 仔细阅读本文档和 README
- 查看 TypeScript 编译器的错误提示
- 使用 `console.log()` 在代码中添加调试输出
- 查阅 [Cloudflare Workers 开发文档](https://developers.cloudflare.com/workers/)

---

## 9. 进阶学习资源

### 9.1 协议标准（按推荐阅读顺序）

| 资源 | 语言 | 说明 |
|------|------|------|
| [《OAuth 2.0 图解》](https://oauth.net/2/) | 英文/中文翻译 | 图文并茂，适合入门 |
| [OAuth 2.0 的四种授权模式](https://www.ruanyifeng.com/blog/2019/04/oauth-grant-types.html) | 中文 | 阮一峰的博客，通俗易懂 |
| [JSON Web Token 入门教程](https://www.ruanyifeng.com/blog/2018/07/json_web_token-tutorial.html) | 中文 | 同样是阮一峰的教程 |
| [JWT 调试器](https://jwt.io) | — | 在线解码 JWT，实操工具 |
| [OpenID Connect 规范](https://openid.net/developers/how-connect-works/) | 英文 | OIDC 官方示意图 |
| [RFC 6749 — OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749) | 英文 | 最权威的规范文档（适合有基础后阅读） |
| [RFC 7519 — JWT](https://datatracker.ietf.org/doc/html/rfc7519) | 英文 | JWT 官方规范 |
| [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636) | 英文 | PKCE 规范 |

### 9.2 Web 开发基础

| 资源 | 说明 |
|------|------|
| [MDN Web 开发入门](https://developer.mozilla.org/zh-CN/docs/Learn) | Mozilla 的免费 Web 教程，质量极高 |
| [MDN HTTP 指南](https://developer.mozilla.org/zh-CN/docs/Web/HTTP) | HTTP 协议详解 |
| [MDN JavaScript 指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide) | JavaScript 语言教程 |
| [TypeScript 手册](https://www.typescriptlang.org/zh/docs/) | TypeScript 官方中文文档 |

### 9.3 安全知识

| 资源 | 说明 |
|------|------|
| [OWASP 十大 Web 安全风险](https://owasp.org/www-project-top-ten/) | Web 安全知识必读 |
| [XSS 攻击详解](https://developer.mozilla.org/zh-CN/docs/Web/Security/Types_of_attacks) | MDN 安全文档 |
| [CSRF 攻击详解](https://developer.mozilla.org/zh-CN/docs/Web/Security/Cross-site_request_forgery) | 了解 CSRF 是什么 |

### 9.4 Cloudflare Workers

| 资源 | 说明 |
|------|------|
| [Workers 快速开始](https://developers.cloudflare.com/workers/get-started/guide/) | 官方入门教程 |
| [Workers KV 文档](https://developers.cloudflare.com/workers/learning/how-kv-works/) | KV 存储详解 |
| [Wrangler 命令行工具](https://developers.cloudflare.com/workers/wrangler/) | 部署和管理工具 |
| [Workers 运行时 API](https://developers.cloudflare.com/workers/runtime-apis/) | 可用的 API 列表 |

### 9.5 推荐学习路线

如果你是初学者，推荐按以下顺序学习：

1. **第 1 周**：读完本文档，看懂整体架构。阅读 MDN 的 JavaScript 和 HTTP 基础。
2. **第 2 周**：在本地跑通项目（`wrangler dev`），能登录后台、创建用户。
3. **第 3 周**：阅读阮一峰的 OAuth 2.0 和 JWT 教程，理解核心概念。
4. **第 4 周**：对照代码和文档，逐行理解 `auth.ts` 中的 OAuth 流程。
5. **第 5 周**：尝试修改一些功能，比如增加登录页面的 CSS 样式，或者添加一个简单的 API。
6. **第 6 周**：尝试创建你自己的应用，接入 SSO。
7. **之后**：阅读 RFC 规范文档，深入理解协议细节。

> **最后的话**：编程不是记住所有语法，而是理解概念和知道到哪里查资料。这个项目中涉及的 OAuth、JWT、加密等知识，很多专业开发者也需要反复学习和查阅。遇到不懂的，先跳过，继续往下看，或者睡一觉再看——大脑会在后台处理这些信息。**坚持比聪明更重要。**

---

*Happy Coding! 🚀*
