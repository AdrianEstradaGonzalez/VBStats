const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Stripe configuration (use live key in production, test key in development)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
let stripe;

if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.startsWith('sk_test_tu_clave') || STRIPE_SECRET_KEY === 'sk_test_placeholder') {
  console.error('⚠️  STRIPE_SECRET_KEY no está configurada correctamente en las variables de entorno');
  console.error('⚠️  Configura STRIPE_SECRET_KEY en Render Dashboard > Environment');
  stripe = null;
} else {
  try {
    stripe = require('stripe')(STRIPE_SECRET_KEY);

    console.log('--- Stripe Initialization ---');
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceBasic = process.env.STRIPE_PRICE_BASIC;
    const pricePro = process.env.STRIPE_PRICE_PRO;

    console.log('Stripe Secret Key loaded:', secretKey ? `sk...${secretKey.slice(-4)}` : 'NOT FOUND or empty');
    console.log('Stripe Price ID (Basic):', priceBasic || 'NOT FOUND or empty');
    console.log('Stripe Price ID (Pro):', pricePro || 'NOT FOUND or empty');

    if (!secretKey || !priceBasic || !pricePro) {
      console.error('CRITICAL: One or more Stripe environment variables are missing. Please check your Render dashboard.');
    }

    const mode = secretKey && secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST';
    console.log('Running in mode:', mode);
    console.log('--------------------------');
  } catch (e) {
    console.error('❌ Error al inicializar Stripe:', e.message);
    stripe = null;
  }
}

// Price IDs for Stripe (configure these in your Stripe dashboard)
const PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC || 'price_basic_monthly',
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
};

// Trial configuration
const TRIAL_DAYS = 7;

// Check if a device has already used a trial
const hasDeviceUsedTrial = async (deviceId) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM device_trials WHERE device_id = ?',
      [deviceId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Error checking device trial:', error);
    return false;
  }
};

// Check if user has already used a trial
const hasUserUsedTrial = async (userId) => {
  try {
    const [rows] = await pool.query(
      'SELECT trial_used FROM users WHERE id = ?',
      [userId]
    );
    return rows.length > 0 && rows[0].trial_used === 1;
  } catch (error) {
    console.error('Error checking user trial:', error);
    return false;
  }
};

