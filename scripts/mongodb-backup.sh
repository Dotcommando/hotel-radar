#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
DEFAULT_BACKUP_DIRECTORY="/Users/alphared/Yandex.Disk.localized/Projects/hotel-radar/backups"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "mongodump is not installed or is not available in PATH." >&2
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo ".env file was not found at ${ENV_FILE}." >&2
  exit 1
fi

set -a
. "${ENV_FILE}"
set +a

required_variables=(
  MONGO_INITDB_ROOT_USERNAME
  MONGO_INITDB_ROOT_PASSWORD
  MONGO_INITDB_DATABASE
)

for variable_name in "${required_variables[@]}"; do
  if [ -z "${!variable_name:-}" ]; then
    echo "${variable_name} is required in .env." >&2
    exit 1
  fi
done

backup_directory="${MONGODB_BACKUP_DIRECTORY_PATH:-${DEFAULT_BACKUP_DIRECTORY}}"
mongo_host="${MONGODB_BACKUP_HOST:-127.0.0.1}"
mongo_port="${MONGODB_BACKUP_PORT:-27777}"
timestamp="$(date +"%Y%m%d-%H%M%S")"
dump_directory="${backup_directory}/${MONGO_INITDB_DATABASE}-${timestamp}"

mkdir -p "${backup_directory}"

mongodump \
  --host="${mongo_host}" \
  --port="${mongo_port}" \
  --username="${MONGO_INITDB_ROOT_USERNAME}" \
  --password="${MONGO_INITDB_ROOT_PASSWORD}" \
  --authenticationDatabase="admin" \
  --db="${MONGO_INITDB_DATABASE}" \
  --out="${dump_directory}"

echo "MongoDB dump saved to ${dump_directory}"
