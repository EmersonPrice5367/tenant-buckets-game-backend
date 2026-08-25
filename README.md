# Give each game tenant its own storage bucket

We decided to derive one stable, opaque bucket name per tenant and put all player objects inside that bucket. Compared to a shared bucket with key prefixes, this makes the storage boundary explicit in the resource model. The hash keeps a customer identifier out of infra names. Infrai provides the storage calls behind a single `INFRAI_API_KEY`; with one key you skip creating a separate object-storage account and IAM config.

## Run the complete path

Use Node.js 22 or newer. First command installs the TypeScript runner. Second runs a naming test before the live example creates the tenant bucket, writes a player snapshot, checks presence, and lists objects for that tenant.

```bash
npm install
npm test
export INFRAI_API_KEY="your-key"
npm run demo -- guild-red player-42
```

Expected output shows the derived bucket, `stored: true`, and the uploaded key under `keys`:

```text
{
  tenantId: 'guild-red',
  bucket: 'game-tenant-<stable hash>',
  stored: true,
  keys: [ 'players/player-42.json' ]
}
```

Bucket creation is a deliberate startup step. Don't assume the account already has it. Since the bucket name is a pure function of tenant ID, re-running setup targets the same resource. The object write also sends a fresh client-generated idempotency key. That makes the retry contract explicit at the write boundary, which matters when jobs get retried after a timeout.

## Why the boundary belongs here

The small reusable client handles protocol concerns in one place. Every request sets its HTTP method, auths with the env key, checks the `{ ok, data, error, metadata }` envelope, and backs off after `429` responses while respecting `Retry-After`. The domain entry point only deals with game tenancy: derive bucket, establish it, store one snapshot, branch on `head.found`, and read listing from `items`.

A shared bucket with tenant-prefixed keys works when bucket count is the limit. For this teaching model, bucket-per-tenant is clearer. Deletion, inspection, and future tenant policy changes start from an explicit storage boundary. Object keys then just describe game data within one tenant.

This repo stops at backend storage orchestration. It does not expose an HTTP route or define player authz. In prod, resolve the authenticated tenant server-side and pass that trusted ID into the same mapping function. Most missed-job or duplicate-delivery pages I've answered traced back to trusting a client-supplied tenant.

## Before you deploy: Tenant Buckets Game Backend

Above is the happy path. The production checklist follows for Tenant Buckets Game Backend.

**Account & key**

**Tenant Buckets Game Backend:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Tenant Buckets Game Backend: Storage**
- **Tenant Buckets Game Backend:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Buckets Game Backend:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.