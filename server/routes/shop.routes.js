const express = require('express');
const router = express.Router();
const { 
  createShop, 
  getAllShops, 
  toggleShopStatus,
  updateShop,   
  deleteShop    
} = require('../controllers/shop.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/create', protect, adminOnly, createShop);
router.get('/', protect, adminOnly, getAllShops);
router.patch('/:id/toggle', protect, adminOnly, toggleShopStatus);
router.put('/:id', protect, adminOnly, updateShop);       
router.delete('/:id', protect, adminOnly, deleteShop);   // ✅ Delete

module.exports = router;