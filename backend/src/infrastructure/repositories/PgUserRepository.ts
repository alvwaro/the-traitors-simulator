import { User, UserRole } from '../../domain/entities';
import { ISessionRepository, IUserRepository } from '../../domain/repositories';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
}

const toEntity = (r: UserRow): User =>
  new User({ id: r.id, username: r.username, passwordHash: r.password_hash, role: r.role, createdAt: r.created_at });

export class PgUserRepository implements IUserRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await query<UserRow>(this.db, 'SELECT * FROM users WHERE id = $1', [id]);
    return row ? toEntity(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const [row] = await query<UserRow>(this.db, 'SELECT * FROM users WHERE lower(username) = lower($1)', [username.trim()]);
    return row ? toEntity(row) : null;
  }

  async create(user: User): Promise<void> {
    const u = user.toJSON();
    await query(this.db, 'INSERT INTO users (id, username, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5)', [
      u.id,
      u.username,
      u.passwordHash,
      u.role,
      u.createdAt,
    ]);
  }

  async update(user: User): Promise<void> {
    const u = user.toJSON();
    await query(this.db, 'UPDATE users SET password_hash = $2, role = $3 WHERE id = $1', [u.id, u.passwordHash, u.role]);
  }
}

export class PgSessionRepository implements ISessionRepository {
  constructor(private readonly db: Queryable) {}

  async create(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
    await query(this.db, 'INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
  }

  async findUser(tokenHash: string): Promise<User | null> {
    const [row] = await query<UserRow>(
      this.db,
      `SELECT u.* FROM user_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash],
    );
    return row ? toEntity(row) : null;
  }

  async delete(tokenHash: string): Promise<void> {
    await query(this.db, 'DELETE FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteExpired(): Promise<void> {
    await query(this.db, 'DELETE FROM user_sessions WHERE expires_at <= now()');
  }
}
