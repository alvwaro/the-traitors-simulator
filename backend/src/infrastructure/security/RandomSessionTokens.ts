import { createHash, randomBytes } from 'node:crypto';
import { ISessionTokens } from '../../application/ports/ISecurity';

/** 32 bytes aleatórios (base64url) no cookie; SHA-256 dele no banco. */
export class RandomSessionTokens implements ISessionTokens {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
