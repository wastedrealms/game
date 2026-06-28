# Infrastructure

`static-site.yaml` — the **one-time** CloudFormation stack for a game's hosting
(private S3 bucket + CloudFront with OAC + DNS-validated ACM cert + Route53 alias).

This is **set up once per game/subdomain and rarely touched** — so it's deployed by
hand via the CLI, not from CI. The repeating thing is the app build/deploy
(`.github/workflows/deploy.yml`), which just syncs files + invalidates the cache.

## Deploy (once, in us-east-1)

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
  --profile <prod>
```

(No `--capabilities` needed — no named IAM resources. The ACM cert auto-validates
because CloudFormation writes the DNS record into the hosted zone.)

## Wire the outputs into GitHub

```bash
aws cloudformation describe-stacks --region us-east-1 \
  --stack-name wr-game-production \
  --query "Stacks[0].Outputs" --profile <prod>
```

In the repo → Settings → Environments → **production**, set:
- `S3_BUCKET` = `BucketName` output
- `CLOUDFRONT_DISTRIBUTION_ID` = `DistributionId` output
- `AWS_REGION` = `us-east-1`
- secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (prod deploy creds)

Then the **Deploy** workflow can publish builds to `game.wastedrealms.com`.

## Next game

Same template, new stack — e.g. `wr-bunker-production` with
`SiteName=wr-bunker DomainName=bunker.wastedrealms.com`.
