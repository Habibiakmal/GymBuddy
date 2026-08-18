#!/bin/bash
set -e

PROJECT_ID="gen-lang-client-0130714675"
SA_NAME="github-actions-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Setting up Service Account for GitHub Actions Automatic Deploy ==="

# 1. Create Service Account if not exists
gcloud iam service-accounts create $SA_NAME \
  --description="Service account for GitHub Actions auto deploy" \
  --display-name="GitHub Actions Deployer" \
  --project=$PROJECT_ID || true

# 2. Grant required IAM roles
echo "Granting Cloud Run Admin & Artifact Registry roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin" --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" --quiet

# 3. Create Service Account Key
KEY_FILE="/tmp/gcp-sa-key.json"
gcloud iam service-accounts keys create $KEY_FILE \
  --iam-account=$SA_EMAIL \
  --project=$PROJECT_ID

echo ""
echo "=========================================================================="
echo "✅ SERVICE ACCOUNT KEY BERHASIL DIBUAT!"
echo "=========================================================================="
echo "Silakan copy seluruh isi JSON di bawah ini, lalu:"
echo "1. Buka: https://github.com/Habibiakmal/GymBuddy/settings/secrets/actions"
echo "2. Klik 'New repository secret'"
echo "3. Name: GCP_SA_KEY"
echo "4. Secret: (Paste seluruh isi JSON di bawah ini)"
echo "5. Klik 'Add secret'"
echo "=========================================================================="
echo ""
cat $KEY_FILE
echo ""
echo "=========================================================================="

GH_PAT="${1:-$GH_TOKEN}"
if [ -n "$GH_PAT" ] && command -v gh &> /dev/null; then
  echo "Mengunggah secret GCP_SA_KEY ke GitHub secara otomatis..."
  echo "$GH_PAT" | gh auth login --with-token 2>/dev/null || true
  gh secret set GCP_SA_KEY --repo="Habibiakmal/GymBuddy" < $KEY_FILE
  echo "✅ BERHASIL 100%: Secret GCP_SA_KEY sudah terpasang otomatis di GitHub!"
fi
