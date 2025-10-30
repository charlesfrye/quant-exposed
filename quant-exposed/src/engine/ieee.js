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


