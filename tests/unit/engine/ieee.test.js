/**
 * FormatDefinition.test.js
 * Unit tests for FormatDefinition class
 */

import {
  bitsToValue,
  bitsToRawHex,
  bitsToRawDecimal,
  bitsToArray,
  bitsToHexFloat,
  valueToBits,
  clampDecomposed,
  composeBits,
  extract,
  FORMATS
} from "../../src/engine/ieee";
import { buildBase2Equation, buildBase10Equation, getExactBase10Value } from "../../src/engine/ieee";

describe("ieee.js", () => {
  describe("e4m3 format", () => {
    const E4M3 = FORMATS.e4m3;

    describe("E4M3 special cases", () => {
      it("should not support infinity", () => {
        expect(E4M3.hasInfinity).toBe(false);
      });

      it("should handle NaN pattern: S 1111 111₂", () => {
        // NaN: sign=0, exp=1111 (15), mant=111 (7) = 0b01111111 = 0x7F
        const nanBits = 0x7Fn;
        const decomp = extract(E4M3, nanBits);
        expect(decomp.exponent).toBe(15);
        expect(decomp.significand).toBe(7n);
        expect(Number.isNaN(bitsToValue(E4M3, nanBits))).toBe(true);
        expect(bitsToHexFloat(E4M3, nanBits)).toBe("nan");
        expect(bitsToArray(E4M3, nanBits)).toEqual([0, 1, 1, 1, 1, 1, 1, 1]);
        expect(valueToBits(E4M3, NaN)).toEqual(nanBits);
        expect(composeBits(E4M3, decomp)).toEqual(nanBits);

        // Also test with sign=1: 0b11111111 = 0xFF
        const nanBitsNeg = 0xFFn;
        expect(Number.isNaN(bitsToValue(E4M3, nanBitsNeg))).toBe(true);
        expect(bitsToHexFloat(E4M3, nanBitsNeg)).toBe("nan");
        expect(bitsToArray(E4M3, nanBitsNeg)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);

        expect(buildBase2Equation(E4M3, decomp)).toBe("Special (NaN/∞)");
        expect(buildBase10Equation(E4M3, decomp)).toBe("Special (NaN/∞)");
        expect(getExactBase10Value(E4M3, decomp)).toBe("NaN");

        expect(bitsToRawHex(E4M3, nanBits)).toBe("0x7f");
        expect(bitsToRawDecimal(nanBits)).toBe("127");
      });

      it("should handle zeros: S 0000 000₂", () => {
        // Zero: sign=0, exp=0000 (0), mant=000 (0) = 0b00000000 = 0x00
        const zeroBits = 0x00n;
        const decomp = extract(E4M3, zeroBits);
        expect(decomp.sign).toBe(0);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(0n);
        expect(bitsToValue(E4M3, zeroBits)).toBe(0);
        expect(Object.is(bitsToValue(E4M3, zeroBits), 0)).toBe(true);
        expect(valueToBits(E4M3, 0)).toEqual(zeroBits);
        expect(composeBits(E4M3, decomp)).toEqual(zeroBits);

        // Negative zero: sign=1, exp=0000 (0), mant=000 (0) = 0b10000000 = 0x80
        const negZeroBits = 0x80n;
        const negZeroDecomp = extract(E4M3, negZeroBits);
        expect(negZeroDecomp.sign).toBe(1);
        expect(negZeroDecomp.exponent).toBe(0);
        expect(negZeroDecomp.significand).toBe(0n);
        const negZeroValue = bitsToValue(E4M3, negZeroBits);
        expect(negZeroValue === 0).toBe(true); // -0 === 0 is true
        expect(Object.is(negZeroValue, -0)).toBe(true);

        expect(buildBase2Equation(E4M3, decomp)).toBe("(-1)^0 × 0");
        expect(buildBase10Equation(E4M3, decomp)).toBe("1 × 2^-9 × 0");
        expect(getExactBase10Value(E4M3, decomp)).toBe("0");

        expect(bitsToRawHex(E4M3, zeroBits)).toBe("0x00");
        expect(bitsToRawDecimal(zeroBits)).toBe("0");
        expect(bitsToArray(E4M3, zeroBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      });

      it("should handle max normal: S 1111 110₂ = ± 2^8 × 1.75 = ± 448", () => {
        // Max normal: sign=0, exp=1111 (15), mant=110 (6) = 0b01111110 = 0x7E
        const maxBits = 0x7En;
        const decomp = extract(E4M3, maxBits);
        expect(decomp.exponent).toBe(15);
        expect(decomp.significand).toBe(6n);
        const value = bitsToValue(E4M3, maxBits);
        // Verify exact base 10 value: 2^8 × 1.75 = 256 × 1.75 = 448
        expect(value).toBe(448);
        expect(valueToBits(E4M3, 448)).toEqual(maxBits);
        expect(composeBits(E4M3, decomp)).toEqual(maxBits);

        // Negative max normal: sign=1, exp=1111 (15), mant=110 (6) = 0b11111110 = 0xFE
        const maxBitsNeg = 0xFEn;
        const negValue = bitsToValue(E4M3, maxBitsNeg);
        expect(negValue).toBe(-448);
        expect(valueToBits(E4M3, negValue)).toEqual(maxBitsNeg);

        // Check the base-2 and 10 rendering for max normal value
        expect(buildBase2Equation(E4M3, decomp)).toBe("(-1)^0 × 10_2^(1111_2 - 0111_2) × 1.110_2");
        expect(buildBase10Equation(E4M3, decomp)).toBe("1 × 2^8 × 1.75");
        expect(getExactBase10Value(E4M3, decomp)).toBe("448");

        expect(bitsToRawHex(E4M3, maxBits)).toBe("0x7e");
        expect(bitsToRawDecimal(maxBits)).toBe("126");
        expect(bitsToArray(E4M3, maxBits)).toEqual([0, 1, 1, 1, 1, 1, 1, 0]);
      });

      it("should handle min normal: S 0001 000₂ = ± 2^-6", () => {
        // Min normal: sign=0, exp=0001 (1), mant=000 (0) = 0b00001000 = 0x08
        const minBits = 0x08n;
        const decomp = extract(E4M3, minBits);
        expect(decomp.exponent).toBe(1);
        expect(decomp.significand).toBe(0n);
        const value = bitsToValue(E4M3, minBits);
        expect(value).toBe(0.015625);
        expect(valueToBits(E4M3, value)).toEqual(minBits);
        expect(composeBits(E4M3, decomp)).toEqual(minBits);

        // Negative min normal: sign=1, exp=0001 (1), mant=000 (0) = 0b10001000 = 0x88
        const minBitsNeg = 0x88n;
        const negValue = bitsToValue(E4M3, minBitsNeg);
        expect(negValue).toBe(-0.015625);

        // Check the base-2 and 10 rendering for max normal value
        expect(buildBase2Equation(E4M3, decomp)).toBe("(-1)^0 × 10_2^(0001_2 - 0111_2) × 1.000_2");
        expect(buildBase10Equation(E4M3, decomp)).toBe("1 × 2^-6 × 1");
        expect(getExactBase10Value(E4M3, decomp)).toBe("0.015625");

        expect(bitsToRawHex(E4M3, minBits)).toBe("0x08");
        expect(bitsToRawDecimal(minBits)).toBe("8");
        expect(bitsToArray(E4M3, minBits)).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
      });

      it("should handle max subnorm: S 0000 111₂ = ± 2^-6 × 0.875", () => {
        // Max subnorm: sign=0, exp=0000 (0), mant=111 (7) = 0b00000111 = 0x07
        const maxSubBits = 0x07n;
        const decomp = extract(E4M3, maxSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(7n);
        const value = bitsToValue(E4M3, maxSubBits);
        expect(value).toBe(0.013671875);
        expect(valueToBits(E4M3, value)).toEqual(maxSubBits);
        expect(composeBits(E4M3, decomp)).toEqual(maxSubBits);

        // Negative max subnorm: sign=1, exp=0000 (0), mant=111 (7) = 0b10000111 = 0x87
        const maxSubBitsNeg = 0x87n;
        const negValue = bitsToValue(E4M3, maxSubBitsNeg);
        expect(negValue).toBe(-0.013671875);

        expect(buildBase2Equation(E4M3, decomp)).toBe("(-1)^0 × 10_2^(1 - 0111_2) × 0.111_2");
        expect(buildBase10Equation(E4M3, decomp)).toBe("1 × 2^-9 × 7");
        expect(getExactBase10Value(E4M3, decomp)).toBe("0.013671875");

        expect(bitsToRawHex(E4M3, maxSubBits)).toBe("0x07");
        expect(bitsToRawDecimal(maxSubBits)).toBe("7");
      });

      it("should handle min subnorm: S 0000 001₂ = ± 2^-9", () => {
        // Min subnorm: sign=0, exp=0000 (0), mant=001 (1) = 0b00000001 = 0x01
        const minSubBits = 0x01n;
        const decomp = extract(E4M3, minSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(1n);
        const value = bitsToValue(E4M3, minSubBits);
        expect(value).toBe(0.001953125);
        expect(valueToBits(E4M3, 0.001953125)).toEqual(minSubBits);
        expect(composeBits(E4M3, decomp)).toEqual(minSubBits);

        // Negative min subnorm: sign=1, exp=0000 (0), mant=001 (1) = 0b10000001 = 0x81
        const minSubBitsNeg = 0x81n;
        const negValue = bitsToValue(E4M3, minSubBitsNeg);
        expect(negValue).toBe(-0.001953125);

        expect(buildBase2Equation(E4M3, decomp)).toBe("(-1)^0 × 10_2^(1 - 0111_2) × 0.001_2");
        expect(buildBase10Equation(E4M3, decomp)).toBe("1 × 2^-9");
        expect(getExactBase10Value(E4M3, decomp)).toBe("0.001953125");

        expect(bitsToRawHex(E4M3, minSubBits)).toBe("0x01");
        expect(bitsToRawDecimal(minSubBits)).toBe("1");
        expect(bitsToArray(E4M3, minSubBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
      });
    });
  });

  describe("e5m2 format", () => {
    const E5M2 = FORMATS.e5m2;

    describe("E5M2 special cases", () => {
      it("should have exponent bias of 15", () => {
        expect(E5M2.exponentBias).toBe(15);
      });

      it("should support infinity", () => {
        expect(E5M2.hasInfinity).toBe(true);
      });

      it("should handle infinities: S 11111 00₂", () => {
        // Positive infinity: sign=0, exp=11111 (31), mant=00 (0) = 0b01111100 = 0x7C
        const posInfBits = 0x7Cn;
        const decomp = extract(E5M2, posInfBits);
        expect(decomp.exponent).toBe(31);
        expect(decomp.significand).toBe(0n);
        const value = bitsToValue(E5M2, posInfBits);
        expect(value).toBe(Infinity);
        expect(bitsToHexFloat(E5M2, posInfBits)).toBe("0xinf");
        expect(bitsToArray(E5M2, posInfBits)).toEqual([0, 1, 1, 1, 1, 1, 0, 0]);
        expect(composeBits(E5M2, decomp)).toEqual(posInfBits);

        // Negative infinity: sign=1, exp=11111 (31), mant=00 (0) = 0b11111100 = 0xFC
        const negInfBits = 0xFCn;
        const negValue = bitsToValue(E5M2, negInfBits);
        expect(negValue).toBe(-Infinity);
        expect(bitsToHexFloat(E5M2, negInfBits)).toBe("-0xinf");
        expect(bitsToArray(E5M2, negInfBits)).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
        expect(buildBase2Equation(E5M2, decomp)).toBe("Special (NaN/∞)");
        expect(buildBase10Equation(E5M2, decomp)).toBe("Special (NaN/∞)");
        expect(getExactBase10Value(E5M2, decomp)).toBe("Infinity");
      });

      it("should handle NaN patterns: S 11111 {01, 10, 11}₂", () => {
        // NaN pattern 1: sign=0, exp=11111 (31), mant=01 (1) = 0b01111101 = 0x7D
        const nanBits1 = 0x7Dn;
        expect(Number.isNaN(bitsToValue(E5M2, nanBits1))).toBe(true);
        expect(bitsToHexFloat(E5M2, nanBits1)).toBe("nan");
        expect(bitsToArray(E5M2, nanBits1)).toEqual([0, 1, 1, 1, 1, 1, 0, 1]);
        // NaN pattern 2: sign=0, exp=11111 (31), mant=10 (2) = 0b01111110 = 0x7E
        const nanBits2 = 0x7En;
        expect(Number.isNaN(bitsToValue(E5M2, nanBits2))).toBe(true);
        expect(bitsToHexFloat(E5M2, nanBits2)).toBe("nan");
        expect(bitsToArray(E5M2, nanBits2)).toEqual([0, 1, 1, 1, 1, 1, 1, 0]);
        // NaN pattern 3: sign=0, exp=11111 (31), mant=11 (3) = 0b01111111 = 0x7F
        const nanBits3 = 0x7Fn;
        expect(Number.isNaN(bitsToValue(E5M2, nanBits3))).toBe(true);
        expect(bitsToHexFloat(E5M2, nanBits3)).toBe("nan");
        expect(bitsToArray(E5M2, nanBits3)).toEqual([0, 1, 1, 1, 1, 1, 1, 1]);
        // Also test with sign=1
        expect(Number.isNaN(bitsToValue(E5M2, 0xFDn))).toBe(true);
        expect(Number.isNaN(bitsToValue(E5M2, 0xFEn))).toBe(true);
        expect(Number.isNaN(bitsToValue(E5M2, 0xFFn))).toBe(true);
      });

      it("should handle zeros: S 00000 00₂", () => {
        // Zero: sign=0, exp=00000 (0), mant=00 (0) = 0b00000000 = 0x00
        const zeroBits = 0x00n;
        const decomp = extract(E5M2, zeroBits);
        expect(decomp.sign).toBe(0);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(0n);
        expect(bitsToValue(E5M2, zeroBits)).toBe(0);
        expect(Object.is(bitsToValue(E5M2, zeroBits), 0)).toBe(true);

        // Negative zero: sign=1, exp=00000 (0), mant=00 (0) = 0b10000000 = 0x80
        const negZeroBits = 0x80n;
        const negZeroDecomp = extract(E5M2, negZeroBits);
        expect(negZeroDecomp.sign).toBe(1);
        expect(negZeroDecomp.exponent).toBe(0);
        expect(negZeroDecomp.significand).toBe(0n);
        const negZeroValue = bitsToValue(E5M2, negZeroBits);
        expect(negZeroValue === 0).toBe(true); // -0 === 0 is true
        expect(Object.is(negZeroValue, -0)).toBe(true);

        expect(buildBase2Equation(E5M2, decomp)).toBe("(-1)^0 × 0");
        expect(buildBase10Equation(E5M2, decomp)).toBe("1 × 2^-16 × 0");
        expect(getExactBase10Value(E5M2, decomp)).toBe("0");
        expect(bitsToArray(E5M2, zeroBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      });

      it("should handle max normal: S 11110 11₂ = ± 2^15 × 1.75 = ± 57,344", () => {
        // Max normal: sign=0, exp=11110 (30), mant=11 (3) = 0b01111011 = 0x7B
        const maxBits = 0x7Bn;
        const decomp = extract(E5M2, maxBits);
        expect(decomp.exponent).toBe(30);
        expect(decomp.significand).toBe(3n);
        const value = bitsToValue(E5M2, maxBits);
        expect(value).toBe(57344);

        // Negative max normal: sign=1, exp=11110 (30), mant=11 (3) = 0b11111011 = 0xFB
        const maxBitsNeg = 0xFBn;
        const negValue = bitsToValue(E5M2, maxBitsNeg);
        expect(negValue).toBe(-57344);

        expect(buildBase2Equation(E5M2, decomp)).toBe("(-1)^0 × 10_2^(11110_2 - 01111_2) × 1.11_2");
        expect(buildBase10Equation(E5M2, decomp)).toBe("1 × 2^15 × 1.75");
        expect(getExactBase10Value(E5M2, decomp)).toBe("5.7344×104");
        expect(bitsToArray(E5M2, maxBits)).toEqual([0, 1, 1, 1, 1, 0, 1, 1]);
      });

      it("should handle min normal: S 00001 00₂ = ± 2^-14", () => {
        // Min normal: sign=0, exp=00001 (1), mant=00 (0) = 0b00000100 = 0x04
        const minBits = 0x04n;
        const decomp = extract(E5M2, minBits);
        expect(decomp.exponent).toBe(1);
        expect(decomp.significand).toBe(0n);
        const value = bitsToValue(E5M2, minBits);
        expect(value).toBe(0.00006103515625);

        // Negative min normal: sign=1, exp=00001 (1), mant=00 (0) = 0b10000100 = 0x84
        const minBitsNeg = 0x84n;
        const negValue = bitsToValue(E5M2, minBitsNeg);
        expect(negValue).toBe(-0.00006103515625);

        expect(buildBase2Equation(E5M2, decomp)).toBe("(-1)^0 × 10_2^(00001_2 - 01111_2) × 1.00_2");
        expect(buildBase10Equation(E5M2, decomp)).toBe("1 × 2^-14 × 1");
        expect(getExactBase10Value(E5M2, decomp)).toBe("6.103515625×10-5");
        expect(bitsToArray(E5M2, minBits)).toEqual([0, 0, 0, 0, 0, 1, 0, 0]);
      });

      it("should handle max subnorm: S 00000 11₂ = ± 2^-14 × 0.75", () => {
        // Max subnorm: sign=0, exp=00000 (0), mant=11 (3) = 0b00000011 = 0x03
        const maxSubBits = 0x03n;
        const decomp = extract(E5M2, maxSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(3n);
        const value = bitsToValue(E5M2, maxSubBits);
        expect(value).toBe(0.0000457763671875);

        expect(buildBase2Equation(E5M2, decomp)).toBe("(-1)^0 × 10_2^(1 - 01111_2) × 0.11_2");
        expect(buildBase10Equation(E5M2, decomp)).toBe("1 × 2^-16 × 3");
        expect(getExactBase10Value(E5M2, decomp)).toBe("4.57763671875×10-5");

        expect(bitsToRawHex(E5M2, maxSubBits)).toBe("0x03");
        expect(bitsToRawDecimal(maxSubBits)).toBe("3");
        expect(bitsToArray(E5M2, maxSubBits)).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);

        // Negative max subnorm: sign=1, exp=00000 (0), mant=11 (3) = 0b10000011 = 0x83
        const maxSubBitsNeg = 0x83n;
        const negValue = bitsToValue(E5M2, maxSubBitsNeg);
        expect(negValue).toBe(-0.0000457763671875);
      });

      it("should handle min subnorm: S 00000 01₂ = ± 2^-16", () => {
        // Min subnorm: sign=0, exp=00000 (0), mant=01 (1) = 0b00000001 = 0x01
        const minSubBits = 0x01n;
        const decomp = extract(E5M2, minSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(1n);
        const value = bitsToValue(E5M2, minSubBits);
        expect(value).toBe(0.0000152587890625);

        // Negative min subnorm: sign=1, exp=00000 (0), mant=01 (1) = 0b10000001 = 0x81
        const minSubBitsNeg = 0x81n;
        const negValue = bitsToValue(E5M2, minSubBitsNeg);
        expect(negValue).toBe(-0.0000152587890625);

        expect(buildBase2Equation(E5M2, decomp)).toBe("(-1)^0 × 10_2^(1 - 01111_2) × 0.01_2");
        expect(buildBase10Equation(E5M2, decomp)).toBe("1 × 2^-16");
        expect(getExactBase10Value(E5M2, decomp)).toBe("1.52587890625×10-5");

        expect(bitsToRawHex(E5M2, minSubBits)).toBe("0x01");
        expect(bitsToRawDecimal(minSubBits)).toBe("1");
        expect(bitsToArray(E5M2, minSubBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
      });
    });
  });

  describe("e2m3 format", () => {
    const E2M3 = FORMATS.e2m3;

    describe("E2M3 special cases", () => {
      it("should have exponent bias of 3", () => {
        expect(E2M3.exponentBias).toBe(1);
      });

      it("should not support infinity or NaN", () => {
        expect(E2M3.hasInfinity).toBe(false);
        expect(E2M3.hasNaN).toBe(false);
      });
      // TODO: Stopped here
      it("should handle zeros: S 00 000₂", () => {
        // Zero: sign=0, exp=00 (0), mant=000 (0) = 0b000000 = 0x00
        const zeroBits = 0x00n;
        const decomp = extract(E2M3, zeroBits);
        expect(decomp.sign).toBe(0);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(0n);
        expect(bitsToValue(E2M3, zeroBits)).toBe(0);
        expect(Object.is(bitsToValue(E2M3, zeroBits), 0)).toBe(true);

        // Negative zero: sign=1, exp=00 (0), mant=000 (0) = 0b100000 = 0x20
        const negZeroBits = 0x20n;
        const negZeroDecomp = extract(E2M3, negZeroBits);
        expect(negZeroDecomp.sign).toBe(1);
        expect(negZeroDecomp.exponent).toBe(0);
        expect(negZeroDecomp.significand).toBe(0n);
        const negZeroValue = bitsToValue(E2M3, negZeroBits);
        expect(negZeroValue === 0).toBe(true); // -0 === 0 is true
        expect(Object.is(negZeroValue, -0)).toBe(true);

        expect(buildBase2Equation(E2M3, decomp)).toBe("(-1)^0 × 0");
        expect(buildBase10Equation(E2M3, decomp)).toBe("1 × 2^-3 × 0");
        expect(getExactBase10Value(E2M3, decomp)).toBe("0");
        expect(bitsToArray(E2M3, zeroBits)).toEqual([0, 0, 0, 0, 0, 0]);
      });

      it("should handle max normal: S 11 111₂ = ± 2^2 × 1.875 = ± 7.5", () => {
        const maxBits = 0x1Fn;
        const decomp = extract(E2M3, maxBits);
        expect(decomp.exponent).toBe(3);
        expect(decomp.significand).toBe(7n);
        const value = bitsToValue(E2M3, maxBits);
        expect(value).toBe(7.5);

        expect(valueToBits(E2M3, value)).toEqual(maxBits);

        expect(buildBase2Equation(E2M3, decomp)).toBe("(-1)^0 × 10_2^(11_2 - 01_2) × 1.111_2");
        expect(buildBase10Equation(E2M3, decomp)).toBe("1 × 2^2 × 1.875");
        expect(getExactBase10Value(E2M3, decomp)).toBe("7.5");
        expect(bitsToArray(E2M3, maxBits)).toEqual([0, 1, 1, 1, 1, 1]);
      });

      it("should handle min normal: S 01 000₂ = ± 2^-0 = ± 1.0", () => {
        const minBits = 0x08n;
        const decomp = extract(E2M3, minBits);
        expect(decomp.exponent).toBe(1);
        expect(decomp.significand).toBe(0n);
        const value = bitsToValue(E2M3, minBits);
        expect(value).toBe(1.0);
        expect(valueToBits(E2M3, value)).toEqual(minBits);
        expect(composeBits(E2M3, decomp)).toEqual(minBits);

        const minBitsNeg = 0x28n;
        const negValue = bitsToValue(E2M3, minBitsNeg);
        expect(negValue).toBe(-1.0);

        expect(buildBase2Equation(E2M3, decomp)).toBe("(-1)^0 × 10_2^(01_2 - 01_2) × 1.000_2");
        expect(buildBase10Equation(E2M3, decomp)).toBe("1 × 2^0 × 1");
        expect(getExactBase10Value(E2M3, decomp)).toBe("1");
        expect(bitsToArray(E2M3, minBits)).toEqual([0, 0, 1, 0, 0, 0]);
      });

      it("should handle max subnorm: S 00 111₂ = ± 2^-2 × 0.875", () => {
        // Max subnorm: sign=0, exp=00 (0), mant=111 (7) = 0b00111 = 0x07
        const maxSubBits = 0x07n;
        const decomp = extract(E2M3, maxSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(7n);
        const value = bitsToValue(E2M3, maxSubBits);
        expect(value).toBe(0.875);

        expect(buildBase2Equation(E2M3, decomp)).toBe("(-1)^0 × 10_2^(1 - 01_2) × 0.111_2");
        expect(buildBase10Equation(E2M3, decomp)).toBe("1 × 2^-3 × 7");
        expect(getExactBase10Value(E2M3, decomp)).toBe("0.875");

        expect(bitsToRawHex(E2M3, maxSubBits)).toBe("0x07");
        expect(bitsToRawDecimal(maxSubBits)).toBe("7");
        expect(bitsToArray(E2M3, maxSubBits)).toEqual([0, 0, 0, 1, 1, 1]);

        // Negative max subnorm: sign=1, exp=00 (0), mant=111 (7) = 0b1000111 = 0x47
        const maxSubBitsNeg = 0x27n;
        const negValue = bitsToValue(E2M3, maxSubBitsNeg);
        expect(negValue).toBe(-0.875);
      });

      it("should handle min subnorm: S 00 001₂ = ± 0.125", () => {
        const minSubBits = 0x01n;
        const decomp = extract(E2M3, minSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(1n);
        const value = bitsToValue(E2M3, minSubBits);
        expect(value).toBe(0.125);

        // Negative min subnorm: sign=1, exp=00 (0), mant=001 (1) = 0b1000001 = 0x41
        const minSubBitsNeg = 0x21n;
        const negValue = bitsToValue(E2M3, minSubBitsNeg);
        expect(negValue).toBe(-0.125);

        expect(buildBase2Equation(E2M3, decomp)).toBe("(-1)^0 × 10_2^(1 - 01_2) × 0.001_2");
        expect(buildBase10Equation(E2M3, decomp)).toBe("1 × 2^-3");
        expect(getExactBase10Value(E2M3, decomp)).toBe("0.125");

        expect(bitsToRawHex(E2M3, minSubBits)).toBe("0x01");
        expect(bitsToRawDecimal(minSubBits)).toBe("1");
        expect(bitsToArray(E2M3, minSubBits)).toEqual([0, 0, 0, 0, 0, 1]);
      });
    });
    describe("e8m0 format", () => {
      const E8M0 = FORMATS.e8m0;

      describe("E8M0 special cases", () => {
        it("should handle zeros: S 00000000₂ = ± 2^-127", () => {
          // For e8m0 with hasZeroes=false, zero encodes as the smallest normal

          const zeroBits = 0x00n;
          const decomp = extract(E8M0, zeroBits);
          expect(decomp.sign).toBe(0);
          expect(decomp.exponent).toBe(0);
          expect(decomp.significand).toBe(0n);
          const expectedValue = Math.pow(2, 0 - E8M0.exponentBias);
          expect(bitsToValue(E8M0, zeroBits)).toBe(expectedValue);
          expect(Object.is(bitsToValue(E8M0, zeroBits), expectedValue)).toBe(true);
          expect(valueToBits(E8M0, expectedValue)).toEqual(zeroBits);
          expect(composeBits(E8M0, decomp)).toEqual(zeroBits);

          expect(bitsToRawHex(E8M0, zeroBits)).toBe("0x00");
          expect(bitsToRawDecimal(zeroBits)).toBe("0");
          expect(bitsToArray(E8M0, zeroBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
        });

      });
    });
  });

  describe("bfloat16 format", () => {
    const BF16 = FORMATS.bf16;
    describe("BF16 special cases", () => {
      it("should handle zeros: S 0000000000000000₂ = ± 2^-127", () => {
        const zeroBits = 0x0000n;
        const decomp = extract(BF16, zeroBits);
        expect(decomp.sign).toBe(0);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(0n);
        expect(bitsToValue(BF16, zeroBits)).toBe(0);
        expect(Object.is(bitsToValue(BF16, zeroBits), 0)).toBe(true);
        expect(valueToBits(BF16, 0)).toEqual(zeroBits);
        expect(composeBits(BF16, decomp)).toEqual(zeroBits);

        expect(bitsToRawHex(BF16, zeroBits)).toBe("0x0000");
        expect(bitsToRawDecimal(zeroBits)).toBe("0");
        expect(bitsToArray(BF16, zeroBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      });
      it("should handle min subnorm: S 0000000000000001₂ = ± 2^-127", () => {
        const minSubBits = 0x0001n;
        const decomp = extract(BF16, minSubBits);
        expect(decomp.exponent).toBe(0);
        expect(decomp.significand).toBe(1n);
        const value = bitsToValue(BF16, minSubBits);
        expect(value).toBe(9.18354961579912115600575419704879435795832466228193376178712270530013483949005603790283203125 * Math.pow(10, -41));
        expect(valueToBits(BF16, value)).toEqual(minSubBits);
        expect(composeBits(BF16, decomp)).toEqual(minSubBits);

        expect(bitsToRawHex(BF16, minSubBits)).toBe("0x0001");
        expect(bitsToRawDecimal(minSubBits)).toBe("1");
        expect(bitsToArray(BF16, minSubBits)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
        // TODO: SUS -- Expected: "(-1)^0 × 10_2^(1 - 01111110_2) × 0.0000001_2"
        expect(buildBase2Equation(BF16, decomp)).toBe("(-1)^0 × 10_2^(1 - 01111111_2) × 0.0000001_2");
        expect(buildBase10Equation(BF16, decomp)).toBe("1 × 2^-126 × 0.0078125");
        expect(getExactBase10Value(BF16, decomp)).toBe("9.18354961579912115600575419704879435795832466228193376178712270530013483949005603790283203125×10-41");
      });
    });
  });

  describe("clampDecomposed & composeBits", () => {
    it("should work for e5m2", () => {
      const E5M2 = FORMATS.e5m2;
      // max exp is 31, max sig is 3n
      expect(
        clampDecomposed(E5M2, { sign: 15, exponent: 999, significand: 25n })
      ).toEqual({ sign: 1, exponent: 31, significand: 3n });
    });
    it("should work for e4m3", () => {
      const E4M3 = FORMATS.e4m3;
      // max exp is 15, max sig is 7n
      expect(
        clampDecomposed(E4M3, { sign: 15, exponent: 999, significand: 25n })
      ).toEqual({ sign: 1, exponent: 15, significand: 7n });
    });

  });


});
