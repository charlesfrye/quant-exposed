import { formatEquation } from "@/utils/formatEquation";

export default function BaseNField({ label, value }) {
  // Check if the value contains equation formatting (^ or _)
  const hasFormatting = typeof value === "string" && (value.includes("^") || value.includes("_"));
  const formattedValue = hasFormatting ? formatEquation(value) : value;

  return (
    <div className="w-full">
      <div className="text-zinc-500 text-center">{label}</div>
      <div className="text-xl font-semibold tracking-tight text-center font-mono break-all overflow-wrap-anywhere">
        {formattedValue}
      </div>
    </div>
  );
}

