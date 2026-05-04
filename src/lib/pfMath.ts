/**
 * Utility for Power Factor Correction calculations.
 * Formula: kVAr = kW * (Tan(Φ1) - Tan(Φ2))
 * Where:
 * Φ1 = arccos(Current PF)
 * Φ2 = arccos(Target PF)
 */

export const TARGET_PF_OPTIONS = [0.90, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1.00];

export const calculateKVArCorrection = (currentPF: number, targetPF: number, loadKW: number) => {
  if (currentPF >= targetPF) return { factorF: 0, requiredKVAr: 0 };
  
  // Convert PF to Radians using arccos (cos phi -> phi)
  const phi1 = Math.acos(currentPF);
  const phi2 = Math.acos(targetPF);
  
  // Calculate Tan of angles
  const tanPhi1 = Math.tan(phi1);
  const tanPhi2 = Math.tan(phi2);
  
  // Step 3: kW * (tan phi1 - tan phi2)
  const rawFactorF = tanPhi1 - tanPhi2;
  // Commercial/Engineering charts often use 4-decimal truncation for precision matching
  const factorF = Math.floor(rawFactorF * 10000) / 10000;
  const requiredKVAr = loadKW * factorF;
  
  return {
    factorF: factorF,
    requiredKVAr: requiredKVAr
  };
};

/**
 * Finds the specific PF value from the "Current Power Factor" column.
 * Engineering charts typically use truncation (step down) rather than rounding.
 * Example: 0.805 -> 0.80
 */
export const getNearestStandardPF = (pf: number) => {
  // Clamp between 0.50 and 0.99 which is common for charts
  const clamped = Math.max(0.5, Math.min(0.99, pf));
  // Use floor to ensure 0.805 becomes 0.80 (truncation to 2 decimal places)
  return Math.floor(clamped * 100) / 100;
};
