import Bit from "@/components/Bit";

export default function BitPattern({ bitArray, spec, toggleBit }) {
  // Number of sign bits is what is left after accounting for exponent and mantissa
  const g1 = spec.totalBits - spec.exponentBits - spec.mantissaBits;
  const g2 = spec.exponentBits;
  const g3 = spec.mantissaBits;

  return (
    <>
      <div className="text-zinc-500 mb-2 text-center">Bit Pattern</div>
      <div className="flex flex-wrap gap-4 text-2xl font-mono justify-center">
        {g1 > 0 && (
          <div className="flex flex-col items-center">
            <div className="flex gap-1">
              {bitArray.slice(0, g1).map((b, i) => (
                <Bit key={`s-${i}`} bit={b} title="Sign" onClick={() => toggleBit(i)} />
              ))}
            </div>
            <div className="text-xs text-zinc-500 mb-1">Sign</div>
          </div>
        )}
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
    </>
  );
}
