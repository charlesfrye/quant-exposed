/**
 * FormatDefinition.test.js
 * Unit tests for FormatDefinition class
 */

import { FormatDefinition } from "../../src/engine/FormatDefinition";
import { FORMATS } from "../../src/engine/constants";

describe("FormatDefinition", () => {
	describe("e4m3 format", () => {
		let format;

		beforeEach(() => {
			format = new FormatDefinition(FORMATS.e4m3);
		});

		test("should initialize with correct properties", () => {
			expect(format.name).toBe("E4M3 (FP8)");
			expect(format.totalBits).toBe(8);
			expect(format.exponentBits).toBe(4);
			expect(format.mantissaBits).toBe(3);
			expect(format.signBits).toBe(1);
			expect(format.exponentBias).toBe(7);
		});

		test("should calculate correct masks", () => {
			expect(format.mantissaMask).toBe(0b00000111);
			expect(format.exponentMask).toBe(0b01111000);
			expect(format.signMask).toBe(0b10000000);
		});

		test("should extract components correctly", () => {
			const bits = 0b10110010;

			expect(format.extractSign(bits)).toBe(1);
			expect(format.extractExponent(bits)).toBe(0b0110);
			expect(format.extractMantissa(bits)).toBe(0b010);
		});

		test("should convert from bits to values", () => {
			const testCases = [
				{ bits: 0b00000000, value: 0 }, // +0
				{ bits: 0b10000000, value: -0 }, // -0
				{ bits: 0b00111000, value: 1 }, // +1
				{ bits: 0b10111000, value: -1 }, // -1
				{ bits: 0b01111110, value: 448 }, // Max positive value
				{ bits: 0b11111110, value: -448 }, // Min negative value
			];

			for (const { bits, value } of testCases) {
				expect(format.bitsToValue(bits)).toBe(value);
			}
		});

		test("should handle NaN correctly", () => {
			// one NaN has all bits set
			const nanBits = 0b11111111;

			expect(format.isNaN(nanBits)).toBe(true);
			expect(Number.isNaN(format.bitsToValue(nanBits))).toBe(
				true
			);
		});
	});

	describe("e8m0 format (no sign bit)", () => {
		let format;

		beforeEach(() => {
			format = new FormatDefinition(FORMATS.e8m0);
		});

		test("should initialize with correct properties", () => {
			expect(format.name).toBe("E8M0 (E8)");
			expect(format.totalBits).toBe(8);
			expect(format.exponentBits).toBe(8);
			expect(format.mantissaBits).toBe(0);
			expect(format.signBits).toBe(0);
			expect(format.exponentBias).toBe(127);
		});

		test("should calculate correct masks", () => {
			expect(format.mantissaMask).toBe(0);
			expect(format.exponentMask).toBe(0xff);
			expect(format.signMask).toBe(0);
		});

		test("should always return positive values", () => {
			const value = format.bitsToValue(0xf0);
			expect(value).toBeGreaterThan(0);
		});

		test("should return powers of two", () => {
			const value = format.bitsToValue(0xfe);
			expect(value).toBe(Math.pow(2, 127));
		});

		test("all ones is NaN", () => {
			expect(format.isNaN(0xff)).toBe(true);
		});
	});

	describe("e2m1 format (FP4)", () => {
		let format;

		beforeEach(() => {
			format = new FormatDefinition(FORMATS.e2m1);
		});

		test("should initialize with correct properties", () => {
			expect(format.name).toBe("E2M1 (FP4)");
			expect(format.totalBits).toBe(4);
			expect(format.exponentBits).toBe(2);
			expect(format.mantissaBits).toBe(1);
			expect(format.signBits).toBe(1);
			expect(format.exponentBias).toBe(1);
		});

		test("should calculate correct range values", () => {
			expect(format.minValue).toBeLessThan(0);
			expect(format.maxValue).toBeGreaterThan(0);
			expect(format.smallestPositive).toBeGreaterThan(0);
		});
	});
});
