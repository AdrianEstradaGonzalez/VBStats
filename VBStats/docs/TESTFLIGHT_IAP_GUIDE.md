# TestFlight IAP Subscription Testing Guide

## Why "SKU not found" / "No se pudieron cargar los productos"

This error means `react-native-iap` cannot find the subscription products in the App Store. It is almost always a **configuration issue** in App Store Connect, not a code bug.

## Checklist: Required Steps

### 1. Paid Applications Agreement (CRITICAL)

Go to [App Store Connect > Agreements](https://appstoreconnect.apple.com/agreements):
- **"Paid Applications" agreement must be ACTIVE** (green status)
- If it says "Pending" or doesn't exist, you cannot sell IAP products
- You must complete: Banking info + Tax forms + Contact info

> Without this agreement, `fetchProducts()` always returns an empty array.

### 2. Subscriptions in App Store Connect

Go to App Store Connect > My Apps > VBStats > Subscriptions:

| Field | Value |
|-------|-------|
| **Subscription Group** | Planes VBStats |
| **Product ID (Basic)** | `com.vbstats.basico.mensual` |
| **Product ID (Pro)** | `com.vbstats.pro.mensual` |
| **Status** | Must be **"Ready to Submit"** or **"Approved"** |
| **Price** | Must have at least one price point set |
| **Localization** | At least one language with Display Name + Description |

Each subscription **must have**:
- ✅ A reference name
- ✅ A subscription duration (1 month)
- ✅ At least one price point (territory pricing)
- ✅ At least one localization (display name + description)
- ✅ Status: "Ready to Submit" (yellow icon) or "Approved" (green)

> If status is "Missing Metadata" (red), products won't load.

### 3. Bundle ID Match

The Product IDs must start with your app's Bundle Identifier:
- Bundle ID: `com.vbstats`
- Products: `com.vbstats.basico.mensual`, `com.vbstats.pro.mensual` ✅

Verify in Xcode: Target > General > Bundle Identifier = `com.vbstats`

### 4. In-App Purchase Capability

In Xcode:
1. Select your app target
2. Go to **Signing & Capabilities**
3. Verify **"In-App Purchase"** capability is listed
4. If not, click **"+ Capability"** and add it

### 5. TestFlight Build

- Upload a new build **after** adding the In-App Purchase capability
- The build must be processed and available in TestFlight
- Wait ~15-30 minutes after processing for IAP products to become available

### 6. Sandbox Test Account

Go to App Store Connect > Users and Access > Sandbox > Testers:
1. Create a sandbox tester (use a non-Apple-ID email)
2. On the test device: **Settings > App Store > Sandbox Account** — sign in with the sandbox tester
3. Do NOT sign out of your regular Apple ID

> In iOS 16+, sandbox accounts are configured separately under Settings > App Store > Sandbox Account.

## Backend .env Configuration

Your backend (Render) needs this environment variable for receipt verification:

```bash
APPLE_SHARED_SECRET=REPLACE_WITH_APPLE_SHARED_SECRET
```

Get this from: **App Store Connect > My Apps > VBStats > App Information > App-Specific Shared Secret**

If you don't see it, click "Manage" next to App-Specific Shared Secret to generate one.

### Setting on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your VBStats backend service
3. Go to **Environment** tab
4. Add: `APPLE_SHARED_SECRET` = your shared secret value
5. Click **Save Changes** (service will redeploy)

## Sandbox Subscription Timing

In sandbox, subscriptions renew on an accelerated schedule:

| Real Duration | Sandbox Duration |
|---------------|-----------------|
| 1 week        | 3 minutes       |
| 1 month       | 5 minutes       |
| 2 months      | 10 minutes      |
| 3 months      | 15 minutes      |
| 6 months      | 30 minutes      |
| 1 year        | 1 hour          |

Subscriptions auto-renew up to **6 times** in sandbox, then expire.

## Debugging Steps

### Step 1: Check console logs
The app logs detailed IAP info. Connect Xcode and check the console for:
```
📦 Fetching subscription products with SKUs: [...]
📦 Available Apple products: [...]
```

If the products array is empty, the issue is in App Store Connect configuration.

### Step 2: Verify in Xcode StoreKit Testing (local)
1. In Xcode, go to **File > New > File > StoreKit Configuration File**
2. Add two subscriptions with the same Product IDs
3. In **Product > Scheme > Edit Scheme > Run > Options**, select the StoreKit Configuration
4. Run the app — this tests IAP locally without App Store Connect

### Step 3: Test on device with TestFlight
1. Make sure all the checklist items above are completed
2. Upload a new build to TestFlight
3. Wait 15-30 minutes after processing
4. Install via TestFlight and test

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "SKU not found" / Empty products | Products not configured or agreement not signed | Complete all checklist items above |
| "Cannot connect to iTunes Store" | No internet or StoreKit not initialized | Check network and `initConnection()` |
| Receipt verification fails (status ≠ 0) | Wrong APPLE_SHARED_SECRET | Regenerate and update in Render |
| Status 21007 | Sandbox receipt sent to production URL | Backend auto-retries with sandbox URL ✅ |
| Status 21003 | Receipt data corrupted | Re-attempt purchase |

## Full Backend .env Example

```bash
# Database
MYSQL_PUBLIC_URL=mysql://user:pass@host:port/database

# Stripe (Android)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PRICE_BASIC=price_xxxxx
STRIPE_PRICE_PRO=price_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Apple IAP (iOS)
APPLE_SHARED_SECRET=a767e11233bb439283af2c934b79007c

```bash
# Database
MYSQL_PUBLIC_URL=mysql://user:pass@host:port/database

# Stripe (Android)
STRIPE_SECRET_KEY=REPLACE_WITH_STRIPE_SECRET
STRIPE_PRICE_BASIC=REPLACE_WITH_STRIPE_PRICE_BASIC
STRIPE_PRICE_PRO=REPLACE_WITH_STRIPE_PRICE_PRO

# Apple IAP (iOS)
APPLE_SHARED_SECRET=REPLACE_WITH_APPLE_SHARED_SECRET

# Email
RESEND_API_KEY=REPLACE_WITH_RESEND_API_KEY
EMAIL_FROM=VBStats <onboarding@resend.dev>

# App
PORT=4000
FRONTEND_URL=https://vbstats.app
```
