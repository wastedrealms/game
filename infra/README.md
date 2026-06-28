# Infrastructure & deploys

Two separate concerns:

1. **Infrastructure** (`static-site.yaml`) — the **one-time** CloudFormation stack per
   game/subdomain (private S3 bucket + CloudFront with OAC + ACM cert + Route53 alias).
   Set up once and rarely touched.
2. **Publishing the app** — the repeating step: **build → sync to S3 → invalidate CloudFront**.
   You can do this **locally** (`npm run deploy:prod`) or via **GitHub Actions**
   (`.github/workflows/deploy.yml`). Both do the same three things.

---

## 1. Infrastructure (once, in us-east-1)

```bash
aws cloudformation deploy \
  --region us-east-1 \
  --template-file infra/static-site.yaml \
  --stack-name wr-game-production \
  --parameter-overrides \
      SiteName=wr-game \
      Deployment=production \
      DomainName=game.wastedrealms.com \
      HostedZoneId=<wastedrealms.com zone id> \
      CertificateArn=<shared wildcard cert arn>   # optional; omit to auto-create a per-domain cert \
  --profile <prod>
```

(No `--capabilities` needed — no named IAM resources.)

**Shared wildcard cert:** one ACM cert (us-east-1) for `wastedrealms.com` + `*.wastedrealms.com`
covers the apex (portal) and every subdomain (game, bunker…). Pass its ARN as `CertificateArn`
to reuse it; leave it blank and the stack creates+auto-validates a per-domain cert instead
(CloudFormation writes the DNS record into the hosted zone).

**Live resources (game, account 221082174267):** stack `wr-game-production`, bucket
`wr-game-production-221082174267`, distribution `EB4C49VRYCZ49`, zone `Z077140917YPC6OF0XW7N`.

---

## 2. Publishing the app

Both paths run: `npm run build` → `aws s3 sync apps/web/dist …` (hashed assets cached
immutably, `index.html` `no-cache`) → `aws cloudfront create-invalidation --paths "/*"`.

### Local (manual, fastest for iterating)

```bash
npm run deploy:prod          # → scripts/deploy-prod.sh  (AWS profile "prod")
```

The script resolves the bucket + distribution id from the CloudFormation **stack outputs at
runtime**, so no account-specific values are hardcoded in the repo. Use this after a batch of
edits to push them all live in one go.

### GitHub Actions (`.github/workflows/deploy.yml`)

Runs the same build/sync/invalidate on push (or manual dispatch), using a GitHub
**Environment** for config. In the repo → Settings → Environments → **production**:

- **Variables:** `AWS_REGION` = `us-east-1`, `CLOUDFRONT_DISTRIBUTION_ID` = `DistributionId` output.
- **Secrets:** `S3_BUCKET` = `BucketName` output (kept as a **secret** because the bucket name
  contains the AWS account id — this keeps it out of the public Actions logs),
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (prod deploy creds).

Get the output values with:

```bash
aws cloudformation describe-stacks --region us-east-1 \
  --stack-name wr-game-production \
  --query "Stacks[0].Outputs" --profile <prod>
```

---

## Next game

Same template, new stack — e.g. `wr-bunker-production` with
`SiteName=wr-bunker DomainName=bunker.wastedrealms.com` and the same `CertificateArn`.
