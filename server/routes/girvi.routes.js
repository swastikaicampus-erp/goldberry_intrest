const router = require('express').Router();

const { protect, shopOnly } = require('../middleware/auth.middleware');
const { girviUpload } = require('../middleware/Upload.middleware');

const {
  createGirvi,
  getGirviRecords,
  getGirvi,
  updateGirvi,
  deleteGirvi,
  calculateInterest,
  settleGirvi,
  partialPayment,
  getOverdueRecords,
  getClosedRecords,
} = require('../controllers/Girvi.controller');

router.use(protect, shopOnly);

router.post('/', girviUpload, createGirvi);
router.get('/', getGirviRecords);
router.get('/overdue', getOverdueRecords);
router.get('/closed', getClosedRecords);
router.get('/:id', getGirvi);
router.get('/:id/interest', calculateInterest);
router.put('/:id', girviUpload, updateGirvi);   // ← new
router.delete('/:id', deleteGirvi);                // ← new
router.patch('/:id/settle', settleGirvi);
router.patch('/:id/partial', partialPayment);

module.exports = router;