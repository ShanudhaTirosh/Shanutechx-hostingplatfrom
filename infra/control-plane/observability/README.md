# 📊 ShanuTechX Observability Stack

> Prometheus + Grafana + Loki + Promtail monitoring stack for ShanuTechX infrastructure.

---

## Stack Architecture

```
┌─────────────────┐       ┌─────────────────┐
│   Prometheus    │──────>│     Grafana     │ <── Browser Dashboard
│ (Metrics 9090)  │       │ (Dashboards 3000)│
└────────┬────────┘       └────────┬────────┘
         │ Scrape                  │ Query
         ▼                         ▼
 ┌───────────────┐        ┌─────────────────┐
 │  shanutechx-  │        │      Loki       │
 │      api      │        │  (Logs 3100)    │
 └───────────────┘        └────────┬────────┘
                                   │ Push
                          ┌────────┴────────┐
                          │    Promtail     │ <── /var/run/docker.sock
                          └─────────────────┘
```

---

## Starting the Observability Stack

The observability stack runs on the internal network (`shanutechx-internal`). To start it alongside the core control plane:

```bash
cd infra/control-plane
docker compose -f docker-compose.yml -f observability/docker-compose.observability.yml up -d
```

---

## Pre-provisioned Dashboards & Datasources

1. **Prometheus Datasource**: `http://prometheus:9090` (default metric store)
2. **Loki Datasource**: `http://loki:3100` (container logs store)
3. **Dashboard — "ShanuTechX Overview"**:
   - HTTP Requests / sec
   - p95 Request Latency
   - 5xx Error Rate %
   - Active Deployments count
   - Nodes Online count
   - Open Tickets & Pending Payment Reviews
   - Process RSS Memory & CPU Usage
   - Database Connection Pool Usage
   - Live Loki container log stream

---

## Environment Variables

Set in `infra/control-plane/.env`:

```env
GRAFANA_ADMIN_PASSWORD=your-secure-admin-password
```

---

## Exposing Grafana securely

To access Grafana via your domain (e.g. `grafana.yourdomain.com`), add the following Traefik labels to the `grafana` service in `docker-compose.observability.yml`:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.grafana.rule=Host(`grafana.${ROOT_DOMAIN}`)
  - traefik.http.routers.grafana.entrypoints=websecure
  - traefik.http.routers.grafana.tls.certresolver=le
  - traefik.http.services.grafana.loadbalancer.server.port=3000
```
