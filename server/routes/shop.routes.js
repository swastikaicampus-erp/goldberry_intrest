const express = require('express');
const router = express.Router();
const {
  createShop,
  getAllShops,
  toggleShopStatus,
  updateShop,
  deleteShop,
  getOwnProfile,      
  updateOwnProfile,   
  changePassword      
} = require('../controllers/shop.controller');

const { protect, adminOnly, shopOnly } = require('../middleware/auth.middleware');

// ==========================================
// 🟢 SHOP OWNER ROUTES (For Logged In Shop)
// ==========================================
// Yahan humne `shopOnly` middleware lagaya hai
router.get('/profile/me', protect, shopOnly, getOwnProfile);
router.put('/profile/me', protect, shopOnly, updateOwnProfile);
router.post('/profile/change-password', protect, shopOnly, changePassword);


// ==========================================
// 🔴 ADMIN ROUTES (For Super Admin)
// ==========================================
router.post('/create', protect, adminOnly, createShop);
router.get('/', protect, adminOnly, getAllShops);
router.patch('/:id/toggle', protect, adminOnly, toggleShopStatus);
router.put('/:id', protect, adminOnly, updateShop);
router.delete('/:id', protect, adminOnly, deleteShop);

module.exports = router;