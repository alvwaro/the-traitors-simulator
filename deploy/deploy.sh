#!/usr/bin/env bash
# Atualiza a pilha na EC2: baixa as imagens e recria só os containers cuja imagem mudou
# (as migrações rodam antes da API subir).
#   ./deploy.sh               aplica sempre
#   ./deploy.sh --if-changed  só age quando alguma imagem nova foi baixada (para o cron da atualização automática)
set -euo pipefail
cd "$(dirname "$0")"

image_ids() {
  docker compose config --images | sort -u | while read -r image; do
    docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || echo "ausente:$image"
  done
}

before=$(image_ids)
docker compose pull --quiet
if [[ "${1:-}" == "--if-changed" && "$(image_ids)" == "$before" ]]; then
  exit 0
fi

echo "[$(date -Is)] subindo a pilha..."
docker compose up -d --remove-orphans
# Tira as imagens antigas que ficaram sem uso (o disco da instância é pequeno).
docker image prune -f >/dev/null
docker compose ps
