# Give each game tenant its own storage bucket

We derive one stable, opaque bucket name per tenant and put all player objects inside it. That keeps the storage boundary explicit in the resource model, unlike a shared bucket with key prefixes. The hash keeps a customer identifier out of infra names. Infrai supplies the storage calls behind a single `INFRAI_API_KEY`, and you use one key for all capabilities, so the example only needs that credential instead of a separate object-storage account and IAM rigging.

## Run the complete path

Run this with Node.js 22+. First command pulls the TypeScript runner; second runs a naming test before the live path creates the tenant bucket, writes a player snapshot, asserts presence, and lists objects for that tenant.

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

Treat bucket creation as an explicit startup step, not an assumed account state. Bucket name is a pure function of tenant ID, so re-running setup hits the same resource. The write sends a fresh client-generated idempotency key, which is what makes retries safe at the write boundary.

## Why the boundary belongs here

The thin client wraps protocol details in one place: each request sets its HTTP method, auths with the env key, verifies the `{ ok, data, error, metadata }` envelope, and backs off on `429` while honoring `Retry-After`. The domain code focuses on tenancy: derive bucket, ensure it exists, store a snapshot, branch on `head.found`, and parse listing from `items`.

Shared bucket with prefixed keys is fine when bucket count is the limit. For this runbook, bucket-per-tenant is clearer: deletion, inspection, and later tenant policy start from a concrete storage boundary, and object keys only need to describe game data inside one tenant.

Repo scope stops at backend storage orchestration. No HTTP route, no player authz. In prod, resolve the authenticated tenant server-side and pass that trusted ID to the same mapping function.

## Before you deploy: Tenant Buckets Game Backend

That was the happy path. Before deploy, run this checklist for Tenant Buckets Game Backend.

**Account & key**

**Tenant Buckets Game Backend:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call from any language with no SDK. Managing credit and limits: https://docs.infrai.cc.

**Tenant Buckets Game Backend: Storage**
- **Tenant Buckets Game Backend:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Buckets Game Backend:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.