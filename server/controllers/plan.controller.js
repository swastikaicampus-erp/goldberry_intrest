const Plan = require('../models/Plan');

exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.seedPlans = async () => {
  const count = await Plan.countDocuments();
  if (count === 0) {
    await Plan.insertMany([
      {
        name: 'Basic',
        price: 999,
        durationMonths: 1,
        maxCustomers: 50,
        features: ['50 Customers', '1 Month Validity', 'Basic Reports', 'Print Receipt']
      },
      {
        name: 'Standard',
        price: 2499,
        durationMonths: 3,
        maxCustomers: 200,
        features: ['200 Customers', '3 Months Validity', 'Analytics Dashboard', 'Print Receipt', 'SMS Alerts', 'Photo Upload']
      },
      {
        name: 'Premium',
        price: 4999,
        durationMonths: 6,
        maxCustomers: 99999,
        features: ['Unlimited Customers', '6 Months Validity', 'Full Analytics', 'Print Receipt', 'SMS Alerts', 'Photo Upload', 'Data Export', 'Priority Support']
      }
    ]);
    console.log('Plans seeded');
  }
};