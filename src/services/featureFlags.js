'use strict';
// Feature Flags - instant enable/disable without deploy
const FLAGS = {
  localBrandRanking: true,
  categoryAwareWeights: true,
  vehicleResolverEnrichment: true,
  impressionTracking: true,
  behaviorSignals: false,  // v4 - data collection phase
  abTesting: false,        // Phase 3 - not ready yet
};

function isEnabled(flag) {
  return FLAGS[flag] === true;
}

module.exports = { isEnabled, FLAGS };
