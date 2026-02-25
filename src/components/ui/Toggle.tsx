export default function Toggle({ checked, onChange, label }: { checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, label?: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-gray-600 rounded-full peer peer-checked:bg-gray-500 peer-focus:outline-none transition-colors relative">
        <div className={`absolute top-0.5 left-0.5 bg-foreground rounded-full h-4 w-4 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
      </div>
    </label>
  )
}
