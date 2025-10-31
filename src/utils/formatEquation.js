import React from "react";

/**
 * Formats an equation string with superscripts and subscripts.
 * 
 * Handles:
 * - `^` for superscripts (e.g., `(-1)^0`, `2^(...)`)
 * - `_2` for subscripts (e.g., `01111111_2`, `1.0000000_2`)
 * - `×` for multiplication
 * 
 * @param {string} equation - The equation string to format
 * @returns {Array} Array of React elements and strings
 */
export function formatEquation(equation) {
  const result = [];
  let i = 0;
  let keyCounter = 0;

  while (i < equation.length) {
    // Handle superscript: ^
    if (equation[i] === '^') {
      i++; // Skip '^'

      // Determine the superscript content
      let supContent = '';
      let parenDepth = 0;

      // If starts with '(', parse until matching ')'
      if (equation[i] === '(') {
        parenDepth = 1;
        i++; // Skip '('
        while (i < equation.length && parenDepth > 0) {
          if (equation[i] === '(') {
            parenDepth++;
            supContent += equation[i];
          } else if (equation[i] === ')') {
            parenDepth--;
            if (parenDepth > 0) {
              supContent += equation[i];
            }
          } else {
            supContent += equation[i];
          }
          i++;
        }
      } else {
        // Single value or simple expression
        while (i < equation.length &&
          equation[i] !== ' ' &&
          equation[i] !== '×' &&
          equation[i] !== '_' &&
          equation[i] !== '^') {
          supContent += equation[i];
          i++;
        }
      }

      // Recursively format the superscript content (in case it has subscripts)
      const formattedSup = formatEquationContent(supContent, keyCounter);
      keyCounter++;
      result.push(
        <sup key={`sup-${keyCounter}`} className="align-baseline">
          {formattedSup}
        </sup>
      );
      continue;
    }

    // Handle subscript: _2, _10, etc.
    if (equation[i] === '_') {
      i++; // Skip '_'
      let subContent = '';
      while (i < equation.length && /[0-9]/.test(equation[i])) {
        subContent += equation[i];
        i++;
      }
      keyCounter++;
      result.push(
        <sub key={`sub-${keyCounter}`} className="align-baseline">
          {subContent}
        </sub>
      );
      continue;
    }

    // Regular character
    let regularText = '';
    while (i < equation.length &&
      equation[i] !== '^' &&
      equation[i] !== '_') {
      regularText += equation[i];
      i++;
    }

    if (regularText) {
      result.push(regularText);
    }
  }

  return result;
}

/**
 * Helper function to format content that may contain subscripts but no superscripts.
 * Used recursively for superscript content.
 */
function formatEquationContent(content, baseKey) {
  const result = [];
  let i = 0;
  let keyCounter = 0;

  while (i < content.length) {
    // Handle subscript: _2, _10, etc.
    if (content[i] === '_') {
      i++; // Skip '_'
      let subContent = '';
      while (i < content.length && /[0-9]/.test(content[i])) {
        subContent += content[i];
        i++;
      }
      keyCounter++;
      result.push(
        <sub key={`sub-inline-${baseKey}-${keyCounter}`} className="align-baseline">
          {subContent}
        </sub>
      );
      continue;
    }

    // Regular character
    result.push(content[i]);
    i++;
  }

  return result;
}

