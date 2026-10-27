#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# SDK local-tool resolution fails in some paths ending with a space (this
# workspace has one). Use the restored entry DLL as a fallback.
if dotnet tool run dotnet-ef -- --version >/dev/null 2>&1; then
  exec dotnet tool run dotnet-ef -- "$@"
fi
package_root="$(dotnet nuget locals global-packages --list | sed 's/^global-packages: //')"
entry="${package_root%/}/dotnet-ef/10.0.12/tools/net8.0/any/dotnet-ef.dll"
if [[ ! -f "$entry" ]]; then
  dotnet tool restore
fi
exec dotnet "$entry" "$@"
