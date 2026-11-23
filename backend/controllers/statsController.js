const { asyncHandler } = require('../utils/helpers');
const { dashboardData, analyticsData } = require('../services/dbStats');

exports.dashboard = asyncHandler(async (req, res) => res.json(await dashboardData()));
exports.analytics = asyncHandler(async (req, res) => res.json(await analyticsData()));
