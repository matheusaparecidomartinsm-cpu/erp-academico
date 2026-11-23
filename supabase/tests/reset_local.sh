#!/bin/sh
# Recria o banco local de teste e aplica bootstrap + migrações. Uso: sh reset_local.sh
export PGHOST=${PGHOST:-/tmp} PGPORT=${PGPORT:-5544} PGUSER=${PGUSER:-postgres}
cd "$(dirname "$0")/../.."
psql -q -c "drop database if exists erp" -c "create database erp" 2>&1 | grep -v NOTICE
for f in supabase/tests/bootstrap_local.sql supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d erp -f "$f" || exit 1; done
echo "banco local pronto"
