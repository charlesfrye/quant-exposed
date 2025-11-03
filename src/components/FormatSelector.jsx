export default function FormatSelector({ formats, selectedFormat, onFormatChange }) {

  return (
    <section className="flex justify-center">
      <div className="flex border border-zinc-700 rounded-lg overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-500 scrollbar-track-transparent w-full max-w-full sm:w-max scroll-smooth snap-x">
        {Object.entries(formats).map(([k, s], index, array) => {
          const isLast = index === array.length - 1;
          const isSelected = k === selectedFormat;

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
              <span className="sm:inline">{s.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
