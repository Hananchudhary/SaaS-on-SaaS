const fs = require('fs/promises');
const path = require('path');
const { ErrorCodes, createErrorResponse } = require('../middleware/error_handling');

const getSystemPlans = async (req, res) => {
  try {
    const configPath = path.resolve(__dirname, '..', '..', 'config.json');
    const rawConfig = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(rawConfig);

    const plans = Array.isArray(config.plans) ? config.plans : [];
    const responsePlans = plans
      .map((plan, index) => ({
        id: plan.plan_id ?? index + 1,
        name: plan.plan_name,
        price: plan.monthly_price,
        description: plan.description || '',
        tier_1_users: plan.tier_1_users,
        tier_2_users: plan.tier_2_users,
        tier_3_users: plan.tier_3_users,
        client_id: plan.client_id
      }))
      .filter((plan) => plan.name);

    return res.status(200).json({
      success: true,
      data: { plans: responsePlans }
    });
  } catch (error) {
    console.error('[SystemPlans] Error:', error);
    return res.status(500).json(createErrorResponse(ErrorCodes.UNKNOWN_ERROR));
  }
};

module.exports = {
  getSystemPlans
};
