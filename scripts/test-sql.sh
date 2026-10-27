#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
connection="${LMS_TEST_SQL_CONNECTION:-$(dotnet user-secrets list --project backend/LMS.API | sed -n 's/^ConnectionStrings:DefaultConnection = //p')}"
if [[ -z "$connection" ]]; then echo 'Configure a local SQL Server connection first.' >&2; exit 1; fi
# Each API test creates, migrates, then deletes its own LMS_Tests_<guid> database.
# Use a local development login with CREATE DATABASE permission.
LMS_TEST_SQL_CONNECTION="$connection" dotnet test backend/LMS.Tests --filter 'FullyQualifiedName~ApiTests' --verbosity minimal
