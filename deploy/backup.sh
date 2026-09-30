#!/usr/bin/env bash
# Backup do banco (pg_dump compactado), guardando os últimos BACKUP_KEEP_DAYS dias.
# Com BACKUP_S3_BUCKET definido, também envia para o S3 (precisa da AWS CLI e de uma role na EC2 com s3:PutObject).
#   ./backup.sh
# Restaurar: gunzip -c arquivo.sql.gz | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
set -euo pipefail
cd "$(dirname "$0")"

dir="${BACKUP_DIR:-$HOME/backups}"
mkdir -p "$dir"
file="$dir/traitors-$(date +%Y%m%d-%H%M%S).sql.gz"

# Usuário e banco vêm do próprio container (as variáveis do .env que o Postgres recebeu).
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$file"
find "$dir" -name 'traitors-*.sql.gz' -mtime +"${BACKUP_KEEP_DAYS:-7}" -delete

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  aws s3 cp "$file" "s3://$BACKUP_S3_BUCKET/backups/" --only-show-errors
fi
echo "[$(date -Is)] backup: $file"
