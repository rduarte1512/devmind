const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  flash: {
    name: 'DevMind Flash',
    price: 900, // €9.00
    currency: 'eur',
  },
  performance: {
    name: 'DevMind Performance',
    price: 1900, // €19.00
    currency: 'eur',
  },
  ultra: {
    name: 'DevMind Ultra',
    price: 3900, // €39.00
    currency: 'eur',
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan } = req.body;
  const planDetails = PLANS[plan];

  if (!planDetails) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  try {
    const domain = process.env.APP_URL || `http://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: planDetails.currency,
            product_data: {
              name: planDetails.name,
            },
            unit_amount: planDetails.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${domain}/success.html`,
      cancel_url: `${domain}/`,
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ error: error.message });
  }
};
