export default function FormatSelector({ formats, selectedFormat, onFormatChange }) {
  return (
    <section className="flex justify-center">
      <div className="flex border border-zinc-700 rounded-lg overflow-hidden w-max">
        {Object.entries(formats).map(([k, s], index, array) => {
          const isFirst = index === 0;
          const isLast = index === array.length - 1;
          const isSelected = k === selectedFormat;

          return (
            <button
              key={k}
              onClick={() => onFormatChange(k)}
              className={`
                px-4 py-1 text-sm
                ${isFirst ? 'rounded-l-lg' : ''}
                ${isLast ? 'rounded-r-lg' : ''}
                ${!isLast ? 'border-r border-zinc-700' : ''}
                ${isSelected ? 'bg-zinc-700 text-white' : 'bg-transparent text-zinc-700'}
                transition-colors
              `}
            >
              {s.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

