#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -e .env ]]; then
  echo '.env already exists. To avoid replacing database credentials, configure user-secrets manually as documented in README.md.' >&2
  exit 1
fi
umask 077
sql_port="${SQL_PORT:-14330}"
sql_password="Lms!9$(openssl rand -hex 24)"
seed_password="Demo!9$(openssl rand -hex 20)"
jwt_key="$(openssl rand -hex 48)"
printf 'MSSQL_SA_PASSWORD=%s\nSQL_PORT=%s\n' "$sql_password" "$sql_port" > .env
dotnet user-secrets set --project backend/LMS.API 'ConnectionStrings:DefaultConnection' "Server=localhost,$sql_port;Database=LMS;User Id=sa;Password=$sql_password;Encrypt=True;TrustServerCertificate=True" >/dev/null
dotnet user-secrets set --project backend/LMS.API 'Jwt:SigningKey' "$jwt_key" >/dev/null
dotnet user-secrets set --project backend/LMS.API 'Seed:Password' "$seed_password" >/dev/null
dotnet user-secrets set --project backend/LMS.API 'Seed:Enabled' true >/dev/null
dotnet user-secrets set --project backend/LMS.API 'Database:MigrateOnStartup' true >/dev/null
printf 'Development secrets configured. Demo password saved in .demo-password (ignored by Git).\n'
printf '%s\n' "$seed_password" > .demo-password
