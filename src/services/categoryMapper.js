'use strict';

// Autodoc categoryName → ჩვენი category slug
const CATEGORY_MAP = {
  // სამუხრუჭე სისტემა
  'Brake Pad Set': 'brakes',
  'Brake Lining/Shoe': 'brakes',
  'Brake Disc': 'brake-discs',
  'Brake Caliper': 'brake-caliper',
  'Brake Master Cylinder': 'brakes',
  'Brake Hose': 'brakes',
  'Brake Drum': 'brakes',

  // ფილტრები
  'Oil Filter': 'oil-filter',
  'Air Filter': 'air-filter',
  'Fuel Filter': 'fuel-filter',
  'Cabin Filter': 'cabin-filter',
  'Filter Set': 'oil-filter',

  // სავალი ნაწილები
  'Shock Absorber': 'shock-absorber',
  'Coil Spring': 'coil-spring',
  'Control Arm': 'control-arm',
  'Ball Joint': 'ball-joint',
  'Stabilizer Link': 'stabilizer-link',
  'Wheel Bearing': 'wheel-bearing',
  'Wheel Hub': 'wheel-hub',
  'Tie Rod End': 'tie-rod-end',
  'Bushing': 'bushing',
  'CV Joint': 'cv-joint',
  'CV Boot': 'cv-boot',

  // გადამცემი
  'Timing Belt': 'driveshaft',
  'Timing Chain': 'timing-chain',
  'Belt Tensioner': 'belt-tensioner',
  'V-Belt': 'driveshaft',
  'Poly V-Belt': 'driveshaft',

  // ძრავი
  'Water Pump': 'water-pump',
  'Thermostat': 'thermostat',
  'Oil Pump': 'oil-pump',
  'Spark Plug': 'spark-plug',
  'Ignition Coil': 'ignition-coil',
  'Starter': 'starter',
  'Alternator': 'alternator',
  'Turbocharger': 'turbocharger',
  'Injection Pump': 'farsonka',
  'Injector': 'farsonka',
  'Gasket': 'gasket',
  'Oil Seal': 'oil-seal',

  // გაგრილება
  'Radiator': 'radiator',
  'Oil Cooler': 'oil-cooler',

  // საჭე
  'Steering Link': 'steering-link',
  'Power Steering Pump': 'steering',

  // გადაბმულობა
  'Clutch Kit': 'clutch',
  'Clutch Release Bearing': 'clutch-release-bearing',

  // ელექტრო
  'Lambda Sensor': 'electrics',
  'ABS Sensor': 'electrics',
  'Lighting': 'lighting',

  // ზეთები
  'Engine Oil': 'engine-oil',
  'Antifreeze': 'antifreeze',
};

function mapCategory(autodocCategoryName) {
  if (!autodocCategoryName) return null;
  
  // ზუსტი match
  if (CATEGORY_MAP[autodocCategoryName]) return CATEGORY_MAP[autodocCategoryName];
  
  // partial match
  const lower = autodocCategoryName.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return val;
    }
  }
  return null;
}

module.exports = { mapCategory };
