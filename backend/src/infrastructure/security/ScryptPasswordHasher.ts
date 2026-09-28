import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { IPasswordHasher } from '../../application/ports/ISecurity';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
/** Custo do scrypt (N=2^15): lento o bastante contra força bruta, rápido para um login. */
const OPTIONS: ScryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const PREFIX = 'scrypt';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, OPTIONS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Formato guardado: scrypt$<sal base64>$<hash base64>. */
export class ScryptPasswordHasher implements IPasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await derive(password, salt);
    return `${PREFIX}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [prefix, salt, expected] = stored.split('$');
    if (prefix !== PREFIX || !salt || !expected) return false;
    const key = await derive(password, Buffer.from(salt, 'base64'));
    const target = Buffer.from(expected, 'base64');
    return key.length === target.length && timingSafeEqual(key, target);
  }
}
