export default function BaseNField({ label, value }) {
  return (
    <div className="w-full">
      <div className="text-zinc-500 text-center">{label}</div>
      <div className="text-xl font-semibold tracking-tight text-center font-mono break-all overflow-wrap-anywhere">
        {value}
      </div>
    </div>
  );
}

