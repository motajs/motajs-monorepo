#!/usr/bin/env bash
set -euo pipefail

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_host="${DEPLOY_HOST:-h5test}"
deploy_root="${DEPLOY_ROOT:-/var/www/doc/server}"
deploy_url="${DEPLOY_URL:-https://mota.press/server/}"
deploy_port="${DEPLOY_SSH_PORT:-}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
staging="$(dirname "$deploy_root")/.server.deploy-$stamp"
replaced="$(dirname "$deploy_root")/.server.replaced-$stamp"

if [[ ! "$deploy_host" =~ ^[A-Za-z0-9._@-]+$ ]]; then
  echo "Unsafe DEPLOY_HOST: $deploy_host" >&2
  exit 1
fi
if [[ ! "$deploy_root" =~ ^/var/www/[A-Za-z0-9._/-]+$ ]]; then
  echo "DEPLOY_ROOT must be an absolute path below /var/www: $deploy_root" >&2
  exit 1
fi
if [[ -n "$deploy_port" && ! "$deploy_port" =~ ^[0-9]+$ ]]; then
  echo "DEPLOY_SSH_PORT must be numeric" >&2
  exit 1
fi

ssh_command=(ssh)
rsync_shell="ssh"
if [[ -n "$deploy_port" ]]; then
  ssh_command+=(-p "$deploy_port")
  rsync_shell+=" -p $deploy_port"
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  pnpm --dir "$package_root" build:with-editor
fi

dist="$package_root/dist"
for required in index.html service-worker.js static/editor/current.json; do
  if [[ ! -f "$dist/$required" ]]; then
    echo "Missing deployment artifact: $dist/$required" >&2
    exit 1
  fi
done

build_id="$(node -e 'const fs=require("node:fs"); const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!/^[a-f0-9]{64}$/.test(p.buildId||"")) process.exit(1); process.stdout.write(p.buildId)' "$dist/static/editor/current.json")"
worker_sha="$(shasum -a 256 "$dist/service-worker.js" | awk '{print $1}')"

previous_id="$("${ssh_command[@]}" "$deploy_host" bash -s -- "$deploy_root" "$staging" <<'REMOTE'
set -euo pipefail
target="$1"
staging="$2"
rm -rf "$staging"
mkdir -p "$staging"
if [[ -f "$target/static/editor/current.json" ]]; then
  previous="$(sed -nE 's/.*"buildId"[[:space:]]*:[[:space:]]*"([a-f0-9]{64})".*/\1/p' "$target/static/editor/current.json" | head -n 1)"
  if [[ "$previous" =~ ^[a-f0-9]{64}$ ]] && [[ -d "$target/static/editor/releases/$previous" ]]; then
    printf '%s' "$previous"
  fi
fi
REMOTE
)"

rsync -a --delete -e "$rsync_shell" "$dist/" "$deploy_host:$staging/"

"${ssh_command[@]}" "$deploy_host" bash -s -- "$deploy_root" "$staging" "$replaced" "$build_id" "${previous_id:--}" "$worker_sha" <<'REMOTE'
set -euo pipefail
target="$1"
staging="$2"
replaced="$3"
build_id="$4"
previous_id="$5"
expected_worker_sha="$6"
if [[ "$previous_id" = "-" ]]; then previous_id=""; fi

if [[ -n "$previous_id" && "$previous_id" != "$build_id" ]]; then
  mkdir -p "$staging/static/editor/releases"
  cp -a "$target/static/editor/releases/$previous_id" "$staging/static/editor/releases/"
  printf '{\n  "schemaVersion": 1,\n  "buildId": "%s",\n  "previousBuildId": "%s"\n}\n' "$build_id" "$previous_id" > "$staging/static/editor/current.json"
else
  printf '{\n  "schemaVersion": 1,\n  "buildId": "%s"\n}\n' "$build_id" > "$staging/static/editor/current.json"
fi

test -f "$staging/index.html"
test -f "$staging/service-worker.js"
test -f "$staging/static/editor/releases/$build_id/editor-manifest.json"
actual_build_id="$(sed -nE 's/.*"buildId"[[:space:]]*:[[:space:]]*"([a-f0-9]{64})".*/\1/p' "$staging/static/editor/releases/$build_id/editor-manifest.json" | head -n 1)"
test "$actual_build_id" = "$build_id"
actual_worker_sha="$(sha256sum "$staging/service-worker.js" | awk '{print $1}')"
test "$actual_worker_sha" = "$expected_worker_sha"

rm -rf "$replaced"
if [[ -e "$target" ]]; then mv "$target" "$replaced"; fi
if mv "$staging" "$target"; then
  rm -rf "$replaced"
else
  if [[ -e "$replaced" ]]; then mv "$replaced" "$target"; fi
  exit 1
fi

test "$(sha256sum "$target/service-worker.js" | awk '{print $1}')" = "$expected_worker_sha"
REMOTE

curl --fail --silent --show-error --location "$deploy_url" >/dev/null
curl --fail --silent --show-error --location "${deploy_url%/}/service-worker.js" >/dev/null
DEPLOY_URL="$deploy_url" pnpm --dir "$package_root" verify:deployment

echo "Deployed Editor $build_id"
echo "Service Worker SHA-256 $worker_sha"
echo "Target $deploy_host:$deploy_root"
