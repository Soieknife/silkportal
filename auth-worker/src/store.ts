import { Env, User, OAuthApp, Session, AuthCode, RefreshToken, RsaKeySet } from './types';

export class Store {
  constructor(private env: Env) {}

  // --- 会话 ---
  async getSession(sessionId: string): Promise<Session | null> {
    const data = await this.env.SESSIONS.get(`session:${sessionId}`, 'json');
    return data as Session | null;
  }

  async createSession(session: Session): Promise<void> {
    await this.env.SESSIONS.put(`session:${session.sessionId}`, JSON.stringify(session), {
      expirationTtl: Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.env.SESSIONS.delete(`session:${sessionId}`);
  }

  async listSessions(): Promise<Session[]> {
    const list = await this.env.SESSIONS.list({ prefix: 'session:' });
    const sessions: Session[] = [];
    for (const key of list.keys) {
      const data = await this.env.SESSIONS.get(key.name, 'json');
      if (data) sessions.push(data as Session);
    }
    return sessions;
  }

  // --- 授权码 ---
  async getAuthCode(code: string): Promise<AuthCode | null> {
    const data = await this.env.AUTH_CODES.get(`code:${code}`, 'json');
    return data as AuthCode | null;
  }

  async createAuthCode(authCode: AuthCode, ttlSeconds: number): Promise<void> {
    await this.env.AUTH_CODES.put(`code:${authCode.code}`, JSON.stringify(authCode), {
      expirationTtl: ttlSeconds,
    });
  }

  async deleteAuthCode(code: string): Promise<void> {
    await this.env.AUTH_CODES.delete(`code:${code}`);
  }

  // --- 用户 ---
  async getUser(userId: string): Promise<User | null> {
    const data = await this.env.USERS.get(`user:${userId}`, 'json');
    return data as User | null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = await this.env.USERS.get(`email:${email.toLowerCase()}`);
    if (!userId) return null;
    return this.getUser(userId);
  }

  async createUser(user: User): Promise<void> {
    await this.env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await this.env.USERS.put(`email:${user.email.toLowerCase()}`, user.id);
  }

  async updateUser(user: User, oldEmail?: string): Promise<void> {
    await this.env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await this.env.USERS.put(`email:${user.email.toLowerCase()}`, user.id);
    if (oldEmail && oldEmail.toLowerCase() !== user.email.toLowerCase()) {
      await this.env.USERS.delete(`email:${oldEmail.toLowerCase()}`);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      await this.env.USERS.delete(`email:${user.email.toLowerCase()}`);
    }
    await this.env.USERS.delete(`user:${userId}`);
  }

  async listUsers(): Promise<User[]> {
    const list = await this.env.USERS.list({ prefix: 'user:' });
    const users: User[] = [];
    for (const key of list.keys) {
      const data = await this.env.USERS.get(key.name, 'json');
      if (data) users.push(data as User);
    }
    return users;
  }

  // --- 应用 ---
  async getApp(clientId: string): Promise<OAuthApp | null> {
    const data = await this.env.APPS.get(`app:${clientId}`, 'json');
    return data as OAuthApp | null;
  }

  async createApp(app: OAuthApp): Promise<void> {
    await this.env.APPS.put(`app:${app.clientId}`, JSON.stringify(app));
  }

  async updateApp(app: OAuthApp): Promise<void> {
    await this.env.APPS.put(`app:${app.clientId}`, JSON.stringify(app));
  }

  async deleteApp(clientId: string): Promise<void> {
    await this.env.APPS.delete(`app:${clientId}`);
  }

  async listApps(): Promise<OAuthApp[]> {
    const list = await this.env.APPS.list({ prefix: 'app:' });
    const apps: OAuthApp[] = [];
    for (const key of list.keys) {
      const data = await this.env.APPS.get(key.name, 'json');
      if (data) apps.push(data as OAuthApp);
    }
    return apps;
  }

  // --- 批量会话管理 ---
  async deleteUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
    const list = await this.env.SESSIONS.list({ prefix: 'session:' });
    for (const key of list.keys) {
      const session = await this.env.SESSIONS.get(key.name, 'json') as Session | null;
      if (session && session.userId === userId && session.sessionId !== excludeSessionId) {
        await this.env.SESSIONS.delete(key.name);
      }
    }
  }

  // --- 刷新令牌 ---
  async getRefreshToken(token: string): Promise<RefreshToken | null> {
    const data = await this.env.REFRESH_TOKENS.get(`refresh:${token}`, 'json');
    return data as RefreshToken | null;
  }

  async createRefreshToken(rt: RefreshToken, ttlSeconds: number): Promise<void> {
    await this.env.REFRESH_TOKENS.put(`refresh:${rt.token}`, JSON.stringify(rt), {
      expirationTtl: ttlSeconds,
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.env.REFRESH_TOKENS.delete(`refresh:${token}`);
  }

  // --- RSA 密钥 ---
  async getRsaKeys(): Promise<RsaKeySet | null> {
    const data = await this.env.RSA_KEYS.get('rsa:current', 'json');
    return data as RsaKeySet | null;
  }

  async saveRsaKeys(keys: RsaKeySet): Promise<void> {
    await this.env.RSA_KEYS.put('rsa:current', JSON.stringify(keys));
  }

  // --- 初始化检查 ---
  async isInitialized(): Promise<boolean> {
    const keys = await this.env.RSA_KEYS.get('rsa:current');
    return keys !== null;
  }

  async hasUsers(): Promise<boolean> {
    const list = await this.env.USERS.list({ prefix: 'user:', limit: 1 });
    return list.keys.length > 0;
  }
}
