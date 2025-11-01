import { formatEquation } from "@/utils/formatEquation";

export default function BaseNField({ label, value }) {
  // Convert scientific notation (×10-41 or ×104) to format with superscripts (×10^-41 or ×10^4)
  let processedValue = value;
  if (typeof value === "string") {
    // Match patterns like ×10-41, ×10+5, ×104, etc.
    processedValue = value.replace(/×10([+-]?\d+)/g, "×10^$1");
  }

  // Check if the value contains equation formatting (^ or _)
  const hasFormatting = typeof processedValue === "string" && (processedValue.includes("^") || processedValue.includes("_"));
  const formattedValue = hasFormatting ? formatEquation(processedValue) : processedValue;

  return (
    <div className="w-full">
      <div className="text-zinc-500 text-center">{label}</div>
      <div className="text-xl font-semibold tracking-tight text-center font-mono break-all overflow-wrap-anywhere">
        {formattedValue}
      </div>
    </div>
  );
}

