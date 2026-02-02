# Apple In-App Purchase (IAP) Configuration

This document explains how to configure Apple In-App Purchases for VBStats.

## App Store Connect Configuration

### Subscription Group: "Planes VBStats"

The app uses a subscription group with two subscription products:

| Level | Reference Name | Product ID | Duration | Price |
|-------|---------------|------------|----------|-------|
| 1 | Plan BASICO | `com.vbstats.basico.mensual` | 1 month | 4.99€ |
| 2 | Plan PRO | `com.vbstats.pro.mensual` | 1 month | 9.99€ |

### Apple IDs
- Plan BASICO: `6758346609`
- Plan PRO: `6758347106`

## Backend Configuration

### Environment Variables

Add these environment variables to your backend (e.g., in Render Dashboard):

```bash
# Apple App Store Connect Shared Secret
# Get this from App Store Connect > My Apps > [Your App] > App Information > App-Specific Shared Secret
APPLE_SHARED_SECRET=your_shared_secret_here
```

### Database Migration

Run the migration to add Apple IAP support:

```bash
mysql -u root -p your_database < db/add_apple_iap_support.sql
```

### Server-to-Server Notifications

Configure App Store Connect to send server-to-server notifications:

1. Go to App Store Connect > My Apps > [Your App] > App Information
2. Under "App Store Server Notifications", set the Production/Sandbox Server URL:
   - Production: `https://your-api-domain.com/subscriptions/apple/webhook`
   - Sandbox: `https://your-api-domain.com/subscriptions/apple/webhook`

## iOS App Configuration

### Required Capabilities

In Xcode, enable the following capabilities for your app target:
1. Go to your target > Signing & Capabilities
2. Click "+ Capability"
3. Add "In-App Purchase"

### StoreKit Configuration (Optional for Testing)

For local testing without App Store Connect:
1. Create a StoreKit Configuration file in Xcode
2. Add subscription products matching the Product IDs above
3. In Scheme settings, select the StoreKit Configuration file

### Building for iOS

After adding react-native-iap, run:

```bash
cd ios
pod install
cd ..
npx react-native run-ios
```

## Payment Flow

### iOS (Apple IAP)
1. User selects a plan in SelectPlanScreen
2. App calls `appleIAPService.purchaseSubscription()`
3. Apple's native purchase dialog appears
4. User completes payment via Apple Pay or stored payment method
5. Receipt is sent to backend for verification
6. Backend verifies with Apple servers
7. User subscription is updated in database

### Android (Stripe)
1. User selects a plan in SelectPlanScreen
2. App opens Stripe Checkout in browser
3. User completes payment
4. Stripe webhook notifies backend
5. User subscription is updated in database

## Apple's Requirements Compliance

This implementation complies with Apple's App Store Review Guidelines:

1. **No External Payment Links on iOS**: iOS users can only purchase through Apple IAP
2. **Subscription Management**: Users are directed to iOS Settings to manage/cancel subscriptions
3. **Clear Pricing**: Prices are displayed using Apple's localized pricing
4. **Auto-Renewal Disclosure**: Terms clearly state auto-renewal behavior
5. **Restore Purchases**: Users can restore previous purchases on new devices

## Troubleshooting

### Common Issues

1. **Products not loading**: Ensure Product IDs match exactly with App Store Connect
2. **Purchase fails**: Check if your App Store Connect agreement is signed and banking info is complete
3. **Receipt verification fails**: Verify APPLE_SHARED_SECRET is correct

### Sandbox Testing

1. Create a Sandbox Tester account in App Store Connect
2. Sign out of your regular Apple ID on the test device
3. When making a purchase, sign in with the Sandbox Tester account
4. Subscriptions renew faster in sandbox (1 month = 5 minutes)

## Code Structure

```
VBStats/
├── services/
│   ├── appleIAPService.ts      # Apple IAP service for iOS
│   └── subscriptionService.ts  # Main subscription service (with Apple product IDs)
└── pages/
    └── SelectPlanScreen.tsx    # Plan selection with platform-specific payment

backend/
├── routes/
│   └── subscriptions.js        # API routes including Apple verification
└── db/
    └── add_apple_iap_support.sql  # Database migration
```
