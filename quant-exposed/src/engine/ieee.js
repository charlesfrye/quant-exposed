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


export function buildExplanation(spec, dec, value) {
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
    ? value.toExponential(12)
    : String(value);

  const ulp = Math.pow(2, (isSubnormal ? 1 - bias : expAdj) - mBits);
  const delta = `±${ulp.toExponential(12)}`;

  return { base2, base10, exact, delta };
}
