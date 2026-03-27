#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -d ".next" ]]; then
	echo "Build non trovata (.next assente). Esegui prima: pnpm run build"
	exit 1
fi

exec pnpm run start -- -p "${PORT:-3000}"
