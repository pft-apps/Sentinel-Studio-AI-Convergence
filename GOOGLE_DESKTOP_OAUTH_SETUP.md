# Google Desktop App OAuth 2.0 Configuration Guide (RFC 8252 Loopback)

## 1. Problem & Architecture Overview

### Why Google Blocks Embedded WebViews & iframes
Google actively blocks OAuth 2.0 requests originating from embedded browsers, Electron `<webview>` tags, Chromium Embedded Framework (CEF), and `<iframe>` containers with errors such as:
- **`403: disallowed_useragent`** ("Something went wrong")
- **Passkey and WebAuthn hardware security key blocks** (FIDO2 credentials require top-level OS browser execution)

### The Solution: RFC 8252 Desktop Loopback Flow with PKCE
Sentinel Studio adheres to the official Google Identity and IETF OAuth 2.0 specification for Native Apps (**RFC 8252**):

1. **Ephemeral Local Server**: When the user clicks **"Sign in with Google"**, Sentinel Studio spins up a lightweight local HTTP server listening exclusively on `127.0.0.1` on port `0` (allowing the operating system to dynamically assign an unused ephemeral port, e.g., `127.0.0.1:54321`).
2. **External Browser Launch**: The app constructs the Google OAuth consent URL containing PKCE challenge (`S256`) and dynamic redirect URI (`http://127.0.0.1:{port}/auth/callback`), then launches the user's default system browser using Electron's `shell.openExternal`.
3. **Hardware & Passkey Verification**: The user signs in within Chrome/Edge/Firefox with full support for Google passkeys, biometric WebAuthn, hardware YubiKeys, and Google 2-Step Verification.
4. **Loopback Redirect Capture**: Google redirects back to `http://127.0.0.1:{port}/auth/callback?code=...`.
5. **Clean Browser Confirmation**: The local HTTP server serves a clean HTML confirmation message:
   > *"Authentication successful! You can close this tab and return to Sentinel Studio."*
   and immediately closes the temporary HTTP server.
6. **PKCE Token Exchange**: The main process exchanges the authorization code for tokens at `https://oauth2.googleapis.com/token` using the PKCE `code_verifier`, fetches user profile details from `https://www.googleapis.com/oauth2/v3/userinfo`, and updates the application state.

---

## 2. Google Cloud Console Configuration Steps

To configure your own OAuth 2.0 Client ID for Sentinel Studio:

### Step 1: Open Google Cloud Console
1. Navigate to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Select your Google Cloud project (or create a new project, e.g., *Sentinel Studio Workstation*).

### Step 2: Configure OAuth Consent Screen (If Not Already Done)
1. In the left navigation, click **OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace for your organization).
3. Fill in required fields:
   - **App name**: `Sentinel Studio Executive`
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Under **Scopes**, add:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
5. Save and continue.

### Step 3: Create OAuth 2.0 Client ID (CRITICAL STEP)
1. Return to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** at the top of the page.
3. Select **OAuth client ID**.
4. In the **Application type** dropdown, select:
   👉 **Desktop app** 👈
   *(DO NOT select "Web application").*

> **Why "Desktop app"?**
> When **Application type** is set to **Desktop app**, Google's OAuth 2.0 authorization server automatically permits loopback redirects to `http://127.0.0.1` on **any arbitrary port** without requiring you to whitelist specific port numbers in advance.

5. In the **Name** field, enter: `Sentinel Studio Desktop Client`.
6. Click **Create**.
7. Google will display your **Client ID** (e.g., `1234567890-abcdefg1234567.apps.googleusercontent.com`) and Client Secret.

---

## 3. Applying the Credentials in Sentinel Studio

### Option A: Via the In-App Settings Modal
1. Click the **⚙️ Config** icon beside the Google Sign-In button in Sentinel Studio's top header.
2. Paste your **Client ID** into the **Google OAuth 2.0 Client ID (Desktop App)** field.
3. (Optional) Paste the **Client Secret**.
4. Click **Save Configuration**.
5. Click **Sign in with Google** to test the loopback flow immediately.

### Option B: Via Environment Variables
You can also set the Client ID in `.env` or your desktop environment:
```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```
Or for client-side Vite builds:
```env
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

---

## 4. Architectural Summary Table

| Component | Implementation | Rationale |
| :--- | :--- | :--- |
| **Main Process** (`main.js`) | Node.js `http.createServer` on `127.0.0.1:0` | Ephemeral port binding eliminates port conflicts |
| **Browser Opener** | `shell.openExternal(authUrl)` | Bypasses embedded WebView; opens default OS browser |
| **PKCE Generator** | RFC 7636 `crypto` SHA-256 (`S256`) | Cryptographic protection against authorization code interception |
| **Callback Handler** | Path `/auth/callback` on ephemeral loopback server | Captures `code` & `state`, serves confirmation HTML, shuts down server |
| **Bridge API** (`preload.js`) | `contextBridge.exposeInMainWorld('sentinelDesktop')` | Safe IPC boundary without exposing Node.js primitives |
| **Frontend UI** (`googleAuth.ts` / `GoogleAuthControl.tsx`) | 3 Interactive States: Unauthenticated, Listening (with Cancel), and Active Session | Seamless state reactivity with real-time port feedback |
