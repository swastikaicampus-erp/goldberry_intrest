const express = require('express');
const router = express.Router();
const { getPlans, seedPlans } = require('../controllers/plan.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

seedPlans(); // Auto seed on startup

router.get('/', protect, getPlans);

module.exports = router;