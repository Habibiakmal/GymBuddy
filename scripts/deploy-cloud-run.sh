#!/bin/bash
# ==============================================================================
# GymBuddy Backend: Google Cloud Run Deployment Script
# Region: asia-southeast2 (Jakarta)
# Architecture: Hostinger -> Cloud Run (asia-southeast2) -> Firestore + Gemini
# ==============================================================================

set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"gen-lang-client-0130714675"}
REGION="asia-southeast2"
SERVICE_NAME="gymbuddy-backend"
IMAGE_TAG="asia-southeast2-docker.pkg.dev/${PROJECT_ID}/gymbuddy/${SERVICE_NAME}:latest"

echo "=========================================================="
echo "DEPLOYING GYMBUDDY BACKEND TO GOOGLE CLOUD RUN"
echo "Project ID : ${PROJECT_ID}"
echo "Region     : ${REGION}"
echo "Service    : ${SERVICE_NAME}"
echo "=========================================================="

# 1. Build Container Image using Google Cloud Build
echo "Building container image with Cloud Build..."
gcloud builds submit --tag "${IMAGE_TAG}" --project "${PROJECT_ID}"

# 2. Deploy to Google Cloud Run using declarative cloudrun.yaml manifest
echo "Applying declarative Cloud Run service manifest (cloudrun.yaml)..."
gcloud run services replace cloudrun.yaml \
  --region "${REGION}" \
  --project "${PROJECT_ID}"

# Ensure public unauthenticated access for staging testing
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --region "${REGION}" \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project "${PROJECT_ID}"

# 3. Output Service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format 'value(status.url)' --project "${PROJECT_ID}")

echo "=========================================================="
echo "✓ DEPLOYMENT SUCCESSFUL!"
echo "Service URL: ${SERVICE_URL}"
echo "Health Check: ${SERVICE_URL}/health"
echo "=========================================================="
