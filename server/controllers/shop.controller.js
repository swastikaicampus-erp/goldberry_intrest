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
    res.json({ 
      message: `Shop ${shop.isActive ? 'activate' : 'deactivate'} ho gayi`, 
      isActive: shop.isActive 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Edit Shop
exports.updateShop = async (req, res) => {
  try {
    const { shopName, ownerName, phone, email, address, city, state, pincode, gstNumber, planId } = req.body;

    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop nahi mili' });

    // Plan change hua hai to expiry recalculate karo
    if (planId && planId !== shop.plan?.toString()) {
      const plan = await Plan.findById(planId);
      if (!plan) return res.status(404).json({ message: 'Plan nahi mila' });
      shop.plan = plan._id;
      shop.planPurchasedAt = new Date();
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + plan.durationMonths);
      shop.planExpiresAt = expiry;
    }

    // Fields update karo
    if (shopName)  shop.shopName  = shopName;
    if (ownerName) shop.ownerName = ownerName;
    if (phone)     shop.phone     = phone;
    if (email)     shop.email     = email;
    if (address)   shop.address   = address;
    if (city)      shop.city      = city;
    if (state)     shop.state     = state;
    if (pincode)   shop.pincode   = pincode;
    if (gstNumber !== undefined) shop.gstNumber = gstNumber;

    await shop.save();

    const updated = await Shop.findById(shop._id).populate('plan').select('-password');
    res.json({ message: 'Shop update ho gayi!', shop: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete Shop
exports.deleteShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop nahi mili' });

    await shop.deleteOne();
    res.json({ message: 'Shop delete ho gayi!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// =========================================================================
// ── SHOP OWNER PROFILE APIS (For Shop User) ──────────────────────────────
// =========================================================================

// 1. Get Own Profile
exports.getOwnProfile = async (req, res) => {
  try {
    const shop = await Shop.findById(req.user._id).populate('plan').select('-password');
    if (!shop) return res.status(404).json({ message: 'Shop nahi mili' });
    res.json(shop);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. Update Own Profile (Sirf basic details, plan ya loginId nahi)
exports.updateOwnProfile = async (req, res) => {
  try {
    const { shopName, ownerName, phone, email, address, city, state, pincode, gstNumber } = req.body;
    
    const shop = await Shop.findById(req.user._id);
    if (!shop) return res.status(404).json({ message: 'Shop nahi mili' });

    if (shopName) shop.shopName = shopName;
    if (ownerName) shop.ownerName = ownerName;
    if (phone) shop.phone = phone;
    if (email) shop.email = email;
    if (address) shop.address = address;
    if (city) shop.city = city;
    if (state) shop.state = state;
    if (pincode) shop.pincode = pincode;
    if (gstNumber !== undefined) shop.gstNumber = gstNumber;

    await shop.save();

    const updated = await Shop.findById(shop._id).populate('plan').select('-password');
    res.json({ message: 'Profile updated successfully!', shop: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. Change Password
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old aur New password dono daalna zaroori hai.' });
    }

    const shop = await Shop.findById(req.user._id);
    
    // Check if old password matches
    const isMatch = await shop.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password galat hai.' });
    }

    // Set new password (pre-save hook isko automatically hash kar dega)
    shop.password = newPassword;
    await shop.save();

    res.json({ message: 'Password successfully change ho gaya!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};