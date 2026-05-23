const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { createShop, getAllShops, toggleShopStatus } = require('../controllers/shop.controller');
const { getDashboardStats } = require('../controllers/Dashboard.controller');

// ── Admin Dashboard ──────────────────────────────────────────────────────────
router.get('/dashboard', protect, adminOnly, getDashboardStats);

// ── Shop Routes ──────────────────────────────────────────────────────────────
router.post('/shops', protect, adminOnly, createShop);
router.get('/shops', protect, adminOnly, getAllShops);
router.patch('/shops/:id/toggle', protect, adminOnly, toggleShopStatus);

module.exports = router;