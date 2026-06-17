export default function PresetCard({ preset, selected, onClick }) {
  const categoryColors = {
    indoor: 'text-orange-400',
    outdoor: 'text-green-400',
    golden_hour: 'text-yellow-400',
    night: 'text-indigo-400',
    flash: 'text-blue-400',
    general: 'text-gray-400',
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3 border transition-all ${
        selected
          ? 'bg-accent/15 border-accent/40 shadow-md shadow-accent/10'
          : 'bg-surface-800 border-surface-600 hover:border-surface-500 hover:bg-surface-700'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none mt-0.5 shrink-0">{preset.icon}</span>
        <div className="min-w-0">
          <p className={`text-sm font-medium leading-tight ${selected ? 'text-accent' : 'text-white'}`}>
            {preset.name}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight line-clamp-2">
            {preset.description}
          </p>
          <span className={`text-[10px] font-medium mt-1 inline-block ${categoryColors[preset.category] || 'text-gray-500'}`}>
            {preset.category}
          </span>
        </div>
      </div>
    </button>
  )
}
