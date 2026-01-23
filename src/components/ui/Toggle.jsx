export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-[#545b64] rounded-full peer peer-checked:bg-[#7f8792] peer-focus:outline-none transition-colors relative">
        <div className={`absolute top-0.5 left-0.5 bg-white rounded-full h-4 w-4 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
      </div>
    </label>
  )
}
