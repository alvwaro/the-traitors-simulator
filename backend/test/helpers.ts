import request from 'supertest';
import { buildApp } from '../src/main/app';
import { pool } from '../src/infrastructure/database/connection';

/** Um app por arquivo de teste (o limite de tentativas de login é por app). */
export const app = buildApp();

export type Agent = ReturnType<typeof request.agent>;

let counter = 0;

/** Senha das contas de teste (gerada a cada execução). */
export const TEST_SECRET = `t-${Math.floor(Date.now() / 1000).toString(36)}-segredo`;

/** Cria uma conta nova e devolve um cliente já logado (o cookie de sessão fica no agente). */
export async function signUp(prefix = 'user', owner = false): Promise<{ agent: Agent; username: string }> {
  const agent = request.agent(app);
  const username = `${prefix}${Date.now().toString(36)}${counter++}`.slice(0, 30);
  const res = await agent.post('/api/auth/register').send({ username, password: TEST_SECRET });
  if (res.status >= 300) throw new Error(`cadastro falhou: ${res.status} ${JSON.stringify(res.body)}`);
  if (owner) {
    await pool.query("UPDATE users SET role = 'OWNER' WHERE lower(username) = lower($1)", [username]);
  }
  return { agent, username };
}

/** Falha com a resposta inteira quando o status não é o esperado (a mensagem ajuda a entender o erro). */
export function ok<T = any>(res: request.Response, status = 200): T {
  if (res.status !== status) throw new Error(`esperava ${status}, veio ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body as T;
}

/** Cria personagens com os nomes dados e devolve os ids. */
export async function createCharacters(agent: Agent, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) ids.push(ok<{ id: string }>(await agent.post('/api/characters').send({ name }), 201).id);
  return ids;
}

/** Temporada pronta para começar, com `size` personagens avulsos. */
export async function createSeason(agent: Agent, size: number, extra: Record<string, unknown> = {}): Promise<any> {
  const batch = counter++;
  const characterIds = await createCharacters(agent, Array.from({ length: size }, (_, i) => `Jogador ${i + 1}${batch ? ` (${batch})` : ''}`));
  return ok(await agent.post('/api/seasons').send({ name: `Temporada ${counter++}`, characterIds, ...extra }), 201);
}
