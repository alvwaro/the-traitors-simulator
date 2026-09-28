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
# 1. Dependências
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


## Scripts

| Onde       | Comando                | O que faz                                        |
|------------|------------------------|--------------------------------------------------|
| raiz       | `npm run typecheck`    | Checagem de tipos do backend e do frontend       |
| raiz       | `npm run build`        | Build de produção dos dois projetos              |
| raiz       | `npm run db:up/down`   | Sobe/derruba o PostgreSQL                        |
| raiz       | `npm run user:owner -- <usuario>` | Torna a conta dona do site             |
| `backend`  | `npm run sim:balance -- 200 30 MIX` | Roda temporadas em memória e mede o equilíbrio |
| `frontend` | `npm run preview`      | Serve o build de produção                        |
