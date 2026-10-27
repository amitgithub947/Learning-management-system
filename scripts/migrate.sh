#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# dotnet-ef uses the design-time factory; load only the requested user secret.
# Never echo a connection string or dump the entire secrets store.
connection="${ConnectionStrings__DefaultConnection:-$(dotnet user-secrets list --project backend/LMS.API | sed -n 's/^ConnectionStrings:DefaultConnection = //p')}"
if [[ -z "$connection" ]]; then echo 'Configure ConnectionStrings:DefaultConnection first.' >&2; exit 1; fi
ConnectionStrings__DefaultConnection="$connection" \
  ./scripts/ef.sh database update --project backend/LMS.Infrastructure --startup-project backend/LMS.API
