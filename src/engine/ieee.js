import { FORMATS as MX_FORMATS } from "@/engine/constants";
import { FormatDefinition } from "@/engine/FormatDefinition";

export const FORMATS = Object.fromEntries(
  Object.entries(MX_FORMATS).map(([key, info]) => [key, new FormatDefinition(info)])
);

export function extract(spec, bits) {
  const nbits = Number(bits);
  const sign = spec.extractSign(nbits);
  const exponent = spec.extractExponent(nbits);
  const mantissa = spec.extractMantissa(nbits);
  return { sign, exponent, significand: BigInt(mantissa) };
}

/* 
 * ---------------------------------
 * Bits to Value Section
 * ---------------------------------  
 */

export function composeBits(spec, d) {
  // build a number bit pattern via FormatDefinition conventions
  const sign = (d.sign ? 1 : 0) & 1;
  const exponent = Math.max(0, Math.min((1 << spec.exponentBits) - 1, d.exponent >>> 0));
  const mantissaMask = (1n << BigInt(spec.mantissaBits)) - 1n;
  const mantissa = (d.significand & mantissaMask);

  const expShift = BigInt(spec.mantissaBits);
  const signShift = BigInt(spec.totalBits - 1);

  const bits = (BigInt(sign) << signShift) | (BigInt(exponent) << expShift) | mantissa;
  return bits;
}

export function bitsToValue(spec, bits) {
  const nbits = Number(bits);
  return spec.bitsToValue(nbits);
}

export function bitsToRawHex(spec, bits) {
  const hexDigits = Math.ceil(spec.totalBits / 4);
  const hex = bits.toString(16);
  return '0x' + hex.padStart(hexDigits, '0');
}

export function bitsToRawDecimal(bits) {
  return bits.toString(10);
}

export function bitsToArray(spec, bits) {
  const out = [];
  for (let i = spec.totalBits - 1; i >= 0; i--) {
    out.push(Number((bits >> BigInt(i)) & 1n));
  }
  return out;
}

export function bitsToHexFloat(spec, bits) {
  const { sign, exponent, significand } = extract(spec, bits);
  const bias = spec.exponentBias;
  const signPrefix = sign ? '-0x' : '0x';
  const maxExp = (1 << spec.exponentBits) - 1;
  // Only treat as NaN if the format supports NaN AND exponent is all ones
  // For formats without special values, max exponent is valid for normal numbers
  if ((spec.hasNaN || spec.hasInfinity) && exponent === maxExp) {
    // Check if it's actually NaN (non-zero mantissa) or infinity (zero mantissa)
    if (spec.hasNaN && significand !== 0n) {
      return 'nan';
    }
    if (spec.hasInfinity && significand === 0n) {
      return signPrefix + 'inf';
    }
    // If format supports NaN but this isn't the NaN pattern, still treat as NaN
    if (spec.hasNaN) {
      return 'nan';
    }
  }
  if (exponent === 0) {
    const fracHex = fractionToHex(spec.mantissaBits, significand);
    return signPrefix + '0.' + fracHex + 'p' + (1 - bias).toString();
  }
  const full = (1n << BigInt(spec.mantissaBits)) | significand;
  const fracHex = fractionToHex(spec.mantissaBits, full & ((1n << BigInt(spec.mantissaBits)) - 1n));
  return signPrefix + '1.' + fracHex + 'p' + (exponent - bias).toString();
}

function fractionToHex(mantissaBits, mantissa) {
  const needed = Math.ceil(mantissaBits / 4);
  const padBits = needed * 4 - mantissaBits;
  const value = mantissa << BigInt(padBits);
  let s = value.toString(16).padStart(needed, '0');
  s = s.replace(/0+$/g, '');
  return s || '0';
}

/* 
 * ---------------------------------
 * Value to Bits Section
 * ---------------------------------  
 */

