# Bridge 🌉
### Instant Cross-Device Personal Transfer & Universal Clipboard

Bridge is a private, production-ready laptop-to-phone transfer service designed to eliminate the friction of emailing yourself links, creating drafts, messaging yourself on chat apps, or manually re-typing text across devices.

---

## 🚀 Key Features

- **Instant Link Sharing:** Click the extension or press `Alt + Shift + B` on any webpage on your laptop; it appears immediately in your phone inbox ready to open.
- **Universal Clipboard & Notes:** Transfer long prompts, code snippets, formatted notes, and instructions with one-tap Copy on mobile.
- **Client-Side Encrypted File Transfer:** Send PDFs, screenshots, documents, and code files up to 50MB. Files are encrypted client-side with 256-bit AES-GCM before upload and decrypted in-browser upon download.
- **End-to-End Encryption & Zero-Knowledge Storage:** Plaintext content and encryption keys never leave your devices or touch server logs. Every payload uses unique 96-bit (12-byte) initialization vectors (IVs) and SHA-256 integrity checksums.
- **Secure QR Code Pairing:** Link your phone to your laptop in seconds by scanning a short-lived QR code that securely exchanges the master transfer key.
- **Chrome Manifest V3 Extension:** Lightweight browser extension with 1-click "Send Page to Phone", "Send Selected Text", and configurable keyboard shortcuts.
- **Mobile Progressive Web App (PWA):** Installable on Android and iOS Safari, featuring Web Share Target integration to send links/files directly from your phone's OS share sheet into Bridge.
- **Persistent & Offline Accessible:** Items remain available in your inbox even when the originating device is powered down.

---

## 🛠️ Technology Stack

