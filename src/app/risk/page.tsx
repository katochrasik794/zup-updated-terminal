export const metadata = {
  title: 'Risk Disclosure | Zuperior Terminal',
  description: 'Risk Disclosure Statement for Zuperior Terminal',
};

export default function RiskPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Risk Disclosure</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Trading Risks</h2>
            <p className="text-white/80">
              Trading in financial instruments involves substantial risk of loss. You should carefully consider whether trading is suitable for you in light of your circumstances, knowledge, and financial resources.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Market Risks</h2>
            <p className="text-white/80">
              Market conditions can change rapidly and may result in significant losses. Past performance is not indicative of future results.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Leverage Risks</h2>
            <p className="text-white/80">
              Trading on margin or with leverage can amplify both profits and losses. You may lose more than your initial investment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Technical Risks</h2>
            <p className="text-white/80">
              Technical issues, system failures, or connectivity problems may affect your ability to execute trades or manage positions.
            </p>
          </section>

          <section>
            <p className="text-sm text-white/60 mt-8">
              Please ensure you fully understand the risks involved before trading.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
