const Shop = require('../models/Shop');
const Plan = require('../models/Plan');

// Generate unique login ID like GG-SHOP-2024-XXXX
const generateLoginId = () => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GG-${year}-${rand}`;
};

// Generate random password
const generatePassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
};

exports.createShop = async (req, res) => {
  try {
    const { shopName, ownerName, phone, email, address, city, state, pincode, gstNumber, planId } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) return res.status(404).json({ message: 'Plan nahi mila' });

    // Unique login ID generate karo
    let loginId;
    let exists = true;
    while (exists) {
      loginId = generateLoginId();
      exists = await Shop.findOne({ loginId });
    }
    const rawPassword = generatePassword();

    const planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + plan.durationMonths);

    const shop = await Shop.create({
      shopName, ownerName, phone, email, address, city, state,
      pincode, gstNumber, loginId, password: rawPassword,
      plan: plan._id, planPurchasedAt: new Date(), planExpiresAt
    });

    // Password raw return karo (sirf ek baar dikhega)
    res.status(201).json({
      message: 'Shop successfully create ho gayi!',
      credentials: { loginId, password: rawPassword },
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        ownerName: shop.ownerName,
        plan: plan.name,
        planExpiresAt: shop.planExpiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find().populate('plan').select('-password');
    res.json(shops);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.toggleShopStatus = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop nahi mili' });
    shop.isActive = !shop.isActive;
    await shop.save();
    res.json({ message: `Shop ${shop.isActive ? 'activate' : 'deactivate'} ho gayi`, isActive: shop.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};