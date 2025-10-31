export default function Bit({ bit, title, onClick }) {
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