// Convert a JavaScript number to the closest representable bit pattern for the given spec
export function valueToBits(spec, x) {
  if (Number.isNaN(x)) {
    // Produce a NaN encoding if supported; otherwise return zero
    const allOnesExp = (1 << spec.exponentBits) - 1;
    if (spec.hasNaN) {
      // For formats with explicit NaN patterns, set all mantissa bits to match the pattern
      // Otherwise, use a non-zero mantissa value
      const nanSig = spec.mantissaBits > 0 ? ((1n << BigInt(spec.mantissaBits)) - 1n) : 0n;
      return composeBits(spec, { sign: 0, exponent: allOnesExp, significand: nanSig });
    }
    return 0n;
  }

  if (!Number.isFinite(x)) {
    const sign = x < 0 ? 1 : 0;
    const allOnesExp = (1 << spec.exponentBits) - 1;
    if (spec.hasInfinity) {
      return composeBits(spec, { sign, exponent: allOnesExp, significand: 0n });
    }
    // Clamp to max finite normal for formats without infinity
    const maxFiniteExp = allOnesExp - 1;
    const maxSig = (1n << BigInt(spec.mantissaBits)) - 1n;
    return composeBits(spec, { sign, exponent: maxFiniteExp, significand: maxSig });
  }

  // Handle signed zeros
  if (Object.is(x, 0) || Object.is(x, -0)) {
    const sign = Object.is(x, -0) ? 1 : 0;
    return composeBits(spec, { sign, exponent: 0, significand: 0n });
  }

  const sign = x < 0 ? 1 : 0;
  const ax = Math.abs(x);

  const bias = spec.exponentBias;
  const mBits = spec.mantissaBits;
  const eBits = spec.exponentBits;
  const maxExp = (1 << eBits) - 1;
  // For formats with infinity, the maximum exponent is reserved for special values
  // For formats with NaN but not infinity, the maximum exponent is valid for normal numbers
  // unless the mantissa would create a NaN pattern
  const maxFiniteExp = spec.hasInfinity ? maxExp - 1 : maxExp;

  // Threshold for smallest normal: 2^(1-bias)
  const smallestNormal = Math.pow(2, 1 - bias);

  if (ax < smallestNormal) {
    // Subnormal: value = 2^(1-bias) * (mantissa / 2^mBits)
    const scale = Math.pow(2, 1 - bias - mBits);
    // Round to nearest even by using Math.round; JS uses ties to +Infinity, which is fine here
    let mantissa = Math.round(ax / scale);
    if (mantissa <= 0) {
      return composeBits(spec, { sign, exponent: 0, significand: 0n });
    }
    const maxMantissa = (1 << mBits) - 1;
    if (mantissa > maxMantissa) {
      // Rounded up past subnormal range -> smallest normal
      mantissa = maxMantissa;
    }
    return composeBits(spec, { sign, exponent: 0, significand: BigInt(mantissa) });
  }

  // Normal numbers
  let exp = Math.floor(Math.log2(ax));
  let frac = ax / Math.pow(2, exp); // in [1, 2)
  let mantissa = Math.round((frac - 1) * Math.pow(2, mBits));

  // Handle rounding that bumps mantissa to 2^m -> increment exponent
  const oneULP = 1 << mBits;
  if (mantissa === oneULP) {
    mantissa = 0;
    exp += 1;
  }

  let expRaw = exp + bias;
  if (expRaw >= maxExp) {
    // Overflow to infinity if supported
    if (spec.hasInfinity) {
      return composeBits(spec, { sign, exponent: maxExp, significand: 0n });
    }
    // For formats with NaN but not infinity, check if this pattern would be NaN
    if (expRaw === maxExp && spec.hasNaN) {
      const testBits = composeBits(spec, { sign, exponent: maxExp, significand: BigInt(mantissa) });
      if (spec.isNaN(Number(testBits))) {
        // This pattern would be NaN, clamp to maxFiniteExp
        return composeBits(spec, { sign, exponent: maxFiniteExp, significand: (1n << BigInt(mBits)) - 1n });
      }
      // This pattern is valid, use maxExp
      return testBits;
    }
    // Clamp to max finite for other cases
    return composeBits(spec, { sign, exponent: maxFiniteExp, significand: (1n << BigInt(mBits)) - 1n });
  }

  if (expRaw <= 0) {
    // Fell into subnormal due to very small value after rounding
    // Represent as subnormal
    const scale = Math.pow(2, 1 - bias - mBits);
    const subMantissa = Math.round(ax / scale);
    const clamped = Math.max(0, Math.min((1 << mBits) - 1, subMantissa));
    return composeBits(spec, { sign, exponent: 0, significand: BigInt(clamped) });
  }

  return composeBits(spec, { sign, exponent: expRaw, significand: BigInt(mantissa) });
}


