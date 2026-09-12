# WildDuck — Complete Documentation & API Reference

> Compiled from the official `wildduck-docs` and `wildduck` (server) repositories, including the in-repo OpenAPI specification, TOML configuration files, `roles.json` permission map, and the `CLAUDE.md` codebase guide. Version references below correspond to WildDuck **v1.50.0** (the version stamped on the bundled OpenAPI spec) unless noted otherwise. Where the narrative docs and the actual source code disagreed (this happened a few times — e.g. password hashing), the source code was treated as ground truth and is called out explicitly.

## Table of contents

**Part 1 — WildDuck Documentation**
1. Introduction
2. Features
3. Installation
4. FAQ
5. Architecture
6. Protocols & Concepts
7. Security
8. Operations
9. Tools & Ecosystem
10. Developer / Codebase Reference

**Part 2 — WildDuck HTTP API Reference**
1. Overview & authentication
2. Roles & permissions
3. Error codes
4. Webhooks
5. Real-time events (SSE)
6. Message submission
7. MCP tokens
8. Full endpoint reference (120 endpoints)

---

# PART 1 — WildDuck Documentation

## 1. Introduction

WildDuck is an open-source, horizontally scalable IMAP/POP3 mail server written in Node.js, created and maintained by the team at Zone (zone.eu) / the `zone-eu` GitHub organization (historically `nodemailer/wildduck`). Unlike traditional mail servers such as Dovecot, WildDuck does not store mail on the filesystem in mbox/Maildir format — every message, mailbox, user account and attachment lives in **MongoDB**, with **Redis** used for pub/sub notifications, caching and rate limiting. This design choice is what gives WildDuck its headline property: **no single point of failure (no-SPOF)**. Because state lives in a replicated/sharded database cluster rather than on a single machine's disk, any WildDuck process can serve any user, processes can be added or removed freely, and a node failing does not take mailboxes with it.

WildDuck is also explicitly designed to be used as a **library**, not just a standalone server. The companion projects that handle inbound SMTP (`haraka-plugin-wildduck`) and outbound SMTP (`zonemta-wildduck`) `require()` WildDuck's own handler classes (`lib/user-handler.js`, `lib/message-handler.js`, `lib/filter-handler.js`, `lib/dkim-handler.js`, etc.) directly and share the same MongoDB/Redis connections, so all three components operate on one consistent view of the data instead of talking to each other over an API.

A WildDuck deployment is normally composed of several cooperating services rather than one monolithic process:

- **WildDuck** itself — IMAP, POP3, the management HTTP API, and (optionally) LMTP for local testing.
- **Haraka** with `haraka-plugin-wildduck` — the public-facing inbound SMTP server that receives mail from the internet and hands it to WildDuck's filter/storage layer.
- **ZoneMTA** with `zonemta-wildduck` — the outbound SMTP relay that takes messages users have sent and delivers them to the wider internet.
- **Rspamd** — spam/virus scanning consulted by Haraka before a message is accepted or rejected.
- **MongoDB** and **Redis** — the shared data layer for all of the above.

## 2. Features

