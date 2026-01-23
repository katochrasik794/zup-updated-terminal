import TradingViewWidget from '../widgets/TradingViewWidget'

export default function ChartSection() {
  return (
    <div className="flex-1 bg-[#1c1c1c] relative h-full overflow-hidden rounded-md">
      <TradingViewWidget />
    </div>
  )
}