// Record trial usage for device and user
const recordTrialUsage = async (userId, deviceId, planType) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
    
    // Update user trial info
    await conn.query(
      `UPDATE users SET 
        trial_used = TRUE, 
        trial_started_at = NOW(), 
        trial_ends_at = ?,
        trial_plan_type = ?
      WHERE id = ?`,
      [trialEndsAt, planType, userId]
    );
    
    // Record device trial
    await conn.query(
      `INSERT INTO device_trials (device_id, user_id, plan_type) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [deviceId, userId, planType]
    );
    
    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    console.error('Error recording trial usage:', error);
    return false;
  } finally {
    conn.release();
  }
};

// Check trial eligibility for a device
router.post('/check-trial-eligibility', async (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    
    if (!userId || !deviceId) {
      return res.status(400).json({ error: 'userId and deviceId are required' });
    }
    
    const deviceUsedTrial = await hasDeviceUsedTrial(deviceId);
    const userUsedTrial = await hasUserUsedTrial(userId);
    
    // Get user's current subscription to check if they're on a trial
    const [rows] = await pool.query(
      'SELECT trial_used, trial_ends_at, trial_plan_type, subscription_type FROM users WHERE id = ?',
      [userId]
    );
    
    let currentTrial = null;
    if (rows.length > 0 && rows[0].trial_ends_at) {
      const trialEndsAt = new Date(rows[0].trial_ends_at);
      if (trialEndsAt > new Date()) {
        currentTrial = {
          planType: rows[0].trial_plan_type,
          endsAt: rows[0].trial_ends_at,
          daysRemaining: Math.ceil((trialEndsAt - new Date()) / (1000 * 60 * 60 * 24))
        };
      }
    }
    
    res.json({
      eligible: !deviceUsedTrial && !userUsedTrial,
      deviceUsedTrial,
      userUsedTrial,
      currentTrial,
      trialDays: TRIAL_DAYS
    });
  } catch (error) {
    console.error('Error checking trial eligibility:', error);
    res.status(500).json({ error: 'Failed to check trial eligibility' });
  }
});

// Get user's subscription
router.get('/:userId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT subscription_type, subscription_expires_at, stripe_customer_id, stripe_subscription_id,
              trial_used, trial_started_at, trial_ends_at, trial_plan_type,
              auto_renew, cancelled_at, apple_original_transaction_id
       FROM users WHERE id = ?`,
      [req.params.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    
    // ============================================
    // APPLE SYNC: If user is 'free' but has an apple_original_transaction_id,
    // the Apple verification may have failed previously. Try to re-check.
    // ============================================
    if (user.apple_original_transaction_id && (!user.subscription_type || user.subscription_type === 'free')) {
      // User has an Apple transaction but shows as free - check if subscription is still valid
      if (user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date()) {
        // Subscription should still be active based on expiration date
        const appleProductId = user.apple_product_id;
        const syncedType = APPLE_PRODUCT_IDS[appleProductId] || 'pro';
        
        console.log(`🔄 APPLE SYNC: User ${req.params.userId} is 'free' but has active Apple subscription until ${user.subscription_expires_at}, restoring to ${syncedType}`);
        
        await pool.query(
          `UPDATE users SET subscription_type = ? WHERE id = ?`,
          [syncedType, req.params.userId]
        );
        
        user.subscription_type = syncedType;
        console.log(`✅ APPLE SYNC: User ${req.params.userId} restored to ${syncedType}`);
      }
    }

    // ============================================
    // STRIPE SYNC: If user is 'free' but has a stripe_customer_id,
    // check Stripe for active/trialing subscriptions (handles missed webhooks)
    // ============================================
    if (stripe && user.stripe_customer_id && (!user.subscription_type || user.subscription_type === 'free')) {
      try {
        const stripeSubs = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
          limit: 10,
        });
        
        // Find the most recent active or trialing subscription
        const activeSub = stripeSubs.data.find(sub => sub.status === 'active' || sub.status === 'trialing');
        
        if (activeSub) {
          const priceId = activeSub.items.data[0].price.id;
          let syncedType = 'free';
          
          if (priceId === PRICE_IDS.basic) {
            syncedType = 'basic';
          } else if (priceId === PRICE_IDS.pro) {
            syncedType = 'pro';
          } else {
            // Fallback: check subscription metadata or try matching by price amount
            const priceAmount = activeSub.items.data[0].price.unit_amount;
            if (priceAmount >= 900) {
              syncedType = 'pro';
            } else if (priceAmount >= 400) {
              syncedType = 'basic';
            }
          }
          
          if (syncedType !== 'free') {
            const endTimestamp = activeSub.trial_end || activeSub.current_period_end;
            const isTrial = !!activeSub.trial_end && activeSub.trial_end > Math.floor(Date.now() / 1000);
            
            console.log(`🔄 STRIPE SYNC: User ${req.params.userId} is '${user.subscription_type}' in DB but has active Stripe subscription: ${syncedType} (trial: ${isTrial})`);
            
            // Cancel any other subscriptions (keep only the most recent active one)
            for (const sub of stripeSubs.data) {
              if (sub.id !== activeSub.id && (sub.status === 'active' || sub.status === 'trialing')) {
                console.log(`🗑️ STRIPE SYNC: Cancelling duplicate subscription ${sub.id}`);
                await stripe.subscriptions.cancel(sub.id);
              }
            }
            
            // Update DB to match Stripe
            await pool.query(
              `UPDATE users SET 
                subscription_type = ?,
                subscription_expires_at = FROM_UNIXTIME(?),
                stripe_subscription_id = ?,
                auto_renew = ?,
                cancelled_at = NULL
              WHERE id = ?`,
              [syncedType, endTimestamp, activeSub.id, !activeSub.cancel_at_period_end, req.params.userId]
            );
            
            user.subscription_type = syncedType;
            user.subscription_expires_at = new Date(endTimestamp * 1000);
            user.stripe_subscription_id = activeSub.id;
            user.auto_renew = !activeSub.cancel_at_period_end;
            user.cancelled_at = null;
            
            console.log(`✅ STRIPE SYNC: User ${req.params.userId} updated to ${syncedType}`);
          }
        }
      } catch (syncErr) {
        console.error('⚠️ Error during Stripe sync:', syncErr.message);
        // Continue with DB data if sync fails
      }
    }
    
    // Check if subscription has expired
    if (user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
      // Only downgrade if auto_renew is off (user cancelled)
      if (!user.auto_renew) {
        await pool.query(
          'UPDATE users SET subscription_type = ? WHERE id = ?',
          ['free', req.params.userId]
        );
        user.subscription_type = 'free';
      }
      // If auto_renew is on, the payment gateway should renew it via webhook
      // We give a grace period handled by the scheduler
    }

    // Check if subscription is marked for cancellation in Stripe
    let cancelAtPeriodEnd = false;
    if (stripe && user.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
      } catch (stripeErr) {
        console.error('Error fetching Stripe subscription status:', stripeErr.message);
      }
    }

    // Check if user is on an active trial
    let activeTrial = null;
    if (user.trial_ends_at) {
      const trialEndsAt = new Date(user.trial_ends_at);
      if (trialEndsAt > new Date()) {
        activeTrial = {
          planType: user.trial_plan_type,
          endsAt: user.trial_ends_at,
          daysRemaining: Math.ceil((trialEndsAt - new Date()) / (1000 * 60 * 60 * 24))
        };
      }
    }
    
    // Also check: if subscription is active (pro/basic) and has a trial_end in Stripe, report as trial
    if (stripe && user.stripe_subscription_id && (user.subscription_type === 'pro' || user.subscription_type === 'basic')) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        if (stripeSub.trial_end && stripeSub.trial_end > Math.floor(Date.now() / 1000)) {
          activeTrial = {
            planType: user.subscription_type,
            endsAt: new Date(stripeSub.trial_end * 1000).toISOString(),
            daysRemaining: Math.ceil((stripeSub.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
          };
        }
      } catch (err) {
        // Ignore - we already have what we need
      }
    }
    
    res.json({
      type: user.subscription_type || 'free',
      expiresAt: user.subscription_expires_at,
      stripeCustomerId: user.stripe_customer_id,
      stripeSubscriptionId: user.stripe_subscription_id,
      cancelAtPeriodEnd: cancelAtPeriodEnd || (!user.auto_renew && user.cancelled_at !== null),
      autoRenew: user.auto_renew === 1 || user.auto_renew === true,
      cancelledAt: user.cancelled_at,
      trialUsed: user.trial_used === 1,
      activeTrial: activeTrial,
      hasAppleSubscription: !!user.apple_original_transaction_id,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Update subscription type (ONLY via webhook or internal calls - NOT for direct API calls)
// This endpoint is PROTECTED and should only be called by Stripe webhooks
router.put('/:userId', async (req, res) => {
  try {
    const { subscription_type, expires_at, stripe_customer_id, stripe_subscription_id, internal_key } = req.body;
    
    // SECURITY: Prevent direct subscription type changes without proper authorization
    // Only allow changes if:
    // 1. Internal key is provided (for webhook/server-side calls)
    // 2. Or if downgrading to 'free' (cancellation)
    // 3. Or if only updating Stripe IDs (not subscription_type)
    const INTERNAL_SECRET = process.env.SUBSCRIPTION_INTERNAL_KEY || 'vbstats_internal_secure_key_2024';
    
    const isInternalCall = internal_key === INTERNAL_SECRET;
    const isDowngradeToFree = subscription_type === 'free';
    const isOnlyStripeUpdate = !subscription_type && (stripe_customer_id || stripe_subscription_id || expires_at !== undefined);
    
    // If trying to upgrade to paid plan without internal authorization, reject
    if (subscription_type && (subscription_type === 'basic' || subscription_type === 'pro')) {
      if (!isInternalCall) {
        console.warn(`⚠️ SECURITY: Rejected direct subscription upgrade attempt for user ${req.params.userId} to ${subscription_type}`);
        return res.status(403).json({ 
          error: 'Cambio de suscripción no autorizado. Use el proceso de pago de la aplicación.',
          code: 'UNAUTHORIZED_SUBSCRIPTION_CHANGE'
        });
      }
    }
    
    const validTypes = ['free', 'basic', 'pro'];
    if (subscription_type && !validTypes.includes(subscription_type)) {
      return res.status(400).json({ error: 'Invalid subscription type' });
    }

    let query = 'UPDATE users SET ';
    const updates = [];
    const params = [];

    if (subscription_type) {
      updates.push('subscription_type = ?');
      params.push(subscription_type);
    }
    if (expires_at !== undefined) {
      updates.push('subscription_expires_at = ?');
      params.push(expires_at);
    }
    if (stripe_customer_id !== undefined) {
      updates.push('stripe_customer_id = ?');
      params.push(stripe_customer_id);
    }
    if (stripe_subscription_id !== undefined) {
      updates.push('stripe_subscription_id = ?');
      params.push(stripe_subscription_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    query += updates.join(', ') + ' WHERE id = ?';
    params.push(req.params.userId);

    await pool.query(query, params);
    
    console.log(`✅ Subscription updated for user ${req.params.userId}: ${subscription_type || 'no type change'}`);
    res.json({ message: 'Subscription updated' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// Start a free trial (no payment required initially)
router.post('/start-trial', async (req, res) => {
  console.log('🎁 Start trial request:', req.body);
  
  try {
    const { userId, planType, deviceId } = req.body;
    
    if (!userId || !planType || !deviceId) {
      return res.status(400).json({ error: 'userId, planType and deviceId are required' });
    }
    
    if (planType !== 'pro') {
      return res.status(400).json({ error: 'La prueba gratuita solo está disponible para el plan Pro' });
    }
    
    // Check eligibility
    const deviceUsedTrial = await hasDeviceUsedTrial(deviceId);
    const userUsedTrial = await hasUserUsedTrial(userId);
    
    if (deviceUsedTrial) {
      return res.status(400).json({ 
        error: 'Este dispositivo ya ha utilizado una prueba gratuita.',
        code: 'DEVICE_TRIAL_USED'
      });
    }
    
    if (userUsedTrial) {
      return res.status(400).json({ 
        error: 'Esta cuenta ya ha utilizado una prueba gratuita.',
        code: 'USER_TRIAL_USED'
      });
    }
    
    // Record trial usage
    const recorded = await recordTrialUsage(userId, deviceId, planType);
    if (!recorded) {
      return res.status(500).json({ error: 'Error al iniciar la prueba gratuita' });
    }
    
    // Update user subscription to the trial plan
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
    
    await pool.query(
      `UPDATE users SET 
        subscription_type = ?,
        subscription_expires_at = ?
      WHERE id = ?`,
      [planType, trialEndsAt, userId]
    );
    
    console.log(`✅ Trial started for user ${userId}: ${planType} until ${trialEndsAt}`);
    
    res.json({
      success: true,
      planType,
      trialEndsAt: trialEndsAt.toISOString(),
      trialDays: TRIAL_DAYS,
      message: `Prueba gratuita de ${TRIAL_DAYS} días activada. Después se cobrará automáticamente.`
    });
  } catch (error) {
    console.error('❌ Error starting trial:', error);
    res.status(500).json({ error: 'Error al iniciar la prueba gratuita' });
  }
});

// Create Stripe checkout session
router.post('/create-checkout', async (req, res) => {
  console.log('📦 Create checkout request:', req.body);
  
  if (!stripe) {
    console.error('❌ Stripe not configured');
    return res.status(503).json({ 
      error: 'Servicio de pago no disponible. Configura STRIPE_SECRET_KEY en el servidor.' 
    });
  }

  try {
    const { userId, priceId, planType, platform, withTrial, deviceId } = req.body;

    if (!userId || !priceId) {
      return res.status(400).json({ error: 'userId y priceId son requeridos' });
    }
    
    // If requesting trial, check eligibility
    let trialEligible = false;
    if (withTrial && deviceId) {
      const deviceUsedTrial = await hasDeviceUsedTrial(deviceId);
      const userUsedTrial = await hasUserUsedTrial(userId);
      trialEligible = !deviceUsedTrial && !userUsedTrial;
    }

    console.log('🔍 Getting user:', userId);
    
    // Get user email
    const [users] = await pool.query('SELECT email, stripe_customer_id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = users[0];
    let customerId = user.stripe_customer_id;

    console.log('👤 User:', user.email, 'Customer ID:', customerId);

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      console.log('➕ Creating Stripe customer...');
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: userId.toString() },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
      console.log('✅ Customer created:', customerId);
    }

    console.log('💳 Creating checkout session with priceId:', priceId);

    // Cancel any existing active/trialing subscriptions to prevent duplicates
    try {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
      });
      for (const sub of existingSubs.data) {
        if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
          console.log(`🗑️ Cancelling existing subscription ${sub.id} (status: ${sub.status}) before new checkout`);
          await stripe.subscriptions.cancel(sub.id);
        }
      }
    } catch (cancelErr) {
      console.error('⚠️ Error cancelling existing subscriptions:', cancelErr.message);
      // Continue with checkout even if cancellation fails
    }

    // Build checkout session options
    const normalizedPlanType = planType === 'basic' || planType === 'pro' ? planType : null;
    const sessionOptions = {
      customer: customerId,
      payment_method_types: platform === 'ios' ? ['card', 'apple_pay'] : ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL || 'vbstats://'}payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'vbstats://'}payment-cancelled`,
      metadata: {
        userId: userId.toString(),
        withTrial: withTrial ? 'true' : 'false',
        deviceId: deviceId || '',
        planType: normalizedPlanType || '',
      },
    };
    
    // Add trial period if eligible
    if (withTrial && trialEligible) {
      sessionOptions.subscription_data = {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          userId: userId.toString(),
          isTrial: 'true',
        },
      };
      console.log(`🎁 Adding ${TRIAL_DAYS} day trial to checkout session`);
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    console.log('✅ Checkout session created:', session.id);
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('❌ Error creating checkout session:', error.message);
    console.error('Error details:', error);
    
    let errorMessage = 'Error al crear sesión de pago';
    if (error.code === 'resource_missing') {
      errorMessage = 'Price ID no válido. Configura los productos en Stripe Dashboard.';
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Clave de Stripe inválida. Verifica STRIPE_SECRET_KEY.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Verify checkout session and update subscription if completed
// This is called when the user clicks "I already paid" to handle webhook delays
router.post('/verify-checkout-session', async (req, res) => {
  console.log('🔍 Verify checkout session request:', req.body);
  
  if (!stripe) {
    console.error('❌ Stripe not configured');
    return res.status(503).json({ error: 'Servicio de pago no disponible' });
  }

  try {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
      return res.status(400).json({ error: 'sessionId y userId son requeridos' });
    }

    // Retrieve the checkout session from Stripe
    console.log('📦 Retrieving checkout session:', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    console.log('📦 Session status:', session.status, 'Payment status:', session.payment_status);

    // Check if the session is completed
    if (session.status !== 'complete') {
      return res.json({ 
        success: false, 
        status: session.status,
        message: 'El pago no se ha completado todavía. Por favor, completa el proceso de pago en la ventana de Stripe.'
      });
    }

    // Verify that this session belongs to this user
    if (session.metadata.userId !== userId.toString()) {
      console.warn(`⚠️ Session user mismatch: session userId ${session.metadata.userId} vs request userId ${userId}`);
      return res.status(403).json({ error: 'Esta sesión de pago no corresponde a tu cuenta' });
    }

    const subscription = session.subscription;
    const withTrial = session.metadata.withTrial === 'true';
    const deviceId = session.metadata.deviceId;

    if (!subscription) {
      return res.status(400).json({ error: 'No se encontró información de suscripción' });
    }

    // Get subscription details (subscription could be expanded object or just ID)
    let subscriptionData;
    if (typeof subscription === 'string') {
      subscriptionData = await stripe.subscriptions.retrieve(subscription);
    } else {
      subscriptionData = subscription;
    }

    const priceId = subscriptionData.items.data[0].price.id;
    
    // Determine subscription type from price ID
    let subscriptionType = 'free';
    if (priceId === PRICE_IDS.basic) {
      subscriptionType = 'basic';
    } else if (priceId === PRICE_IDS.pro) {
      subscriptionType = 'pro';
    } else if (session.metadata.planType === 'basic' || session.metadata.planType === 'pro') {
      subscriptionType = session.metadata.planType;
    } else {
      // Fallback: determine type from price amount
      const priceAmount = subscriptionData.items.data[0].price.unit_amount;
      if (priceAmount >= 900) {
        subscriptionType = 'pro';
      } else if (priceAmount >= 400) {
        subscriptionType = 'basic';
      }
    }

    console.log(`✅ Session verified for user ${userId}: ${subscriptionType}, trial: ${withTrial}`);

    // Cancel any OTHER active/trialing subscriptions for this customer to prevent duplicates
    if (session.customer) {
      try {
        const allSubs = await stripe.subscriptions.list({
          customer: session.customer,
          status: 'all',
        });
        for (const sub of allSubs.data) {
          if (sub.id !== subscriptionData.id && (sub.status === 'active' || sub.status === 'trialing')) {
            console.log(`🗑️ Verify: Cancelling duplicate subscription ${sub.id}`);
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (cleanupErr) {
        console.error('⚠️ Error cleaning up duplicate subscriptions:', cleanupErr.message);
      }
    }

    // If this was a trial checkout, record trial usage
    if (withTrial && deviceId && subscriptionData.trial_end) {
      console.log(`🎁 Recording trial usage for user ${userId}, device ${deviceId}`);
      await recordTrialUsage(userId, deviceId, subscriptionType);
    }

    // Get the subscription end date (trial_end if on trial, otherwise current_period_end)
    const endTimestamp = subscriptionData.trial_end || subscriptionData.current_period_end;

    // Update user subscription in database
    await pool.query(
      `UPDATE users SET 
        subscription_type = ?, 
        subscription_expires_at = FROM_UNIXTIME(?),
        stripe_subscription_id = ?,
        auto_renew = TRUE,
        cancelled_at = NULL
      WHERE id = ?`,
      [subscriptionType, endTimestamp, subscriptionData.id, userId]
    );

    console.log(`✅ Subscription activated for user ${userId}: ${subscriptionType}${withTrial ? ' (with trial)' : ''}`);

    // Return updated subscription info
    res.json({
      success: true,
      type: subscriptionType,
      expiresAt: new Date(endTimestamp * 1000).toISOString(),
      isTrial: !!subscriptionData.trial_end && subscriptionData.trial_end > Math.floor(Date.now() / 1000),
      message: withTrial 
        ? `¡Prueba gratuita de ${TRIAL_DAYS} días activada! Tu suscripción ${subscriptionType.toUpperCase()} está lista.`
        : `¡Suscripción ${subscriptionType.toUpperCase()} activada!`
    });
  } catch (error) {
    console.error('❌ Error verifying checkout session:', error.message);
    
    if (error.code === 'resource_missing') {
      return res.status(404).json({ 
        success: false,
        error: 'Sesión de pago no encontrada. Si acabas de pagar, espera unos segundos e inténtalo de nuevo.'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error al verificar el pago. Inténtalo de nuevo.'
    });
  }
});

// Stripe webhook to handle subscription events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payment service not available' });
  }

  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const subscriptionId = session.subscription;
        const withTrial = session.metadata.withTrial === 'true';
        const deviceId = session.metadata.deviceId;

        // Cancel any OTHER active/trialing subscriptions for this customer to prevent duplicates
        try {
          const allSubs = await stripe.subscriptions.list({
            customer: session.customer,
            status: 'all',
          });
          for (const sub of allSubs.data) {
            if (sub.id !== subscriptionId && (sub.status === 'active' || sub.status === 'trialing')) {
              console.log(`\uD83D\uDDD1\uFE0F Webhook: Cancelling duplicate subscription ${sub.id}`);
              await stripe.subscriptions.cancel(sub.id);
            }
          }
        } catch (cleanupErr) {
          console.error('\u26A0\uFE0F Error cleaning up duplicate subscriptions:', cleanupErr.message);
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;
        
        // Determine subscription type from price ID
        let subscriptionType = 'free';
        if (priceId === PRICE_IDS.basic) {
          subscriptionType = 'basic';
        } else if (priceId === PRICE_IDS.pro) {
          subscriptionType = 'pro';
        } else if (session.metadata.planType === 'basic' || session.metadata.planType === 'pro') {
          subscriptionType = session.metadata.planType;
        } else {
          // Fallback: determine type from price amount
          const priceAmount = subscription.items.data[0].price.unit_amount;
          if (priceAmount >= 900) {
            subscriptionType = 'pro';
          } else if (priceAmount >= 400) {
            subscriptionType = 'basic';
          }
        }
        
        // If this was a trial checkout, record trial usage
        if (withTrial && deviceId && subscription.trial_end) {
          console.log(`🎁 Recording trial usage for user ${userId}, device ${deviceId}`);
          await recordTrialUsage(userId, deviceId, subscriptionType);
        }

        // Get the subscription end date (trial_end if on trial, otherwise current_period_end)
        const endTimestamp = subscription.trial_end || subscription.current_period_end;

        // Update user subscription
        await pool.query(
          `UPDATE users SET 
            subscription_type = ?, 
            subscription_expires_at = FROM_UNIXTIME(?),
            stripe_subscription_id = ?,
            auto_renew = TRUE,
            cancelled_at = NULL
          WHERE id = ?`,
          [subscriptionType, endTimestamp, subscriptionId, userId]
        );
        
        console.log(`✅ Subscription activated for user ${userId}: ${subscriptionType}${withTrial ? ' (with trial)' : ''}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by Stripe customer ID
        const [users] = await pool.query(
          'SELECT id, subscription_type FROM users WHERE stripe_customer_id = ?',
          [customerId]
        );

        if (users.length > 0) {
          const userId = users[0].id;
          const priceId = subscription.items.data[0].price.id;
          
          let subscriptionType = 'free';
          if (priceId === PRICE_IDS.basic) {
            subscriptionType = 'basic';
          } else if (priceId === PRICE_IDS.pro) {
            subscriptionType = 'pro';
          } else if (users[0].subscription_type === 'basic' || users[0].subscription_type === 'pro') {
            subscriptionType = users[0].subscription_type;
          } else {
            // Fallback: determine type from price amount
            const priceAmount = subscription.items.data[0].price.unit_amount;
            if (priceAmount >= 900) {
              subscriptionType = 'pro';
            } else if (priceAmount >= 400) {
              subscriptionType = 'basic';
            }
          }

          // Update subscription info including auto_renew status from Stripe
          const autoRenew = !subscription.cancel_at_period_end;
          await pool.query(
            `UPDATE users SET 
              subscription_type = ?, 
              subscription_expires_at = FROM_UNIXTIME(?),
              auto_renew = ?,
              cancelled_at = ?
            WHERE id = ?`,
            [
              subscriptionType, 
              subscription.current_period_end, 
              autoRenew,
              autoRenew ? null : new Date(),
              userId
            ]
          );
          console.log(`🔄 Subscription updated for user ${userId}: ${subscriptionType}, auto_renew: ${autoRenew}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Downgrade to free - keep all user data!
        await pool.query(
          `UPDATE users SET 
            subscription_type = 'free', 
            subscription_expires_at = NULL,
            stripe_subscription_id = NULL,
            auto_renew = FALSE,
            cancelled_at = COALESCE(cancelled_at, NOW())
          WHERE stripe_customer_id = ?`,
          [customerId]
        );
        console.log(`⚠️ Subscription deleted for customer ${customerId}, downgraded to free`);
        break;
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }

  res.json({ received: true });
});

// Cancel subscription
router.post('/:userId/cancel', async (req, res) => {
  console.log('📛 Cancel subscription request for userId:', req.params.userId);
  
  if (!stripe) {
    console.error('❌ Stripe not configured');
    return res.status(503).json({ error: 'Payment service not available' });
  }

  try {
    const [users] = await pool.query(
      'SELECT stripe_subscription_id, stripe_customer_id, subscription_type, apple_original_transaction_id FROM users WHERE id = ?',
      [req.params.userId]
    );

    if (users.length === 0) {
      console.error('❌ User not found:', req.params.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    console.log('👤 User data:', { 
      subscriptionId: user.stripe_subscription_id, 
      customerId: user.stripe_customer_id,
      appleTransactionId: user.apple_original_transaction_id,
      type: user.subscription_type 
    });

    // If user has Apple subscription, they need to cancel via App Store
    if (user.apple_original_transaction_id && !user.stripe_subscription_id) {
      // Mark as cancelled in our DB even though Apple manages the actual cancellation
      await pool.query(
        `UPDATE users SET auto_renew = FALSE, cancelled_at = NOW() WHERE id = ?`,
        [req.params.userId]
      );
      return res.status(400).json({ 
        error: 'Para cancelar tu suscripción de Apple, ve a Ajustes > Apple ID > Suscripciones en tu dispositivo iOS. Tu plan se mantendrá activo hasta la fecha de vencimiento.',
        code: 'APPLE_SUBSCRIPTION_CANCEL_VIA_APPSTORE',
        expiresAt: user.subscription_expires_at,
      });
    }

    let subscriptionId = user.stripe_subscription_id;
    
    // If no subscription ID stored, try to find it from customer
    if (!subscriptionId && user.stripe_customer_id) {
      console.log('🔍 No subscription ID stored, fetching from Stripe customer...');
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'active',
          limit: 1,
        });
        
        if (subscriptions.data.length > 0) {
          subscriptionId = subscriptions.data[0].id;
          console.log('✅ Found subscription from customer:', subscriptionId);
          
          // Update the user record with the subscription ID
          await pool.query(
            'UPDATE users SET stripe_subscription_id = ? WHERE id = ?',
            [subscriptionId, req.params.userId]
          );
        }
      } catch (stripeErr) {
        console.error('Error fetching subscriptions from Stripe:', stripeErr.message);
      }
    }

    if (!subscriptionId) {
      console.error('❌ No active subscription found');
      // If still no subscription, just update the user to free
      await pool.query(
        'UPDATE users SET subscription_type = ?, subscription_expires_at = NULL, stripe_subscription_id = NULL, auto_renew = FALSE, cancelled_at = NOW() WHERE id = ?',
        ['free', req.params.userId]
      );
      return res.json({ message: 'Subscription cancelled (no active Stripe subscription found)' });
    }

    // Cancel at period end (user can use until expiration)
    console.log('🚫 Cancelling subscription:', subscriptionId);
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Mark auto_renew as false and record cancellation date in our DB
    await pool.query(
      `UPDATE users SET auto_renew = FALSE, cancelled_at = NOW() WHERE id = ?`,
      [req.params.userId]
    );

    console.log('✅ Subscription marked for cancellation at period end');
    
    // Get the expiration date to inform the user
    const [subInfo] = await pool.query(
      'SELECT subscription_expires_at FROM users WHERE id = ?',
      [req.params.userId]
    );
    const expiresAt = subInfo.length > 0 ? subInfo[0].subscription_expires_at : null;
    
    res.json({ 
      message: 'Subscription will be cancelled at period end',
      expiresAt: expiresAt,
      cancelledAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error.message);
    res.status(500).json({ error: 'Failed to cancel subscription', details: error.message });
  }
});

// ============================================
// APPLE IN-APP PURCHASE ENDPOINTS
// ============================================

// Apple IAP Product ID to subscription type mapping
const APPLE_PRODUCT_IDS = {
  'com.vbstats.basico.mes': 'basic',
  'com.vbstats.pro.mes': 'pro',
};

// Apple App Store Connect Shared Secret (configure in environment)
const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET || '';

// Apple verification URLs
const APPLE_VERIFY_RECEIPT_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_RECEIPT_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';

/**
 * Verify Apple receipt with Apple's servers
 * @param {string} receiptData - Base64 encoded receipt data
 * @param {boolean} useSandbox - Whether to use sandbox environment
 */
const verifyAppleReceipt = async (receiptData, useSandbox = false) => {
  const verifyUrl = useSandbox ? APPLE_VERIFY_RECEIPT_SANDBOX : APPLE_VERIFY_RECEIPT_PRODUCTION;
  
  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': APPLE_SHARED_SECRET,
        'exclude-old-transactions': true,
      }),
    });

    const result = await response.json();
    
    // Status 21007 means it's a sandbox receipt sent to production
    // Retry with sandbox URL
    if (result.status === 21007 && !useSandbox) {
      console.log('🔄 Receipt is from sandbox, retrying with sandbox URL...');
      return verifyAppleReceipt(receiptData, true);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error verifying Apple receipt:', error);
    throw error;
  }
};

/**
 * Extract subscription info from Apple receipt verification response
 */
const extractSubscriptionInfo = (verificationResult) => {
  if (verificationResult.status !== 0) {
    return null;
  }

  // Get the latest receipt info (most recent subscription)
  const latestReceiptInfo = verificationResult.latest_receipt_info || [];
  const pendingRenewalInfo = verificationResult.pending_renewal_info || [];
  
  if (latestReceiptInfo.length === 0) {
    return null;
  }

  // Sort by expires_date_ms to get the most recent subscription
  const sortedReceipts = [...latestReceiptInfo].sort((a, b) => 
    parseInt(b.expires_date_ms) - parseInt(a.expires_date_ms)
  );
  
  const latestReceipt = sortedReceipts[0];
  const productId = latestReceipt.product_id;
  const expiresDateMs = parseInt(latestReceipt.expires_date_ms);
  const originalTransactionId = latestReceipt.original_transaction_id;
  const transactionId = latestReceipt.transaction_id;
  
  // Check if subscription is still active
  const isActive = expiresDateMs > Date.now();
  
  // Check if in trial period
  const isInTrial = latestReceipt.is_trial_period === 'true';
  
  // Check if will auto-renew
  const renewalInfo = pendingRenewalInfo.find(r => r.original_transaction_id === originalTransactionId);
  const willRenew = renewalInfo ? renewalInfo.auto_renew_status === '1' : false;
  
  return {
    productId,
    subscriptionType: APPLE_PRODUCT_IDS[productId] || 'free',
    isActive,
    isInTrial,
    willRenew,
    expiresAt: new Date(expiresDateMs),
    originalTransactionId,
    transactionId,
  };
};

// Verify Apple purchase and update user subscription
router.post('/apple/verify', async (req, res) => {
  console.log('🍎 Apple purchase verification request');
  
  try {
    const { userId, productId, transactionId, receipt, originalTransactionId } = req.body;
    
    if (!userId || !receipt) {
      return res.status(400).json({ error: 'userId and receipt are required' });
    }

    // Check if APPLE_SHARED_SECRET is configured
    if (!APPLE_SHARED_SECRET) {
      console.error('❌ APPLE_SHARED_SECRET not configured');
      return res.status(503).json({ 
        error: 'Apple IAP service not configured. Set APPLE_SHARED_SECRET in environment.' 
      });
    }

    // Verify receipt with Apple
    console.log('🔍 Verifying receipt with Apple...');
    const verificationResult = await verifyAppleReceipt(receipt);
    
    if (verificationResult.status !== 0) {
      console.error('❌ Apple receipt verification failed, status:', verificationResult.status);
      return res.status(400).json({ 
        error: 'Verificación de recibo fallida',
        code: `APPLE_VERIFY_ERROR_${verificationResult.status}`
      });
    }

    // Extract subscription info
    const subscriptionInfo = extractSubscriptionInfo(verificationResult);
    
    if (!subscriptionInfo) {
      return res.status(400).json({ error: 'No se encontró información de suscripción válida' });
    }

    console.log('✅ Apple verification successful:', {
      productId: subscriptionInfo.productId,
      type: subscriptionInfo.subscriptionType,
      active: subscriptionInfo.isActive,
      trial: subscriptionInfo.isInTrial,
      expiresAt: subscriptionInfo.expiresAt,
    });

    // Only update if subscription is active
    if (!subscriptionInfo.isActive) {
      return res.status(400).json({ 
        error: 'La suscripción ha expirado',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Update user subscription in database
    // If Apple reports this is a trial period, also update trial fields
    if (subscriptionInfo.isInTrial) {
      console.log('🎁 Apple reports trial period active, updating trial fields');
      await pool.query(
        `UPDATE users SET 
          subscription_type = ?,
          subscription_expires_at = ?,
          apple_original_transaction_id = ?,
          apple_transaction_id = ?,
          apple_product_id = ?,
          auto_renew = TRUE,
          cancelled_at = NULL,
          trial_used = TRUE,
          trial_started_at = NOW(),
          trial_ends_at = ?,
          trial_plan_type = ?
        WHERE id = ?`,
        [
          subscriptionInfo.subscriptionType,
          subscriptionInfo.expiresAt,
          subscriptionInfo.originalTransactionId,
          subscriptionInfo.transactionId,
          subscriptionInfo.productId,
          subscriptionInfo.expiresAt,
          subscriptionInfo.subscriptionType,
          userId
        ]
      );
    } else {
      await pool.query(
        `UPDATE users SET 
          subscription_type = ?,
          subscription_expires_at = ?,
          apple_original_transaction_id = ?,
          apple_transaction_id = ?,
          apple_product_id = ?,
          auto_renew = TRUE,
          cancelled_at = NULL
        WHERE id = ?`,
        [
          subscriptionInfo.subscriptionType,
          subscriptionInfo.expiresAt,
          subscriptionInfo.originalTransactionId,
          subscriptionInfo.transactionId,
          subscriptionInfo.productId,
          userId
        ]
      );
    }

    console.log(`✅ User ${userId} subscription updated via Apple IAP: ${subscriptionInfo.subscriptionType} (trial: ${subscriptionInfo.isInTrial})`);

    res.json({
      success: true,
      subscriptionType: subscriptionInfo.subscriptionType,
      expiresAt: subscriptionInfo.expiresAt,
      isInTrial: subscriptionInfo.isInTrial,
    });
  } catch (error) {
    console.error('❌ Error verifying Apple purchase:', error);
    res.status(500).json({ error: 'Error al verificar la compra' });
  }
});

// Get Apple subscription status for a user
router.get('/apple/status/:userId', async (req, res) => {
  console.log('🍎 Apple subscription status request for userId:', req.params.userId);
  
  try {
    const [users] = await pool.query(
      `SELECT subscription_type, subscription_expires_at, 
              apple_original_transaction_id, apple_product_id
       FROM users WHERE id = ?`,
      [req.params.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    
    // If user has Apple subscription, check if still active
    if (user.apple_original_transaction_id) {
      const isActive = user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date();
      
      res.json({
        isActive,
        productId: user.apple_product_id,
        expirationDate: user.subscription_expires_at,
        willRenew: isActive, // We'd need to check with Apple for accurate renewal status
        isInTrial: false, // Would need receipt data to determine this
      });
    } else {
      res.json({
        isActive: false,
        productId: null,
        expirationDate: null,
        willRenew: false,
        isInTrial: false,
      });
    }
  } catch (error) {
    console.error('❌ Error fetching Apple subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

// Apple Server-to-Server Notifications endpoint
// Apple sends notifications here when subscription status changes
router.post('/apple/webhook', async (req, res) => {
  console.log('🍎 Apple S2S Notification received');
  
  try {
    const notification = req.body;
    
    // Log the notification type
    console.log('📨 Notification type:', notification.notification_type);
    
    // Handle different notification types
    switch (notification.notification_type) {
      case 'INITIAL_BUY':
      case 'DID_RENEW':
      case 'DID_RECOVER':
      case 'INTERACTIVE_RENEWAL': {
        // Subscription is active/renewed, update user
        const latestReceipt = notification.unified_receipt?.latest_receipt_info?.[0];
        if (latestReceipt) {
          const originalTransactionId = latestReceipt.original_transaction_id;
          const productId = latestReceipt.product_id;
          const expiresDateMs = parseInt(latestReceipt.expires_date_ms);
          const subscriptionType = APPLE_PRODUCT_IDS[productId] || 'free';
          
          // Find user by Apple transaction ID
          const [users] = await pool.query(
            'SELECT id FROM users WHERE apple_original_transaction_id = ?',
            [originalTransactionId]
          );
          
          if (users.length > 0) {
            const userId = users[0].id;
            await pool.query(
              `UPDATE users SET 
                subscription_type = ?,
                subscription_expires_at = FROM_UNIXTIME(? / 1000),
                auto_renew = TRUE,
                cancelled_at = NULL
              WHERE id = ?`,
              [subscriptionType, expiresDateMs, userId]
            );
            console.log(`✅ User ${userId} subscription renewed via Apple: ${subscriptionType}`);
          }
        }
        break;
      }
      
      case 'DID_CHANGE_RENEWAL_STATUS': {
        // User toggled auto-renewal off/on from App Store settings
        const renewalInfo = notification.unified_receipt?.pending_renewal_info?.[0];
        const latestReceiptRenewal = notification.unified_receipt?.latest_receipt_info?.[0];
        if (renewalInfo && latestReceiptRenewal) {
          const originalTransactionId = latestReceiptRenewal.original_transaction_id;
          const willAutoRenew = renewalInfo.auto_renew_status === '1';
          
          const [users] = await pool.query(
            'SELECT id FROM users WHERE apple_original_transaction_id = ?',
            [originalTransactionId]
          );
          
          if (users.length > 0) {
            const userId = users[0].id;
            await pool.query(
              `UPDATE users SET 
                auto_renew = ?,
                cancelled_at = ?
              WHERE id = ?`,
              [willAutoRenew, willAutoRenew ? null : new Date(), userId]
            );
            console.log(`🔄 User ${userId} Apple auto_renew changed to: ${willAutoRenew}`);
          }
        }
        break;
      }

      case 'CANCEL':
      case 'DID_FAIL_TO_RENEW':
      case 'EXPIRED': {
        // Subscription cancelled or expired
        const latestReceipt = notification.unified_receipt?.latest_receipt_info?.[0];
        if (latestReceipt) {
          const originalTransactionId = latestReceipt.original_transaction_id;
          const expiresDateMs = parseInt(latestReceipt.expires_date_ms);
          const isExpired = expiresDateMs <= Date.now();
          
          // Find user
          const [users] = await pool.query(
            'SELECT id, subscription_type FROM users WHERE apple_original_transaction_id = ?',
            [originalTransactionId]
          );
          
          if (users.length > 0) {
            const userId = users[0].id;
            
            if (isExpired) {
              // Subscription has expired, downgrade to free (keep all data!)
              await pool.query(
                `UPDATE users SET 
                  subscription_type = 'free',
                  auto_renew = FALSE,
                  cancelled_at = COALESCE(cancelled_at, NOW())
                WHERE id = ?`,
                [userId]
              );
              console.log(`⚠️ User ${userId} subscription expired, downgraded to free`);
            } else {
              // Subscription not yet expired, mark as cancelled but keep plan until expiry
              await pool.query(
                `UPDATE users SET 
                  auto_renew = FALSE,
                  cancelled_at = NOW()
                WHERE id = ?`,
                [userId]
              );
              console.log(`⚠️ User ${userId} subscription cancelled, active until ${new Date(expiresDateMs).toISOString()}`);
            }
          }
        }
        break;
      }
      
      case 'REFUND': {
        // User got a refund, revoke access
        const latestReceipt = notification.unified_receipt?.latest_receipt_info?.[0];
        if (latestReceipt) {
          const originalTransactionId = latestReceipt.original_transaction_id;
          
          const [users] = await pool.query(
            'SELECT id FROM users WHERE apple_original_transaction_id = ?',
            [originalTransactionId]
          );
          
          if (users.length > 0) {
            const userId = users[0].id;
            await pool.query(
              `UPDATE users SET 
                subscription_type = 'free',
                subscription_expires_at = NULL
              WHERE id = ?`,
              [userId]
            );
            console.log(`⚠️ User ${userId} subscription refunded, access revoked`);
          }
        }
        break;
      }
      
      default:
        console.log('ℹ️ Unhandled notification type:', notification.notification_type);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing Apple webhook:', error);
    res.status(500).json({ error: 'Failed to process notification' });
  }
});

module.exports = router;
