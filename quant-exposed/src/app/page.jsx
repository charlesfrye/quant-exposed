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
} from "@/engine/ieee";

import Bit from "@/components/Bit";
import LineBreak from "@/components/LineBreak";
import Field from "@/components/Field";
import BaseNField from "@/components/BaseNField";
import FormatSelector from "@/components/FormatSelector";

export default function Home() {
  const [formatKey, setFormatKey] = useState("e4m3");
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
  const exactText = useMemo(() => getExactBase10Value(spec, dec, value), [spec, dec, value]);

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
      // check for overflow based on format's representable range
      let sign = parsed < 0 ? -1 : 1;
      let ax = Math.abs(parsed);
      let maxVal = spec.maxValue;
      let minVal = spec.minValue;

      let willOverflow = (sign > 0 && ax > maxVal) || (sign < 0 && -ax < minVal);

      if (willOverflow) {
        if (spec.hasInfinity) {
          setValueText(sign > 0 ? "Infinity" : "-Infinity");
          setBits(valueToBits(spec, sign > 0 ? Infinity : -Infinity));
        } else if (spec.hasNaN) {
          setValueText("NaN");
          setBits(valueToBits(spec, NaN));
        } else {
          // Clamp to maximal value for this format
          setValueText(
            sign > 0
              ? (Number.isFinite(maxVal) ? formatFiniteWith20DigitRule(maxVal) : String(maxVal))
              : (Number.isFinite(minVal) ? formatFiniteWith20DigitRule(minVal) : String(minVal))
          );
          setBits(valueToBits(spec, sign > 0 ? maxVal : minVal));
        }
      } else {
        setBits(valueToBits(spec, parsed));
      }
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

  const groups = useMemo(() => {
    return [1, spec.exponentBits, spec.mantissaBits];
  }, [spec]);

  const [g1, g2, g3] = groups;

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans overflow-x-hidden">
      <main className="flex w-full max-w-4xl flex-col gap-8 p-10">
        <FormatSelector
          formats={FORMATS}
          selectedFormat={formatKey}
          onFormatChange={changeFormat}
        />

        <section className="flex flex-col items-center w-full">
          <div className="text-zinc-500 mb-2 text-center">Value</div>
          <input
            className="text-4xl sm:text-6xl font-semibold tracking-tight text-center bg-transparent outline-none w-full max-w-full h-12"
            value={valueText}
            onChange={handleValueChange}
            onBlur={commitValue}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitValue(); } }}
          />
        </section>
        <LineBreak />
        <section className="flex flex-col items-center">
          <div className="text-zinc-500 mb-2 text-center">Bit Pattern</div>
          <div className="flex flex-wrap gap-4 text-2xl font-mono justify-center">
            <div className="flex flex-col items-center">

              <div className="flex gap-1">
                {bitArray.slice(0, g1).map((b, i) => (
                  <Bit key={`s-${i}`} bit={b} title="Sign" onClick={() => toggleBit(i)} />
                ))}
              </div>
              <div className="text-xs text-zinc-500 mb-1">Sign</div>
            </div>
            <div className="flex flex-col items-center">

              <div className="flex gap-1">
                {bitArray.slice(g1, g1 + g2).map((b, i) => (
                  <Bit key={`e-${i}`} bit={b} title="Exponent" onClick={() => toggleBit(g1 + i)} />
                ))}
              </div>
              <div className="text-xs text-zinc-500 mb-1">Exponent</div>
            </div>
            {g3 > 0 && (
              <div className="flex flex-col items-center">
                <div className="flex gap-1">
                  {bitArray
                    .slice(g1 + g2, g1 + g2 + g3)
                    .map((b, i) => (
                      <Bit
                        key={`m-${i}`}
                        bit={b}
                        title="Significand"
                        onClick={() => toggleBit(g1 + g2 + i)}
                      />
                    ))}
                </div>
                <div className="text-xs text-zinc-500 mb-1">Significand</div>
              </div>
            )}
          </div>
        </section>

        <LineBreak />

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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

        <section className="flex flex-col items-center gap-6">
          <BaseNField label="Evaluation in Base-2" value={base2Text} />
          <BaseNField label="Evaluation in Base-10" value={base10Text} />
          <BaseNField label="Exact Base-10 Value" value={exactText} />
        </section>
      </main>
    </div>
  );
}




