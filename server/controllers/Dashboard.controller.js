const Shop = require('../models/Shop');
const Plan = require('../models/Plan');

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Basic counts ──────────────────────────────────────────────────────
    const [totalShops, activeShops, newThisMonth] = await Promise.all([
      Shop.countDocuments(),
      Shop.countDocuments({ isActive: true }),
      Shop.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    // ── Expiring shops (already expired + expiring in 30 days) ───────────
    const expiringShopsDocs = await Shop.find({ planExpiresAt: { $lte: thirtyDaysLater } })
      .populate('plan', 'name')
      .select('shopName city planExpiresAt plan loginId')
      .sort({ planExpiresAt: 1 })
      .limit(10)
      .lean();

    const expiringShops = expiringShopsDocs.map((shop) => {
      const diff = Math.ceil((new Date(shop.planExpiresAt) - now) / (1000 * 60 * 60 * 24));
      return {
        _id: shop._id,
        shopName: shop.shopName,
        city: shop.city,
        planName: shop.plan?.name || '—',
        loginId: shop.loginId,
        planExpiresAt: shop.planExpiresAt,
        daysLeft: diff,
      };
    });

    // ── All plans from DB ─────────────────────────────────────────────────
    const plans = await Plan.find().select('name price').lean();
    const planMap = {};
    plans.forEach((p) => { planMap[p._id.toString()] = p; });

    // ── Plan distribution (simple group, no lookup needed) ────────────────
    const planDistRaw = await Shop.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const planDistribution = planDistRaw
      .filter((d) => d._id) // skip null plan shops
      .map((d) => {
        const plan = planMap[d._id.toString()] || {};
        return {
          planId: d._id,
          planName: plan.name || 'Unknown',
          count: d.count,
          revenue: (plan.price || 0) * d.count,
        };
      })
      .sort((a, b) => a.planName.localeCompare(b.planName));

    // ── Total revenue: sum plan prices for all shops that have a plan ─────
    const totalRevenue = planDistribution.reduce((sum, p) => sum + p.revenue, 0);

    // ── Monthly revenue: shops purchased this month ───────────────────────
    const monthlyShops = await Shop.find({ planPurchasedAt: { $gte: startOfMonth } })
      .select('plan')
      .lean();

    const monthlyRevenue = monthlyShops.reduce((sum, shop) => {
      const plan = planMap[shop.plan?.toString()];
      return sum + (plan?.price || 0);
    }, 0);

    // ── Recent shops ──────────────────────────────────────────────────────
    const recentShops = await Shop.find()
      .populate('plan', 'name price')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      stats: {
        totalShops,
        activeShops,
        inactiveShops: totalShops - activeShops,
        newThisMonth,
        expiringCount: expiringShops.length,
        totalRevenue,
        monthlyRevenue,
      },
      planDistribution,
      expiringShops,
      recentShops,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: err.message });
  }
};