#!/usr/bin/env bash
# Prepara uma EC2 nova com Ubuntu 24.04: Docker Engine + Compose e 2 GB de swap.
# Uso (na instância): ./setup-ec2.sh   — depois saia e entre de novo no SSH para o grupo docker valer.
set -euo pipefail

if ! command -v docker >/dev/null; then
  # Instalador oficial do Docker (repositório apt da Docker, já com o plugin do Compose).
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"
sudo systemctl enable --now docker

# Swap: numa instância de 2 GB, evita que um pico de memória derrube o Postgres ou a API.
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

docker --version
docker compose version
echo "Pronto. Saia (exit) e entre de novo no SSH para usar o docker sem sudo."
