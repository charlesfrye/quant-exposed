/**
 * OCP Microscaling Formats (MX) Specifications
 * Contains definitions for FP8, FP6, and FP4 formats
 */

export const FORMATS = {
	e4m3: {
		name: "FP8 (E4M3)",
		totalBits: 8,
		exponentBits: 4,
		mantissaBits: 3,
		exponentBias: 7,
		hasInfinity: false,
		hasNaN: true,
		nanPatterns: [0b011111_11], // all mantissa bits must also be 1
	},
	e5m2: {
		name: "FP8 (E5M2)",
		totalBits: 8,
		exponentBits: 5,
		mantissaBits: 2,
		exponentBias: 15,
		hasInfinity: true,
		hasNaN: true,
	},
	e8m0: {
		name: "E8 (E8M0)",
		totalBits: 8,
		exponentBits: 8,
		mantissaBits: 0,
		exponentBias: 127,
		hasInfinity: false,
		hasNaN: true,
	},
	e2m3: {
		name: "FP6 (E2M3)",
		totalBits: 6,
		exponentBits: 2,
		mantissaBits: 3,
		exponentBias: 1,
		hasInfinity: false,
		hasNaN: false,
	},
	e3m2: {
		name: "FP6 (E3M2)",
		totalBits: 6,
		exponentBits: 3,
		mantissaBits: 2,
		exponentBias: 3,
		hasInfinity: false,
		hasNaN: false,
	},
	e2m1: {
		name: "FP4 (E2M1)",
		totalBits: 4,
		exponentBits: 2,
		mantissaBits: 1,
		exponentBias: 1,
		hasInfinity: false,
		hasNaN: false,
	},
};