/* 
 * ---------------------------------
 * Clamping Section
 * ---------------------------------  
 */

export function maxValues(spec) {
  const maxExp = (1 << spec.exponentBits) - 1;
  const maxSig = (1n << BigInt(spec.mantissaBits)) - 1n;
  return { maxExponent: maxExp, maxSignificand: maxSig };
}

// d is a decomposed value { sign, exponent, significand }
// Returns a decomposed value with the exponent and significand clamped to the range of the format
export function clampDecomposed(spec, d) {
  const { maxExponent, maxSignificand } = maxValues(spec);
  const exponent = Math.max(0, Math.min(maxExponent, d.exponent));
  const significand = d.significand < 0n ? 0n : d.significand > maxSignificand ? maxSignificand : d.significand;
  // Clamp sign to binary: > 0 becomes 1, <= 0 becomes 0
  const sign = d.sign > 0 ? 1 : 0;
  return { sign, exponent, significand };
}

/**
 * Check if a finite numeric value will overflow the format's representable range
 * @param {Object} spec - Format specification
 * @param {number} value - Finite numeric value to check
 * @returns {boolean} True if the value will overflow
 */
export function checkOverflow(spec, value) {
  if (!Number.isFinite(value)) return false;
  const sign = value < 0 ? -1 : 1;
  const ax = Math.abs(value);
  const maxVal = spec.maxValue;
  const minVal = spec.minValue;
  return (sign > 0 && ax > maxVal) || (sign < 0 && -value < minVal);
}

/**
 * Handle overflow for a finite numeric value by returning the appropriate value
 * based on the format's capabilities (infinity, NaN, or clamped value)
 * @param {Object} spec - Format specification
 * @param {number} value - Finite numeric value that overflows
 * @returns {Object} Object with `value` (the value to use) and optional `displayText`
 */
function handleOverflow(spec, value) {
  if (!Number.isFinite(value)) {
    return { value };
  }

  const sign = value < 0 ? -1 : 1;
  const maxVal = spec.maxValue;
  const minVal = spec.minValue;

  if (spec.hasInfinity) {
    const overflowValue = sign > 0 ? Infinity : -Infinity;
    const displayText = sign > 0 ? "Infinity" : "-Infinity";
    return { value: overflowValue, displayText };
  } else if (spec.hasNaN) {
    return { value: NaN, displayText: "NaN" };
  } else {
    // Clamp to maximal value for this format
    const clampedValue = sign > 0 ? maxVal : minVal;
    const displayText = Number.isFinite(clampedValue)
      ? formatFiniteWith20DigitRule(clampedValue)
      : String(clampedValue);
    return { value: clampedValue, displayText };
  }
}

/**
 * Normalize an input value, checking for overflow and handling it appropriately.
 * For values that don't overflow but can't be exactly represented, returns the
 * closest representable value to avoid bouncing.
 * @param {Object} spec - Format specification
 * @param {number} value - Numeric value to normalize
 * @returns {Object} Object with `value` (the value to use) and optional `displayText`
 */
export function normalizeInputValue(spec, value) {
  if (!Number.isFinite(value)) {
    return { value };
  }

  if (checkOverflow(spec, value)) {
    return handleOverflow(spec, value);
  }

  // Convert to bits and back to get the actual representable value
  // This ensures we return the value that the bits will actually represent,
  // preventing bouncing when the valueText updates based on the bits
  const bits = valueToBits(spec, value);
  const actualValue = bitsToValue(spec, bits);

  // If the value changed after conversion, use the actual representable value
  if (Math.abs(value - actualValue) > Number.EPSILON) {
    return { value: actualValue };
  }

  return { value };
}

/* 
 * ---------------------------------
 * Formatting Section
 * ---------------------------------  
 */

// If a number has more than 20 digits of precision, switch to exponential notation
export function formatFiniteWith20DigitRule(num) {
  const expStr = num.toExponential();
  const plain = expandExponentialToPlain(expStr);
  const digitCount = plain.replace(/[^0-9]/g, '').length;
  return digitCount > 20 ? expStr : plain;
}

