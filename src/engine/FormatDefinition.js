/**
 * FormatDefinition.js
 * Class to handle calculations and operations for various floating-point formats
 */

export class FormatDefinition {
  /**
   * Constructor for FormatDefinition class
   * @param {Object} formatInfo - Format definition object from constants.js
   */
  constructor(formatInfo) {
    this.formatInfo = formatInfo;

    // basic properties
    this.name = formatInfo.name;
    this.totalBits = formatInfo.totalBits;
    this.exponentBits = formatInfo.exponentBits;
    this.mantissaBits = formatInfo.mantissaBits;
    this.exponentBias = formatInfo.exponentBias;
    this.hasInfinity = formatInfo.hasInfinity;
    this.hasNaN = formatInfo.hasNaN;
    this.nanPatterns = formatInfo.nanPatterns;

    // calculate derived properties
    this.signBits = this.calculateSignBits();

    this.mantissaMask = this.calculateMantissaMask();
    this.exponentMask = this.calculateExponentMask();
    this.signMask = this.calculateSignMask();

    this.minValue = this.calculateMinValue();
    this.maxValue = this.calculateMaxValue();
    this.smallestPositive = this.calculateSmallestPositive();
  }

  /**
   * Calculate the number of sign bits
   * @returns {number} Number of sign bits (0 or 1)
   */
  calculateSignBits() {
    const spareBits =
      this.totalBits - this.exponentBits - this.mantissaBits;
    return spareBits > 0 ? 1 : 0;
  }

  /**
   * Calculate the mask for the mantissa bits
   * @returns {number} Bit mask for mantissa
   */
  calculateMantissaMask() {
    if (this.mantissaBits === 0) return 0;
    return (1 << this.mantissaBits) - 1;
  }

  /**
   * Calculate the mask for the exponent bits
   * @returns {number} Bit mask for exponent
   */
  calculateExponentMask() {
    const mask =
      ((1 << this.exponentBits) - 1) << this.mantissaBits;
    return mask;
  }

  /**
   * Calculate the mask for the sign bit
   * @returns {number} Bit mask for sign
   */
  calculateSignMask() {
    if (this.signBits === 0) return 0;
    return 1 << (this.totalBits - 1);
  }

  /**
   * Calculate the minimum representable value
   * @returns {number} Minimum representable value
   */
  calculateMinValue() {
    if (this.signBits === 0) {
      // If no sign bit, the minimum is the smallest positive number
      return this.calculateSmallestPositive();
    } else {
      // With sign bit, the minimum is the negative of the max value
      return -this.calculateMaxValue();
    }
  }

  /**
   * Calculate the maximum representable value
   * @returns {number} Maximum representable value
   */
  calculateMaxValue() {
    // All exponent bits set (except for the highest if NaN/Infinity are supported)
    // and all mantissa bits set
    let maxExponent = (1 << this.exponentBits) - 1;

    // If the format supports NaN/Infinity, the highest exponent is reserved
    if (this.hasInfinity || this.hasNaN) {
      maxExponent -= 1;
    }

    // Calculate using the standard floating-point formula:
    // (-1)^sign * 2^(exp-bias) * (1 + mantissa/2^mantissaBits)
    const expValue = Math.pow(2, maxExponent - this.exponentBias);
    const mantissaValue = 1 + (1 - Math.pow(2, -this.mantissaBits));

    return expValue * mantissaValue;
  }

  /**
   * Calculate the smallest positive representable value
   * @returns {number} Smallest positive representable value
   */
  calculateSmallestPositive() {
    // Smallest positive value is with minimum exponent and zero mantissa
    // Denormals would be smaller, but we're ignoring them for now
    const minExponent = 1; // Assuming 0 is reserved for denormals
    const expValue = Math.pow(2, minExponent - this.exponentBias);
    return expValue;
  }

