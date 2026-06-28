#!/usr/bin/env bash
# Build the web app and deploy it to the production S3 + CloudFront stack.
# Resolves the bucket + distribution from the CloudFormation stack outputs at
# runtime, so no account-specific values are hardcoded (safe for a public repo).
#
# Usage:  ./scripts/deploy-prod.sh           (uses AWS profile "prod")
#         AWS_PROFILE=other ./scripts/deploy-prod.sh
set -euo pipefail

PROFILE="${AWS_PROFILE:-prod}"
REGION="us-east-1"
STACK="wr-game-production"

cd "$(dirname "$0")/.."

echo "→ Resolving stack outputs ($STACK)…"
out() { aws cloudformation describe-stacks --region "$REGION" --profile "$PROFILE" \
  --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET="$(out BucketName)"
DIST="$(out DistributionId)"
[ -n "$BUCKET" ] && [ -n "$DIST" ] || { echo "Could not resolve stack outputs"; exit 1; }

echo "→ Building…"
npm run build

echo "→ Syncing to S3…"
# Hashed assets cache forever; index.html must revalidate so new builds show.
aws s3 sync apps/web/dist "s3://$BUCKET" --delete --exclude index.html \
  --cache-control "public, max-age=31536000, immutable" --profile "$PROFILE"
aws s3 cp apps/web/dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache" --profile "$PROFILE"

echo "→ Invalidating CloudFront…"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" \
  --profile "$PROFILE" --query "Invalidation.Status" --output text

echo "✓ Deployed → https://game.wastedrealms.com"
