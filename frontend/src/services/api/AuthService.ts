import type { User } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface Credentials {
  username: string;
  password: string;
}

/** Conta e sessão. A sessão fica num cookie httpOnly: o navegador envia sozinho. */
export interface IAuthService {
  me(): Promise<User | null>;
  login(credentials: Credentials): Promise<User>;
  register(credentials: Credentials): Promise<User>;
  logout(): Promise<void>;
}

export class AuthService implements IAuthService {
  constructor(private readonly http: IHttpClient) {}

  async me() {
    return (await this.http.get<{ user: User | null }>('/auth/me')).user;
  }

  async login(credentials: Credentials) {
    return (await this.http.post<{ user: User }>('/auth/login', credentials)).user;
  }

  async register(credentials: Credentials) {
    return (await this.http.post<{ user: User }>('/auth/register', credentials)).user;
  }

  async logout() {
    await this.http.post('/auth/logout');
  }
}