  /**
   * Check if a bit pattern represents NaN
   * @param {number} bits - The bit pattern to check
   * @returns {boolean} True if the pattern represents NaN
   */
  isNaN(bits) {
    if (!this.hasNaN) return false;

    if (this.nanPatterns) {
      return this._matchesPatterns(bits, this.nanPatterns);
    }

    // otherwise, NaN if exponent is all 1s and mantissa is non-zero
    const exponent = this.extractExponent(bits);
    const mantissa = this.extractMantissa(bits);

    return (
      exponent === (1 << this.exponentBits) - 1 &&
      (this.mantissaBits == 0 || mantissa !== 0)
    );
  }

  /**
   * Check if a bit pattern represents infinity
   * @param {number} bits - The bit pattern to check
   * @returns {boolean} True if the pattern represents infinity
   */
  isInfinity(bits) {
    if (!this.hasInfinity) return false;

    // otherwise, infinity if all exponent bits set and zero mantissa
    const exponent = this.extractExponent(bits);
    const mantissa = this.extractMantissa(bits);

    return (
      exponent === (1 << this.exponentBits) - 1 &&
      mantissa === 0
    );
  }

  /**
   * Extract the sign bit from a bit pattern
   * @param {number} bits - The bit pattern
   * @returns {number} 0 for positive, 1 for negative
   */
  extractSign(bits) {
    if (this.signBits === 0) return 0;
    return (bits & this.signMask) !== 0 ? 1 : 0;
  }

  /**
   * Extract the exponent from a bit pattern
   * @param {number} bits - The bit pattern
   * @returns {number} The extracted exponent value
   */
  extractExponent(bits) {
    return (bits & this.exponentMask) >> this.mantissaBits;
  }

  /**
   * Extract the mantissa from a bit pattern
   * @param {number} bits - The bit pattern
   * @returns {number} The extracted mantissa value
   */
  extractMantissa(bits) {
    return bits & this.mantissaMask;
  }

  /**
   * Convert a bit pattern to its corresponding floating-point value
   * @param {number} bits - The bit pattern
   * @returns {number} The floating-point value
   */
  bitsToValue(bits) {
    if (this.hasNaN && this.isNaN(bits)) return NaN;
    if (this.hasInfinity && this.isInfinity(bits)) {
      const sign = this.extractSign(bits);
      return sign ? -Infinity : Infinity;
    }

    // extract components
    const sign = this.extractSign(bits);
    const exponent = this.extractExponent(bits);
    const mantissa = this.extractMantissa(bits);

    // handle denormals and zeros
    if (exponent === 0) {
      if (mantissa === 0) {
        // Special case: formats without zero support (e.g., e8m0) treat zero as 2^-bias
        if (this.formatInfo.hasZeroes === false) {
          const value = Math.pow(2, 0 - this.exponentBias);
          return sign ? -value : value;
        }
        return sign ? -0 : 0;
      } else {
        // denormals
        const value =
          Math.pow(2, 1 - this.exponentBias) *
          (mantissa /
            Math.pow(2, this.mantissaBits));
        return sign ? -value : value;
      }
    }

    // Normal numbers
    // Value = (-1)^sign * 2^(exp-bias) * (1 + mantissa*2^-mantissaBits)
    const value =
      Math.pow(2, exponent - this.exponentBias) *
      (1 + mantissa / Math.pow(2, this.mantissaBits));
    return sign ? -value : value;
  }

  /**
   * Get all possible values for this format
   * @returns {Array} Array of objects containing bit patterns and their values
   */
  getAllValues() {
    const values = [];
    const maxBits = 1 << this.totalBits;

    for (let bits = 0; bits < maxBits; bits++) {
      const value = this.bitsToValue(bits);
      values.push({
        bits,
        value,
        sign: this.extractSign(bits),
        exponent: this.extractExponent(bits),
        mantissa: this.extractMantissa(bits),
      });
    }

    return values;
  }

  _matchesPatterns(bits, patterns) {
    return patterns.some((value) => (bits & value) === value);
  }
}
