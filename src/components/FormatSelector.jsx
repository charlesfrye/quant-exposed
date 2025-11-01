export default function FormatSelector({ formats, selectedFormat, onFormatChange }) {
  // Extract short code from format name (e.g., "E4M3" from "FP8 (E4M3)")
  const getShortCode = (name) => {
    const match = name.match(/\(([^)]+)\)/);
    return match ? match[1] : name;
  };

  return (
    <section className="flex justify-center">
      <div className="flex border border-zinc-700 rounded-lg overflow-hidden w-max">
        {Object.entries(formats).map(([k, s], index, array) => {
          const isLast = index === array.length - 1;
          const isSelected = k === selectedFormat;
          const shortCode = getShortCode(s.name);

          return (
            <button
              key={k}
              onClick={() => onFormatChange(k)}
              className={`
                px-2 sm:px-4 py-1 text-xs sm:text-sm
                ${!isLast ? 'border-r border-zinc-700' : ''}
                ${isSelected ? 'bg-zinc-700 text-white' : 'bg-transparent text-zinc-700'}
                transition-colors
              `}
            >
              <span className="sm:hidden">{shortCode}</span>
              <span className="hidden sm:inline">{s.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