- **Frontend & App:** Next.js (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Cryptography:** Web Crypto API (`globalThis.crypto.subtle`) using AES-GCM-256, PBKDF2 (SHA-256, 100,000 rounds), SHA-256 digest checksums.
- **Backend & Database:** Supabase PostgreSQL with strict Row Level Security (RLS) on all tables.
- **Real-time Sync:** Supabase Realtime authenticated channels with local event fallback.
- **File Storage:** Private Supabase Storage bucket (`transfers`) with folder-scoped user RLS policies.
- **Browser Extension:** Chrome Manifest V3 with background service worker and local secure storage.
- **Testing:** Node.js native test runner (`node:test`, `node:assert`) with TypeScript test execution via `tsx`.

---

## 📦 Project Structure

```
Personal-Share/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Primary inbox & transfer workspace
│   │   ├── layout.tsx             # Root layout with PWA manifest & SW registration
│   │   ├── globals.css            # Tailwind theme styles
│   │   └── api/transfers/route.ts # HTTP API for Extension & desktop companion
│   ├── components/
│   │   ├── Navbar.tsx             # Brand header, sync state, device indicators
│   │   ├── SendComposer.tsx       # Link, note, and encrypted file composer
│   │   ├── InboxList.tsx          # Real-time decrypted items, search & filters
│   │   ├── PairingModal.tsx       # QR code generator, short code & pairing claim
│   │   ├── DeviceManagerModal.tsx # Active devices & revocation controls
│   │   ├── SettingsModal.tsx      # Master key export/import & retention settings
│   │   └── PwaInstallBanner.tsx   # Device-aware install prompts (iOS / Android)
│   └── lib/
│       ├── types.ts               # Core TypeScript data contracts
│       ├── crypto.ts              # Web Crypto AES-GCM, SHA-256, and key derivation
│       ├── validation.ts          # Zod schemas, URL normalization & sanitization
│       ├── device-storage.ts      # Device identity & local key storage
│       └── api/
│           ├── transfer-service.ts# End-to-end transfer lifecycle & realtime
│           └── pairing-service.ts # Pairing invitation & device management
├── extension/                     # Chrome Manifest V3 Companion
│   ├── manifest.json              # Extension manifest (shortcuts, permissions)
│   ├── popup.html                 # Extension popup UI
│   ├── popup.js                   # Extension popup logic (activeTab query, selection)
│   ├── popup.css                  # Extension dark styling
│   ├── background.js              # Service worker (Alt+Shift+B shortcut handler)
│   └── icons/                     # 16px, 48px, 128px extension icons
├── supabase/
│   └── migrations/
│       └── 20261012_init_bridge_schema.sql # Production PostgreSQL DDL, RLS, & Storage
├── tests/                         # Automated test suite
│   ├── crypto.test.ts             # AES-GCM roundtrips, IV uniqueness, checksums
│   ├── validation.test.ts         # URL security, malicious scheme blocking, Zod
│   ├── pairing.test.ts            # QR payload, expiry enforcement, revocation
│   └── transfer-service.test.ts   # Item encryption, fetching, pinning, deletion
├── public/
│   ├── manifest.json              # Web App Manifest & Web Share Target
│   └── sw.js                      # PWA Service Worker
├── .env.example                   # Environment configuration template
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
*(Note: Bridge includes an offline/local zero-config fallback mode that works immediately out of the box even before cloud credentials are provided).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Tests
```bash
npm test
```
All 25 automated unit and integration tests will execute.

### 5. Build for Production
```bash
npm run build
```

---

## 🔒 Supabase Backend Setup

1. Create a project at [supabase.com](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste and run the entire migration file:
   `supabase/migrations/20261012_init_bridge_schema.sql`
4. This script automatically:
   - Creates `profiles`, `devices`, `pairing_invitations`, `transfer_items`, and `audit_events` tables.
   - Sets up performance indexes.
   - Enables Row Level Security (RLS) on all tables with `auth.uid() = user_id` restrictions.
   - Creates the private `transfers` storage bucket with folder-scoped RLS policies.
   - Enables Supabase Realtime publication on `transfer_items`.
5. In your Supabase Dashboard under **Project Settings &rarr; API**, copy:
   - `Project URL` &rarr; `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` &rarr; `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Add these to `.env.local` or your Vercel project environment variables.

---

## 🧩 Installing the Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `extension/` directory from this project (`Personal-Share/extension`).
5. Pin the Bridge icon to your toolbar.
6. **Usage:**
   - On any webpage, press `Alt + Shift + B` or click the extension icon.
   - Click **Send Page to Phone** to push the URL and title.
   - Highlight any text on a webpage and click **Send Selected Text**.

---

## 📱 Mobile PWA Installation & Share Menu

1. On your phone (Android or iPhone), open your Bridge URL (e.g. `http://<your-lan-ip>:3000` or deployed Vercel HTTPS URL).
2. **On Android (Chrome):**
   - Tap the **Install** button on the in-app banner or tap Chrome's menu (`⋮`) &rarr; **Add to Home screen** / **Install app**.
3. **On iOS (Safari):**
   - Tap Safari's **Share** button (box with upward arrow) &rarr; scroll down &rarr; tap **Add to Home Screen**.
4. **Phone-to-Laptop Transfers via OS Share Menu:**
   - Bridge registers as a Web Share Target (`share_target` in `manifest.json`).
   - When sharing a webpage or link from any app on your phone, choose **Bridge** from the share sheet to send it straight to your laptop inbox.

---

## 🔐 Security & Privacy Architecture

- **Zero-Knowledge Encryption:** Data is encrypted client-side using standard AES-GCM (256-bit key). The ciphertext is uploaded with an isolated random 12-byte IV and SHA-256 digest. Even database administrators cannot inspect your private links, notes, or files.
- **Integrity Verification:** Every downloaded transfer item and file undergoes cryptographic SHA-256 verification against its checksum before presentation. Tampered or corrupted data is rejected.
- **Short-Lived Pairing:** Device pairing invitations automatically expire after 10 minutes.
- **Device Revocation:** The primary account owner can revoke any paired device at any time from the **Paired Devices** modal, immediately severing its access.
- **Automated Retention:** Unpinned transfers expire according to your retention policy (default 72 hours).

---

## 🚀 Deploying to Vercel

1. Push this repository to a private GitHub repository:
   ```bash
   git add .
   git commit -m "Initial Bridge release"
   git remote add origin https://github.com/<your-username>/bridge.git
   git push -u origin main
   ```
2. Log in to [vercel.com](https://vercel.com/) and click **Add New &rarr; Project**.
3. Import your `bridge` repository.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel production domain, e.g. `https://bridge.vercel.app`)
5. Click **Deploy**. Vercel will build and provide a production HTTPS URL.
