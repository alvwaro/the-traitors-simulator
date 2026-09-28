/// <reference types="vite/client" />

/** Variáveis de ambiente lidas pelo frontend (ver .env.example). */
interface ImportMetaEnv {
  /** Endereço da API; em desenvolvimento, o Vite repassa /api para o backend. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
