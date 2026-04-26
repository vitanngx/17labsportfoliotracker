#!/usr/bin/env sh
set -eu

export PORT="${PORT:-10000}"
export PORTFOLIO_DATA_DIR="${PORTFOLIO_DATA_DIR:-/var/data}"
export PORTFOLIO_DB_PATH="${PORTFOLIO_DB_PATH:-$PORTFOLIO_DATA_DIR/portfolio.db}"

mkdir -p "$(dirname "$PORTFOLIO_DB_PATH")"

exec npm run start -- --hostname 0.0.0.0 --port "$PORT"
