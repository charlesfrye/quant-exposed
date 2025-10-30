import { FORMATS as MX_FORMATS } from "@/engine/constants";
import { FormatDefinition } from "@/engine/FormatDefinition";

export const FORMATS = Object.fromEntries(
  Object.entries(MX_FORMATS).map(([key, info]) => [key, new FormatDefinition(info)])
);

export function maxValues(spec) {
  const maxExp = (1 << spec.exponentBits) - 1;
  const maxSig = (1n << BigInt(spec.mantissaBits)) - 1n;
  return { maxExponent: maxExp, maxSignificand: maxSig };
}

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

export function extract(spec, bits) {
  const nbits = Number(bits);
  const sign = spec.extractSign(nbits);
  const exponent = spec.extractExponent(nbits);
  const mantissa = spec.extractMantissa(nbits);
  return { sign, exponent, significand: BigInt(mantissa) };
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

export function bitsToHexFloat(spec, bits) {
  const { sign, exponent, significand } = extract(spec, bits);
  const bias = spec.exponentBias;
  const signPrefix = sign ? '-0x' : '0x';
  if (exponent === (1 << spec.exponentBits) - 1) {
    return 'nan';
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

export function clampDecomposed(spec, d) {
  const { maxExponent, maxSignificand } = maxValues(spec);
  const exponent = Math.max(0, Math.min(maxExponent, d.exponent));
  const significand = d.significand < 0n ? 0n : d.significand > maxSignificand ? maxSignificand : d.significand;
  const sign = d.sign ? 1 : 0;
  return { sign, exponent, significand };
}

export function bitsToArray(spec, bits) {
  const out = [];
  for (let i = spec.totalBits - 1; i >= 0; i--) {
    out.push(Number((bits >> BigInt(i)) & 1n));
  }
  return out;
}


export function buildEquation(spec, dec, value) {
  const bias = spec.exponentBias;
  const mBits = spec.mantissaBits;
  const eBits = spec.exponentBits;
  const expRaw = dec.exponent;
  const isSpecial = expRaw === (1 << eBits) - 1;
  const signFactor = dec.sign ? -1 : 1;

  const fracBin = dec.significand
    .toString(2)
    .padStart(mBits, '0');

  if (isSpecial) {
    return {
      base2: 'Special (NaN/∞)',
      base10: 'Special (NaN/∞)',
      exact: Number.isNaN(value) ? 'NaN' : (signFactor < 0 ? '-Infinity' : 'Infinity'),
      delta: 'N/A',
    };
  }

  const isSubnormal = expRaw === 0;
  const expAdj = isSubnormal ? 1 - bias : expRaw - bias;
  const mantissaFloat = isSubnormal
    ? Number(dec.significand) / Math.pow(2, mBits)
    : 1 + Number(dec.significand) / Math.pow(2, mBits);

  const base2Mantissa = isSubnormal ? `0.${fracBin}` : `1.${fracBin}`;
  const expRawBin = expRaw.toString(2).padStart(eBits, '0');
  const biasBin = bias.toString(2).padStart(eBits, '0');

  const base2 = `(-1)^${dec.sign} × 2^(${expRawBin}₂ - ${biasBin}₂) × ${base2Mantissa}₂`;
  const base10 = `${signFactor} × 2^${expAdj} × ${mantissaFloat}`;

  const exact = Number.isFinite(value)
    ? formatFiniteWith20DigitRule(value)
    : String(value);

  const ulp = Math.pow(2, (isSubnormal ? 1 - bias : expAdj) - mBits);
  const delta = `±${ulp.toExponential(12)}`;

  return { base2, base10, exact, delta };
}

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

// Convert a JavaScript number to the closest representable bit pattern for the given spec
export function valueToBits(spec, x) {
  if (Number.isNaN(x)) {
    // Produce a NaN encoding if supported; otherwise return zero
    const allOnesExp = (1 << spec.exponentBits) - 1;
    if (spec.hasNaN) {
      const nanSig = spec.mantissaBits > 0 ? 1n : 0n;
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
  const maxFiniteExp = maxExp - 1;

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
    // Overflow to infinity if supported or clamp to max finite
    if (spec.hasInfinity) {
      return composeBits(spec, { sign, exponent: maxExp, significand: 0n });
    }
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
