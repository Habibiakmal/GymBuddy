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

# 2. Deploy to Google Cloud Run
echo "Deploying service to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_TAG}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300s \
  --execution-environment gen2 \
  --service-account 253242815083-compute@developer.gserviceaccount.com \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --set-secrets GEMINI_API_KEY=gymbuddy-gemini-api-key:latest,JWT_SECRET=gymbuddy-jwt-secret:latest,MONGODB_URI=gymbuddy-mongodb-uri:latest,TWILIO_ACCOUNT_SID=gymbuddy-twilio-account-sid:latest,TWILIO_AUTH_TOKEN=gymbuddy-twilio-auth-token:latest \
  --project "${PROJECT_ID}"

# 3. Output Service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format 'value(status.url)' --project "${PROJECT_ID}")

echo "=========================================================="
echo "✓ DEPLOYMENT SUCCESSFUL!"
echo "Service URL: ${SERVICE_URL}"
echo "Health Check: ${SERVICE_URL}/health"
echo "=========================================================="
