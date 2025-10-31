export default function Field({
  label,
  value,
  onDec,
  onInc,
}) {
  return (
    <div className="grid gap-1 min-w-0">
      <div className="text-zinc-500 font-mono text-xs">{label.toUpperCase()}</div>
      <div className="flex items-center gap-1 min-w-0">
        <input
          className="flex-1 min-w-0 rounded-md border px-3 py-2 font-mono"
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

