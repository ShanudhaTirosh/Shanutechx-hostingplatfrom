# PXN STORES UI/UX Design & Architectural Structure Specification

This document provides a comprehensive technical overview and design specification for **PXN STORES** (`https://www.pxnstores.lk/`). It covers the visual design system, color tokens, typography, component hierarchy, product selection workflows, and responsive layout patterns analyzed across the entire site.

---

## 🛠️ 1. Core Visual Design System & Aesthetics

PXN STORES utilizes a modern, dark-mode, high-contrast tech aesthetic optimized for digital storefronts, SaaS, hosting, and VPN providers.

### 🎨 Color Palette & Theme Tokens
* **Background Primary**: `rgb(9, 9, 12)` (`#09090C`) – Deep Slate / Midnight Black
* **Card & Container Background**: `rgb(17, 24, 39)` (`#111827`) / `rgba(15, 23, 42, 0.75)` – Dark Slate Glassmorphism
* **Text Primary**: `rgb(249, 250, 251)` (`#F9FAFB`) – Pure Off-White
* **Text Secondary**: `rgb(156, 163, 175)` (`#9CA3AF`) – Muted Slate Gray
* **Brand Primary / Accent Green**: `rgb(16, 185, 129)` (`#10B981`) – Emerald Green (used for active statuses, prices, badges, and primary action highlights)
* **Secondary Accent**: Cyan / Teal (`#06B6D4` / `#0E7490`) – Gradient overlays on buttons and hero text
* **Border Color**: `rgba(255, 255, 255, 0.1)` – Subtle outline borders with dynamic focus glow

### 🔤 Typography & Font Hierarchy
* **Heading / Display Font**: `Outfit, Inter, system-ui, sans-serif`
  * `H1`: `60px` / `bold` / White heading with gradient accent options
  * `H2`: `48px` / `bold` / Section titles (e.g., "OUR OWN VPN APPS", "Global Network Footprint")
  * `H3`: `13px` - `18px` / `semibold` / Product Card titles & subheadings
* **Body / System Font**: `Inter, system-ui, sans-serif` (`16px`, `14px` for metadata)

---

## 🧩 2. Global Navigation & Layout Architecture

### 🧭 Top Navigation Bar (Header)
* **Logo**: `PXN STORES` with icon mark and live status indicator ("All Systems Normal").
* **Main Menu Items**:
  1. **Home** (`/`)
  2. **V2Ray** (`/v2ray`)
  3. **Cloud VPS** (`/vps`)
  4. **Softwares** (`/softwares`)
  5. **Games** (`/games`)
  6. **Discord** (`/discord`)
  7. **Game Topup** (`/game-topup`)
  8. **Support** (`/support`)
  9. **Login / Auth** (`/auth`)
* **Quick Navigation Bar (Bottom Mobile / Action Bar)**:
  * Shortcuts: `Home`, `Cart`, `Orders`, `Account`
* **Progressive Web App (PWA) Install Banner**:
  * Banner prompting users to "Install PXN STORES" with "Install App" and "Not Now" choices.

### ⚓ Footer Architecture
* **Brand Bio**: Overview of PXN STORES LK as Sri Lanka's trusted shop for V2Ray, VPS, software subscriptions, and game top-ups.
* **Navigation Links Grid**:
  * **Services**: V2Ray, Cloud VPS, Softwares, Games, Discord, Game Topup, Gift Cards
  * **Company**: About Us, Reviews, Contact
  * **Support**: Help Center, FAQs, Discord Support, Status Page
  * **Legal**: Privacy Policy, Terms of Service, Cookie Policy, Refund Policy
* **Trust Badges & Payments**: Supported payment methods list, Discord live support integration, Copyright notice `© 2026 PXN Stores LK`.

---

## 📦 3. Detailed Page Breakdown & Product Selection Workflows

### ⚡ A. V2Ray VPN Services (`/v2ray`)
* **Hero Banner**: "Best V2Ray in Sri Lanka – SLT, Dialog, Hutch & Airtel"
* **Product Tiers & Network Packages**:
  * **SLT ZOOM (Fibre, 4G, ADSL)** - `SG SERVER`
  * **SLT NETFLIX (Fibre, 4G, ADSL)** - `SG SERVER` (Supports 1990 Netflix package)
  * **SLT ZOOM PREPAID 235** - `SG SERVER` (Unlimited Data)
  * **Sri Lankan IP Variants**:
    * `SLT ZOOM SRI LANKAN IP (LK IP)`
    * `SLT NETFLIX SRI LANKAN IP (LK IP)`
    * `SLT ZOOM PREPAID 235 SRI LANKAN IP`