export function expandExponentialToPlain(expStr) {
  if (!/[eE]/.test(expStr)) return expStr;
  const match = expStr.match(/^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return expStr;
  const sign = match[1] || '';
  const intPart = match[2] || '0';
  const fracPart = match[3] || '';
  const exp = parseInt(match[4], 10) || 0;

  const digits = intPart + fracPart;
  const pointIndex = intPart.length + exp;

  if (pointIndex <= 0) {
    const zeros = '0'.repeat(Math.abs(pointIndex));
    return sign + '0.' + zeros + digits.replace(/^0+$/, '0');
  }

  if (pointIndex >= digits.length) {
    const zeros = '0'.repeat(pointIndex - digits.length);
    return sign + digits + zeros;
  }

  const left = digits.slice(0, pointIndex);
  const right = digits.slice(pointIndex);
  return sign + left + (right.length ? '.' + right : '');
}

export function buildBase2Equation(spec, dec) {
  const {
    exponentBits: eBits,
    mantissaBits: mBits,
    exponentBias: bias,
    hasInfinity,
    hasNaN,
  } = spec;
  const { sign, exponent: expRaw, significand } = dec;

  const maxExp = (1 << eBits) - 1;
  const isZero = expRaw === 0 && significand === 0n;
  const isSubnormal = expRaw === 0 && significand !== 0n;

  // Special case: formats without zero support (e.g., e8m0) treat exponent=0, significand=0 as normal 2^-bias
  const isE8M0Zero = isZero && (
    (eBits === 8 && mBits === 0) || // e8m0 format
    spec.formatInfo?.hasZeroes === false
  );

  const bin = (v, width) => v.toString(2).padStart(width, '0');
  const sigBits = bin(Number(significand), mBits);
  const Ebits = bin(expRaw, eBits);
  const Bbits = bin(bias, eBits);
  const signPow = `(-1)^${sign}`;

  // -------- Special (NaN/∞) ----------
  // Only treat as special if it's actually NaN or Infinity
  // Check by reconstructing bits and using FormatDefinition's methods
  if (expRaw === maxExp && (hasInfinity || hasNaN)) {
    const bits = Number(composeBits(spec, dec));
    if (hasInfinity && spec.isInfinity(bits)) {
      return 'Special (NaN/∞)';
    }
    if (hasNaN && spec.isNaN(bits)) {
      return 'Special (NaN/∞)';
    }
  }

  // -------- Zeros ----------
  if (isZero && !isE8M0Zero) {
    return `${signPow} × 0`;
  }

  // -------- e8m0 Zero (treated as normal) ----------
  if (isE8M0Zero) {
    // For e8m0 zero (exponent=0, significand=0), show as normal 2^-bias
    return `${signPow} × 10_2^(${Ebits}_2 - ${Bbits}_2) × ${mBits ? `1.${sigBits}_2` : `1_2`}`;
  }

  // -------- Subnormals ----------
  if (isSubnormal) {
    // exponent = 1 - bias; no hidden 1
    return `${signPow} × 10_2^(1 - ${Bbits}_2) × ${mBits ? `0.${sigBits}_2` : `0_2`}`;
  }

  // -------- Normals ----------
  return `${signPow} × 10_2^(${Ebits}_2 - ${Bbits}_2) × ${mBits ? `1.${sigBits}_2` : `1_2`}`;
}

export function buildBase10Equation(spec, dec) {
  const eBits = spec.exponentBits;
  const expRaw = dec.exponent;
  const maxExp = (1 << eBits) - 1;
  // Only treat as special if it's actually NaN or Infinity
  // Check by reconstructing bits and using FormatDefinition's methods
  if (expRaw === maxExp && (spec.hasInfinity || spec.hasNaN)) {
    const bits = Number(composeBits(spec, dec));
    if (spec.hasInfinity && spec.isInfinity(bits)) {
      return 'Special (NaN/∞)';
    }
    if (spec.hasNaN && spec.isNaN(bits)) {
      return 'Special (NaN/∞)';
    }
  }

  const bias = spec.exponentBias;
  const mBits = spec.mantissaBits;
  const isSubnormal = expRaw === 0;
  const signFactor = dec.sign ? -1 : 1;

  // Special case: formats without zero support (e.g., e8m0) treat exponent=0, significand=0 as normal 2^-bias
  const isE8M0Zero = isSubnormal && dec.significand === 0n && (
    (spec.exponentBits === 8 && spec.mantissaBits === 0) || // e8m0 format
    spec.formatInfo?.hasZeroes === false
  );

  if (isSubnormal && !isE8M0Zero) {
    // For subnormals: 2^(1-bias) × (mantissa / 2^mBits)
    // We want to normalize to show as: 2^exp × decimal_fraction
    const significand = dec.significand;
    const baseExp = 1 - bias; // Base exponent before mantissa division

    // Normalize: factor out powers of 2 from the significand to get a cleaner representation
    // Work with BigInt to avoid precision loss
    let normalizedSig = significand;
    let powerOf2Count = 0;

    // Factor out powers of 2 from the significand (right-shift while even)
    while (normalizedSig > 0n && (normalizedSig & 1n) === 0n && powerOf2Count < mBits) {
      normalizedSig = normalizedSig >> 1n;
      powerOf2Count++;
    }

    // Calculate the normalized fraction: remaining significand / remaining bits
    const remainingBits = mBits - powerOf2Count;

    // The exponent should be: baseExp + powerOf2Count
    // Original formula: 2^(1-bias) × (mantissa / 2^mBits)
    // After factoring out powerOf2Count powers of 2 from mantissa:
    // = 2^(1-bias) × (2^powerOf2Count × normalizedSig / 2^mBits)
    // = 2^(1-bias) × 2^powerOf2Count × (normalizedSig / 2^remainingBits)
    // = 2^(1-bias + powerOf2Count) × normalizedFraction
    let normalizedExp = baseExp + powerOf2Count;

    // Check if the significand (after factoring) can be safely converted to Number
    // and whether it's small enough to display as an integer
    const significandNum = Number(significand);
    const normalizedSigNum = Number(normalizedSig);
    const isSignificandSafe = significand <= BigInt(Number.MAX_SAFE_INTEGER) &&
      normalizedSigNum === Number(normalizedSig);

    // If the significand is small and safe, use the traditional format: 2^exp × integer
    // This preserves readability for small integers
    // However, if the combined exponent would be very negative (< -20), prefer normalized form
    const combinedExp = 1 - bias - mBits;
    if (isSignificandSafe && normalizedSigNum < 1e15 && remainingBits === mBits && combinedExp > -20) {
      // No factoring occurred, use original format: 2^(1-bias-mBits) × significand

      // Check if significand is a power of 2
      const mantissaLog2 = Math.log2(significandNum);
      if (Number.isInteger(mantissaLog2) && significandNum > 0) {
        const finalExp = combinedExp + mantissaLog2;
        return `${signFactor} × 2^${finalExp}`;
      }

      return `${signFactor} × 2^${combinedExp} × ${significandNum}`;
    }

    // Otherwise, normalize to show as: 2^exp × decimal_fraction
    const normalizedFraction = normalizedSigNum / Math.pow(2, remainingBits);

    // Check if the normalized fraction is itself a power of 2
    // If so, we can combine it further into the exponent
    // However, only combine for smaller formats or when remainingBits is small,
    // to avoid creating very negative exponents that are less readable
    if (normalizedSig === 1n && remainingBits > 0 && remainingBits <= 4) {
      // normalizedFraction = 1 / 2^remainingBits = 2^-remainingBits
      // So we can combine: 2^normalizedExp × 2^-remainingBits = 2^(normalizedExp - remainingBits)
      normalizedExp = normalizedExp - remainingBits;
      return `${signFactor} × 2^${normalizedExp}`;
    }

    // Special case: if normalized fraction is 1.0 (meaning all bits were factored out), 
    // we can simplify to just the exponent
    if (normalizedFraction === 1.0) {
      return `${signFactor} × 2^${normalizedExp}`;
    }

    // Return in normalized form
    return `${signFactor} × 2^${normalizedExp} × ${normalizedFraction}`;
  }

  if (isE8M0Zero) {
    // For e8m0 zero (exponent=0, significand=0), show as 2^-bias (normal number)
    const expAdj = expRaw - bias;
    return `${signFactor} × 2^${expAdj}`;
  }

  // Normal numbers
  const expAdj = expRaw - bias;
  const mantissaFloat = 1 + Number(dec.significand) / Math.pow(2, mBits);
  return `${signFactor} × 2^${expAdj} × ${mantissaFloat}`;
}

// Convert a fraction numerator/denominator to exact decimal string
function fractionToDecimal(numerator, denominator) {
  if (denominator === 0n) return "Infinity";
  if (numerator === 0n) return "0";

  const sign = (numerator < 0n) !== (denominator < 0n);
  const num = numerator < 0n ? -numerator : numerator;
  const den = denominator < 0n ? -denominator : denominator;

  const wholePart = num / den;
  let remainder = num % den;

  if (remainder === 0n) {
    return sign ? "-" + wholePart.toString() : wholePart.toString();
  }

  // Convert fractional part to decimal
  const fractionalDigits = [];
  const seenRemainders = new Map();

  while (remainder !== 0n && fractionalDigits.length < 1000) {
    if (seenRemainders.has(remainder)) {
      // Repeating decimal detected
      const repeatStart = seenRemainders.get(remainder);
      const nonRepeating = fractionalDigits.slice(0, repeatStart);
      const repeating = fractionalDigits.slice(repeatStart);
      return (sign ? "-" : "") + wholePart.toString() + "." +
        nonRepeating.join("") + "(" + repeating.join("") + ")";
    }

    seenRemainders.set(remainder, fractionalDigits.length);
    remainder *= 10n;
    const digit = remainder / den;
    fractionalDigits.push(digit.toString());
    remainder = remainder % den;
  }

  const result = (sign ? "-" : "") + wholePart.toString() + "." + fractionalDigits.join("");
  return result;
}

// Return full precision base 10 value
export function getExactBase10Value(spec, dec) {
  const eBits = spec.exponentBits;
  const expRaw = dec.exponent;
  const maxExp = (1 << eBits) - 1;
  const signFactor = dec.sign ? -1 : 1;
  if (expRaw === maxExp && (spec.hasInfinity || spec.hasNaN)) {
    const bits = Number(composeBits(spec, dec));
    if (spec.hasInfinity && typeof spec.isInfinity === "function" && spec.isInfinity(bits)) {
      return signFactor < 0 ? "-Infinity" : "Infinity";
    }
    if (spec.hasNaN && typeof spec.isNaN === "function" && spec.isNaN(bits)) {
      return "NaN";
    }
  }

  const bias = spec.exponentBias;
  const mBits = spec.mantissaBits;
  const significand = dec.significand;
  const isSubnormal = expRaw === 0 && significand !== 0n;
  const isZero = expRaw === 0 && significand === 0n;

  // Special case: formats without zero support (e.g., e8m0) treat exponent=0, significand=0 as normal 2^-bias
  const isE8M0Zero = isZero && (
    (spec.exponentBits === 8 && spec.mantissaBits === 0) ||
    spec.formatInfo?.hasZeroes === false
  );

  if (isZero && !isE8M0Zero) {
    return signFactor < 0 ? "-0" : "0";
  }

  if (isE8M0Zero) {
    // For e8m0 zero, treat as normal 2^-bias
    const expAdj = expRaw - bias;
    if (expAdj >= 0) {
      const numerator = (signFactor < 0 ? -1n : 1n) * (1n << BigInt(expAdj));
      const decimalStr = numerator.toString();
      return formatDecimalToExponentBase10(decimalStr);
    } else {
      const denominator = 1n << BigInt(-expAdj);
      const numerator = signFactor < 0 ? -1n : 1n;
      const decimalStr = fractionToDecimal(numerator, denominator);
      // Check for repeating decimals (contain parentheses)
      if (decimalStr.includes("(")) {
        return decimalStr;
      }
      return formatDecimalToExponentBase10(decimalStr);
    }
  }

  if (isSubnormal) {
    // Subnormal: 2^(1-bias) × (mantissa / 2^mBits)
    // = mantissa × 2^(1-bias) / 2^mBits
    // = mantissa / 2^(mBits + bias - 1)
    const denominator = 1n << BigInt(mBits + bias - 1);
    const numerator = (signFactor < 0 ? -1n : 1n) * significand;
    const decimalStr = fractionToDecimal(numerator, denominator);
    // Check for repeating decimals (contain parentheses)
    if (decimalStr.includes("(")) {
      return decimalStr;
    }
    return formatDecimalToExponentBase10(decimalStr);
  }

  // Normal numbers: 2^(exp-bias) × (1 + mantissa/2^mBits)
  // = 2^(exp-bias) × (2^mBits + mantissa) / 2^mBits
  // = (2^mBits + mantissa) × 2^(exp-bias) / 2^mBits
  const expAdj = expRaw - bias;
  const fullMantissa = (1n << BigInt(mBits)) | significand;

  if (expAdj >= mBits) {
    // Can represent as integer
    const numerator = (signFactor < 0 ? -1n : 1n) * fullMantissa * (1n << BigInt(expAdj - mBits));
    const decimalStr = numerator.toString();
    return formatDecimalToExponentBase10(decimalStr);
  } else if (expAdj >= 0) {
    // Numerator has power of 2 factor
    const numerator = (signFactor < 0 ? -1n : 1n) * fullMantissa * (1n << BigInt(expAdj));
    const denominator = 1n << BigInt(mBits);
    const decimalStr = fractionToDecimal(numerator, denominator);
    // Check for repeating decimals (contain parentheses)
    if (decimalStr.includes("(")) {
      return decimalStr;
    }
    return formatDecimalToExponentBase10(decimalStr);
  } else {
    // Negative exponent: divide
    const numerator = (signFactor < 0 ? -1n : 1n) * fullMantissa;
    const denominator = 1n << BigInt(mBits - expAdj);
    const decimalStr = fractionToDecimal(numerator, denominator);
    // Check for repeating decimals (contain parentheses)
    if (decimalStr.includes("(")) {
      return decimalStr;
    }
    return formatDecimalToExponentBase10(decimalStr);
  }
}

function formatDecimalToExponentBase10(decimalString) {
  // Remove sign for ease, handle later
  let sign = "";
  if (decimalString[0] === "-") {
    sign = "-";
    decimalString = decimalString.slice(1);
  }

  // Handle zero
  if (Number(decimalString) === 0) {
    return sign + "0";
  }

  // Find decimal point
  const dotIndex = decimalString.indexOf(".");
  let digits, exponent;

  if (dotIndex === -1) {
    // No decimal point, integer value; exponent is length-1
    digits = decimalString.replace(/^0+/, "");
    exponent = digits.length - 1;
    digits = digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "");
  } else {
    // Normalize: strip leading zeros before decimal
    let intPart = decimalString.slice(0, dotIndex).replace(/^0+/, "");
    let fracPart = decimalString.slice(dotIndex + 1);

    // Remove trailing zeros in fractional part
    fracPart = fracPart.replace(/0+$/, "");

    if (intPart.length > 0) {
      // e.g. 123.45 -> 1.2345 × 10^2
      digits = intPart + fracPart;
      digits = digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "");
      exponent = intPart.length - 1;
    } else {
      // e.g. 0.0000001...case
      // Count leading zeros in fracPart
      const match = fracPart.match(/^0*/);
      const zeros = match ? match[0].length : 0;
      const firstNonZeroIdx = zeros;
      digits = fracPart.slice(firstNonZeroIdx);
      digits = digits[0] + (digits.length > 1 ? "." + digits.slice(1) : "");
      exponent = -(zeros + 1);
    }
  }
  // Remove possible trailing dot
  digits = digits.replace(/\.$/, "");
  // Only use scientific notation for very large (exponent > 3) or very small (exponent < -3) numbers
  // For numbers in the range [-3, 3], return in standard decimal form
  if (exponent >= -3 && exponent <= 3) {
    // Reconstruct the original decimal representation
    if (exponent === 0) {
      return sign + digits;
    } else if (exponent > 0) {
      // Positive exponent: e.g., 4.48 with exp=2 means 448
      const numStr = digits.replace(".", "");
      if (exponent >= numStr.length - 1) {
        // Integer part
        return sign + numStr + "0".repeat(exponent - (numStr.length - 1));
      } else {
        // Has decimal part
        const pointPos = exponent + 1;
        return sign + numStr.slice(0, pointPos) + "." + numStr.slice(pointPos);
      }
    } else {
      // Negative exponent: e.g., 1.5625 with exp=-2 means 0.015625
      const numStr = digits.replace(".", "");
      const zeros = -exponent - 1;
      return sign + "0." + "0".repeat(zeros) + numStr;
    }
  }
  return `${sign}${digits}×10${exponent}`;
}