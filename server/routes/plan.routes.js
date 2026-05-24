const express = require('express');
const router = express.Router();
const { getPlans, createPlan, updatePlan, deletePlan } = require('../controllers/plan.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.get('/', protect, getPlans);
router.post('/', protect, adminOnly, createPlan);
router.put('/:id', protect, adminOnly, updatePlan);
router.delete('/:id', protect, adminOnly, deletePlan);

module.exports = router;