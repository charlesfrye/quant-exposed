export const FORMATS = {
  half: { key: 'half', name: 'half', totalBits: 16, exponentBits: 5, mantissaBits: 10, exponentBias: 15 },
  bfloat: { key: 'bfloat', name: 'bfloat', totalBits: 16, exponentBits: 8, mantissaBits: 7, exponentBias: 127 },
  float: { key: 'float', name: 'float', totalBits: 32, exponentBits: 8, mantissaBits: 23, exponentBias: 127 },
  double: { key: 'double', name: 'double', totalBits: 64, exponentBits: 11, mantissaBits: 52, exponentBias: 1023 },
};

export function maxValues(spec) {
  const maxExp = (1 << spec.exponentBits) - 1;
  const maxSig = (1n << BigInt(spec.mantissaBits)) - 1n;
  return { maxExponent: maxExp, maxSignificand: maxSig };
}

export function composeBits(spec, d) {
  const signShift = BigInt(spec.totalBits - 1);
  const expShift = BigInt(spec.mantissaBits);
  const signPart = BigInt(d.sign & 1) << signShift;
  const expPart = BigInt(d.exponent >>> 0) << expShift;
  const sigPart = d.significand & ((1n << expShift) - 1n);
  return signPart | expPart | sigPart;
}

export function extract(spec, bits) {
  const sign = Number((bits >> BigInt(spec.totalBits - 1)) & 1n);
  const exponent = Number((bits >> BigInt(spec.mantissaBits)) & ((1n << BigInt(spec.exponentBits)) - 1n));
  const significand = bits & ((1n << BigInt(spec.mantissaBits)) - 1n);
  return { sign, exponent, significand };
}

export function bitsToValue(spec, bits) {
  const { sign, exponent, significand } = extract(spec, bits);
  const bias = spec.exponentBias;
  const signFactor = sign ? -1 : 1;
  if (exponent === (1 << spec.exponentBits) - 1) {
    if (significand === 0n) return sign ? -Infinity : Infinity;
    return NaN;
  }
  if (exponent === 0) {
    if (significand === 0n) return sign ? -0 : 0;
    const frac = Number(significand) / Math.pow(2, spec.mantissaBits);
    return signFactor * Math.pow(2, 1 - bias) * frac;
  }
  const frac = 1 + Number(significand) / Math.pow(2, spec.mantissaBits);
  return signFactor * Math.pow(2, exponent - bias) * frac;
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

export function arrayToBits(spec, arr) {
  for (let i = 0; i < arr.length; i++) {
  }
  return null;
}


