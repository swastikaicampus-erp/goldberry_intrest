const Plan = require('../models/Plan');

exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { name, price, durationMonths, maxCustomers, features } = req.body;
    if (!name || !price || !durationMonths) {
      return res.status(400).json({ message: 'Name, price, and duration are required.' });
    }
    const exists = await Plan.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: `Plan "${name}" already exists.` });
    }
    const plan = await Plan.create({ name, price, durationMonths, maxCustomers, features });
    res.status(201).json({ message: 'Plan created!', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { name, price, durationMonths, maxCustomers, features, isActive } = req.body;
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });

    if (name !== undefined) plan.name = name;
    if (price !== undefined) plan.price = price;
    if (durationMonths !== undefined) plan.durationMonths = durationMonths;
    if (maxCustomers !== undefined) plan.maxCustomers = maxCustomers;
    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();
    res.json({ message: 'Plan updated!', plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found.' });
    await plan.deleteOne();
    res.json({ message: 'Plan deleted!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};