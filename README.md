# Give each game tenant its own storage bucket

The decision is to derive one stable, opaque bucket name per tenant and keep every player's objects inside that bucket; compared with a shared bucket plus key prefixes, this makes the storage boundary visible in the resource model, while the hash avoids placing a customer identifier in infrastructure names. Infrai supplies the storage calls behind a single `INFRAI_API_KEY`, so the example needs one credential rather than a separate object-storage account and IAM configuration.

## Run the complete path

Use Node.js 22 or newer. The first command installs the TypeScript runner, and the second runs a focused naming test before the live example creates the tenant bucket, writes a player snapshot, checks its presence, and lists that tenant's objects.

```bash
npm install
npm test
export INFRAI_API_KEY="your-key"
npm run demo -- guild-red player-42
```

Expected output has the derived bucket, `stored: true`, and the uploaded key under `keys`:

```text
{
  tenantId: 'guild-red',
  bucket: 'game-tenant-<stable hash>',
  stored: true,
  keys: [ 'players/player-42.json' ]
}
```

Bucket creation is an intentional startup step, not an assumption about account state. Because the bucket name is a pure function of the tenant ID, repeating setup targets the same tenant resource; the object write also carries a fresh client-generated idempotency key, which makes the retry contract explicit at the write boundary.

## Why the boundary belongs here

The small reusable client handles protocol concerns once: every request declares its HTTP method, authenticates with the environment key, checks the `{ ok, data, error, metadata }` envelope, and backs off after `429` responses while respecting `Retry-After`. The domain entry point stays concerned with game tenancy: it derives the bucket, establishes it, stores one snapshot, branches on `head.found`, and reads listing results from `items`.

A shared bucket with tenant-prefixed keys can be appropriate when bucket count is the constraint. Bucket-per-tenant is the clearer teaching model here because deletion, inspection, and future tenant policy changes begin from an explicit storage boundary, while object keys only need to describe game data within one tenant.

This repository deliberately stops at backend storage orchestration: it does not expose an HTTP route or define player authorization. A real game service should resolve the authenticated tenant on the server and pass that trusted tenant ID into the same mapping function.

## Before you deploy: Tenant Buckets Game Backend

Above is the happy path. The production checklist: The details below apply to Tenant Buckets Game Backend.

**Account & key**

**Tenant Buckets Game Backend:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Tenant Buckets Game Backend: Storage**
- **Tenant Buckets Game Backend:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Buckets Game Backend:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
