#!/usr/bin/env bash
# Installe (ou met à jour) le programme d'envoi des notifications chez Cloudflare.
# La clé d'accès Cloudflare est fournie par l'environnement de travail (jamais écrite ici).
# La clé privée VAPID reste chez Cloudflare (secret) : elle est conservée d'une mise à jour à l'autre.
set -euo pipefail
cd "$(dirname "$0")"
API=https://api.cloudflare.com/client/v4
A=$(curl -s $API/accounts | python3 -c "import json,sys;print(json.load(sys.stdin)['result'][0]['id'])")
D=$(curl -s "$API/accounts/$A/d1/database?name=khatm-push" | python3 -c "import json,sys;print(json.load(sys.stdin)['result'][0]['uuid'])")
VAPID_PUBLIC=$(grep -o "VAPID_PUBLIC = '[^']*'" ../src/push.ts | cut -d"'" -f2)
META=$(mktemp)
python3 - "$D" "$VAPID_PUBLIC" > "$META" <<'PY'
import json, sys
print(json.dumps({"main_module": "worker.js", "compatibility_date": "2024-11-01",
  "bindings": [{"type": "d1", "name": "DB", "id": sys.argv[1]}, {"type": "plain_text", "name": "VAPID_PUBLIC", "text": sys.argv[2]}],
  "keep_bindings": ["secret_text"]}))
PY
curl -s -X PUT "$API/accounts/$A/workers/scripts/khatm-push" -F "metadata=@$META;type=application/json" \
  -F "worker.js=@worker.js;type=application/javascript+module" | python3 -c "import json,sys;d=json.load(sys.stdin);print('programme mis à jour :',d['success'],d.get('errors'))"
rm -f "$META"
