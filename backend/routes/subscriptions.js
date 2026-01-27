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
              trial_used, trial_started_at, trial_ends_at, trial_plan_type
       FROM users WHERE id = ?`,
      [req.params.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    
    // Check if subscription has expired
    if (user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
      // Subscription expired, downgrade to free
      await pool.query(
        'UPDATE users SET subscription_type = ? WHERE id = ?',
        ['free', req.params.userId]
      );
      user.subscription_type = 'free';
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
    
    res.json({
      type: user.subscription_type || 'free',
      expiresAt: user.subscription_expires_at,
      stripeCustomerId: user.stripe_customer_id,
      stripeSubscriptionId: user.stripe_subscription_id,
      cancelAtPeriodEnd: cancelAtPeriodEnd,
      trialUsed: user.trial_used === 1,
      activeTrial: activeTrial,
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
    const { userId, priceId, platform, withTrial, deviceId } = req.body;

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

    // Build checkout session options
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

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;
        
        // Determine subscription type from price ID
        let subscriptionType = 'free';
        if (priceId === PRICE_IDS.basic) {
          subscriptionType = 'basic';
        } else if (priceId === PRICE_IDS.pro) {
          subscriptionType = 'pro';
        }
        
        // If this was a trial checkout, record trial usage
        if (withTrial && deviceId && subscription.trial_end) {
          console.log(`🎁 Recording trial usage for user ${userId}, device ${deviceId}`);
          await recordTrialUsage(userId, deviceId, subscriptionType);
        }

        // Update user subscription
        await pool.query(
          `UPDATE users SET 
            subscription_type = ?, 
            subscription_expires_at = FROM_UNIXTIME(?),
            stripe_subscription_id = ?
          WHERE id = ?`,
          [subscriptionType, subscription.current_period_end, subscriptionId, userId]
        );
        
        console.log(`✅ Subscription activated for user ${userId}: ${subscriptionType}${withTrial ? ' (with trial)' : ''}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by Stripe customer ID
        const [users] = await pool.query(
          'SELECT id FROM users WHERE stripe_customer_id = ?',
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
          }

          await pool.query(
            `UPDATE users SET 
              subscription_type = ?, 
              subscription_expires_at = FROM_UNIXTIME(?)
            WHERE id = ?`,
            [subscriptionType, subscription.current_period_end, userId]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Downgrade to free
        await pool.query(
          `UPDATE users SET 
            subscription_type = 'free', 
            subscription_expires_at = NULL,
            stripe_subscription_id = NULL
          WHERE stripe_customer_id = ?`,
          [customerId]
        );
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
      'SELECT stripe_subscription_id, stripe_customer_id, subscription_type FROM users WHERE id = ?',
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
      type: user.subscription_type 
    });

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
        'UPDATE users SET subscription_type = ?, subscription_expires_at = NULL, stripe_subscription_id = NULL WHERE id = ?',
        ['free', req.params.userId]
      );
      return res.json({ message: 'Subscription cancelled (no active Stripe subscription found)' });
    }

    // Cancel at period end (user can use until expiration)
    console.log('🚫 Cancelling subscription:', subscriptionId);
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    console.log('✅ Subscription marked for cancellation at period end');
    res.json({ message: 'Subscription will be cancelled at period end' });
  } catch (error) {
    console.error('❌ Error cancelling subscription:', error.message);
    res.status(500).json({ error: 'Failed to cancel subscription', details: error.message });
  }
});

module.exports = router;
