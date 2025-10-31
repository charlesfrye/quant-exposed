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
export function handleOverflow(spec, value) {
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
      return sign ? '-∞' : '∞';
    }
    if (hasNaN && spec.isNaN(bits)) {
      return 'Not a Number';
    }
  }

  // -------- Zeros ----------
  if (isZero) {
    return `${signPow} × 0`;
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
      return dec.sign ? '-∞' : '∞';
    }
    if (spec.hasNaN && spec.isNaN(bits)) {
      return 'Not a Number';
    }
  }

  const bias = spec.exponentBias;
  const mBits = spec.mantissaBits;
  const isSubnormal = expRaw === 0;
  const signFactor = dec.sign ? -1 : 1;

  if (isSubnormal) {
    // For subnormals: 2^(1-bias) × (mantissa / 2^mBits)
    // Simplify to: 2^(1-bias-mBits) × mantissa
    // Or when mantissa is a power of 2, combine further
    const significandNum = Number(dec.significand);
    const combinedExp = 1 - bias - mBits;

    // Check if the mantissa fraction simplifies to a power of 2
    // i.e., mantissa / 2^mBits = 2^k for some integer k
    // This happens when mantissa itself is a power of 2
    // For example: mantissa=1 means 1/8 = 2^-3, so we can combine to 2^(combinedExp-3)
    const mantissaLog2 = Math.log2(significandNum);
    if (Number.isInteger(mantissaLog2) && significandNum > 0) {
      // Mantissa is a power of 2, so combine exponents
      const finalExp = combinedExp + mantissaLog2;
      return `${signFactor} × 2^${finalExp}`;
    }

    // Otherwise, show as: 2^combinedExp × mantissa
    return `${signFactor} × 2^${combinedExp} × ${significandNum}`;
  }

  // Normal numbers
  const expAdj = expRaw - bias;
  const mantissaFloat = 1 + Number(dec.significand) / Math.pow(2, mBits);
  return `${signFactor} × 2^${expAdj} × ${mantissaFloat}`;
}

// Return a user-facing exact value string mirroring the 20-digit rule
export function getExactBase10Value(spec, dec, value) {
  const eBits = spec.exponentBits;
  const expRaw = dec.exponent;
  const maxExp = (1 << eBits) - 1;
  // Only treat as special if it's actually NaN or Infinity
  // Check by reconstructing bits and using FormatDefinition's methods
  const signFactor = dec.sign ? -1 : 1;
  if (expRaw === maxExp && (spec.hasInfinity || spec.hasNaN)) {
    const bits = Number(composeBits(spec, dec));
    if (spec.hasInfinity && spec.isInfinity(bits)) {
      return signFactor < 0 ? '-∞' : '∞';
    }
    if (spec.hasNaN && spec.isNaN(bits)) {
      return 'Not a Number';
    }
  }
  return Number.isFinite(value)
    ? formatFiniteWith20DigitRule(value)
    : String(value);
}
