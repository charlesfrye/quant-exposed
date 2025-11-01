"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FORMATS,
  bitsToArray,
  bitsToRawDecimal,
  bitsToRawHex,
  bitsToValue,
  clampDecomposed,
  composeBits,
  extract,
  bitsToHexFloat,
  buildBase2Equation,
  buildBase10Equation,
  getExactBase10Value,
  valueToBits,
  formatFiniteWith20DigitRule,
  normalizeInputValue,
} from "@/engine/ieee";

import LineBreak from "@/components/LineBreak";
import Field from "@/components/Field";
import BaseNField from "@/components/BaseNField";
import FormatSelector from "@/components/FormatSelector";
import BitPattern from "@/components/BitPattern";

export default function Home() {

  const firstFormatKey = Object.keys(FORMATS)[0];
  const [formatKey, setFormatKey] = useState(firstFormatKey);
  const spec = FORMATS[formatKey];

  const [bits, setBits] = useState(0n);

  const dec = useMemo(() => extract(spec, bits), [spec, bits]);
  const bitArray = useMemo(() => bitsToArray(spec, bits), [spec, bits]);

  const value = useMemo(() => bitsToValue(spec, bits), [spec, bits]);
  const rawHex = useMemo(() => bitsToRawHex(spec, bits), [spec, bits]);
  const rawDec = useMemo(() => bitsToRawDecimal(bits), [bits]);
  const hexFloat = useMemo(() => bitsToHexFloat(spec, bits), [spec, bits]);

  const base2Text = useMemo(() => buildBase2Equation(spec, dec), [spec, dec]);
  const base10Text = useMemo(() => buildBase10Equation(spec, dec), [spec, dec]);
  const exactText = useMemo(() => getExactBase10Value(spec, dec), [spec, dec]);

  const [valueText, setValueText] = useState("");

  useEffect(() => {
    setValueText(
      Number.isNaN(value)
        ? "NaN"
        : (Number.isFinite(value) ? formatFiniteWith20DigitRule(value) : String(value))
    );
  }, [spec, bits, value]);

  function handleValueChange(e) {
    setValueText(e.target.value);
  }

  function commitValue() {
    const text = valueText;
    const trimmed = text.trim().toLowerCase();
    if (trimmed === "nan") {
      setBits(valueToBits(spec, NaN));
      return;
    }
    if (trimmed === "+inf" || trimmed === "inf" || trimmed === "+infinity" || trimmed === "infinity") {
      setBits(valueToBits(spec, Infinity));
      return;
    }
    if (trimmed === "-inf" || trimmed === "-infinity") {
      setBits(valueToBits(spec, -Infinity));
      return;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
      const { value: normalizedValue, displayText } = normalizeInputValue(spec, parsed);
      setBits(valueToBits(spec, normalizedValue));
      // Only set displayText if provided (for overflow cases).
      // Otherwise, let useEffect handle it based on the actual bits value
      // to avoid bouncing when the value can't be exactly represented.
      if (displayText !== undefined) {
        setValueText(displayText);
      }
      // For non-overflow cases, useEffect will update valueText from the bits
    } else if (parsed === Infinity) {
      setValueText("Infinity");
      setBits(valueToBits(spec, Infinity));
    } else if (parsed === -Infinity) {
      setValueText("-Infinity");
      setBits(valueToBits(spec, -Infinity));
    } else {
      // Revert display to current computed value
      setValueText(
        Number.isNaN(value)
          ? "NaN"
          : (Number.isFinite(value) ? formatFiniteWith20DigitRule(value) : String(value))
      );
    }
  }

  function applyDecomposed(update) {
    const next = clampDecomposed(spec, { ...dec, ...update });
    setBits(composeBits(spec, next));
  }

  function toggleBit(indexFromLeft) {
    const pos = BigInt(spec.totalBits - 1 - indexFromLeft);
    const mask = 1n << pos;
    setBits((prev) => (prev & mask) !== 0n ? prev & ~mask : prev | mask);
  }

  function changeFormat(next) {
    if (next === formatKey) return;
    const nextSpec = FORMATS[next];
    const carried = clampDecomposed(nextSpec, {
      sign: dec.sign,
      exponent: dec.exponent,
      significand: dec.significand,
    });
    setBits(composeBits(nextSpec, carried));
    setFormatKey(next);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans overflow-x-hidden">
      <main className="flex w-full max-w-4xl flex-col gap-4 sm:gap-8 p-4 sm:p-8">
        <FormatSelector
          formats={FORMATS}
          selectedFormat={formatKey}
          onFormatChange={changeFormat}
        />

        <section className="flex flex-col items-center w-full">
          <div className="text-zinc-500 mb-1 sm:mb-2 text-center">Value</div>
          <input
            className="text-4xl sm:text-6xl font-semibold tracking-tight text-center bg-transparent outline-none w-full max-w-full h-16"
            value={valueText}
            onChange={handleValueChange}
            onBlur={commitValue}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitValue(); } }}
          />
        </section>

        <LineBreak />

        <section className="flex flex-col items-center">
          <BitPattern bitArray={bitArray} spec={spec} toggleBit={toggleBit} />
        </section>

        <LineBreak />

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <Field
            label="Sign"
            value={dec.sign}
            onDec={() => applyDecomposed({ sign: 0 })}
            onInc={() => applyDecomposed({ sign: 1 })}
          />
          <Field
            label="Exponent"
            value={dec.exponent}
            onDec={() => applyDecomposed({ exponent: dec.exponent - 1 })}
            onInc={() => applyDecomposed({ exponent: dec.exponent + 1 })}
          />
          <Field
            label="Significand"
            value={Number(dec.significand)}
            onDec={() => applyDecomposed({ significand: dec.significand - 1n })}
            onInc={() => applyDecomposed({ significand: dec.significand + 1n })}
          />
          <Field
            label="Raw Hexadecimal Integer Value"
            value={rawHex}
            onDec={() => applyDecomposed({ significand: dec.significand - 1n })}
            onInc={() => applyDecomposed({ significand: dec.significand + 1n })}
          />
          <Field
            label="Raw Decimal Integer Value"
            value={rawDec}
            onDec={() => applyDecomposed({ significand: dec.significand - 1n })}
            onInc={() => applyDecomposed({ significand: dec.significand + 1n })}
          />
          <Field
            label='Hexadecimal Form ("%a")'
            value={hexFloat}
            onDec={() => applyDecomposed({ significand: dec.significand - 1n })}
            onInc={() => applyDecomposed({ significand: dec.significand + 1n })}
          />
        </section>

        <LineBreak />

        <section className="flex flex-col items-center gap-3 sm:gap-6">
          <BaseNField label="Evaluation in Base-2" value={base2Text} />
          <BaseNField label="Evaluation in Base-10" value={base10Text} />
          <BaseNField label="Exact Base-10 Value" value={exactText} />
        </section>

        {/* <LineBreak /> */}

        <footer className="mt-8 sm:mt-16 mb-4 sm:mb-6 text-center text-sm text-zinc-400">
          Inspired by <a href="https://float.exposed" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">float.exposed</a>.{" "}
          Read the <a href="https://github.com/opencomputeproject/HW-SIG-Microscaling-FP" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">OCP MX FP spec</a>.{" "}
          Try <a href="https://modal.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">modal.com</a>.
        </footer>
      </main>
    </div>
  );
}




