const Shop = require('../models/Shop');
const Plan = require('../models/Plan');
const crypto = require('crypto');

// Generate unique login ID like GG-SHOP-2024-XXXX
const generateLoginId = () => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GG-${year}-${rand}`;
};



// ── Password generator ────────────────────────────────────────────────────────
// e.g. "Shop@4Kx9mZ"  — uppercase + lowercase + digit + symbol, 10 chars
const generatePassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$!';

  const rand = (str) => str[crypto.randomInt(str.length)];

  // Guarantee at least one of each type
  const required = [rand(upper), rand(lower), rand(digits), rand(symbols)];

  const all = upper + lower + digits + symbols;
  const rest = Array.from({ length: 6 }, () => rand(all));

  // Shuffle combined array
  return [...required, ...rest]
    .sort(() => crypto.randomInt(3) - 1)
    .join('');
};

// ── Create Shop ───────────────────────────────────────────────────────────────
// POST /api/admin/shops
exports.createShop = async (req, res) => {
  try {
    const {
      shopName, ownerName, phone, email,
      address, city, state, pincode,
      gstNumber, plan, planPurchasedAt, planExpiresAt,
    } = req.body;

    // ✅ Email required hai — loginId bhi wahi banega
    if (!email) {
      return res.status(400).json({ message: 'Email is required to create a shop.' });
    }

    // ✅ Duplicate check — email/loginId dono same hain
    const existing = await Shop.findOne({ loginId: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'A shop with this email already exists.' });
    }

    // ✅ Auto-generate password
    const plainPassword = generatePassword();

    const shop = await Shop.create({
      shopName,
      ownerName,
      phone,
      email: email.toLowerCase().trim(),
      loginId: email.toLowerCase().trim(), // ✅ Email = LoginId
      password: plainPassword,              // model ka pre-save hook hash karega
      address,
      city,
      state,
      pincode,
      gstNumber,
      plan: plan || undefined,
      planPurchasedAt: planPurchasedAt || undefined,
      planExpiresAt: planExpiresAt || undefined,
    });

    // ✅ Plain password response mein bhejo (admin ko dikhao / share karo)
    res.status(201).json({
      message: 'Shop created successfully.',
      loginId: shop.loginId,
      password: plainPassword,   // sirf ek baar milega — save kar lo!
      shop: {
        _id: shop._id,
        shopName: shop.shopName,
        ownerName: shop.ownerName,
        phone: shop.phone,
        email: shop.email,
        loginId: shop.loginId,
        city: shop.city,
        isActive: shop.isActive,
        createdAt: shop.createdAt,
      },
    });
  } catch (err) {
    console.error('createShop error:', err);
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