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

// Get user's subscription
router.get('/:userId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT subscription_type, subscription_expires_at, stripe_customer_id, stripe_subscription_id 
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

    res.json({
      type: user.subscription_type || 'free',
      expiresAt: user.subscription_expires_at,
      stripeCustomerId: user.stripe_customer_id,
      stripeSubscriptionId: user.stripe_subscription_id,
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Update subscription type (for manual updates or webhook handling)
router.put('/:userId', async (req, res) => {
  try {
    const { subscription_type, expires_at, stripe_customer_id, stripe_subscription_id } = req.body;
    
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
    res.json({ message: 'Subscription updated' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
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
    const { userId, priceId, platform } = req.body;

    if (!userId || !priceId) {
      return res.status(400).json({ error: 'userId y priceId son requeridos' });
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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
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
      },
    });

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

        // Update user subscription
        await pool.query(
          `UPDATE users SET 
            subscription_type = ?, 
            subscription_expires_at = FROM_UNIXTIME(?),
            stripe_subscription_id = ?
          WHERE id = ?`,
          [subscriptionType, subscription.current_period_end, subscriptionId, userId]
        );
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
  if (!stripe) {
    return res.status(503).json({ error: 'Payment service not available' });
  }

  try {
    const [users] = await pool.query(
      'SELECT stripe_subscription_id FROM users WHERE id = ?',
      [req.params.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionId = users[0].stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    // Cancel at period end (user can use until expiration)
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.json({ message: 'Subscription will be cancelled at period end' });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
