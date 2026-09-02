# Webmail UI/UX — Full Capability List + Implementation Prompt

Built for your stack: WildDuck (Node.js) + Zone-MTA + Haraka + Postal, custom webmail frontend.

---

## 1. Core Mail UI/UX Features

### Inbox / Message List
- Threaded conversation view (Gmail-style) vs flat list toggle
- Unread bold + unread count badges (per folder, tab title, favicon)
- Read/unread, star/flag, important markers
- Multi-select with bulk actions (archive, delete, mark read, move, label)
- Swipe actions on mobile (archive/delete/snooze)
- Snooze email (hide until a chosen time, resurface in inbox)
- Pin/star priority messages
- Sender avatar / initials / favicon
- Preview pane (right-side split view) + full-page view toggle
- Dense/comfortable/compact list density options
- Infinite scroll or pagination toggle
- Keyboard shortcuts (Gmail-style: j/k navigate, e archive, # delete, c compose)
- Undo send (delay-send window, e.g. 5–30s)
- Search with operators (from:, to:, subject:, has:attachment, before:/after:, is:unread)
- Search suggestions/autocomplete from contacts + past searches
- Saved searches / smart folders
- Tabs/categories (Primary, Social, Promotions, Updates — auto-classified)
- Drag-and-drop to folders/labels
- Right-click context menu

### Compose
- Rich text editor (bold/italic/underline, lists, quote, code block, alignment, font/size, text color)
- Plain text mode toggle
- Attachments: drag-drop, paste-from-clipboard, multiple files, progress bar, inline image embedding
- Large attachment handling (cloud link fallback if file too big)
- CC/BCC toggle
- Signature (multiple signatures, per-account default, HTML signature with logo/socials)
- Templates / canned responses
- Scheduled send (pick date/time)
- Read receipts / delivery confirmation request
- Mail merge / bulk personalized send (optional, advanced)
- Auto-save drafts (every few seconds)
- Reply/Reply All/Forward with quoted history collapsed by default
- Inline reply (reply within thread without opening new window)
- Spell-check + grammar suggestions
- Send confidentially / expiring email (optional privacy feature)
- Priority flag / sensitivity marking
- @mentions in shared inboxes (if team inbox feature added)

### Folders / Organization
- System folders: Inbox, Sent, Drafts, Trash, Spam/Junk, Archive
- Custom folders (nested/subfolders)
- Labels/tags (multiple labels per email, color-coded)
- Rules/filters (auto move, label, forward, delete based on sender/subject/keyword)
- Auto-archive rules
- Folder-level unread counts
- Drag folders to reorder / collapse tree

### Attachments & Media
- Inline image preview
- PDF/doc preview without download
- Attachment gallery view (all attachments across mailbox, filterable)
- Save-to-cloud (Drive/Dropbox style connector) — future-proof hook
- Virus/malware scan status indicator

### Contacts / Address Book
- Auto-collected contacts from sent/received mail
- Manual contact CRUD, groups/lists
- Import/export (CSV, vCard)
- Contact quick-view (hover card with recent threads)
- Frequent/favorite contacts in compose autocomplete

### Calendar / Scheduling (optional but expected in modern webmail)
- CalDAV-backed calendar tab
- Meeting invite parsing (.ics) with Accept/Decline/Tentative buttons
- "Find a time" / free-busy view

### Multi-Account & Aliases
- Multiple mailbox accounts in one UI (account switcher)
- Send-as aliases / custom "from" addresses
- Unified inbox view (all accounts merged) vs per-account view

### Search & Filters (Power User)
- Full-text search across body + attachments (needs indexing, e.g. via Elasticsearch/Meilisearch)
- Filter chips (unread, attachments, flagged, date range)
- Search across all folders vs current folder

### Security / Privacy UI
- PGP/GPG encryption support (compose + decrypt inline)
- S/MIME support (optional)
- "External sender" warning banner
- Phishing/spoofing warning banners
- Login activity / active sessions panel
- Two-factor authentication (TOTP/WebAuthn) settings
- App passwords for IMAP/SMTP clients
- Blocked senders list

### Settings / Account Management
- Profile (name, avatar, signature)
- Vacation responder / auto-reply (with date range)
- Forwarding (with keep-copy option)
- Filters/rules management UI
- Storage quota meter (visual bar, per-folder breakdown)
- Theme (light/dark/system), density, font size
- Notification preferences (desktop push, sound, digest email)
- Language/locale
- Import mail (via IMAP migration tool) / export mailbox (mbox/eml zip)
- Session/device management, revoke access

### Notifications
- Browser push notifications (Web Push API)
- Desktop notification with quick actions (archive/reply from notification)
- Unread badge on PWA icon
- Digest/summary email option

### Mobile / PWA
- Installable PWA, offline draft support (service worker + IndexedDB queue)
- Responsive swipe gestures
- Bottom nav for mobile

### Accessibility
- Full keyboard navigation
- Screen-reader labels (ARIA) on all interactive elements
- High-contrast theme option

### Admin
- Admin panel: create/suspend/delete mailboxes, set quotas per plan
- Usage/storage analytics per user
- Abuse/spam reports queue
- DKIM/SPF/DMARC status dashboard per domain
- Domain management (add domain, verify DNS records with copy-paste UI)
- Billing tie-in (map to your existing Stripe/plan system)

### AI-Powered Features 
- Smart compose (inline autocomplete suggestions as you type)
- Smart reply (3 short suggested replies under a thread)
- AI summarize thread ("catch me up" button on long threads)
- Auto-categorize/priority inbox (ML or rule-based "important" scoring)
- AI-drafted replies from a prompt ("write a polite decline")
- Spam/phishing detection assist beyond SpamAssassin (LLM-based content check)
- Natural-language search ("emails from Kasun about invoice last month")
- Auto-generate meeting replies from calendar context
- Translate incoming email inline

---

## 2. Backend/API Building Blocks (WildDuck-centric)

| Capability | How it maps to your stack |
|---|---|
| Mailbox storage/IMAP/POP3 | WildDuck (already planned) |
| Outbound sending | Zone-MTA / your existing Postal |
| Inbound receiving/filtering | Haraka → WildDuck |
| REST API for webmail frontend | WildDuck's built-in REST API (auth, messages, mailboxes, filters, contacts via its API layer) — wrap with your own Express gateway for auth/session/rate-limiting |
| Full-text search | Meilisearch or Elasticsearch indexing message bodies async via a worker |
| Push notifications | Web Push (VAPID) triggered from a WildDuck webhook on new mail |
| Rules/filters | WildDuck filters API (sieve-like) exposed via your UI |
| PGP | OpenPGP.js client-side (keys never leave browser) |
| AI features | Your own Express AI-gateway service calling an LLM API (Claude/OpenAI) with mail content, kept server-side, never exposing your model API key to the browser |
| Realtime UI updates | WebSocket/SSE layer on top of WildDuck's IMAP IDLE or its webhook/pub-sub |
| Admin/billing | Your existing STX/PXN admin patterns (Firestore or your DB) tied to WildDuck's user API for provisioning |

---