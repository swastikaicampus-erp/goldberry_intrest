const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Shop = require('../models/Shop');
const bcrypt = require('bcryptjs');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Seed master admin (ek baar chalao)
const seedAdmin = async () => {
  const exists = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  if (!exists) {
    await Admin.create({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log('Master Admin created');
  }
};
seedAdmin();


// const seedTestShop = async () => {
//   const exists = await Shop.findOne({ loginId: 'SHOP-TEST-001' });
//   if (!exists) {
//     await Shop.create({
//       shopName: 'Shree Ganesh Jewellers',
//       ownerName: 'Ramesh Gupta',
//       phone: '9876543210',
//       address: 'Main Bazaar',
//       city: 'Bhopal',
//       state: 'MP',
//       pincode: '462001',
//       loginId: 'SHOP-TEST-001',
//       password: 'Shop@123',   // raw do — pre-save hook hash karega
//       isActive: true,
//     });
//     console.log('✅ Test Shop created: SHOP-TEST-001 / Shop@123');
//   }
// };
// seedTestShop();

// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({ message: 'Email ya password galat hai' });
    }
    const token = generateToken(admin._id, 'master_admin');
    res.json({ token, role: 'master_admin', email: admin.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Shop Login
exports.shopLogin = async (req, res) => {
  try {
    const { loginId, password } = req.body;
    const shop = await Shop.findOne({ loginId }).populate('plan');
    if (!shop || !(await shop.matchPassword(password))) {
      return res.status(401).json({ message: 'Login ID ya password galat hai' });
    }
    if (!shop.isActive) {
      return res.status(403).json({ message: 'Aapki shop inactive hai' });
    }
    const token = generateToken(shop._id, 'shop');
    res.json({
      token,
      role: 'shop',
      shop: {
        id: shop._id,
        shopName: shop.shopName,
        ownerName: shop.ownerName,
        loginId: shop.loginId,
        plan: shop.plan,
        planExpiresAt: shop.planExpiresAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};