- **No single point of failure.** Add or remove application servers, MongoDB replica members/shards, or Redis nodes without downtime.
- **Multi-tenant hosting.** Serves virtual mail hosting for arbitrary numbers of domains and users from the same cluster.
- **Unicode/UTF-8 addresses.** WildDuck natively supports non-ASCII email usernames (`UTF8=ACCEPT`, RFC 6855) — e.g. `андрис@уайлддак.орг` is a valid, deliverable address on a WildDuck instance.
- **Full-featured IMAP4rev1** implementation with a large set of extensions (IDLE, CONDSTORE, ENABLE, UIDPLUS, SPECIAL-USE, MOVE, COMPRESS=DEFLATE, QUOTA, and more — see §6.1).
- **Built-in message filtering** — a Sieve-like (but not Sieve-script-based) rules engine managed entirely through the HTTP API, evaluated on every incoming message.
- **Attachment deduplication.** Identical attachments across different messages/mailboxes are stored once and reference-counted (see §6.4).
- **Autoresponders ("vacation" replies)** with configurable active windows and per-sender throttling.
- **Comprehensive REST management API** covering users, addresses, mailboxes, messages, filters, autoreplies, DKIM, domain aliases and access control, TLS certificates (including ACME automation), application-specific passwords, two-factor authentication (TOTP and WebAuthn/FIDO2), audits, webhooks, and system settings.
- **Two-factor authentication**: TOTP and WebAuthn/FIDO2, enforceable per account.
- **Application Specific Passwords (ASPs)** so third-party IMAP/POP3/SMTP clients don't need the account's master password (and can be scoped and revoked individually).
- **Message encryption at rest** using OpenPGP and/or S/MIME public keys registered on the account, so incoming mail can be encrypted transparently as it's stored.
- **Audits**, letting an administrator capture a time-boxed, tamper-evident copy of a mailbox's traffic for legal/compliance review.
- **Webhooks** that push near-real-time events (new mail, auth failures, mailbox changes, etc.) to external HTTP endpoints.
- **Prometheus metrics** exposed from a dedicated, independent HTTP listener for observability (see §8.5).
- **ElasticSearch-backed full-text search**, optional, for scaling search beyond MongoDB's own `$text` index.
- **ACME (Let's Encrypt) automation** for per-SNI-hostname TLS certificates across IMAP, POP3, the API, and SMTP.
- **MCP (Model Context Protocol) support**, letting AI agents/LLM tool clients read a user's mail (see §6.9) through scoped, revocable tokens.

## 3. Installation

WildDuck requires **Node.js** (current LTS is recommended — check `package.json`'s `engines` field for the exact floor for a given release), **MongoDB** (replica set strongly recommended even for single-node installs, since WildDuck relies on features tied to replica sets such as change streams for some indexing features), and **Redis**.

At a high level, standing up a self-hosted instance looks like:

1. Install MongoDB and Redis (either locally or point at existing managed instances).
2. Clone the `wildduck` repository and run `npm install` (or use the published Docker image — see §8.2).
3. Copy/adjust the TOML configuration under `config/` — at minimum `dbs.toml` (Mongo/Redis connection strings) and the per-protocol files (`imap.toml`, `pop3.toml`, `api.toml`, `lmtp.toml`) for hostnames and enabled/disabled services.
4. Start the server: `node server.js` (or `npm start`), or run the individual entry points (`api.js`, `imap.js`, `pop3.js`, `lmtp.js`, `worker.js`, `tasks.js`, `webhooks.js`, `indexer.js`) separately if you want to scale/deploy each role independently (see §10 for what each entry point does).
5. Create your first user via the HTTP API (`POST /users`) — see the Users section of Part 2.
6. Wire up Haraka + `haraka-plugin-wildduck` for inbound mail and ZoneMTA + `zonemta-wildduck` for outbound mail if you want a mail-flow-complete deployment (WildDuck's own LMTP listener is for local testing only and is disabled by default).

A pre-built Docker image is published as `nodemailer/wildduck` on Docker Hub — see §8.2 for environment-variable based configuration. There is also a documented systemd/Ubuntu scripted install path referenced by the fail2ban guide (§8.7), implying an official install script exists for Ubuntu 20.04 LTS-class systems, in addition to the Docker route.

`npm run printconf` prints WildDuck's fully resolved effective configuration (after merging all TOML files and environment variable overrides), which is the fastest way to sanity-check a deployment's config before starting the server.

## 4. FAQ

**Why MongoDB instead of local disk (Maildir/mbox)?**
Storing all state in MongoDB (with attachments in GridFS) is what removes the single point of failure: any WildDuck process, on any host, can serve any mailbox, because nothing is pinned to local disk. It also means MongoDB's own replication/sharding is what gives you mail-server high availability, rather than needing to build failover logic into WildDuck itself.

**Does WildDuck store the original RFC822 message?**
No. Incoming messages are parsed into a tree-like structure and the original raw RFC822 source is not retained as-is; when a client fetches a message, WildDuck rebuilds it from the parsed structure. In the large majority of cases the rebuilt message is byte-for-byte compatible with what was received, but there are known edge cases (documented in the IMAP protocol differences list, §6.1) around base64-encoded attachments and certain multipart MIME boilerplate text that can differ slightly from the original bytes.

**Can I use non-ASCII / Unicode email addresses?**
Yes — `UTF8=ACCEPT` (RFC 6855) is supported, and WildDuck genuinely accepts non-Latin usernames as valid, routable addresses.

**How is spam handled?**
WildDuck itself doesn't scan for spam; that's Rspamd's job, invoked from the Haraka inbound layer before a message is accepted. WildDuck's role is to store the message (optionally into a Junk/Spam folder based on the score Haraka/Rspamd attached) and apply the user's own filters on top.

**Is Sieve supported?**
Not as a scripting language. WildDuck has its own, broadly similar, filtering engine (see §6.5) that's configured entirely through the REST API rather than by uploading `.sieve` scripts.

**What happens to deleted messages/attachments?**
See §6.4 (attachment deduplication) and §6.6 (retention policies) — deletion decrements reference counters rather than immediately freeing storage, and a separate garbage-collection pass reclaims attachment content once nothing references it any more.

## 5. Architecture

### 5.1 Overview

A production WildDuck deployment is best thought of as five cooperating layers:

1. **Inbound edge (Haraka + haraka-plugin-wildduck):** accepts SMTP connections from the public internet, does recipient validation, SPF/DKIM/DMARC/ARC verification, and consults Rspamd for spam/virus scoring, then calls into WildDuck's `FilterHandler` to run the recipient's filters and store the message.
2. **Mail store (WildDuck core):** MongoDB-backed IMAP/POP3 service plus the management REST API. This is the only layer end users' mail clients (and administrators) talk to directly for reading/organizing mail.
3. **Outbound edge (ZoneMTA + zonemta-wildduck):** messages a user sends (via IMAP APPEND to a queue-backed folder or the API's message-submission endpoint) are queued into MongoDB (`zone-queue`, GridFS-backed) and delivered to the internet by ZoneMTA, which also signs with the domain's DKIM key and uploads a copy of what was actually sent into the user's Sent folder.
4. **Shared state (MongoDB + Redis):** MongoDB holds everything durable — users, mailboxes, messages, filters, DKIM keys, TLS certs, settings, audit logs, the outbound queue. Redis handles ephemeral concerns: pub/sub notifications that wake up IMAP `IDLE` connections when something changes, rate-limit counters, caching, distributed locks (e.g. for ACME certificate issuance and retention cleanup), and BullMQ-backed job queues for webhooks and search indexing.
5. **Background workers:** a task-queue processor (`tasks.js`) handles slow/critical operations that must survive restarts (user deletion, mailbox restore, quota recalculation, audits, ACME issuance/renewal, folder clearing, re-indexing for search, running migrations); `webhooks.js` delivers webhook events; `indexer.js` synchronizes ElasticSearch when full-text search is enabled.

### 5.2 WildDuck server (IMAP / POP3 / API / LMTP)

The WildDuck process itself is what mail clients (Thunderbird, Apple Mail, Outlook, mobile clients, webmail backends, etc.) connect to for reading and organizing mail, and what administrative tooling talks to over the REST API. It is not responsible for accepting mail from the wider internet — that's Haraka's job. WildDuck's own LMTP interface exists purely as a local testing convenience (the `examples/push-message.js` script "delivers" a test message over LMTP) and is disabled by default; the guidance is explicit that if you're running the Haraka plugin, you don't need LMTP at all.

Each of the protocol servers (IMAP, POP3, the REST API, LMTP) can be enabled/disabled independently in configuration and, per `CLAUDE.md`, can be deployed as separate processes/services (e.g. an "IMAP-only" or "API-only" role) sharing the same MongoDB/Redis backend — useful for scaling protocol-heavy workloads independently of API-heavy workloads.

### 5.3 Inbound SMTP — Haraka

**Haraka** is a plugin-based SMTP server (not written by the WildDuck team) that WildDuck integrates with via `haraka-plugin-wildduck`. On the inbound edge, Haraka is responsible for:

- Speaking SMTP to the rest of the internet (accepting connections from remote MTAs).
- Validating recipients against WildDuck's user/address database before accepting a message (so it can reject unknown recipients at the SMTP level rather than after acceptance).
- Running SPF, DKIM, DMARC, and ARC verification on the incoming message.
- Consulting **Rspamd** for a spam/virus score and acting on it (reject, quarantine to Junk, tag, etc., depending on configured thresholds).
- Handing accepted messages to WildDuck via `filterHandler.storeMessage()`, imported directly from `@zone-eu/wildduck/lib/filter-handler`, so the message is written straight into the recipient's mailbox (running their filters, autoreplies, and forwarding rules along the way) rather than via a network hop to a separate API.
- Queuing forwards and autoreplies into the `zone-queue` collection so ZoneMTA can send them onward.

### 5.4 Outbound SMTP — ZoneMTA

**ZoneMTA** is, similarly, a general-purpose outbound SMTP relay (also from the same team) that WildDuck integrates with via `zonemta-wildduck`. Messages become eligible for outbound delivery in one of two ways: an IMAP client `APPEND`s a message to a special queue-backed mailbox, or a client calls the API's message-submission endpoint. Either way, the message lands in the `zone-queue` MongoDB collection (backed by GridFS for the message body) and ZoneMTA picks it up from there. The `zonemta-wildduck` plugin:

- Validates that the `From:` address is actually one the authenticated user is allowed to send as.
- Enforces per-user/per-day recipient rate limits (backed by the `wdr:<userId>` Redis counter).
- Signs outgoing messages with the sending domain's DKIM key, retrieved from WildDuck's own DKIM key store (`lib/dkim-handler.js`).
- Uploads a copy of the message as actually sent (after any modifications, e.g. header rewriting) to the user's Sent folder once delivery succeeds.

A message queued for outbound delivery has a maximum time-to-live in the queue (`sender.maxQueueTime`, default 30 days in milliseconds) after which the MTA will no longer attempt delivery; this value must be kept in sync with ZoneMTA's own `maxQueueTime` setting.

### 5.5 Spam filtering — Rspamd

**Rspamd** is a general-purpose spam-filtering system consulted by Haraka (not by WildDuck directly) during the inbound SMTP transaction. It combines many heuristics (Bayesian classification, DNS blocklists, SPF/DKIM/DMARC results, regex/rule-based checks, optional external reputation feeds) into a single composite spam score, which Haraka then acts on — typically rejecting messages above a hard threshold and routing messages above a lower threshold into the recipient's Junk/Spam folder (which, per §6.6, has an enforced maximum retention of 30 days) rather than Inbox.


## 6. Protocols & Concepts

### 6.1 IMAP / POP3 protocol support

WildDuck implements the full **IMAP4rev1** command set plus a substantial list of extensions:

| Extension | RFC | Notes |
|---|---|---|
| IDLE | RFC 2177 | Push notifications for new/deleted messages and flag changes |
| CONDSTORE + ENABLE | RFC 4551 / RFC 5161 | Most of the spec is supported; metadata-related pieces are ignored. See §6.2 |
| STARTTLS | RFC 2595 | |
| NAMESPACE | RFC 2342 | Minimal — lists a single user namespace with a hierarchy separator |
| UNSELECT | RFC 3691 | |
| UIDPLUS | RFC 4315 | |
| SPECIAL-USE | RFC 6154 | |
| ID | RFC 2971 | |
| MOVE | RFC 6851 | |
| AUTHENTICATE PLAIN + SASL-IR | RFC 4959 | |
| APPENDLIMIT | RFC 7889 | Global max message size advertised via CAPABILITY |
| UTF8=ACCEPT | RFC 6855 | Enables native Unicode usernames |
| QUOTA | RFC 2087 | A single global quota root per account; quota is the sum of stored messages' RFC822 sizes, not actual on-disk bytes |
| COMPRESS=DEFLATE | RFC 4978 | Optional, off by default (`imap.enableCompression`) |

WildDuck passes the bulk of the community **ImapTest** stress-testing suite. The typical "failures" reported by that tool are expected/intentional: WildDuck does not send unsolicited `FLAGS` updates (only unsolicited `FETCH FLAGS`), and it can return `NO` for a `STORE` command if the target messages were deleted by a different session in the meantime.

Performance note straight from the docs: for a single user, WildDuck is slower than Dovecot at raw message fetch throughput, because Dovecot reads bytes straight off the filesystem while WildDuck reconstructs each message from its parsed, deduplicated representation. This is treated as an acceptable trade-off — bulk single-mailbox throughput is rarely the bottleneck that matters in practice, whereas WildDuck's MongoDB-sharded design scales far better across large numbers of concurrent users, and its write-ahead-log-style notification pipeline gives good cross-client sync latency (e.g. one client seeing a change another client just made).

**Known, intentional IMAP protocol differences** (documented explicitly so client authors and operators aren't surprised):

1. `\Recent` is not implemented (and is unlikely to ever be).
2. `RENAME` does not cascade into subfolders, technically violating RFC 3501 §6.3.5 — WildDuck actually stores all mailboxes in a flat structure, and the `/` hierarchy separator shown to clients is cosmetic only.
3. Unsolicited `FLAGS` / `PERMANENTFLAGS` responses are not sent outside of `SELECT`/`EXAMINE` — flag changes are only announced via unsolicited `FETCH` updates.
4. `STORE` returns `NO` if the targeted messages were deleted in another session in the meantime.
5. The `CHARSET` argument to `SEARCH` is ignored.
6. `SEARCH MODSEQ` metadata arguments (`<entry-name>`, `<entry-type-req>`) are accepted syntactically but not actually used.
7. `SEARCH TEXT` and `SEARCH BODY` are both implemented via a MongoDB `$text` index over the decoded plaintext body, rather than RFC 3501's literal full-message vs. body-section string match.
8. Behavior of `FETCH` against messages deleted mid-session by another connection is explicitly noted in the source docs as unconfirmed/needs-checking.
9. **Autoexpunge**: setting the `\Deleted` flag on a message triggers an `EXPUNGE` in the background automatically. This is spec-compliant, just proactive.

Additionally, messages retrieved from WildDuck are not guaranteed to be byte-identical to what was originally received — most notably around base64-encoded attachment re-wrapping and certain multipart MIME boilerplate strings — because storage/retrieval goes through a parse → rebuild round-trip rather than storing the raw RFC822 blob.

**POP3** support covers the mandatory command set from RFC 1939 plus `UIDL`, `USER`/`PASS`, `SASL PLAIN`, `PIPELINING`, and `TOP`. Behavior notes:
- Changes (deletions, seen-marking) are only committed to storage at the `QUIT`/UPDATE stage — if a client disconnects without issuing `QUIT`, nothing is persisted, including `RETR`-triggered "seen" marking.
- `LIST`/`UIDL` only ever show the newest 250 messages in INBOX by default (configurable via `pop3.maxMessages`).
- `UIDL` uses the message's 24-byte hex Mongo `_id` as the unique ID; if a message is moved between mailboxes it can effectively "reappear" in a listing.
- `RETR` marks a message `\Seen`.
- `DELE` marks a message `\Seen` and moves it to Trash (rather than truly deleting it immediately).

### 6.2 CONDSTORE and connection management

WildDuck's CONDSTORE (RFC 4551) support covers the vast majority of the spec — the exception being the metadata-entry pieces of `SEARCH MODSEQ`, which are accepted but ignored (see difference #6 above) — giving IMAP clients an efficient way to resynchronize just the messages that changed since their last known MODSEQ, rather than re-listing an entire mailbox.

Separately, WildDuck exposes advanced **connection management** hooks (`onConnect` / `onClose` style handlers, per the architecture notes) that let operators observe and react to the IMAP connection lifecycle — useful for connection accounting, abuse detection, or integrating with external connection-limiting/observability systems, on top of the built-in `imap.maxConnections` per-client cap.

### 6.3 Attachment deduplication

WildDuck de-duplicates attachments at the level of their **encoded** MIME node content (i.e. the raw base64/quoted-printable bytes as they appeared in the message), not the decoded file. This is a deliberate trade-off: encoded-content matching produces some false negatives (the literal same file, re-encoded slightly differently across two emails, might be stored as two separate attachment entries) but it's necessary to preserve the validity of signature schemes like DKIM and GPG, which sign the message bytes as transmitted. Note that WildDuck never stores the raw RFC822 source of a message at all — it parses every message into a tree structure and rebuilds it on retrieval, and in the common case the rebuilt message is indistinguishable from the original.

Mechanically: when an attachment is encountered, WildDuck computes its SHA-256 hash. If a GridFS attachment entry with a matching hash already exists, its reference counter is simply incremented and that entry's `_id` is added to the new message's `attachments` array — no new copy is written. Deleting a message does the reverse: every attachment it references has its counter decremented. Attachment bytes are **not** deleted the instant a counter hits zero; a separate, periodic garbage-collection process sweeps up zero-reference attachments.

To avoid a race condition where deletions could prematurely wipe an attachment still referenced elsewhere, WildDuck borrows a "magic number" scheme (credited to a technique used at Mail.ru): each *message* is assigned a random number at creation time. Adding the message increments each of its attachments' magic counter by that random number; deleting the message decrements by the same amount. In the correct, race-free case, a fully-dereferenced attachment ends up with **both** its reference counter and its magic counter at exactly zero. If only one of the two counters is zero, something raced, and the attachment is deliberately *not* deleted (erring on the side of not losing data).

### 6.4 Message filtering

WildDuck ships a built-in filtering engine that is conceptually similar to Sieve but is **not** Sieve — there is no script language or `.sieve` file format involved. Filters are structured data (conditions + actions) created, listed, updated and deleted entirely through the `/users/:user/filters` family of REST API endpoints (see Part 2), and are evaluated by `FilterHandler` against every message as it's stored (both for locally-delivered mail via Haraka and for the reference LMTP test path).

### 6.5 Retention policies

WildDuck can automatically expire (delete) messages that have sat in a mailbox longer than a configured retention period.

- **Spam and Trash folders always have a maximum retention of 30 days.** Even if you configure a longer value, it is silently capped at 30 days for those two special-use folders.
- Other folders have no retention limit by default.
- A default retention period for *all* of a user's mailboxes (including any folders they create later) can be set at account-creation time via the `retention` property on `POST /users` — a plain number of **milliseconds**. E.g. a 90-day default retention is `7776000000` (`90 * 24 * 3600 * 1000`).
- Retention can also be set per-mailbox via the mailbox update endpoint. Changing a mailbox's retention setting only affects *new* messages going forward — it does not retroactively change the expiry of messages already stored in that mailbox.

Mechanically: every WildDuck process periodically attempts to acquire a distributed lock (via the `redfour`/`ioredfour` Redis-locking mechanism) for the cleanup job. Whichever instance gets the lock opens a cursor over all messages whose retention deadline has already passed and deletes them one at a time — meaning an expired message can, in practice, linger for up to roughly a minute past its exact expiry rather than disappearing at the precise millisecond. Each deletion triggers a cascade: the message document is removed from the `messages` collection, connected IMAP clients are notified (an `EXPUNGE`-equivalent update), the owning user's quota usage counter is decremented, and reference counters on that message's deduplicated attachments (§6.3) are decremented. A separate background sweep later reclaims any attachments whose reference count has reached zero.

### 6.6 Domain management (DKIM, aliases, access control)

Domain-level configuration is spread across a few related but distinct API resource groups, each covering one concern:

- **DKIM** (`/domains/:domain/dkim`) — generate/register the DKIM signing key(s) ZoneMTA uses to sign outbound mail for a domain.
- **Domain aliases** (`/domainaliases`) — map one domain to another so that addresses on the alias domain resolve to accounts on the canonical domain.
- **Domain access control** (`/domainaccess/:tag/...`) — allow/block-list style rules governing which domains/tags are permitted to interact with a given scope.
- **Certs** (`/certs`) — TLS certificates bound to specific SNI hostnames, optionally auto-renewed via ACME (see §8.3).
- **BIMI** — Brand Indicators for Message Identification support is present in the codebase (`lib/bimi-handler.js`, a `bimi` MongoDB collection) for domains that want their verified logo displayed by supporting mail clients.

### 6.7 Full-text search

By default, IMAP `SEARCH TEXT`/`SEARCH BODY` run against MongoDB's own `$text` index over each message's decoded plaintext body. For deployments that outgrow MongoDB text search, WildDuck can optionally sync into **ElasticSearch** instead — enabled via the `[elasticsearch]` configuration block (`elasticsearch.enabled`, plus connection URL/credentials/index name) and a companion `[elasticsearch.indexer]` worker toggle. When enabled, indexing happens through two BullMQ queues run by the `indexer.js` service: a `live_indexing` queue fed in real time by MongoDB change streams on the `journal` collection, and a `backlog_indexing` queue used for bulk/historical (re-)indexing, triggered by the `user-indexing` background task. Search indexing is feature-gated per user via a Redis set (`feature:indexing`) — i.e. it's an opt-in-per-account capability, not an all-or-nothing cluster setting.

### 6.8 MCP (Model Context Protocol) integration

WildDuck includes native support for **MCP** — the protocol used by AI assistants/agents to call external tools — allowing an LLM-based client to read a user's mailbox (users, addresses, mailboxes, and messages, in a deliberately reduced/read-only field set) via scoped, individually revocable tokens rather than handing over the account's real master credentials.

- Configuration lives in `config/mcp.toml`, included into the root config under `[mcp]`.
- Access is governed by two dedicated permission roles defined in `roles.json`: **`mcptokens`** (the ability to create/read/delete the tokens themselves — available to `root`, `manager`, `webmail`, and `user` roles for their own account) and **`mcp:read`** (the actual scoped read-only data access an issued token grants, covering a deliberately narrow field set):
  - `users` → `id, username, name, address, limits`
  - `addresses` → `id, name, address`
  - `mailboxes` → `id, name, path, specialUse, subscribed, hidden, total, unseen, size`
  - `messages` → a fuller set of message metadata and body fields (`id, mailbox, thread, from, replyTo, to, cc, bcc, messageId, subject, date, idate, size, contentType, seen, deleted, flagged, draft, answered, forwarded, references, intro, text, html, attachments, attachmentsList, encrypted`) but **not** account credentials, filters, or anything outside a user's own mail.
- MCP tokens are managed through their own REST endpoints under `/users/:user/mcp-tokens` (see Part 2, §7) — separate from, and narrower in scope than, Application Specific Passwords.


## 7. Security

### 7.1 Overview

WildDuck's security model spans several independent layers: transport encryption (TLS/STARTTLS on every protocol, with optional ACME-issued, auto-renewing SNI certificates), credential hashing (§7.2), API authorization via scoped roles and bearer access tokens (§7.3), optional message-at-rest encryption via PGP/S-MIME (§7.4), optional breached-password screening on login (via the "Have I Been Pwned" Pwned Passwords API or a self-hosted equivalent — `[pwned]` config block, with `hardfail`/`fail`/`softfail`/`none` enforcement modes), and rate-limiting/lockout behavior on both authentication and TOTP attempts.

### 7.2 Authentication & password hashing — verified against source

This is an area where the narrative documentation across different doc sources is inconsistent (one version describes bcrypt with an MD5-derived selector; another describes PBKDF2 with a SHA-1-derived selector). The following is verified directly against `lib/hashes.js`, `lib/user-handler.js`, and `lib/consts.js` in the shipped source, and should be treated as authoritative:

- **Default algorithm for new/changed passwords:** `consts.DEFAULT_HASH_ALGO` is `'pbkdf2'` by default. Concretely that means **PBKDF2-HMAC-SHA256**, with **100,000 iterations** (`PDKDF2_ITERATIONS`) and a **16-byte salt** (`PDKDF2_SALT_SIZE`), produced via the `@phc/pbkdf2` package (PHC string format). `DEFAULT_HASH_ALGO` can be switched to `'bcrypt'` instead, in which case new hashes use **bcrypt with 11 rounds** (`BCRYPT_ROUNDS`) via `bcryptjs`.
- **Verification supports many legacy formats simultaneously**, so existing accounts keep working across an algorithm change or a migration from another mail system: PBKDF2 (`pbkdf2-sha512`, `pbkdf2-sha256`, `pbkdf2-sha1` — identified by PHC prefix), bcrypt (`$2a$`, `$2b$`, `$2y$`), Unix `crypt` SHA-512/SHA-256 (`$6$`, `$5$`), Argon2 (`argon2d`/`argon2i`/`argon2id`, verified via `hash-wasm`), classic Unix DES-crypt (13-character hashes), and salted MD5-crypt (`$1$`) — the latter three existing specifically to support accounts imported from older/legacy systems.
- **Automatic re-hashing on login (`shouldRehash`)**: WildDuck opportunistically upgrades a stored hash to the current preferred algorithm/parameters the next time the user successfully authenticates. Legacy algorithms (DES-crypt, MD5-crypt, Argon2, `pbkdf2-sha1`) are *always* flagged for rehash; a PBKDF2 hash is rehashed if its iteration count is below the currently configured minimum, or if the configured default algorithm has since changed to bcrypt; a bcrypt hash is rehashed only if the configured default algorithm has since changed away from bcrypt.
- **Application Specific Password (ASP) selectors** (used to let WildDuck look up *which* stored ASP hash to check, without storing the ASP itself in a directly reversible or guessable form) are computed as: SHA-1 hash the input string, sum the resulting byte values, take that sum **mod 32**, and hex-encode the single resulting value (`getStringSelector()` in `lib/user-handler.js`). This selector is stored alongside the (separately, strongly) hashed ASP value and used purely to narrow candidate matches, not as the actual credential check.
- **TOTP seeds** and **DKIM private keys** are stored as cleartext in MongoDB by default, but can each be encrypted at rest with a configured secret (`[totp].secret` / `[dkim].secret`, both defaulting to AES-192 for decrypting any legacy values). **Important operational note directly from the config comments**: once you set these secrets, do not change them afterward, or WildDuck will no longer be able to decrypt previously-stored values.
- **Two-factor authentication (2FA)** supports **TOTP** and **WebAuthn/FIDO2** (`[webauthn]` config block: relying-party ID/name, challenge size, attestation mode, user-verification requirement). A configuration flag, `strict2fa` (default `true`), changes what `/authenticate` returns for a 2FA-enabled user: with `strict2fa = true`, a successful password check returns a short-lived 2FA nonce that must then be exchanged for a real token by completing the second factor; with it `false`, the legacy behavior of returning a usable token immediately (before the second factor is checked) is preserved.
- **Rate limiting / lockout**, per `CLAUDE.md`: authentication failures lock out after **12 failures in a 120-second window**; TOTP failures lock out after **6 failures in a 180-second window**. These are implemented via the Redis-backed `ttlcounter` Lua script (`lib/counters.js`) against keys like `auth_user:<tokenId>` and `totp:<userId>`.

### 7.3 API roles & access tokens

Every API request is evaluated against a **role**, and every role is defined declaratively in `config/roles.json` using an `accesscontrol`-style `resource: { action:scope: [fields...] }` structure (e.g. `"users": { "read:own": ["*", "!tags", "!disabledScopes", "!internalData"] }` — read your own user record, every field except the three listed). The roles actually shipped, and their intent, are:

| Role | Intent |
|---|---|
| `root` | Full, unrestricted (`:any`) access to every resource — intended for trusted server-to-server administrative integrations |
| `manager` | Broad `:any` access similar to `root`, but without `messages`, `attachments`, `storage`, `mailboxes`, `settings` — i.e. can administer accounts/domains/DKIM/certs/webhooks but not read or modify actual mail content |
| `webmail` | Scoped for a webmail backend acting on behalf of logged-in users — full mail operations (`messages`, `mailboxes`, `attachments`, `storage`, `filters`, `autoreplies`, `asps`, `mcptokens`, `domainaccess`, `webhooks`) plus limited `users` access (`read:any` + `update:any`, but not create/delete) |
| `user` | The scope granted to an authenticated end user acting for **themselves** (`:own`, not `:any`) — mail operations on their own data, a curated whitelist of updatable profile fields (password, name, forwarding targets, spam level, encryption settings, retention, 2FA disable, etc.), and read-only access to their own webhooks |
| `auth` | Minimal — only `authentication: create:any` (log in), with the `token` field itself excluded from what's returned |
| `tokenAuth` | Minimal — `authentication: create:any` (used specifically for token-based re-authentication flows) |
| `attachments` | Read-only access to `attachments` — used by the dedicated attachment-download code path |
| `downloader` | Read-only access to `messages` — used by the dedicated raw-message-download code path |
| `audit` | Create/read/update/delete on `audits`, plus read access to `users` (an auditor managing audit jobs, not reading live mail directly) |
| `auditclient` | Read-only access to `audits` (consuming/viewing an existing audit's captured data) |
| `export` | Create-only access to `export` and `import` (data portability jobs) |
| `settings` | Full CRUD on system-wide `settings` — matches the "settings-role token" mentioned in the system-defaults documentation |
| `mcp:read` | The scoped, read-only, field-limited grant an issued **MCP token** carries (see §6.8) — deliberately excludes credentials, filters, and anything outside the user's own `users`/`addresses`/`mailboxes`/`messages` data |

Roles are resolved server-side via `roles.can(req.role)…`, and beyond the coarse role check, WildDuck applies a second `permission.filter(data)` pass on response payloads to strip fields a given scope isn't entitled to see (this is what the `!tags`, `!internalData` style exclusions above actually do) — so scoping isn't purely at the endpoint level, it's also enforced at the field level on the way out.

Actual API authentication (as opposed to authorization/roles) is bearer-token based: when `[api.accessControl].enabled = true`, requests must include a valid access token (issued via the `/authenticate`-family endpoints or configured as a static root token) in the `X-Access-Token` header (or, if configured, an `accessToken` query parameter). Tokens are signed with an HMAC secret (`[api.accessControl].secret`) — changing that secret invalidates every previously issued token. Tokens have both a rolling TTL (`tokenTTL`, default 14 days, extended on each use) and a hard maximum lifetime (`tokenLifetime`, default 180 days) after which they expire regardless of use.

### 7.4 Encryption

- **Message encryption at rest**: if a user has an OpenPGP public key (`pubKey`) and/or S/MIME certificate(s) (`smimeCerts`, with configurable `smimeCipher`/`smimeKeyTransport`) registered on their account, and `encryptMessages` (optionally also `encryptForwarded`) is turned on, incoming mail is transparently encrypted to that key/cert as it's stored — so even a database compromise doesn't expose plaintext mail content for that account (though metadata such as headers used for indexing/search may not be covered to the same degree, depending on configuration).
- **Secrets at rest for system data**: TOTP seeds, DKIM private keys, and stored TLS private certificates can each independently be encrypted with their own configured secret (`[totp].secret`, `[dkim].secret`, `[certs].secret`), all defaulting to cleartext storage unless explicitly configured, and all warning against changing the secret after the fact (old values become undecryptable).
- **Transport encryption**: STARTTLS is supported (and can be disabled) on IMAP/POP3/LMTP; the API and all protocol listeners can terminate TLS directly or expect it to be terminated upstream (e.g. by HAProxy — see §8.7, `secure=true` + `secured=true`) via ACME-managed or manually supplied certificates.


## 8. Operations

### 8.1 Configuration reference

WildDuck is configured via **TOML** files (loaded through `@zone-eu/wild-config`), living under `config/`, with `default.toml` as the root file that `@include`s the rest:

| File | Covers |
|---|---|
| `default.toml` | Root file; process identity, 2FA/pwned-password/webauthn options, and `@include`s for every other file below |
| `dbs.toml` | MongoDB connection string, optional separate DBs for GridFS/users/sender queue, Redis connection (single master or Sentinel) |
| `imap.toml` | IMAP listener: port/host, TLS, max message size, line-length limit, retention defaults, bandwidth/connection caps, PROXY protocol, extra interfaces |
| `pop3.toml` | POP3 listener: port/host, TLS, `maxMessages` (default 250), bandwidth caps |
| `api.toml` | REST API listener: port/host, TLS, `[accessControl]` (enable/secret/token TTL & lifetime), `[roles]` (includes `roles.json`), mobile config (`.mobileconfig`) profile branding, CORS |
| `lmtp.toml` | Local-testing LMTP listener (disabled by default) |
| `tls.toml` | Global default TLS key/cert/dhparam, shared unless a service overrides it |
| `dkim.toml` | Whether DKIM private keys are encrypted at rest, and with what algorithm |
| `acme.toml` | ACME directory URL/account email, CAA domain allow-list, key size, `[autogenerate]` SNI cert automation and CNAME-mapping rules, `[agent]` standalone HTTP-01 challenge listener |
| `attachments.toml` | Attachment storage backend (`gridstore`/GridFS), bucket name, whether base64 attachments are decoded to binary before storage |
| `sender.toml` | Outbound queue: ZoneMTA zone name, GridFS/collection names, loop-detection secret (shared with `haraka-plugin-wildduck`), max queue time |
| `metrics.toml` | Prometheus `/metrics` listener — see §8.5 |
| `mcp.toml` | MCP integration settings — see §6.8 |
| `plugins.toml` | Path to a local plugins directory, plus includable per-plugin TOML files |
| `migrations.toml` | Per-migration toggles/batch sizes for background data migrations (e.g. `addressregisterAddDisabled`, `addressesToDomaincache`) |
| `test.toml` / `development.toml` | Environment-specific overrides (test DB names/ports, etc.) |

A few config values worth calling out explicitly because they're easy to get wrong or miss:

- **Any config value can be overridden by an environment variable** using the `APPCONF_` prefix with underscores for nesting, e.g. `APPCONF_dbs_mongo`, `APPCONF_imap_setup_hostname`, `APPCONF_metrics_enabled` — this is the primary configuration mechanism recommended for container deployments.
- `api.toml`'s `[accessControl]` is **disabled by default** (`enabled = false`) — meaning a fresh, default install's API has no authentication requirement at all. Enabling it (`enabled = true`) plus setting a strong `secret` is a baseline production hardening step.
- `imap.toml`'s `retention` (30 days) is the *default* Spam/Trash retention referenced in §6.5, and can be overridden per-account or per-mailbox.
- `webhooks` are only actually processed if **at least one server in the deployment** has `[webhooks].enabled = true` — otherwise events silently pile up unconsumed in the Redis-backed queue.
- `[pwned]` (breached-password checking) is **disabled by default**; when enabled, `type` controls what happens if the check itself fails or the password is found breached: `hardfail` (block login either way), `fail` (block only if actually breached), `softfail` (allow login but flag the response), or `none`.

Full effective configuration for a running instance can always be inspected with `npm run printconf`, which is the most reliable way to confirm what a deployment is actually running with once TOML files and environment overrides are all merged.

### 8.2 Docker

An official pre-built image is published to Docker Hub as **`nodemailer/wildduck`**:

```bash
docker pull nodemailer/wildduck            # latest
docker pull nodemailer/wildduck:1.20       # a specific version tag
```

Inside the container, three environment variables are recognized directly by the image's entrypoint:

- `WILDDUCK_APPDIR` — install path inside the container
- `WILDDUCK_CONFIG` — path to the config file WildDuck should load
- `CMD_ARGS` — extra CLI options appended when launching WildDuck

Running the image with zero extra configuration (`docker run nodemailer/wildduck`) will use the bundled default config, which expects MongoDB and Redis on `localhost` — inside a container this virtually always fails, so one of two strategies is used in practice:

1. **Environment-variable overrides**, using the same `APPCONF_` mechanism as a bare-metal install (`wild-config` reads these regardless of how the process was started):
   ```bash
   docker run \
     -e APPCONF_dbs_mongo='mongodb://mongo:27017/' \
     -e APPCONF_dbs_redis='redis://redis:6379/3' \
     -e APPCONF_smtp_setup_hostname=example.com \
     -e APPCONF_log_gelf_hostname=example.com \
     -e APPCONF_imap_setup_hostname=example.com \
     -e APPCONF_emailDomain=mail.example.com \
     nodemailer/wildduck
   ```
2. **Mounting a custom config directory** over `/wildduck/config` inside the image:
   ```bash
   docker run -v '/config/from/host:/wildduck/config' nodemailer/wildduck
   ```

### 8.3 ACME certificates

WildDuck can obtain and auto-renew per-hostname (SNI) TLS certificates from Let's Encrypt or any other ACME-compatible CA, covering the **IMAP, POP3, REST API, and SMTP** listeners (explicitly **not** MX or webmail servers — those need their own certificate handling). Requirements:

- Every server that a given SNI hostname resolves to must have **either** the WildDuck API **or** a standalone WildDuck ACME agent (`[acme.agent]`, listening on port 80) reachable, so ACME HTTP-01 challenges can be answered on whichever host the CA connects to.
- You still need at least one set of default (even self-signed) certificates configured in `tls.toml`/per-service TLS blocks, since WildDuck only *prefers* SNI certs when a match exists — it needs a fallback.
- An SNI certificate is requested by **registering it via the API**, not through a config file:
  ```bash
  curl -XPOST http://localhost:8080/certs -H 'content-type:application/json' -d'{
      "servername": "imap.example.com",
      "acme": true
  }'
  ```
  This tells WildDuck that whenever `imap.example.com` is the SNI hostname a client connects with, it should serve (and keep renewed) an ACME-issued certificate for it — assuming the ACME agent/API is reachable on port 80 for every IP that hostname resolves to.
- `[acme.autogenerate]` can automate this further via CNAME-based domain ownership mapping, so certificates for subdomains like `imap.{domain}`/`smtp.{domain}` are generated automatically once the right CNAME and at least one `@{domain}` mailbox exist — no explicit `/certs` call needed per domain.
- Certificate hot-reload: sending **SIGHUP** to the master process causes configuration (including all TLS certificates) to be re-read from disk without a restart — existing connections keep using what they had, new connections get the refreshed certs. A malformed config on reload throws, so make sure certificate files stay readable by the WildDuck process user at all times.

### 8.4 Command-line administration

WildDuck doesn't ship a dedicated CLI tool for day-to-day admin tasks — the documented pattern is to script the **REST API** with `curl`, typically wrapped in small Bash functions saved to a personal `~/.wildduck.commands` file and sourced from `~/.bashrc`, e.g.:

```bash
wduck-user() {
  USERID=$1
  curl -i http://localhost:8080/users/$USERID
}

wduck-message-delete() {
  URL=$1   # format: /users/USERID/mailboxes/MAILBOXID/messages/UID
  curl -i -XDELETE http://localhost:8080$URL
}
```

For bulk/ad-hoc data operations too specific for the API (e.g. "find every message containing this Chinese-character string across the entire database"), the documented fallback is querying MongoDB directly, then feeding the resulting `/users/.../mailboxes/.../messages/...` paths back through the API for the actual mutation (rather than mutating MongoDB documents by hand):

```javascript
db.messages.find({'headers.value': /[姚轉]/}).toArray()
  .map(doc => '/users/' + doc.user.str + '/mailboxes/' + doc.mailbox.str + '/messages/' + doc.uid)
```

### 8.5 Prometheus metrics

WildDuck can expose **Prometheus** metrics from a small, dedicated HTTP listener that runs **independently of the main REST API** — meaning even an IMAP-only or POP3-only role/deployment can expose its own metrics without turning on the management API at all.

```toml
[metrics]
enabled = true
host = "127.0.0.1"
port = 8081
secure = false
collectCacheTtl = 10000
```

```bash
curl http://127.0.0.1:8081/metrics
```

Key points:
- **The endpoint is disabled by default**, and when enabled, **it does not require an access token** — it's meant to be reached only by a trusted scraper. The docs explicitly recommend restricting access via the bind address, firewall rules, or a reverse-proxy ACL, and using a sane scrape interval.
- Exposed data includes the running WildDuck version, request/error/traffic rates, and queue depths, plus (via `prom-client`) standard Node.js process metrics, and WildDuck-specific counters for API requests, authentication outcomes, IMAP/POP3/LMTP connections and commands, message operations, notification-journal activity, background task processing, and webhook/indexing queue depth. Metric **labels intentionally exclude** user IDs, mailbox IDs, message IDs, email addresses, and IP addresses, to avoid the metrics endpoint itself becoming a data-exposure risk.
- `collectCacheTtl` (milliseconds, default 10000) caches the results of the more expensive MongoDB task-count and Redis/BullMQ job-count collectors, so frequent or concurrent scrapes don't hammer the backends; set it to `0` to disable caching and query fresh on every scrape. In a multi-worker/cluster deployment, one elected worker process runs these backend collectors.
- **Migration note**: this configuration used to live under `[api.metrics]` and was served from the API port. That path is deprecated but still honored for backward compatibility (an existing `[api.metrics] enabled = true` keeps metrics *collection* running) — it just can't configure the new dedicated listener, so it should be migrated to the top-level `[metrics]` block shown above.
- HTTPS is supported for the metrics endpoint itself via `[metrics.tls]` (falls back to the global TLS cert, then to WildDuck's bundled self-signed cert, if no service-specific cert is given).
- In containers, remember to bind `host` to `0.0.0.0` and publish the port, or the endpoint is invisible outside the container.

### 8.6 Scaling: sharding, disk layout, Redis Sentinel

**MongoDB sharding** is supported and recommended once a single replica set's storage capacity becomes the constraint (not by default for smaller deployments — the docs explicitly frame it as something to opt into once you know you need it, since some administrative queries become scatter-gather across shards). Recommended shard keys:

```javascript
sh.enableSharding('wildduck');
sh.shardCollection('wildduck.messages', { mailbox: 1, uid: 1 });
sh.shardCollection('wildduck.archived', { user: 1, _id: 1 });
sh.shardCollection('wildduck.threads', { user: 'hashed' });
sh.shardCollection('wildduck.authlog', { user: 'hashed' });

sh.enableSharding('attachments');
sh.shardCollection('attachments.attachments.files', { _id: 'hashed' }); // sha256 of contents
sh.shardCollection('attachments.attachments.chunks', { files_id: 'hashed' });
sh.shardCollection('attachments.storage.files', { _id: 'hashed' });     // ObjectId
sh.shardCollection('attachments.storage.chunks', { files_id: 'hashed' });

// if auditing is enabled:
sh.shardCollection('attachments.audit.files', { _id: 'hashed' });
sh.shardCollection('attachments.audit.chunks', { files_id: 'hashed' });
```

**Disk layout**: measured attachment-content vs. everything-else ratio is roughly **1:10**, so a common pattern is a smaller, fast SSD for message metadata/indexes and a larger, cheaper SATA volume for attachment content — achievable with WiredTiger's `storage.directoryPerDB=true` and `storage.wiredTiger.engineConfig.directoryForIndexes=true`, mounting the attachments database's collection directory onto the larger/cheaper disk. MongoDB does not mind if the target folder already exists, so this mount can be prepared before MongoDB is even installed.

**Redis Sentinel** is supported as an alternative to a single Redis master, for automatic failover. Caveats called out directly in the docs: failover isn't instant (there's a window where a new master is being elected, during which pending requests are cached and generally succeed once failover completes, but this is worth load-testing for your own traffic pattern), and Sentinel failover does not guarantee strict consistency — acceptable specifically because WildDuck deliberately avoids storing anything *critical* in Redis, so any data loss during a Sentinel failover should not be user-visible.

### 8.7 HAProxy, fail2ban, and general operating notes

**HAProxy**: plain round-robin TCP load balancing is sufficient (no session persistence/stickiness needed, since IMAP/POP3/API state lives in Mongo/Redis, not on a specific WildDuck process). Enabling the PROXY protocol on the balancer (matched by `useProxy` in `imap.toml`/`pop3.toml`, which also accepts an explicit source-IP allow-list) preserves real client IPs in WildDuck's logs. If HAProxy terminates TLS itself, tell WildDuck's protocol servers TLS is handled upstream:

```toml
[imap]
secure = true    # WildDuck still identifies as a TLS server
secured = true   # ...but does not perform the TLS handshake itself

[pop3]
secure = true
secured = true
```

**fail2ban**: a documented jail definition bans repeat authentication failures at the OS firewall level, based on WildDuck's `[AUTHFAIL]` log lines:

```ini
# /etc/fail2ban/jail.d/custom.conf
[DEFAULT]
ignoreip = 127.0.0.0/8 <your public IP>
findtime = 1h
bantime  = 7d
maxretry = 3

[wildduck]
enabled = true
port    = 993,995
filter  = wildduck
logpath = /var/log/wildduck-server/wildduck-server.log
```

```ini
# /etc/fail2ban/filter.d/wildduck.conf
[INCLUDES]
before = common.conf
[Definition]
failregex = \[AUTHFAIL\] .*"_ip":"<HOST>"
ignoreregex =
```
(Verified on Ubuntu 20.04 LTS with the scripted install; expected to be similar for a Docker-based install.) Useful follow-up commands: `fail2ban-client status wildduck` to see current bans, `fail2ban-client set wildduck unbanip a.b.c.d` to manually unban an address.

**Logging**: WildDuck can emit GELF-formatted logs to a Graylog server (`[log.gelf].enabled = true`), and it's recommended to point `zonemta-wildduck` and `haraka-plugin-wildduck` at the *same* Graylog settings so a single message's journey through inbound → storage → outbound produces one coherent, correlatable log trail. (Graylog-based logging replaced an older `messagelog` MongoDB collection approach.)

**Testing a fresh install**: connect an IMAP client to a newly created account, then simulate an inbound delivery with the bundled example script:
```bash
node examples/push-message.js username@example.com
```
This "delivers" a message via WildDuck's built-in LMTP maildrop interface — if the IMAP client is connected, the new message should appear immediately.

**Importing existing mail**: a separate companion tool, [`import-maildir`](https://github.com/nodemailer/import-maildir), migrates mail from an existing Maildir-format mailbox into WildDuck's database.


## 9. Tools & Ecosystem

### 9.1 Webmail reference client

WildDuck's own reference webmail is a thin client that talks exclusively to the WildDuck HTTP API for both account management and message browsing — it has no privileged access path of its own. A live public demo runs at **wildduck.email**, where anyone can register a free `@wildduck.email` address to try a real, running WildDuck-backed mailbox.

### 9.2 Import / export & Maildir migration

Two supported paths exist for getting existing mail into WildDuck:

1. **`import-maildir`** (nodemailer/import-maildir) — imports directly into the WildDuck MongoDB database, bypassing IMAP entirely. This is both lower-overhead and doesn't require knowing the user's password, but does require direct network access to the target MongoDB/Redis instances. Usage:
   ```bash
   git clone git://github.com/nodemailer/import-maildir.git
   cd import-maildir && npm install --production
   # edit config/default.toml with your Mongo/Redis connection details
   ./bin/import-maildir user@example.com:/var/mail/user_example.com/
   ```
   Multiple `userid:maildirpath` pairs can be passed in one invocation to import several accounts at once; an `uploaders` config value controls how many run in parallel. The target user account must already exist in WildDuck before importing. It's tested primarily against Courier-style Maildir layouts, so Dovecot-specific Maildir extensions may not all be handled.
2. **`mbsync`** — a general-purpose IMAP sync tool. Slower (real IMAP protocol overhead) and requires the account's actual IMAP password, but is a reasonable fallback when direct database access isn't available (e.g. migrating from a genuinely separate, remote IMAP server rather than a local Maildir export).

A real-world walkthrough documented for migrating off **Microsoft Exchange** covers: standing up WildDuck via the [bundled setup script](https://github.com/zone-eu/wildduck/blob/master/setup/README.md), configuring SPF/DKIM DNS records for the domain, issuing a webmail TLS certificate (the example uses `acme.sh`), updating the outbound MTA plugin's configured hostname, converting exported Outlook `.pst` files to Maildir with `readpst` (from the `pst-utils` package) as an intermediate step, and then importing that Maildir output with either of the two tools above. The guide is explicitly flagged by its authors as potentially containing inaccuracies and worth double-checking against current WildDuck behavior rather than followed blindly.

### 9.3 Auditing

WildDuck has a built-in, admin-controlled **auditing** feature for legal/compliance/investigation scenarios, with a clear separation between what an *admin* can do and what an *auditor* (who may be entirely external) can do:

- An admin enables auditing for a specific account, scoped to a specific time window (only messages within that window are exposed — not the account's entire history).
- Audited messages are **copied**, not linked/referenced — so an account holder deleting a message from their live mailbox does **not** remove it from the audit copy.
- The audit — and the auditor's access to it — **automatically expires**: once the audit period lapses, the copied messages are deleted and the auditor's access is revoked.
- Admins can issue the auditor a set of access credentials **encrypted to the auditor's own PGP key**, meaning the admin generating the credentials cannot themselves read the audited email content — only the intended auditor, who decrypts the credentials into a CSV, can use them.
- With valid credentials, an auditor can browse message listings and metadata, search by sender/recipient address, date, and subject, and download individual messages or ZIP bundles of multiple/all messages in the audit.
- Two companion open-source tools implement the admin- and auditor-facing interfaces: **[wildduck-audit-manager](https://github.com/nodemailer/wildduck-audit-manager)** (admin side) and **[wildduck-audit-client](https://github.com/nodemailer/wildduck-audit-client)** (auditor side).

### 9.4 Third-party projects built on WildDuck

- **[Forward Email](https://forwardemail.net)** — a fully open-source, privacy-focused email service combining WildDuck with an encrypted SQLite storage layer, offering IMAP/POP3/SMTP/CalDAV and more.
- **[Astzweig Docker WildDuck](https://github.com/astzweig/docker-wildduck)** — a single Docker image bundling WildDuck, ZoneMTA, Haraka, and Rspamd together.
- **[DuckyPanel](https://github.com/louis-lau/DuckyPanel)** (with its companion **DuckyAPI**) — a multi-tenant domain-admin control panel, where different admin users each own specific domains and have full control over the accounts/forwarders within just their own domains.
- **[Raven Webmail](https://github.com/ramiroaisen/raven-webmail)** — an alternative webmail client for WildDuck.
- **[Project Pending](https://projectpending.com/)** — a domain-parking service that uses WildDuck for the email storage/access layer.
- **[WildDuck UI](https://github.com/softwareartistry/wildduck-ui)** — a standalone administrative UI for a WildDuck instance.

## 10. Developer / codebase reference

This section is derived from the project's own internal contributor guide (`CLAUDE.md`) and reflects the actual code layout rather than user-facing documentation — useful if you intend to operate, extend, or debug a WildDuck deployment rather than just run one.

**Dual role, again, at the code level**: WildDuck is both an application (`server.js` and friends) and an importable library — `haraka-plugin-wildduck` and `zonemta-wildduck` both `require('@zone-eu/wildduck/lib/...')` handler classes directly and share MongoDB/Redis connections with the main WildDuck process, rather than talking over the network.

**Entry points**: `server.js` (starts everything), `api.js` (REST API, built on Restify), `imap.js`, `pop3.js`, `lmtp.js` (local testing only), `worker.js` (background workers), `tasks.js` (MongoDB-backed task queue processor), `webhooks.js` (BullMQ-based webhook delivery), `indexer.js` (BullMQ-based ElasticSearch sync).

**Core handlers (`lib/`)**: `UserHandler` (accounts, auth, 2FA/TOTP/WebAuthn), `MessageHandler` (storage, parsing, PGP), `MailboxHandler` (mailbox CRUD), `StorageHandler` (attachment storage/dedup), `FilterHandler` (the filtering engine), `AuditHandler`, `SettingsHandler`, `DkimHandler`, `CertHandler` (TLS/ACME), `TaskHandler`, `BimiHandler`. Handlers generally expose **both** callback and Promise APIs (the Promise variant prefixed `async`, e.g. `resolveAddress(cb)` vs. `asyncResolveAddress()`).

**REST route modules** live in `lib/api/` — 23 modules, one family per resource: users, addresses, mailboxes, messages, filters, auth, 2FA (totp/webauthn/custom), webhooks, storage, submit, audit, settings, health, acme, dkim, certs, asps, domainaccess, domainaliases, autoreply, updates. Route handlers are wrapped in `tools.responseWrapper()` for consistent error handling, validate input/output with Joi schemas (`validationObjs: { requestBody, pathParams, queryParams, response }`, with the underlying schemas living in `lib/schemas/request/` and `lib/schemas/response/`), and check permissions via `roles.can(req.role).readOwn('resource')`-style calls plus a `permission.filter(data)` pass on response payloads.

**IMAP core** (`imap-core/lib/`) is a modular, stream-based IMAP4rev1 implementation: `imap-server.js` (TLS/SNI/socket setup), `imap-connection.js` (per-connection state), `imap-stream.js` (incoming parser), `imap-composer.js` (response formatter, with DEFLATE support), `imap-command.js` (dispatcher), `search.js` (20+ SEARCH criteria), plus a `handler/` subtree (parser/compiler/formal-syntax) and an `indexer/` subtree (MIME parsing, BODYSTRUCTURE/ENVELOPE generation). 36 individual command implementations live under `commands/`. Notable protocol-level constants: **5 min 37 sec** socket timeout, **50** max bad commands before disconnect, **1 MB** max literal size, **25** levels max parser nesting depth.

**Data flow**:
- *Inbound (production)*: Internet → Haraka → `haraka-plugin-wildduck` → `FilterHandler` → MongoDB. The plugin validates recipients and runs SPF/DKIM/DMARC/ARC, stores via `filterHandler.storeMessage()`, and queues forwards/autoreplies into `zone-queue`. WildDuck's own `lmtp.js` is for local testing only.
- *Outbound*: IMAP `APPEND` to a queue-backed folder, or the API's submit endpoint → MongoDB `zone-queue` (GridFS-backed) → ZoneMTA → `zonemta-wildduck` → the internet. The plugin validates the `From:` address, enforces recipient rate limits, DKIM-signs with keys from WildDuck's own store, and uploads the as-sent message into Sent.
- *Client access*: IMAP/POP3 clients authenticate via `UserHandler` and read/write mailboxes/messages directly; the REST API mutates MongoDB and relies on Redis pub/sub to notify any connected IMAP sessions that something changed.

**Background job systems — three, distinct, and purpose-built**:
1. **MongoDB task queue** (`tasks.js`, `lib/task-handler.js`) — for slow/critical work that must survive a restart, using MongoDB for persistence and `ioredfour` for distributed locking. Task types: `user-delete`, `restore`, `quota`, `audit`, `acme`, `acme-update`, `clear-folder`, `search-apply`, `user-indexing`, `run-migrations`. States flow `waiting` → `active` → completed/requeued. Key API: `add()`, `ensure()` (upsert/dedupe), `getNext()` (get+lock), `release()`, `keepAlive()`.
2. **BullMQ webhook queues** (`webhooks.js`, `lib/events.js`) — `events.publish()` feeds a `webhooks` queue that matches configured webhook subscriptions, which then feeds a `webhooks_post` queue that performs the actual HTTP POST with exponential-backoff retry.
3. **BullMQ indexing queues** (`indexer.js`) — `live_indexing` (real-time, driven by MongoDB change streams on `journal`) and `backlog_indexing` (bulk/historical, driven by the `user-indexing` task); gated per-user by membership in the Redis set `feature:indexing`.

**MongoDB collections**: Core — `users`, `addresses`, `addressregister`, `mailboxes`, `messages`, `threads`, `filters`, `autoreplies`. Auth/security — `authlog` (TTL-indexed), `asps`, `audits`. System — `settings`, `tasks`, `dkim`, `certs`, `domainaccess`, `domainaliases`, `domaincache`, `journal`, `webhooks`, `bimi`. Archival — `archived` (soft-deleted messages), `deletedusers`. Outgoing mail — `zone-queue`. GridFS buckets — `audit.files`, `storage.files`, `attachments.files`.

**Redis key patterns** (selected): `cached:<userId>` (1h TTL user-profile cache), `total:<mailboxId>`/`unseen:<mailboxId>` (24h TTL mailbox counts), `idw:<userId>`/`iup:<userId>` (IMAP down/upload rate counters), `wdr:<userId>` (outgoing-recipient counter used by the ZoneMTA plugin), `wda:<senderId>` (autoreply frequency), `wdf:<visitorId>` (forward rate limit, Haraka plugin), `lim:<service>` (per-user connection-count hash), `rl:rcpt:<visitorId>` (incoming recipient rate limit, Haraka plugin), `auth_user:<tokenId>` (120 s auth-failure counter), `totp:<userId>` (180 s TOTP-failure counter), WebAuthn challenge keys (`challenge:<userId>:reg|auth:<challenge>`, 1h TTL), the `feature:indexing` set, ACME distributed-lock keys (`d:lock:op|safe:<domain>`), and the `wd_events` pub/sub channel used for IMAP notifications. Rate-limiting/locking logic is implemented as Redis **Lua scripts** (`lib/lua/`, registered in `lib/counters.js`): `ttlcounter` (sliding-window limiter), `cachedcounter` (TTL-extending counter), `limitedcounter` (per-entry hash counter tolerant of process restarts), `processlock` (distributed lock with identifier matching).

**Key system-wide limits** (from `lib/consts.js` and default settings): 64 MB max message size, 25 MB max attachment size, 1500 mailboxes per user max (128 levels deep), 1 GB default per-user storage quota, 2000 recipients/day (400 per message), 2000 forwards/day, 12 auth failures/120 s lockout, 6 TOTP failures/180 s lockout, 25-day archive retention, 4-hour minimum interval between autoreplies to the same sender.

**Testing**: Mocha + Chai + Supertest. `npm test` drops the test DB, flushes Redis, lints, starts the server, and runs everything; `npm run test:proto` runs only the protocol-level unit tests (`imap-unit` + `pop3`) with no server or database required — the fast path for iterating on the IMAP/POP3 parser layer; `npm run runtest` runs the suite without the DB-cleanup step. Test config (`config/test.toml`) defaults to `mongodb://127.0.0.1:27017/wildduck-test`, `redis://127.0.0.1:6379/13`, API port 8080, IMAP port 9993, LMTP port 2424.

**Code style**: ESLint (`nodemailer` + `prettier` configs), Prettier at 160-character width, 4-space tabs, single quotes, no trailing commas; commit messages follow Conventional Commits with a ticket reference, e.g. `fix(imap): ZMSA-67: description`.


---

# PART 2 — WildDuck HTTP API Reference

## 1. Overview & authentication

The WildDuck management API is a **REST/JSON** API (built on Restify) that every other piece of tooling — the reference webmail client, `wildduck-audit-manager`, third-party admin panels like DuckyPanel/WildDuck UI — is built on top of. There is nothing an admin UI can do that isn't also available directly through this API.

- **Base URL**: whatever host/port `api.toml` binds to — `http://127.0.0.1:8080` out of the box (HTTP, localhost-only, no auth) — TLS and a public bind address are opt-in configuration, not defaults.
- **Authentication**: when `[api.accessControl].enabled = true`, send a valid access token in the **`X-Access-Token`** request header (an `accessToken` query-string parameter is also accepted if configured). Tokens are obtained via the Authentication endpoints (`POST /authenticate`, and related) or provisioned as a static root token in configuration.
  ```
  X-Access-Token: 59fc66a03e54454869460e45
  ```
- **Authorization**: every request is additionally evaluated against a **role** (see §2) which determines both which endpoints are reachable and which fields of a response are visible.
- **Responses** follow a consistent shape: success responses generally include `{"success": true, ...}` plus resource-specific fields (e.g. a newly created `id`); error responses include `{"error": "human readable message", "code": "MachineReadableCode", ...}` (see §3 for the full code catalog).
- This reference lists **120 documented HTTP endpoints** (from the project's own OpenAPI 3.0 specification, version 1.50.0) across 19 resource groups, plus 3 additional MCP-token endpoints that exist in the codebase/permission model but are not yet included in the generated OpenAPI spec (§7).

## 2. Roles & permissions

See Part 1, §7.3 for the full explanation of how roles work. Quick reference table of the roles defined in `config/roles.json`:

| Role | Scope |
|---|---|
| `root` | Full `:any` access to everything |
| `manager` | `:any` access to everything **except** mail content (`messages`, `attachments`, `storage`, `mailboxes`) and `settings` |
| `webmail` | Full mail operations for logged-in users, plus limited `users` (`read:any` + `update:any`, no create/delete) |
| `user` | `:own`-scoped mail operations and a whitelisted set of self-service profile fields |
| `auth` / `tokenAuth` | Login only (`authentication: create:any`) |
| `attachments` / `downloader` | Read-only, single-purpose (attachment download / raw message download) |
| `audit` / `auditclient` | Audit-job management vs. audit-data consumption |
| `export` | Create-only, for `/data/export` and `/data/import` |
| `settings` | Full CRUD on system-wide settings |
| `mcp:read` | The narrow, field-limited read grant carried by an issued MCP token |

## 3. Error codes

Every API error response includes a machine-readable `code` alongside the human-readable `error` message. The full catalog defined by the project:

| Code | Meaning |
|---|---|
| `InvalidToken` | The supplied access token is invalid or expired |
| `MissingPrivileges` | Not enough privileges for the requested action |
| `InputValidationError` | Request input failed schema validation (message varies by field) |
| `InternalDatabaseError` | A database-layer failure occurred |
| `InternalError` | An unspecified internal error occurred |
| `UserNotFound` | This user does not exist |
| `UserExistsError` | This username already exists |
| `AddressExistsError` | Address already exists |
| `AddressNotFound` | Invalid or unknown email address identifier |
| `ChangeNotAllowed` | Cannot change a special/reserved address |
| `WildcardNotPermitted` | Cannot set a wildcard address as the default |
| `AspNotFound` | Invalid or unknown Application Specific Password key |
| `InvalidAuthScope` | The mobileconfig profile requires either an `imap` or `pop3` scope, plus `smtp` |
| `AuthFailed` | Authentication failed |
| `DkimNotFound` | This domain has no DKIM key registered |
| `AliasExists` | This domain alias already exists |
| `AliasNotFound` | This domain alias does not exist |
| `FilterNotFound` | This filter does not exist |
| `NoSuchMailbox` | This mailbox does not exist |
| `MailboxExistsError` | This mailbox already exists |
| `MessageNotFound` | Invalid message identifier |
| `OverQuotaError` | The user is over their storage quota |
| `EmptyMessage` | An empty message was provided |
| `FileNotFound` | This file does not exist |
| `InsecurePasswordError` | The provided password was found in a breached-passwords list |
| `ERRCOMPOSE` | Could not queue the message for delivery |
| `KeyGenerateError` | Failed to generate a private or public key |
| `InternalConfigError` | Invalid encryption settings |
| `HashError` | A password/credential hashing operation failed |
| `UserUpdateFail` | Could not update the user record |
| `TotpEnabled` | TOTP 2FA is already enabled for this user |
| `QRError` | Failed to generate the TOTP QR code |
| `TotpDisabled` | TOTP 2FA is not currently set up for this user |
| `RateLimitedError` | The authentication attempt was rate limited |
| `U2fEnabled` | (Legacy) U2F 2FA is already enabled for this user |
| `U2fDisabled` | (Legacy) U2F 2FA is not initialized for this user |
| `InvalidU2fRequest` | Failed to validate the (legacy) U2F response |
| `NoUpdates` | Nothing was actually updated by the request |
| `TooMany` | An instance/count limit was hit (e.g. too many mailboxes) |

## 4. Webhooks

Webhooks let external systems subscribe to near-real-time events happening inside WildDuck, rather than polling the API. Manage subscriptions via the `Webhooks` endpoints (`GET/POST /webhooks`, `DELETE /webhooks/{webhook}` — see §8 for full parameter detail); each webhook subscribes to an **array of event-type patterns** (exact type strings, a `"prefix.*"` wildcard, e.g. `"user.*"`, or `"*"` for everything) and a target URL to receive an HTTP POST for each matching event.

At least one running WildDuck instance in the deployment must have `[webhooks].enabled = true` (in `default.toml`) or matching events will simply queue up in Redis without ever being delivered. Delivery itself happens through the two-stage BullMQ pipeline described in Part 1 §10 (`webhooks` matching queue → `webhooks_post` delivery queue, 5 attempts with exponential backoff starting at 2 seconds).

**Complete catalog of event types** that can actually be published (verified directly against `lib/events.js`):

| Event type | Fires when |
|---|---|
| `dkim.created` / `dkim.updated` / `dkim.deleted` | A domain's DKIM key is created, changed, or removed |
| `cert.created` / `cert.updated` / `cert.deleted` | A TLS certificate is created, changed, or removed |
| `domainalias.created` / `domainalias.deleted` | A domain alias is added or removed |
| `address.user.created` / `address.user.deleted` | An email address is added to or removed from a user |
| `address.forwarded.created` / `address.forwarded.deleted` | A forwarding address is added or removed |
| `address.domain.renamed` | A domain used in addresses is renamed |
| `filter.created` / `filter.deleted` | A filtering rule is created or deleted |
| `asp.created` / `asp.deleted` | An Application Specific Password is created or revoked |
| `mcptoken.created` / `mcptoken.deleted` | An MCP token is created or revoked |
| `user.created` | A new user account is created |
| `user.password.changed` | A user's password is changed |
| `user.delete.started` / `user.delete.completed` / `user.delete.cancelled` | The lifecycle stages of an account deletion |
| `autoreply.user.enabled` / `autoreply.user.disabled` | A user's autoresponder is turned on or off |
| `mfa.totp.enabled` / `mfa.totp.disabled` | TOTP 2FA is enabled or disabled |
| `mfa.custom.enabled` / `mfa.custom.disabled` | A custom 2FA method is enabled or disabled |
| `mfa.webauthn.registered` / `mfa.webauthn.removed` | A WebAuthn/FIDO2 credential is registered or removed |
| `mfa.disabled` | All 2FA is disabled for a user |
| `mailbox.created` / `mailbox.renamed` / `mailbox.deleted` | A mailbox (folder) is created, renamed, or deleted |
| `marked.spam` / `marked.ham` | A message is flagged as Junk or un-flagged back to legitimate |
| `forward added` | *(legacy event name — note the literal space rather than a dot, kept as-is for backward compatibility)* A forward rule was added |

Every published event carries a `time` (epoch ms, added automatically) plus event-specific fields; any MongoDB `ObjectId` fields are serialized to their hex-string form before being queued.

## 5. Real-time events (Server-Sent Events)

`GET /users/{user}/updates` opens a long-lived **`text/event-stream`** (SSE) response — this is the mechanism the reference webmail (and any other real-time client) uses to learn about new/changed/deleted messages and mailboxes without polling. Each event is a JSON-encoded string. Clients that reconnect can pass a `Last-Event-ID` query parameter to resume from where they left off rather than re-processing the whole stream. This endpoint is listed under the `Users` tag in §8.

## 6. Message submission

`POST /users/{user}/submit` is how a user account sends outbound mail through the API (as opposed to an IMAP client `APPEND`-ing to a queue-backed folder). Accepted body fields include `mailbox`, `from`, `replyTo`, `to`/`cc`/`bcc`, custom `headers`, `subject`, `text`/`html` bodies, `attachments`, `meta`, `sess`/`ip` (for logging), `reference` (for replies/threading), `isDraft`/`draft`, a scheduled `sendTime`, an `uploadOnly` flag (store without actually queuing for delivery — e.g. to save a draft), and an explicit SMTP `envelope` override. The message is queued into the `zone-queue` collection for ZoneMTA to deliver, exactly like an IMAP-submitted message (see Part 1 §5.4). Full parameter/field detail is under the `Submission` tag in §8.

## 7. MCP tokens

MCP (Model Context Protocol) tokens are a distinct credential type from Application Specific Passwords, purpose-built for AI-agent/LLM tool access, carrying the deliberately narrow `mcp:read` scope described in Part 1 §6.8/§7.3. **These endpoints exist in the running codebase and permission model (`roles.json`'s `mcptokens` resource, and the `mcptoken.created`/`mcptoken.deleted` webhook events) but are not yet present in the project's generated OpenAPI spec**, so they're documented here directly rather than in the generated table in §8:

### `POST /users/{user}/mcp-tokens` — Create new MCP access token
Creates a new scoped, revocable token for a user's mailbox that an MCP-compatible AI client can use to read (never write) that user's own `users`/`addresses`/`mailboxes`/`messages` data, per the `mcp:read` field whitelist in Part 1 §6.8. Requires the `mcptokens: create:own` (or `create:any` for an admin) permission. Triggers the `mcptoken.created` webhook event on success.

### `GET /users/{user}/mcp-tokens` — List MCP access tokens
Lists the MCP tokens currently issued for a user's account (for review/auditing which AI clients currently have standing read access), without exposing the raw token value itself again. Requires `mcptokens: read:own`/`read:any`.

### `DELETE /users/{user}/mcp-tokens/{token}` — Delete an MCP access token
Revokes a specific MCP token immediately. Requires `mcptokens: delete:own`/`delete:any`. Triggers the `mcptoken.deleted` webhook event on success.

## 8. Full endpoint reference

The remainder of this document is generated directly from WildDuck's own OpenAPI 3.0 specification (`docs/api/openapidocs.json`, WildDuck v1.50.0), covering all 120 endpoints it documents, grouped by resource tag. Every request/response field name, type, and requirement flag below is taken verbatim from that specification.

### 8.1 Endpoint-by-endpoint reference

## Users

### `GET /users` — List registered Users

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `query` | query | string | No | Partial match of username or default email address |
| `forward` | query | string | No | Partial match of a forward email address or URL |
| `tags` | query | string | No | Comma separated list of tags. The User must have at least one to be set |
| `requiredTags` | query | string | No | Comma separated list of tags. The User must have all listed tags to be set |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `internalData` | query | boolean | No | If true, then includes internalData in the response. Not shown for user-role tokens. |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetUsersResponse`

### `POST /users` — Create new user

**Request body:**

*Content-Type: `application/json`*

- `username` (string) **(required)**: Username of the User. Dots are allowed but informational only ("user.name" is the same as "username").
- `password` (string [false, ""]) **(required)**: Password for the account. Set to boolean false to disable password usage for the master scope, Application Specific Passwords would still be allowed
- `hashedPassword` (boolean): If true then password is already hashed, so store as is. Supported hashes: pbkdf2, bcrypt ($2a, $2y, $2b), md5 ($1), sha512 ($6), sha256 ($5), argon2 ($argon2d, $argon2i, $argon2id). Stored hashes are rehashed to pbkdf2 on first successful password check. Default: `false`.
- `allowUnsafe` (boolean): If false then validates provided passwords against Have I Been Pwned API. Experimental, so validation is disabled by default but will be enabled automatically in some future version of WildDuck. Default: `true`.
- `address` (string): Default email address for the User (autogenerated if not set)
- `emptyAddress` (boolean): If true then do not autogenerate missing email address for the User. Only needed if you want to create a user account that does not have any email address associated Default: `false`.
- `language` (string): Language code for the User
- `retention` (number): Default retention time (in ms). Set to 0 to disable Default: `0`.
- `name` (string): Name of the User
- `targets` (array of string): An array of forwarding targets. The value could either be an email address or a relay url to next MX server ("smtp://mx2.zone.eu:25") or an URL where mail contents are POSTed to
- `mtaRelay` (string): An address of an SMTP MTA relay. The value should be a relay url. If specified uses the this relay as the outbound MTA.
- `spamLevel` (number): Relative scale for detecting spam. 0 means that everything is spam, 100 means that nothing is spam Default: `50`.
- `quota` (number): Allowed quota of the user in bytes Default: `0`.
- `recipients` (number): How many messages per 24 hour can be sent Default: `0`.
- `forwards` (number): How many messages per 24 hour can be forwarded Default: `0`.
- `filters` (number): How many filters are allowed for this account Default: `0`.
- `requirePasswordChange` (boolean): If true then requires the user to change password, useful if password for the account was autogenerated Default: `false`.
- `require2faEnabled` (boolean): If true then the account is flagged as requiring 2FA to be enabled Default: `false`.
- `imapMaxUpload` (number): How many bytes can be uploaded via IMAP during 24 hour Default: `0`.
- `imapMaxDownload` (number): How many bytes can be downloaded via IMAP during 24 hour Default: `0`.
- `pop3MaxDownload` (number): How many bytes can be downloaded via POP3 during 24 hour Default: `0`.
- `pop3MaxMessages` (number): How many latest messages to list in POP3 session Default: `0`.
- `imapMaxConnections` (number): How many parallel IMAP connections are allowed Default: `0`.
- `receivedMax` (number): How many messages can be received from MX during 60 seconds Default: `0`.
- `fromWhitelist` (array of string): A list of additional email addresses this user can send mail from. Wildcard is allowed.
- `tags` (array of string): A list of tags associated with this user
- `addTagsToAddress` (boolean): If true then autogenerated address gets the same tags as the user Default: `false`.
- `uploadSentMessages` (boolean): If true then all messages sent through MSA are also uploaded to the Sent Mail folder. Might cause duplicates with some email clients, so disabled by default. Default: `false`.
- `mailboxes` (`Mailboxes`): 
- `disabledScopes` (array of string ["imap", "pop3", "smtp"]): List of scopes that are disabled for this user ("imap", "pop3", "smtp")
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `internalData` (object): Optional metadata for internal use, must be an object or JSON formatted string of an object. Not available for user-role tokens
- `pubKey` (string): Public PGP key for the User that is used for encryption. Use empty string to remove the key
- `smimeCerts` (array of string): S/MIME recipient certificates (PEM). Messages are encrypted for all listed certificates. Mutually exclusive with PGP (pubKey).
- `smimeCipher` (string ["AES-CBC", "AES-GCM"]): S/MIME content encryption cipher. Default: `"AES-CBC"`.
- `smimeKeyTransport` (string ["PKCS#1 v1.5", "OAEP"]): S/MIME RSA key transport algorithm. Default: `"PKCS#1 v1.5"`.
- `encryptMessages` (boolean): If true then received messages are encrypted Default: `false`.
- `encryptForwarded` (boolean): If true then forwarded messages are encrypted Default: `false`.
- `featureFlags` (object): Feature flags to specify
  - `indexing` (boolean):  Default: `false`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateUserResponse`

### `GET /users/resolve/{username}` — Resolve ID for a username

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `username` | path | string | Yes | Username of the User. Alphanumeric value. Must start with a letter, dots are allowed but informational only ("user.name" is the same as "username") |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `ResolveIdForUsernameResponse`

### `GET /users/{user}` — Request User information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetUserResponse`

### `PUT /users/{user}` — Update User information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `existingPassword` (string): Validates against account password before applying any changes.
- `password` (string [false, ""]): New password for the account. Set to boolean false to disable password usage for the master scope, Application Specific Passwords would still be allowed
- `hashedPassword` (boolean): If true then password is already hashed, so store as is. Supported hashes: pbkdf2, bcrypt ($2a, $2y, $2b), md5 ($1), sha512 ($6), sha256 ($5), argon2 ($argon2d, $argon2i, $argon2id). Stored hashes are rehashed to pbkdf2 on first successful password check. Default: `false`.
- `allowUnsafe` (boolean): If false then validates provided passwords against Have I Been Pwned API. Experimental, so validation is disabled by default but will be enabled automatically in some future version of WildDuck. Default: `true`.
- `language` (string): Language code for the User
- `name` (string): Name of the User
- `targets` (array of string): An array of forwarding targets. The value could either be an email address or a relay url to next MX server ("smtp://mx2.zone.eu:25") or an URL where mail contents are POSTed to
- `mtaRelay` (string): An address of an SMTP MTA relay. The value should be a relay url. If specified uses the this relay as the outbound MTA.
- `spamLevel` (number): Relative scale for detecting spam. 0 means that everything is spam, 100 means that nothing is spam
- `uploadSentMessages` (boolean): If true then all messages sent through MSA are also uploaded to the Sent Mail folder. Might cause duplicates with some email clients, so disabled by default. Default: `false`.
- `fromWhitelist` (array of string): A list of additional email addresses this user can send mail from. Wildcard is allowed.
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `internalData` (object): Optional internal metadata, must be an object or JSON formatted string of an object. Not available for user-role tokens
- `pubKey` (string): Public PGP key for the User that is used for encryption. Use empty string to remove the key
- `smimeCerts` (array of string): S/MIME recipient certificates (PEM). Messages are encrypted for all listed certificates. Mutually exclusive with PGP (pubKey). Use empty array to remove.
- `smimeCipher` (string ["AES-CBC", "AES-GCM"]): S/MIME content encryption cipher
- `smimeKeyTransport` (string ["PKCS#1 v1.5", "OAEP"]): S/MIME RSA key transport algorithm
- `encryptMessages` (boolean): If true then received messages are encrypted
- `encryptForwarded` (boolean): If true then forwarded messages are encrypted
- `retention` (number): Default retention time (in ms). Set to 0 to disable
- `quota` (number): Allowed quota of the user in bytes
- `recipients` (number): How many messages per 24 hour can be sent
- `forwards` (number): How many messages per 24 hour can be forwarded
- `filters` (number): How many filters are allowed for this account
- `imapMaxUpload` (number): How many bytes can be uploaded via IMAP during 24 hour
- `imapMaxDownload` (number): How many bytes can be downloaded via IMAP during 24 hour
- `pop3MaxDownload` (number): How many bytes can be downloaded via POP3 during 24 hour
- `pop3MaxMessages` (number): How many latest messages to list in POP3 session
- `imapMaxConnections` (number): How many parallel IMAP connections are allowed
- `receivedMax` (number): How many messages can be received from MX during 60 seconds
- `disable2fa` (boolean): If true, then disables 2FA for this user
- `require2faEnabled` (boolean): If true then the account is flagged as requiring 2FA to be enabled
- `tags` (array of string): A list of tags associated with this user
- `disabledScopes` (array of string ["imap", "pop3", "smtp"]): List of scopes that are disabled for this user ("imap", "pop3", "smtp")
- `disabled` (boolean): If true then disables user account (can not login, can not receive messages)
- `featureFlags` (object): Enabled feature flags
  - `indexing` (boolean):  Default: `false`.
- `suspended` (boolean): If true then disables authentication
- `protocol` (string): Application identifier for security logs Default: `"API"`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `DELETE /users/{user}` — Delete a User

This method deletes user and address entries from DB and schedules a background task to delete messages. You can call this method several times even if the user has already been deleted, in case there are still some pending messages.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `deleteAfter` | query | string [false] | No | Delete user entry from registry but keep all user data until provided date. User account is fully recoverable up to that date. |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `DeleteUserResponse`

### `PUT /users/{user}/logout` — Log out User

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `reason` (string): Message to be shown to connected IMAP client
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `POST /users/{user}/quota/reset` — Recalculate User quota

This method recalculates quota usage for a User. Normally not needed, only use it if quota numbers are way off. This method is not transactional, so if the user is currently receiving new messages then the resulting value is not exact.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `RecalculateQuotaResponse`

### `POST /quota/reset` — Recalculate Quota for all Users

This method recalculates quota usage for all Users. Normally not needed, only use it if quota numbers are way off. This method is not transactional, so if the user is currently receiving new messages then the resulting value is not exact.

**Request body:**

*Content-Type: `application/json`*

- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): object

### `POST /users/{user}/password/reset` — Reset password for a User

This method generates a new temporary password for a User. Additionally it removes all two-factor authentication settings

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `validAfter` (string [false]): Allow using the generated password not earlier than provided time
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `ResetUserPasswordResponse`

### `GET /users/{user}/restore` — Return recovery info for a deleted user

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `RecoverInfoResponse`

### `POST /users/{user}/restore` — Cancel user deletion task

Use this endpoint to cancel a timed deletion task scheduled by DELETE /user/{id}. If user data is not yet deleted then the account is fully recovered, except any email addresses that might have been already recycled

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CancelUserDeletionResponse`

### `GET /users/{user}/updates` — Open change stream

This api call returns an EventSource response. Listen on this stream to get notifications about changes in messages and mailboxes. Returned events are JSON encoded strings

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `Last-Event-ID` | query | string | No | Last event ID header as query param |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): string


## Addresses

### `GET /addresses` — List registered Addresses

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `query` | query | string | No | Partial match of an address |
| `forward` | query | string | No | Partial match of a forward email address or URL |
| `tags` | query | string | No | Comma separated list of tags. The Address must have at least one to be set |
| `requiredTags` | query | string | No | Comma separated list of tags. The Address must have all listed tags to be set |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `internalData` | query | boolean | No | If true, then includes internalData in the response. Not shown for user-role tokens. |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetAddressesResponse`

### `POST /users/{user}/addresses` — Create new Address

Add a new email address for a User. Addresses can contain unicode characters. Dots in usernames are normalized so no need to create both "firstlast@example.com" and "first.last@example.com" Special addresses `*@example.com` and `username@*` catch all emails to these domains or users without a registered destination (requires allowWildcard argument)

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `address` (string or string) **(required)**: String. Either an e-mail address or a wildcard address
- `name` (string): Identity name
- `main` (boolean): Indicates if this is the default address for the User
- `allowWildcard` (boolean): If true then address value can be in the form of `*@example.com`, `*suffix@example.com` and `username@*`, otherwise using * is not allowed. Static suffix can be up to 32 characters long.
- `tags` (array of string): A list of tags associated with this address
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `internalData` (object): Optional metadata for internal use, must be an object or JSON formatted string of an object. Not available for user-role tokens
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateUserAddressResponse`

### `GET /users/{user}/addresses` — List registered Addresses for a User

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `internalData` | query | boolean | No | If true, then includes internalData in the response. Not shown for user-role tokens. |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetUserAddressesResponse`

### `GET /users/{user}/addresses/{address}` — Request Addresses information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `address` | path | string | Yes | ID of the Address |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetUserAddressResponse`

### `DELETE /users/{user}/addresses/{address}` — Delete an Address

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `address` | path | string | Yes | ID of the Address |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `PUT /users/{user}/addresses/{id}` — Update Address information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `id` | path | string | Yes | ID of the Address |

**Request body:**

*Content-Type: `application/json`*

- `name` (string): Identity name
- `address` (string): New address if you want to rename existing address. Only affects normal addresses, special addresses that include * can not be changed
- `main` (boolean): Indicates if this is the default address for the User
- `tags` (array of string): A list of tags associated with this address
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `internalData` (object): Optional metadata for internal use, must be an object or JSON formatted string of an object. Not available for user-role tokens
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `GET /users/{user}/addressregister` — List addresses from communication register

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `query` | query | string | Yes | Prefix of an address or a name |
| `limit` | query | number | No | How many records to return |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetUserAddressregisterResponse`

### `PUT /users/{user}/addressregister/{id}` — Update an address in the addressregister

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `id` | path | string | Yes | ID of the Address |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Request body:**

*Content-Type: `application/json`*

- `disabled` (boolean) **(required)**: Disable the address in the register. Disabled addresses are not updated on email receival and sending. Disabled addresses are not included in the response for listing addresses in the register.
- `name` (string): Address header name

**Responses:**

- **200** (Success): `SuccessResponse`

### `POST /addresses/forwarded` — Create new forwarded Address

Add a new forwarded email address. Addresses can contain unicode characters. Dots in usernames are normalized so no need to create both "firstlast@example.com" and "first.last@example.com" Special addresses `*@example.com` and `username@*` catches all emails to these domains or users without a registered destination (requires allowWildcard argument)

**Request body:**

*Content-Type: `application/json`*

- `address` (string or string) **(required)**: E-mail address or wildcard address
- `name` (string): Identity name
- `targets` (array of string): An array of forwarding targets. The value could either be an email address or a relay url to next MX server ("smtp://mx2.zone.eu:25") or an URL where mail contents are POSTed to
- `forwards` (number): Daily allowed forwarding count for this address Default: `0`.
- `allowWildcard` (boolean): If true then address value can be in the form of `*@example.com` or `username@*`, otherwise using * is not allowed
- `autoreply` (`Autoreply`): 
- `tags` (array of string): A list of tags associated with this address
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `internalData` (object): Optional metadata for internal use, must be an object or JSON formatted string of an object. Not available for user-role tokens
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateForwardedAddressResponse`

### `PUT /addresses/forwarded/{id}` — Update forwarded Address information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `id` | path | string | Yes | ID of the Address |

**Request body:**

*Content-Type: `application/json`*

- `address` (string): New address. Only affects normal addresses, special addresses that include * can not be changed
- `name` (string): Identity name
- `targets` (array of string): An array of forwarding targets. The value could either be an email address or a relay url to next MX server ("smtp://mx2.zone.eu:25") or an URL where mail contents are POSTed to. If set then overwrites previous targets array
- `forwards` (number): Daily allowed forwarding count for this address
- `autoreply` (`Autoreply`): 
- `tags` (array of string): A list of tags associated with this address
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `internalData` (object): Optional metadata for internal use, must be an object or JSON formatted string of an object. Not available for user-role tokens
- `forwardedDisabled` (boolean): If true then disables forwarded address (stops forwarding messages)
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `DELETE /addresses/forwarded/{address}` — Delete a forwarded Address

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `address` | path | string | Yes | ID of the Address |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `GET /addresses/forwarded/{address}` — Request forwarded Addresses information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `address` | path | string | Yes | ID of the Address |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetForwardedAddressResponse`

### `GET /addresses/resolve/{address}` — Get Address info

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `address` | path | string or string or string | Yes | ID of the Address or e-mail address string (including wildcard addresses) |
| `allowWildcard` | query | boolean | No | If true then resolves also wildcard addresses |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `ResolveAddressResponse`

### `PUT /addresses/renameDomain` — Rename domain in addresses

Renames domain names for addresses, DKIM keys and Domain Aliases

**Request body:**

*Content-Type: `application/json`*

- `oldDomain` (string) **(required)**: Old Domain Name
- `newDomain` (string) **(required)**: New Domain Name
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `ResolveDomainAddressesResponse`


## Mailboxes

### `GET /users/{user}/mailboxes` — List Mailboxes for a User

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `specialUse` | query | boolean | No | Should the response include only folders with specialUse flag set. |
| `showHidden` | query | boolean | No | Hidden folders are not included in the listing by default. |
| `counters` | query | boolean | No | Should the response include counters (total + unseen). Counters come with some overhead. |
| `sizes` | query | boolean | No | Should the response include mailbox size in bytes. Size numbers come with a lot of overhead as an aggregated query is ran. |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetMailboxesResponse`

### `POST /users/{user}/mailboxes` — Create new Mailbox

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `path` (string) **(required)**: Full path of the mailbox, folders are separated by slashes, ends with the mailbox name (unicode string)
- `hidden` (boolean): Is the folder hidden or not. Hidden folders can not be opened in IMAP. Default: `false`.
- `retention` (number): Retention policy for the created Mailbox. Milliseconds after a message added to mailbox expires. Set to 0 to disable.
- `sess` (string): Session identifier for the logs
- `encryptMessages` (boolean): If true then messages in this mailbox are encrypted Default: `false`.
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateMailboxResponse`

### `GET /users/{user}/mailboxes/{mailbox}` — Request Mailbox information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string ["resolve"] | Yes | ID of the Mailbox |
| `path` | query | string | No | If mailbox is specified as `resolve` in the path then use this param as mailbox path instead of the given mailbox id. |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetMailboxResponse`

### `PUT /users/{user}/mailboxes/{mailbox}` — Update Mailbox information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |

**Request body:**

*Content-Type: `application/json`*

- `path` (string): Full path of the mailbox, use this to rename an existing Mailbox
- `retention` (number): Retention policy for the Mailbox (in ms). Changing retention value updates existing messages in the background using the time each message was added to this mailbox.
- `subscribed` (boolean): Change Mailbox subscription state
- `encryptMessages` (boolean): If true then messages in this mailbox are encrypted
- `hidden` (boolean): Is the folder hidden or not. Hidden folders can not be opened in IMAP.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `DELETE /users/{user}/mailboxes/{mailbox}` — Delete a Mailbox

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## Messages

### `GET /users/{user}/mailboxes/{mailbox}/messages` — List messages in a Mailbox

Lists all messages in a mailbox

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `unseen` | query | boolean | No | If true, then returns only unseen messages. If false, then returs only seen messages. Leave blank to return all messages |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `threadCounters` | query | boolean | No | If true, then includes threadMessageCount in the response. Counters come with some overhead |
| `includeHasDrafts` | query | boolean | No | If true, then calculates and includes hasDrafts in the response. This comes with some overhead |
| `collapseThreads` | query | boolean | No | If true, then returns only the newest or oldest message from each thread, depending on the order argument |
| `limit` | query | number | No | How many records to return |
| `order` | query | object | No | Ordering of the records by insert date |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |
| `includeHeaders` | query | boolean | No | If true, then includes all message headers in the response. If false, then includes only From, Sender, To, Cc, Bcc, Content-Type and References headers |

**Responses:**

- **200** (Success): `GetMessagesResponse`

### `PUT /users/{user}/mailboxes/{mailbox}/messages` — Update Message information

This method updates message flags and also allows to move messages to a different mailbox

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |

**Request body:**

*Content-Type: `application/json`*

- `message` (string) **(required)**: Message ID. Either singular or comma separated number (1,2,3) or colon separated range (3:15), or a range from UID to end (3:*)
- `moveTo` (string): ID of the target Mailbox if you want to move messages
- `updateThread` (boolean): If true, applies the requested updates to all messages in the selected message threads in this Mailbox. Can not be combined with metaData, expires or draft as these describe a single message Default: `false`.
- `seen` (boolean): State of the \Seen flag
- `deleted` (boolean): State of the \Deleted flag
- `flagged` (boolean): State of the \Flagged flag
- `markHam` (boolean): If true then emits the marked.ham webhook for matched messages. Setting flagged=true also emits marked.ham Default: `false`.
- `draft` (boolean): State of the \Draft flag
- `expires` (string or boolean [false]): Either expiration date or false to turn off autoexpiration
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateMessageResponse`

### `DELETE /users/{user}/mailboxes/{mailbox}/messages` — Delete all Messages from a Mailbox

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `async` | query | boolean | No | Schedule deletion task |
| `skipArchive` | query | boolean | No | Skip archived messages |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `DeleteMessagesInMailboxResponse`

### `POST /users/{user}/mailboxes/{mailbox}/messages` — Upload Message

This method allows to upload either an RFC822 formatted message or a message structure to a mailbox. Raw message is stored unmodified, no headers are added or removed. If you want to generate the uploaded message from structured data fields, then do not use the raw property.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |

**Request body:**

*Content-Type: `application/json`*

- `date` (string): Date
- `unseen` (boolean): Is the message unseen or not Default: `false`.
- `flagged` (boolean): Is the message flagged or not Default: `false`.
- `draft` (boolean): Is the message a draft or not Default: `false`.
- `raw` (string): base64 encoded message source. Alternatively, you can provide this value as POST body by using message/rfc822 MIME type. If raw message is provided then it overrides any other mail configuration
- `from` (`AddressOptionalName`): 
- `replyTo` (`AddressOptionalName`): 
- `to` (array of `AddressOptionalName`): Addresses for the To: header
- `cc` (array of `AddressOptionalName`): Addresses for the Cc: header
- `bcc` (array of `AddressOptionalName`): Addresses for the Bcc: header
- `headers` (array of `Header`): Custom headers for the message. If reference message is set then In-Reply-To and References headers are set automatically
- `subject` (string): Message subject. If not then resolved from Reference message
- `text` (string): Plaintext message
- `html` (string): HTML formatted message
- `files` (array of string): Attachments as storage file IDs. NB! When retrieving message info then an array of objects is returned. When uploading a message then an array of IDs is used.
- `attachments` (array of `Attachment`): Attachments for the message
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `reference` (`ReferenceWithAttachments`): 
- `replacePrevious` (object): If set, then deletes a previous message when storing the new one. Useful when uploading a new Draft message.
  - `mailbox` (string): 
  - `id` (number) **(required)**: 
- `bimi` (`Bimi`): 
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UploadMessageResponse`

### `GET /users/{user}/search` — Search for messages

This method allows searching for matching messages.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `q` | query | string | No | Additional query string |
| `mailbox` | query | string | No | ID of the Mailbox |
| `id` | query | string | No | Message ID values, only applies when used in combination with `mailbox`. Either comma separated numbers (1,2,3) or colon separated range (3:15), or a range from UID to end (3:*) |
| `thread` | query | string | No | Thread ID |
| `or` | query | object | No | At least onOne of the included terms must match |
| `query` | query | string | No | Search string, uses MongoDB fulltext index. Covers data from message body and also common headers like from, to, subject etc. |
| `datestart` | query | string | No | Datestring for the earliest message storing time |
| `dateend` | query | string | No | Datestring for the latest message storing time |
| `from` | query | string | No | Partial match for the From: header line |
| `to` | query | string | No | Partial match for the To: and Cc: header lines |
| `subject` | query | string | No | Partial match for the Subject: header line |
| `minSize` | query | number | No | Minimal message size in bytes |
| `maxSize` | query | number | No | Maximal message size in bytes |
| `attachments` | query | boolean | No | If true, then matches only messages with attachments |
| `flagged` | query | boolean | No | If true, then matches only messages with \Flagged flags |
| `unseen` | query | boolean | No | If true, then matches only messages without \Seen flags. Takes precedence over the seen flag |
| `seen` | query | boolean | No | If true, then matches only messages with \Seen flags |
| `useAndSearch` | query | boolean | No | If true, then fulltext search terms are combined with AND semantics |
| `includeHeaders` | query | boolean | No | If true, then includes all message headers in the response. If false, then includes only From, Sender, To, Cc, Bcc, Content-Type and References headers |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `searchable` | query | boolean | No | If true, then matches messages not in Junk or Trash |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |
| `threadCounters` | query | boolean | No | If true, then includes threadMessageCount in the response. Counters come with some overhead |
| `includeHasDrafts` | query | boolean | No | If true, then calculates and includes hasDrafts in the response. This comes with some overhead |
| `collapseThreads` | query | boolean | No | If true, then returns only the newest or oldest matching message from each thread, depending on the order argument |
| `limit` | query | number | No | How many records to return |
| `order` | query | object | No | Ordering of the records by insert date. If no order is supplied, results are sorted by heir mongoDB ObjectId. |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |

**Responses:**

- **200** (Success): `SearchMessagesResponse`

### `POST /users/{user}/search` — Search and update messages

This method allows applying an action to all matching messages. This is an async method so that it will return immediately. Actual modifications are run in the background.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes |  |

**Request body:**

*Content-Type: `application/json`*

- `q` (string): Additional query string
- `mailbox` (string): ID of the Mailbox
- `id` (string): Message ID values, only applies when used in combination with `mailbox`. Either comma separated numbers (1,2,3) or colon separated range (3:15), or a range from UID to end (3:*)
- `thread` (string): Thread ID
- `or` (object): At least onOne of the included terms must match
  - `query` (string): Search string, uses MongoDB fulltext index. Covers data from message body and also common headers like from, to, subject etc.
  - `from` (string): Partial match for the From: header line
  - `to` (string): Partial match for the To: and Cc: header lines
  - `subject` (string): Partial match for the Subject: header line
- `query` (string): Search string, uses MongoDB fulltext index. Covers data from message body and also common headers like from, to, subject etc.
- `datestart` (string): Datestring for the earliest message storing time
- `dateend` (string): Datestring for the latest message storing time
- `from` (string): Partial match for the From: header line
- `to` (string): Partial match for the To: and Cc: header lines
- `subject` (string): Partial match for the Subject: header line
- `minSize` (number): Minimal message size in bytes
- `maxSize` (number): Maximal message size in bytes
- `attachments` (boolean): If true, then matches only messages with attachments
- `flagged` (boolean): If true, then matches only messages with \Flagged flags
- `unseen` (boolean): If true, then matches only messages without \Seen flags. Takes precedence over the seen flag
- `seen` (boolean): If true, then matches only messages with \Seen flags
- `useAndSearch` (boolean): If true, then fulltext search terms are combined with AND semantics Default: `false`.
- `includeHeaders` (boolean): If true, then includes all message headers in the response. If false, then includes only From, Sender, To, Cc, Bcc, Content-Type and References headers Default: `false`.
- `metaData` (boolean): If true, then includes metaData in the response Default: `false`.
- `searchable` (boolean): If true, then matches messages not in Junk or Trash
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs
- `action` (object) **(required)**: Define actions to take with matching messages
  - `moveTo` (string): ID of the target Mailbox if you want to move messages
  - `seen` (boolean): State of the \Seen flag
  - `flagged` (boolean): State of the \Flagged flag
  - `delete` (boolean): If true then delete all found messages Default: `false`.

**Responses:**

- **200** (Success): `SearchApplyMessagesResponse`

### `GET /users/{user}/mailboxes/{mailbox}/messages/{message}` — Request Message information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | number | Yes | Message ID |
| `replaceCidLinks` | query | boolean | No | If true then replaces cid links |
| `markAsSeen` | query | boolean | No | If true then marks message as seen |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetMessageResponse`

### `PUT /users/{user}/mailboxes/{mailbox}/messages/{message}` — Update message information with path param

This method updates message flags and also allows to move messages to a different mailbox

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | string | Yes | Message ID. Either singular or comma separated number (1,2,3) or colon separated range (3:15), or a range from UID to end (3:*) |

**Request body:**

*Content-Type: `application/json`*

- `moveTo` (string): ID of the target Mailbox if you want to move messages
- `updateThread` (boolean): If true, applies the requested updates to all messages in the selected message threads in this Mailbox. Can not be combined with metaData, expires or draft as these describe a single message Default: `false`.
- `seen` (boolean): State of the \Seen flag
- `deleted` (boolean): State of the \Deleted flag
- `flagged` (boolean): State of the \Flagged flag
- `markHam` (boolean): If true then emits the marked.ham webhook for matched messages. Setting flagged=true also emits marked.ham Default: `false`.
- `draft` (boolean): State of the \Draft flag
- `expires` (string or boolean [false]): Either expiration date or false to turn off autoexpiration
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateMessageResponse`

### `DELETE /users/{user}/mailboxes/{mailbox}/messages/{message}` — Delete a Message

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | number | Yes | Message ID |
| `updateThread` | query | boolean | No | If true, deletes all messages in the selected message thread in this Mailbox |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `DeleteMessageResponse`

### `GET /users/{user}/mailboxes/{mailbox}/messages/{message}/message.eml` — Get Message source

This method returns the full RFC822 formatted source of the stored message

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | number | Yes | Message ID |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): string

### `GET /users/{user}/mailboxes/{mailbox}/messages/{message}/attachments/{attachment}` — Download Attachment

This method returns attachment file contents in binary form

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | number | Yes | Message ID |
| `attachment` | path | string | Yes | ID of the Attachment |
| `sendAsString` | query | boolean | No | If true then sends the original attachment back in string format with correct encoding. |

**Responses:**

- **200** (Success): string

### `POST /users/{user}/mailboxes/{mailbox}/messages/{message}/forward` — Forward stored Message

This method allows either to re-forward a message to an original forward target or forward it to some other address. This is useful if a user had forwarding turned on but the message was not delivered so you can try again. Forwarding does not modify the original message.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | number | Yes | Message ID |

**Request body:**

*Content-Type: `application/json`*

- `target` (number): Number of original forwarding target
- `addresses` (array of string): An array of additional forward targets
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `ForwardStoredMessageResponse`

### `POST /users/{user}/mailboxes/{mailbox}/messages/{message}/submit` — Submit Draft for delivery

This method allows to submit a draft message for delivery. Draft is moved to Sent mail folder.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `mailbox` | path | string | Yes | ID of the Mailbox |
| `message` | path | number | Yes | Message ID |

**Request body:**

*Content-Type: `application/json`*

- `deleteFiles` (boolean): If true then deletes attachment files listed in metaData.files array
- `sendTime` (string): Datestring for delivery if message should be sent some later time
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SubmitStoredMessageResponse`

### `PUT /users/{user}/outbound/{queueId}` — Update an Outbound Message

Updates the delivery time of an outbound email that is still queued. Delivery times in the past are replaced with the current time. Queue entries that are already being delivered can not be updated.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `queueId` | path | string | Yes | Outbound queue ID of the message |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Request body:**

*Content-Type: `application/json`*

- `sendTime` (string) **(required)**: New delivery time for the queued message

**Responses:**

- **200** (Success): `UpdateOutboundMessageResponse`

### `DELETE /users/{user}/outbound/{queueId}` — Delete an Outbound Message

You can delete outbound emails that are still in queue. Queue ID can be found from the `outbound` property of a stored email.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `queueId` | path | string | Yes | Outbound queue ID of the message |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## Filters

### `GET /filters` — List all Filters

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `forward` | query | string | No | Partial match of a forward email address or URL |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetAllFiltersResponse`

### `GET /users/{user}/filters` — List Filters for a User

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetFiltersResponse`

### `POST /users/{user}/filters` — Create a new Filter

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `name` (string): Name of the Filter
- `query` (`Query`) **(required)**: 
- `action` (`Action`) **(required)**: 
- `disabled` (boolean): If true then this filter is ignored Default: `false`.
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateFilterResponse`

### `GET /users/{user}/filters/{filter}` — Request Filter information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `filter` | path | string | Yes | Filters unique ID |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetFilterResponse`

### `DELETE /users/{user}/filters/{filter}` — Delete a Filter

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `filter` | path | string | Yes | Filters unique ID |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `PUT /users/{user}/filters/{filter}` — Update Filter information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `filter` | path | string | Yes | Filters unique ID |

**Request body:**

*Content-Type: `application/json`*

- `name` (string): Name of the Filter
- `query` (`Query`): 
- `action` (`Action`): 
- `disabled` (boolean): If true then this filter is ignored
- `metaData` (object): Optional metadata, must be an object or JSON formatted string
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateFilterResponse`


## Autoreplies

### `PUT /users/{user}/autoreply` — Update Autoreply information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `status` (boolean): Is the autoreply enabled (true) or not (false)
- `name` (string [""]): Name that is used for the From: header in autoreply message
- `subject` (string [""]): Subject line for the autoreply. If empty then uses subject of the original message
- `text` (string [""]): Plaintext formatted content of the autoreply message
- `html` (string [""]): HTML formatted content of the autoreply message
- `start` (string [false]): Datestring of the start of the autoreply or boolean false to disable start checks
- `end` (string [false]): Datestring of the end of the autoreply or boolean false to disable end checks
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateAutoreplyResponse`

### `GET /users/{user}/autoreply` — Request Autoreply information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetAutoreplyResponse`

### `DELETE /users/{user}/autoreply` — Delete Autoreply information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## Archive

Archive includes all deleted messages. Once messages are old enough then these are permanenetly deleted from the archive as well. Until then you can restore the deleted messages.

### `GET /users/{user}/archived/messages` — List archived messages

Lists archived (recently deleted) messages for the user. Drafts deleted directly are not archived.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `metaData` | query | boolean | No | If true, then includes metaData in the response |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `order` | query | object | No | Ordering of the records by insert date |
| `threadCounters` | query | boolean | No | If true, then includes threadMessageCount in the response. Counters come with some overhead |
| `includeHeaders` | query | boolean | No | If true, then includes all message headers in the response. If false, then includes only From, Sender, To, Cc, Bcc, Content-Type and References headers |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetArchivedMessagesResponse`

### `POST /users/{user}/archived/restore` — Restore archived messages by date range

Initiates a restore task to move archived messages within the specified date range back to the mailboxes the messages were deleted from. If a target mailbox does not exist, then the messages are moved to INBOX.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `start` (string) **(required)**: Datestring
- `end` (string) **(required)**: Datestring
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `RestoreMessagesResponse`

### `POST /users/{user}/archived/messages/{message}/restore` — Restore a single archived message

Restores one archived message to its original mailbox, or to the specified target mailbox if provided.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `message` | path | number | Yes | Archived message ID |

**Request body:**

*Content-Type: `application/json`*

- `mailbox` (string): ID of the target Mailbox. If not set then original mailbox is used.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `RestoreMessageResponse`


## ApplicationPasswords

### `GET /users/{user}/asps` — List Application Passwords

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `showAll` | query | boolean | No | If not true then skips entries with a TTL set |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetASPsResponse`

### `POST /users/{user}/asps` — Create new Application Password

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `description` (string) **(required)**: Description for the Application Password entry
- `scopes` (array of string ["imap", "pop3", "smtp", "*"]): List of scopes this Password applies to. Special scope "*" indicates that this password can be used for any scope except "master"
- `address` (string): E-mail address to be used as the account address in mobileconfig file. Must be one of the listed identity addresses of the user. Defaults to the main address of the user
- `password` (string): Optional pregenerated password. Must be 16 characters, latin letters only.
- `generateMobileconfig` (boolean): If true then result contains a mobileconfig formatted file with account config Default: `false`.
- `ttl` (number): TTL in seconds for this password. Every time password is used, TTL is reset to this value
- `protocol` (string): Application identifier for security logs Default: `"API"`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateASPResponse`

### `GET /users/{user}/asps/{asp}` — Request ASP information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `asp` | path | string | Yes | ID of the Application Password |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetASPResponse`

### `DELETE /users/{user}/asps/{asp}` — Delete an Application Password

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `asp` | path | string | Yes | ID of the Application Password |
| `protocol` | query | string | No | Application identifier for security logs |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## TwoFactorAuth

### `POST /users/{user}/2fa/totp/setup` — Generate TOTP seed

This method generates TOTP seed and QR code for 2FA. User needs to verify the seed value using 2fa/totp/enable endpoint

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `label` (string): Label text for QR code (defaults to username)
- `issuer` (string) **(required)**: Description text for QR code (defaults to "WildDuck")
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `GenerateTOTPSeedResponse`

### `POST /users/{user}/2fa/totp/enable` — Enable TOTP seed

This method enables TOTP for a user by verifying the seed value generated from 2fa/totp/setup

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `token` (string) **(required)**: 6-digit number that matches seed value from 2fa/totp/setup
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `DELETE /users/{user}/2fa/totp` — Disable TOTP auth

This method disables TOTP for a user. Does not affect other 2FA mechanisms a user might have set up

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `POST /users/{user}/2fa/totp/check` — Validate TOTP Token

This method checks if a TOTP token provided by a User is valid for authentication

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `token` (string) **(required)**: 6-digit number
- `totpNonce` (string) **(required)**: Short-lived nonce returned by /authenticate
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `ValidateTOTPTokenResponse`

### `DELETE /users/{user}/2fa` — Disable 2FA

This method disables all 2FA mechanisms a user might have set up

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `PUT /users/{user}/2fa/custom` — Enable custom 2FA for a user

This method disables account password for IMAP/POP3/SMTP

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `SuccessResponse`

### `DELETE /users/{user}/2fa/custom` — Disable custom 2FA for a user

This method disables custom 2FA. If it was the only 2FA set up, then account password for IMAP/POP3/SMTP gets enabled again

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `GET /users/{user}/2fa/webauthn/credentials` — Get WebAuthN credentials for a user

This method returns the list of WebAuthN credentials for a given user

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetWebAuthNResponse`

### `DELETE /users/{user}/2fa/webauthn/credentials/{credential}` — Remove WebAuthN authenticator

This method deletes the given WebAuthN authenticator for given user.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `credential` | path | string | Yes | Credential ID |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `DeleteWebAuthNResponse`

### `POST /users/{user}/2fa/webauthn/registration-challenge` — Get the WebAuthN registration challenge

This method initiates the WebAuthN authenticator registration challenge

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `description` (string) **(required)**: Descriptive name for the authenticator
- `origin` (string) **(required)**: Origin
- `authenticatorAttachment` (string ["platform", "cross-platform"]): Indicates whether authenticators should be part of the OS ("platform"), or can be roaming authenticators ("cross-platform") Default: `"cross-platform"`.
- `rpId` (string): Relaying party ID. Is domain.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `InitiateWebAuthNRegistrationResponse`

### `POST /users/{user}/2fa/webauthn/registration-attestation` — Attestate WebAuthN authenticator

Attestation is used to verify the authenticity of the authenticator and provide assurances about its features.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `challenge` (string) **(required)**: Challenge as hex string
- `rawId` (string) **(required)**: Credential ID/RawID as hex string
- `clientDataJSON` (string) **(required)**: Clientside data JSON as hex string
- `attestationObject` (string) **(required)**: Attestation object represented as a hex string
- `rpId` (string): Relaying party ID. Is domain.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `AttestateWebAuthNRegistrationResponse`

### `POST /users/{user}/2fa/webauthn/authentication-challenge` — Begin WebAuthN authentication challenge

This method retrieves the WebAuthN PublicKeyCredentialRequestOptions object to use it for authentication

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `origin` (string) **(required)**: Origin domain
- `authenticatorAttachment` (string ["platform", "cross-platform"]): Indicates whether authenticators should be part of the OS ("platform"), or can be roaming authenticators ("cross-platform") Default: `"cross-platform"`.
- `rpId` (string): Relaying party ID. Domain
- `twoFactorNonce` (string): Short-lived nonce returned by /authenticate
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `AuthenticateWebAuthNResponse`

### `POST /users/{user}/2fa/webauthn/authentication-assertion` — WebAuthN authentication Assertion

Assert WebAuthN authentication request and actually authenticate the user

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `challenge` (string) **(required)**: Challenge of the credential as hex string
- `rawId` (string) **(required)**: RawId of the credential
- `clientDataJSON` (string) **(required)**: Client data JSON as hex string
- `authenticatorData` (string) **(required)**: Authentication data as hex string
- `signature` (string) **(required)**: Private key encrypted signature to verify with public key on the server. Hex string
- `rpId` (string): Relaying party ID. Domain
- `twoFactorNonce` (string): Short-lived nonce returned by /authenticate
- `token` (boolean): If true response will contain the user auth token Default: `false`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `AssertWebAuthNResponse`


## Authentication

### `POST /preauth` — Pre-auth check

Check if an username exists and can be used for authentication

**Request body:**

*Content-Type: `application/json`*

- `username` (string or string) **(required)**: Username or E-mail address
- `scope` (string): Required scope. One of master, imap, smtp, pop3 Default: `"master"`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `PreAuthCheckResponse`

### `POST /authenticate` — Authenticate a User

**Request body:**

*Content-Type: `application/json`*

- `username` (string or string) **(required)**: Username or E-mail address
- `password` (string) **(required)**: Password
- `protocol` (string): Application identifier for security logs Default: `"API"`.
- `scope` (string): Required scope. One of master, imap, smtp, pop3 Default: `"master"`.
- `appId` (string): Optional appId which is the URL of the app
- `token` (boolean): If true then generates a temporary access token that is valid for this user. Only available if scope is "master". When using user tokens then you can replace user ID in URLs with "me". Default: `false`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `AuthenticateResponse`

### `DELETE /authenticate` — Invalidate authentication token

This method invalidates currently used authentication token. If token is not provided then nothing happens

**Responses:**

- **200** (Success): `SuccessResponse`

### `GET /users/{user}/authlog` — List authentication Events

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `action` | query | string | No | Limit listing only to values with specific action value |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `filterip` | query | string | No | Limit listing only to values with specific IP address |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetAuthlogResponse`

### `GET /users/{user}/authlog/{event}` — Request Event information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `event` | path | string | Yes | ID of the Event |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetAuthlogEventResponse`

### `GET /authenticated` — Validates the user authentication status

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetIsUserAuthenticatedResponse`


## Audit

Auditing allows to monitor an email account. All existing, deleted and new emails are copied to the auditing system. See also https://github.com/nodemailer/wildduck-audit-manager

### `POST /audit` — Create new audit

Initiates a message audit

**Request body:**

*Content-Type: `application/json`*

- `user` (string) **(required)**: Example: `507f1f77bcf86cd799439011` ID of the User
- `start` (string [false]): Start time as ISO date
- `end` (string [false]): End time as ISO date
- `expires` (string) **(required)**: Expiration date. Audit data is deleted after this date
- `notes` (string): Optional audit notes
- `meta` (object): Optional metadata, must be an object or JSON formatted string
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateAuditResponse`

### `GET /audit/{audit}` — Request Audit Info

This method returns information about stored audit

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `audit` | path | string | Yes | ID of the Audit |

**Responses:**

- **200** (Success): `GetAuditResponse`

### `GET /audit/{audit}/export.mbox` — Export Audited Emails

This method returns a mailbox file that contains all audited emails

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `audit` | path | string | Yes | ID of the Audit |

**Responses:**

- **200** (Success): string


## DomainAliases

### `GET /domainaliases` — List registered Domain Aliases

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `query` | query | string | No | Partial match of a Domain Alias or Domain name |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetDomainAliasesResponse`

### `POST /domainaliases` — Create new Domain Alias

Add a new Alias for a Domain. This allows to accept mail on username@domain and username@alias

**Request body:**

*Content-Type: `application/json`*

- `alias` (string) **(required)**: Domain Alias
- `domain` (string) **(required)**: Domain name this Alias applies to
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): object

### `GET /domainaliases/resolve/{alias}` — Resolve ID for a domain alias

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `alias` | path | string | Yes | Alias domain |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): object

### `GET /domainaliases/{alias}` — Request Alias information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `alias` | path | string | Yes | ID of the Alias |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetDomainAliasResponse`

### `DELETE /domainaliases/{alias}` — Delete an Alias

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `alias` | path | string | Yes | ID of the Alias |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## DomainAccess

Add sender domain names to allowlist (messages are all accepted) or blocklist (messages are sent to Spam folder)

### `POST /domainaccess/{tag}/allow` — Add domain to allowlist

If an email is sent from a domain that is listed in the allowlist then it is never marked as spam. Lists apply for tagged users.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `tag` | path | string | Yes | Tag to look for |

**Request body:**

*Content-Type: `application/json`*

- `domain` (string) **(required)**: Domain name to allowlist for users/addresses that include this tag
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateAllowedDomainResponse`

### `GET /domainaccess/{tag}/allow` — List allowlisted domains

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `tag` | path | string | Yes | Tag to look for |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetAllowedDomainsResponse`

### `POST /domainaccess/{tag}/block` — Add domain to blocklist

If an email is sent from a domain that is listed in the blocklist then it is always marked as spam. Lists apply for tagged users.

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `tag` | path | string | Yes | Tag to look for |

**Request body:**

*Content-Type: `application/json`*

- `domain` (string) **(required)**: Domain name to blocklist for users/addresses that include this tag
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateBlockedDomainResponse`

### `GET /domainaccess/{tag}/block` — List blocklisted domains

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `tag` | path | string | Yes | Tag to look for |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetBlockedDomainsResponse`

### `DELETE /domainaccess/{domain}` — Delete a Domain from listing

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `domain` | path | string | Yes | Listed domain's unique ID |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `DeleteDomainListingResponse`


## DKIM

Whenever an email is sent WildDuck checks if there is a DKIM key registered for the domain name of the sender address and uses it to sign the message.

### `GET /dkim` — List registered DKIM keys

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `query` | query | string | No | Partial match of a Domain name |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetDkimKeysResponse`

### `POST /dkim` — Create or update DKIM key for domain

Add a new DKIM key for a Domain or update existing one. There can be single DKIM key registered for each domain name.

**Request body:**

*Content-Type: `application/json`*

- `domain` (string) **(required)**: Domain name this DKIM key applies to. Use "*" as a special value that will be used for domains that do not have their own DKIM key set
- `selector` (string) **(required)**: Selector for the key
- `privateKey` (string or string): Pem formatted DKIM private key, raw ED25519 is also allowed. If not set then a new 2048 bit RSA key is generated, beware though that it can take several seconds to complete.
- `description` (string): Key description
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateDkimKeyResponse`

### `GET /dkim/resolve/{domain}` — Resolve ID for a DKIM domain

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `domain` | path | string | Yes | DKIM domain |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `ResolveIdResponse`

### `GET /dkim/{dkim}` — Request DKIM information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `dkim` | path | string | Yes | ID of the DKIM |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetDkimKeyResponse`

### `DELETE /dkim/{dkim}` — Delete a DKIM key

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `dkim` | path | string | Yes | ID of the DKIM |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## Certs

WildDuck allows to register TLS certificates to be used with SNI connections. These certificates are used by IMAP, POP3, API and SMTP servers when a SNI capable client establishes a TLS connection. This does not apply for MX servers.

### `GET /certs` — List registered TLS certificates

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `query` | query | string | No | Partial match of a server name |
| `altNames` | query | boolean | No | Match `query` value against SAN as well (including wildcard names) |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetTLSCertsResponse`

### `POST /certs` — Create or update TLS certificate for server name

Add a new TLS certificate for a server name or update existing one. You can add a single certificate for each server name but SAN names are supported as well. For example you can add a certificate for "mydomain.com" that includes "*.mydomain.com" in SAN and the same certificate would be used for requests that do not have it's own server name registered but match the SAN value.
> NB! you must ensure yourself that the `servername` value is actually listed in certificate's common name or SAN as WildDuck is going to use this certificate regardless.

**Request body:**

*Content-Type: `application/json`*

- `servername` (string) **(required)**: Server name this TLS certificate applies to
- `privateKey` (string): PEM formatted TLS private key. Optional if certificate is managed by ACME
- `cert` (string): PEM formatted TLS certificate or a certificate bundle with concatenated certificate and CA chain. Optional if certificate is managed by ACME
- `ca` (array of string): CA chain certificates. Not needed if `cert` value is a bundle
- `description` (string): Certificate description
- `acme` (boolean): If true then private key and certificate are managed automatically by ACME Default: `false`.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UpdateTLSCertResponse`

### `GET /certs/resolve/{servername}` — Resolve ID for a server name

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `servername` | path | string | Yes | Server name |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `ResolveIdResponse`

### `GET /certs/{cert}` — Request TLS certificate information

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `cert` | path | string | Yes | ID of the TLS certificate |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetTLSCertResponse`

### `DELETE /certs/{cert}` — Delete a TLS certificate

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `cert` | path | string | Yes | ID of the TLS certificate |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## Webhooks

### `GET /webhooks` — List registered Webhooks

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `type` | query | string | No | Prefix or exact match. Prefix match must end with ".*", eg "channel.*". Use "*" for all types |
| `user` | query | string | No | User ID |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetWebhooksResponse`

### `POST /webhooks` — Create new Webhook

**Request body:**

*Content-Type: `application/json`*

- `type` (array of string) **(required)**: An array of event types to match. For prefix match use ".*" at the end (eg. "user.*") or "*" for all types
- `user` (string): User ID to match (only makes sense for user specific resources)
- `url` (string) **(required)**: URL to POST data to
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateWebhookResponse`

### `DELETE /webhooks/{webhook}` — Delete a webhook

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `webhook` | path | string | Yes | ID of the Webhook |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`


## Settings

### `GET /settings` — List registered Settings

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `filter` | query | string | No | Optional partial match of the Setting key |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetSettingsResponse`

### `POST /settings/{key}` — Create or Update Setting

Create a new or update an existing setting

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `key` | path | string ["const:archive:time", "const:max:storage", "const:max:recipients", "const:max:mailboxes", "const:max:rcpt_to", "const:max:forwards", "const:authlog:time", "const:autoreply:interval", "const:asp:limit", "const:max:imap:download", "const:max:pop3:download", "const:max:imap:upload", "const:imap:use_wd_worker_channels", "const:max:filters", "const:sender:defer_times", "const:max:bulk_batch_size", "const:domaincache:enabled"] | Yes | Key of the Setting |

**Request body:**

*Content-Type: `application/json`*

- `value` (object) **(required)**: Setting value
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `CreateSettingResponse`

### `GET /settings/{key}` — Get Setting value

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `key` | path | string | Yes | Key of the Setting |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetSettingResponse`


## Storage

Storage allows easier attachment handling when composing Draft messages. Instead of uploading the attachmnent with every draft update, you store the attachment to the Storage and then link stored file for the Draft.

### `POST /users/{user}/storage` — Upload file

This method allows to upload an attachment to be linked from a draft

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `filename` (string): Name of the file
- `contentType` (string): MIME type of the file. Is detected from the file name by default
- `encoding` (string ["base64"]): Encoding of the file content. Useful if you want to upload the file in base64 encoded format. Valid option "base64"
- `content` (string) **(required)**: File content in binary
- `cid` (string): content ID
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): `UploadFileResponse`

### `GET /users/{user}/storage` — List stored files

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `query` | query | string | No | partial match of a filename |
| `limit` | query | number | No | How many records to return |
| `next` | query | string | No | Cursor value for next page, retrieved from nextCursor response value |
| `previous` | query | string | No | Cursor value for previous page, retrieved from previousCursor response value |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `GetFilesResponse`

### `DELETE /users/{user}/storage/{file}` — Delete a File

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `file` | path | string | Yes | ID of the File |
| `sess` | query | string | No | Session identifier for the logs |
| `ip` | query | string | No | IP address for the logs |

**Responses:**

- **200** (Success): `SuccessResponse`

### `GET /users/{user}/storage/{file}` — Download File

This method returns stored file contents in binary form

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |
| `file` | path | string | Yes | ID of the File |

**Responses:**

- **200** (Success): string


## Submission

### `POST /users/{user}/submit` — Submit a Message for Delivery

Use this method to send emails from a user account

**Parameters:**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `user` | path | string | Yes | Example: `507f1f77bcf86cd799439011` ID of the User |

**Request body:**

*Content-Type: `application/json`*

- `mailbox` (string): ID of the Mailbox
- `from` (`AddressOptionalName`): 
- `replyTo` (`AddressOptionalName`): 
- `to` (array of `AddressOptionalName`): Addresses for the To: header
- `cc` (array of `AddressOptionalName`): Addresses for the Cc: header
- `bcc` (array of `AddressOptionalName`): Addresses for the Bcc: header
- `headers` (array of `Header`): Custom headers for the message. If reference message is set then In-Reply-To and References headers are set automatically
- `subject` (string): Message subject. If not then resolved from Reference message
- `text` (string): Plaintext message
- `html` (string): HTML formatted message
- `attachments` (array of object): Attachments for the message
- `meta` (object): Optional metadata, must be an object or JSON formatted string
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs
- `reference` (`Reference`): 
- `isDraft` (boolean): If true then stores the message as a draft without queueing delivery Default: `false`.
- `draft` (object): Draft message to base this one on
  - `mailbox` (string) **(required)**: ID of the Mailbox
  - `id` (number) **(required)**: Message ID
- `sendTime` (string): Send time
- `uploadOnly` (boolean): If true only uploads the message but does not send it Default: `false`.
- `envelope` (object): Optional envelope
  - `from` (`AddressOptionalName`): 
  - `to` (array of object): 

**Responses:**

- **200** (Success): `SubmitMessageResponse`


## Export

### `POST /data/export` — Export data

Export data for matching users. Export dump does not include emails, only account structure (user data, password hashes, mailboxes, filters, etc.). A special "export"-role access token is required for exporting and importing.

**Request body:**

*Content-Type: `application/json`*

- `users` (array of string): An array of User ID values to export
- `tags` (array of string): An array of user tags to export. If set then at least one tag must exist on an user.
- `sess` (string): Session identifier for the logs
- `ip` (string): IP address for the logs

**Responses:**

- **200** (Success): string

### `POST /data/import` — Import user data

Import data from an export dump. If a database entry already exists, it is not modified. A special "export"-role access token is required for exporting and importing.

**Responses:**

- **200** (Success): `CreateImportResponse`


## Health

### `GET /health` — Check the health of the API

Check the status of the WildDuck API service, that is if db is connected and readable/writable, same for redis.

**Responses:**

- **200** (Success): `HealthSuccessResponse`
- **500** (Failed): `HealthErrorResponse`


## Other

### `GET /api-methods` — 