* **Product Card UX Features**:
  * `ACTIVE` status pill badge
  * Server location tags (`SG SERVER`, `LK IP`)
  * Validity period (`1 Month`)
  * Restriction notices (`P2P / Torrent Restricted`)
  * Unlimited speed indicator (`No Speed Limit`)
* **Customer Reviews & Trust Section**:
  * Overall Rating: `5.0 ★` (118+ verified reviews)
  * Verified buyer reviews with official staff replies (`PXN STORES REPLIED 💚`)

---

### 💻 B. Cloud VPS Infrastructure (`/vps`)
* **Hero Section**: "Cloud VPS Infrastructure – High-performance, unmanaged server allocations"
* **Provider & Duration Selector**:
  * **Billing Cycle Options**: `30-Day`, `50-Day`
  * **Cloud Providers**: Linode, DigitalOcean, LeaseWeb, BreezeHost
* **VPS Tier Pricing Cards**:
  | Tier | RAM | CPU | Storage (NVMe) | Bandwidth | Price (30-Day) | CTA |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **VPS1** | 1 GB | 1 Core | 25 GB | 1 TB | **LKR 700** | Order Now |
  | **VPS2** | 2 GB | 1 Core | 50 GB | 2 TB | **LKR 950** | Order Now |
  | **VPS3** | 4 GB | 2 Cores | 80 GB | 4 TB | **LKR 1,200** | Order Now |
  | **VPS4** | 8 GB | 4 Cores | 160 GB | 5 TB | **LKR 1,500** | Order Now |
* **Global Network Footprint (Latency Matrix)**:
  * SG Hub: `~12ms`
  * IN Hub: `~45ms`
  * JP Hub: `~70ms`
  * UK Hub: `~84ms`
  * DE Hub: `~92ms`
  * US Hub: `~135ms`
  * AU Hub: `~160ms`

---

### 🔑 C. Software Subscriptions Store (`/softwares`)
* **Header & Search UX**:
  * Quick Search Bar (`⌘K` hotkey)
  * Category Pills Filter: `All`, `AI`, `AI Tools`, `Creative`, `Finance`, `Productivity`, `Software`, `Streaming`, `Featured`
  * Product Counter: `33 of 33 products`
* **Featured Product Catalog & Pricing Grid**:
  * **Lovable AI Pro 105 Credits** (1 Month): `LKR 1,300` *(Original LKR 25,125)*
  * **CapCut Pro Private Account**: `LKR 700` *(Original LKR 6,800)*
  * **Gemini + Google AI Pro (18 Months)**: `LKR 1,000` *(Original LKR 104,400)*
  * **Netflix 4K UHD Premium (1 Month)**: `LKR 900` *(Original LKR 3,300)*
  * **TradingView Premium Subscription (1 Month)**: `LKR 2,850` *(Original LKR 18,000)*
  * **Canva Pro (1 Year Own Account)**: `LKR 1,000` *(Original LKR 16,000)*
  * **Adobe Creative Cloud (1 Month)**: `LKR 3,000` *(Original LKR 17,500)*
  * **NordVPN Complete (1 Year)**: `LKR 900` *(Original LKR 26,400)*
* **Stock & CTA States**:
  * Available: Green **"View"** button
  * Unavailable: Grayed **"Out of Stock"** status badge

---

### 🔐 D. Authentication & User Account (`/auth`)
* **Layout Structure**: Centered dark slate card with clean input fields.
* **Form Inputs**:
  * Email / Username field
  * Password input with show/hide toggle
  * "Remember Me" checkbox & "Forgot Password?" link
  * Primary Submit Button: Green glowing "Sign In" CTA
  * Quick Register / Create Account toggle

---

## 📱 4. Responsive & Mobile UX Behavior

1. **Fluid Grid Layout**: Standard CSS Grid layout scaling from 1 column on mobile (`<640px`) to 2-3 columns on tablet (`768px`) and 4 columns on desktop (`>1024px`).
2. **Sticky Mobile Navigation Bar**: Fixed bottom bar featuring direct tap icons for `Home`, `Cart`, `Orders`, and `Account`.
3. **PWA Native Feel**: Support for offline fallback, fast caching, and native app prompt banners on Android & iOS.

---

## 📂 5. Directory Asset Index

All raw UI screenshots and structural DOM files are stored locally in the workspace:
- `home_page.png` / `home_structure.json` / `home_snapshot.txt`
- `v2ray_page.png` / `v2ray_structure.json`
- `vps_page.png` / `vps_structure.json`
- `softwares_page.png` / `softwares_structure.json`
- `support_page.png` / `support_structure.json`
- `auth_page.png` / `auth_snapshot.txt`
