const router = require('express').Router();
const { protect, shopOnly } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const {
  createGirvi,
  getGirviRecords,
  getGirvi,
  calculateInterest,
  settleGirvi,
  partialPayment,
  getOverdueRecords,
} = require('../controllers/girvi.controller');

router.use(protect, shopOnly);

router.post('/', upload.fields([{ name: 'photos', maxCount: 4 }]), createGirvi);
router.get('/', getGirviRecords);
router.get('/overdue', getOverdueRecords);
router.get('/:id', getGirvi);
router.get('/:id/interest', calculateInterest);
router.patch('/:id/settle', settleGirvi);
router.patch('/:id/partial', partialPayment);

module.exports = router;