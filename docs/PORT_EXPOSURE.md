# Port exposure: modes, safe edit/close, overview

> **Verification status.** The logic below is covered by unit tests, and the node agent's container configuration was
> checked against a fake Docker over 192 recorded input combinations. Nothing was run against a real node, real Docker,
> Traefik or Cloudflare. Before relying on it, follow the [first-run checklist](#first-run-checklist).

## What was wrong (all found by reading the code, several confirmed by running it)

| # | Problem | Effect |
|---|---|---|
| 1 | The agent only recognised `no_ssl` for host ports. The API and dashboard send `raw_tcp` for "Direct mode". | "Direct mode" never bound a host port. It fell through to Traefik HTTP routing. |
| 2 | `internal_only` was not implemented in the agent. | "Internal only" containers still got a public Traefik router. |
| 3 | Redeploy, webhook rebuild and failover did not pass `publishedPort` (and several not `exposureMode`). | The agent fell back to `publishedPort \|\| internalPort`, silently moving a direct-port deployment to a different host port. |
| 4 | The dashboard panel saved the chosen host port into `internalPort` and toasted "Bound container to host port N". | The app's expected listening port was changed; nothing was bound. |
| 5 | `PATCH /deployments/:id/config` overwrote `exposureMode` with `ssl_with_proxy` on every save by a non-dev user. | A customer editing e.g. the start command silently reset a bot or direct-port deployment. |
| 6 | `PATCH /deployments/:id/routing` accepted a mode and port, ignored both, and answered success. | Misleading; it only cleared `subdomain` for "direct". |
| 7 | Node port exposures (`/nodes/:id/ports/expose`) created a Cloudflare A record and stored the port. **Nothing routes the hostname to the port.** | The feature does not do what its name says. |
| 8 | Any subdomain was accepted, and closing deleted every DNS record with that name. | Exposing a name a customer's site uses, then closing it, took the site down. Reserved names (`api`, `www`) were also accepted. |
| 9 | DNS failures were swallowed (the exposure was still saved), re-saving leaked a record each time, failover added a second A record without removing the dead node's. | Phantom exposures, orphaned records, DNS round-robin to a dead node. |
| 10 | The "Firewall Rules" card was local React state only. | Rules looked saved and enforced; they were neither. |

## Exposure modes

Three user-facing modes map onto the stored `Deployment.exposureMode` and what the node agent does
(`services/node-agent/src/exposure.js`):

| Mode | Stored value | Behaviour |
|---|---|---|
| `proxied` | `ssl_with_proxy` | Public HTTPS URL through Traefik. |
| `direct_port` | `no_ssl` | A raw host port on the node (TCP+UDP), bypassing Traefik. **Open to the internet.** |
| `internal` | `internal_only` | No Traefik router and no host port. |

Legacy values are read as their nearest mode: `ssl_direct` -> proxied, `raw_tcp` -> direct_port. The agent now implements
both `raw_tcp` and `internal_only`, and validates ports (a bad value fails early with a clear message).

## API

| Endpoint | Who | |
|---|---|---|
| `GET /api/ports/overview` | dev | Every node: deployments with mode/host port/URL, node exposures, and detected problems. |
| `GET /api/deployments/:id/exposure` | anyone with read access | Current exposure, problems, whether confirmation is needed. |
| `PUT /api/deployments/:id/exposure` | dev | `{ mode, publishedPort?, confirm? }`. Validated, audited. |
| `POST /api/nodes/:id/ports/expose`, `DELETE .../ports/exposures/:id` | admin/dev | Now validated and DNS-safe (below). |

`PUT` rules: `direct_port` needs a port from 1024 to 65535 that is not reserved (22, 80, 443, 2375-2377, 4789, 7946, the node
agent port, plus anything in `EXPOSURE_RESERVED_PORTS`), not held by another deployment on the node (a **stopped**
deployment still counts, because it would fail to start), and not claimed by a node port exposure. A port with any other
mode is refused rather than silently dropped. If the deployment is **running**, `confirm` must equal its subdomain (or id);
this is enforced server-side.

**A change is stored, not applied.** The running container keeps its old routing until it is redeployed; the response
says `requiresRedeploy: true` and the panel shows it. Redeploys (and webhook rebuilds and failover) now keep the stored
mode and port.

`PATCH /config` no longer changes exposure for real deployments: non-dev callers keep the existing mode; a dev sending a
different mode gets a 400 pointing at `PUT .../exposure` (drafts, `pending_configuration`, can still set it in the wizard).
`PATCH .../routing` now returns 410.

## Node port exposures

These create a DNS record pointing `<subdomain>.<root>` at the node. **They do not route to the port.** The overview marks
them "DNS only". Making them route needs a Traefik file-provider route (or similar) written on the node, which was not
attempted because it could not be verified here (see Known gaps).

What is now safe: reserved and in-use hostnames and reserved ports are refused; a DNS failure saves nothing; a failed save
removes the record it created; re-saving reuses the record and renaming replaces it; closing deletes the exposure's **own**
record by id (legacy rows without one only delete records pointing at that node, and never for a name a deployment owns), and
a failed DNS delete keeps the row so it can be retried; failover creates the new record, repoints the row, then deletes the
dead node's record, and changes nothing if DNS cannot be updated. Every change is audited. `tcp` exposures are created
unproxied, since Cloudflare's proxy cannot carry raw TCP.

## Behaviour changes to expect

* **Existing `internal_only` deployments become private only after a redeploy.** Before, they had a public Traefik router.
  Catalog templates that recommend `internal_only` are affected. If something relied on that accidental exposure it will stop
  working.
* **Existing `raw_tcp` deployments start binding their host port after a redeploy**, using `publishedPort` (or the internal
  port if none was set). The overview flags these rows.
* Dashboard panel: "No SSL (HTTP only)" is now "Internal only", because that is what it always actually stored. Plain-HTTP
  proxying without TLS is not implemented anywhere.
* The firewall card is labelled a preview. It never enforced anything.

## Known gaps

* **Discord/bot deployments** are created with `no_ssl` and internal port 3000 and no `publishedPort`, so each falls back
  to host port 3000. Two on one node conflict, and each exposes port 3000 to the internet. The overview flags this
  (`implicit_port`, `port_conflict`); it was not changed because doing so alters existing behaviour.
* Docker-published ports usually bypass host firewalls such as `ufw`; a `direct_port` is reachable regardless of them.
* Two simultaneous `PUT`s could both pass the conflict check. Unlikely for a dev-only action; not guarded.
* `customDomain.js` describes Traefik's **file** provider, but the shipped node compose files enable only the **Docker**
  provider. Custom domains may not work as written; this was not investigated further.
* There is no real firewall. Building one means managing rules on each node.

## First-run checklist

1. Update the node agents (they contain `exposure.js`). Confirm `git` and Docker behave as before by deploying a normal
   proxied app.
2. Open **Exposed ports** (dev sidebar). Read every error/warning before changing anything.
3. On a test deployment, switch to **Direct port**, type its name to confirm, redeploy, and confirm the port answers on
   `NODE_IP:PORT` and the HTTPS address no longer does.
4. Switch to **Internal only**, redeploy, confirm neither works.
5. Redeploy once more and confirm the mode and port are unchanged.

## Code map

`services/node-agent/src/exposure.js` (+ `docker.js`), `apps/api/src/lib/portExposure.ts` (rules, overview),
`lib/exposureDefaults.ts` (rebuilds keep mode/port), `lib/nodePortExposure.ts` (DNS-safe node exposures),
`routes/ports.ts`, `routes/nodes.ts`, `lib/failoverEngine.ts`; dashboard: `RoutingFirewallPanel.tsx`,
`app/(protected)/dev/ports/page.tsx`. Tests: `nodeAgentExposure` (uses `tests/fixtures/dockerExposureGolden.json`, generated
from the original `docker.js`), `portExposure`, `exposureDefaults`, `nodePortExposure`, `cloudflareDnsDelete`.
