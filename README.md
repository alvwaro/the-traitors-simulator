<div align="center">

# 🗡️ » The Traitors · Simulador [BETA]

Simulador do Reality Show The Traitors! Feito puramente para diversão :)

<img src="docs/images/banner.png" alt="The Traitors · Simulador" width="760" />

</div>

No momento, 3 modos estão disponíveis:

- **Manual**: Serve para administrar uma temporada acontecendo presencialmente ou online, você controla tudo.
- **Automático**: Simulação automática, você apenas assiste!
- **Jogável**: Simulação automática onde você vira um jogador podendo interagir com os NPCS, tudo pode acontecer!

## Requisitos

- Node.js 24+ (veja `.nvmrc`)
- Docker (para o PostgreSQL) ou um PostgreSQL 16 local

## Como rodar

```bash
# 1. Dependências (shared, backend, frontend e gateway)
npm run install:all

# 2. Variáveis de ambiente
cp .env.example .env                  # credenciais do Postgres (docker-compose)
cp backend/.env.example backend/.env  # DATABASE_URL com as mesmas credenciais
cp frontend/.env.example frontend/.env

# 3. Banco de dados
npm run db:up
npm run db:migrate

# 4. Em dois terminais
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173 (o Vite repassa /api para a API)

# 5. Crie sua conta na tela de entrada (Criar conta) e torne-a dona do site
npm run user:owner -- seu_usuario
```

Opcionais em desenvolvimento:

```bash
npm run dev:worker    # fila de trabalhos (limpeza de sessões vencidas e outras tarefas em segundo plano)
npm run dev:gateway   # API Gateway em http://localhost:8080 (use VITE_API_PROXY=http://localhost:8080 no frontend/.env)
```

### Pilha completa com Docker

Site (Nginx) → gateway → duas instâncias da API → Postgres, mais o worker, como em produção:

```bash
npm run stack:up     # http://localhost:8080
npm run stack:down
```

## Estrutura

| Pasta      | O que é |
|------------|---------|
| `shared`   | Kernel compartilhado: enums, regras do jogo, sorteio, votos, frases e o manifesto das rotas da API |
| `backend`  | API (camadas domain/application/infrastructure/presentation) e o worker da fila de trabalhos |
| `frontend` | Site (React + Vite) |
| `gateway`  | API Gateway: valida as requisições pelo manifesto, limita tentativas e distribui a carga |

A arquitetura, os padrões usados e como adicionar rotas, trabalhos e modos novos estão em [docs/architecture.md](docs/architecture.md).

## Scripts

| Onde       | Comando                | O que faz                                        |
|------------|------------------------|--------------------------------------------------|
| raiz       | `npm run typecheck`    | Checagem de tipos de todos os pacotes            |
| raiz       | `npm run build`        | Build de produção de todos os pacotes            |
| raiz       | `npm run test:unit`    | Testes que não precisam do banco (shared, gateway e frontend) |
| raiz       | `npm run db:up/down`   | Sobe/derruba o PostgreSQL                        |
| raiz       | `npm run stack:up/down` | Sobe/derruba a pilha completa no Docker         |
| raiz       | `npm run user:owner -- <usuario>` | Torna a conta dona do site             |
| `backend`  | `npm run sim:balance -- 200 30 MIX` | Roda temporadas em memória e mede o equilíbrio |
| `frontend` | `npm run preview`      | Serve o build de produção                        |
| `backend`  | `npm test` / `npm run test:coverage` | Testes (API de verdade num banco `<nome>_test`, recriado a cada execução; precisa do Postgres rodando) |
| `backend`  | `npm run test:fixtures` | Grava de novo as respostas da API usadas nos testes do frontend |
| `frontend` | `npm test` / `npm run test:coverage` | Testes das telas com as respostas gravadas da API |
| `shared` / `gateway` | `npm test` / `npm run test:coverage` | Testes do kernel e do gateway |
