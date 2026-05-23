const express = require('express');
const router = express.Router();
const { createShop, getAllShops, toggleShopStatus } = require('../controllers/shop.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/create', protect, adminOnly, createShop);
router.get('/', protect, adminOnly, getAllShops);
router.patch('/:id/toggle', protect, adminOnly, toggleShopStatus);

module.exports = router;