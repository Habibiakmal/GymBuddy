#!/bin/bash
set -e

KEY_FILE="/tmp/gcp-sa-key.json"

if [ ! -f "$KEY_FILE" ]; then
  PROJECT_ID="gen-lang-client-0130714675"
  SA_NAME="github-actions-deployer"
  SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
  gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SA_EMAIL \
    --project=$PROJECT_ID
fi

echo ""
echo "=========================================================================="
echo "📋 SALIN (COPY) 1 BARIS TEKS JSON BERSIH INI KE GITHUB SECRETS:"
echo "=========================================================================="
echo ""
python3 -c "import json; print(json.dumps(json.load(open('$KEY_FILE'))))"
echo ""
echo "=========================================================================="
