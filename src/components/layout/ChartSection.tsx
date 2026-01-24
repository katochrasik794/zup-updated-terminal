import dynamic from 'next/dynamic'

const TVChartContainer = dynamic(
  () => import('../chart/TVChartContainer'),
  { ssr: false }
)

export default function ChartSection() {
  return (
    <div className="flex-1 bg-[#1c1c1c] relative h-full overflow-hidden rounded-md border border-gray-800">
      <TVChartContainer />
    </div>
  )
}