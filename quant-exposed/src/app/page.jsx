"use client";

import { useMemo, useState } from "react";
import {
  FORMATS,
  bitsToArray,
  bitsToRawDecimal,
  bitsToRawHex,
  bitsToValue,
  clampDecomposed,
  composeBits,
  extract,
  bitsToHexFloat
} from "@/engine/ieee";

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
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans">
      <main className="flex w-full max-w-4xl flex-col gap-8 p-10">
        <div className="flex gap-2">
          {Object.entries(FORMATS).map(([k, s]) => (
            <button
              key={k}
              onClick={() => changeFormat(k)}
              className={`rounded-full border px-4 py-1 text-sm ${k === formatKey ? "bg-black text-white" : "bg-white"}`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <section className="flex flex-col items-center">
          <div className="text-zinc-500 mb-2 text-center">Value</div>
          <div className="text-4xl sm:text-6xl font-semibold tracking-tight text-center">
            {Number.isNaN(value) ? "NaN" : value.toString()}
          </div>
        </section>

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
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field
            label="Sign"
            value={dec.sign}
            onDec={() => applyDecomposed({ sign: 0 })}
            onInc={() => applyDecomposed({ sign: 1 })}
          />
          <Field
            label="Raw Hexadecimal Integer Value"
            value={rawHex}
            onDec={() => applyDecomposed({ significand: dec.significand - 1n })}
            onInc={() => applyDecomposed({ significand: dec.significand + 1n })}
          />
          <Field
            label="Exponent"
            value={dec.exponent}
            onDec={() => applyDecomposed({ exponent: dec.exponent - 1 })}
            onInc={() => applyDecomposed({ exponent: dec.exponent + 1 })}
          />
          <Field
            label="Raw Decimal Integer Value"
            value={rawDec}
            onDec={() => applyDecomposed({ significand: dec.significand - 1n })}
            onInc={() => applyDecomposed({ significand: dec.significand + 1n })}
          />
          <Field
            label="Significand"
            value={Number(dec.significand)}
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
      </main>
    </div>
  );
}

function Bit({ bit, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`h-10 w-10 rounded-md border text-xl font-semibold ${bit ? "bg-black text-white" : "bg-white"}`}
    >
      {bit}
    </button>
  );
}

function Field({
  label,
  value,
  onDec,
  onInc,
}) {
  return (
    <div className="grid gap-1">
      <div className="text-zinc-500">{label}</div>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 font-mono"
          readOnly
          value={value}
        />
        <div className="flex flex-col gap-px">
          <button
            className="h-5 w-5 rounded-md border font-semibold text-sm leading-none flex items-center justify-center"
            onClick={onInc}
          >
            +
          </button>
          <button
            className="h-5 w-5 rounded-md border font-semibold text-sm leading-none flex items-center justify-center"
            onClick={onDec}
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}


