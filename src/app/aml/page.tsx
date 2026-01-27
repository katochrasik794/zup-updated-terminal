export const metadata = {
  title: 'Preventing Money Laundering | Zuperior Terminal',
  description: 'Anti-Money Laundering Policy for Zuperior Terminal',
};

export default function AMLPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Preventing Money Laundering</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
            <p className="text-white/80">
              Zuperior Terminal is committed to preventing money laundering and terrorist financing. We comply with all applicable anti-money laundering (AML) laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Customer Due Diligence</h2>
            <p className="text-white/80">
              We are required to verify the identity of our customers and may request additional documentation to comply with regulatory requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Suspicious Activity Reporting</h2>
            <p className="text-white/80">
              We monitor transactions for suspicious activity and report any concerns to the relevant authorities as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Your Cooperation</h2>
            <p className="text-white/80">
              We appreciate your cooperation in providing accurate information and documentation when requested. This helps us maintain the integrity of the financial system.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
