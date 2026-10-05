# Paymenter: Complete Feature List

Repository: https://github.com/Paymenter/Paymenter
Website: https://paymenter.org
Docs: https://paymenter.org/docs/installation/install
Live demo: https://demo.paymenter.org

> Compiled from the GitHub README, the official homepage, and the release notes for v1.0 to v1.5. Paymenter has no single complete feature page, so check the docs and GitHub changelog for smaller tweaks.

---

## What is Paymenter?

Paymenter is a free, open-source (MIT license) billing and webshop platform built for hosting companies. It is written in PHP on Laravel (Livewire v4 and Filament v5). It handles selling services, invoicing, recurring payments, support tickets, and automatic server provisioning after payment.

### Requirements

- PHP 8.3 or higher
- Composer
- Web server (Apache or Nginx)
- Database (MariaDB / MySQL)

---

## Billing and Payments

- Subscriptions with automated recurring billing
- Unique billing periods per product (not limited to monthly or yearly)
- Multi-currency with automatic currency conversion and rates
- Billing agreements: customers save a payment method and get auto-charged (Stripe and PayPal)
- In-app payment forms, so customers pay without leaving the site (Stripe and PayPal)
- Built-in gateways: Stripe, PayPal, Mollie
- More gateways via extensions (PayHere, Tebex, crypto, Tripay, Duitku, Cashfree, and others)
- Custom invoice numbering with placeholders (date, customer ID, etc.)
- Proforma invoices
- Invoices cannot be edited after they are issued
- Bill To and Due Date fields on invoices
- Coupons, including a max-uses-per-user limit
- Transactions overview in the admin panel

## Storefront and Checkout

- Products and categories
- Configurable options at checkout, including sliders
- Cart, with developer events for adding, removing, and updating items
- Responsive client area (desktop and mobile)
- Custom themes for full rebranding
- Multi-language support with translations
- RTL support (Arabic, Hebrew, etc.)

## Automation and Server Integrations

- Automatic service deployment after payment
- Bundled server extensions:
  - Pterodactyl
  - cPanel
  - Plesk
  - DirectAdmin
  - Enhance
  - Convoy
  - Virtualizor
  - VirtFusion
- Server cancellation emails
- More integrations in the marketplace

## Customer-Facing Features

- Client area: services, invoices, payment history, billing details
- Support ticketing:
  - File attachments
  - Message avatars
  - Email piping (customers reply by email, attachments included)
- Announcements (built-in blog system)
- Notifications center: in-app notifications with per-user preferences
- Email notification templates, including invoice paid and invoice payment failed
- Service labeling (customers can name their services)
- Affiliate system with tracking and rewards
- Options to disable the ticket system or registration

## Admin and Operations

- Redesigned Filament-based admin panel
- Audit logs: who changed what, and when
- User impersonation (see what a client sees)
- Error logs
- Send test email action to verify mail settings
- In-app updates from the admin panel (no SSH needed)
- Extension browser: install extensions from the admin panel
- Docker support
- WHMCS importer for clients, services, and invoices (Blesta and other importers planned)

## Security

- Multiple remember-me sessions
- Session-locking middleware
- Auth login hook
- v1.5 patched three CVEs, so keep your install updated

## Developer Features

- REST API with OpenAPI spec covering:
  - Users
  - Orders
  - Services
  - Invoices
  - Tickets
  - Affiliates
  - Products and categories (view endpoints)
- Extension system for gateways, servers, and other types, with admin pages, hooks, and events
- OAuth support
- Theme development

---

## Version History (Highlights)

| Version | Highlights                                                                                                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | New admin panel, better extension support, in-app payments, multi-currency, unique billing periods, revamped client area, in-app updates                                     |
| v1.1    | Docker support, invoice numbering, RTL support, error logs, cPanel extension                                                                                                 |
| v1.2    | API routes, user impersonation, checkout sliders, DirectAdmin extension, coupon max uses per user, option to disable tickets and registration, server cancellation email     |
| v1.3    | Audit logs, email ticket piping, ticket attachments, extension browser, transactions overview, Bill To and Due Date on invoices                                              |
| v1.4    | Billing agreements, invoice immutability, proforma invoices, notifications center, WHMCS importer, new homepage and footer, invoice paid and failed templates                |
| v1.5    | Session and login hardening, service labeling, ticket message avatars, products and categories API endpoints, mail test action, Livewire v4 and Filament v5, three CVE fixes |

---

## Useful Links

- Installation: https://paymenter.org/docs/installation/install
- Marketplace: https://paymenter.org/marketplace
- API docs: https://paymenter.org/api
- WHMCS import guide: https://paymenter.org/docs/guides/whmcs-importer
- Releases: https://paymenter.org/releases
- Discord community: https://discord.gg/paymenter-882318291014651924
