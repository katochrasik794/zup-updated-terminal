export const metadata = {
  title: 'Privacy Agreement | Zuperior Terminal',
  description: 'Privacy Agreement for Zuperior Terminal',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Agreement</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-white/80">
              This Privacy Agreement outlines how Zuperior Terminal collects, uses, and protects your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="text-white/80">
              We collect information that you provide directly to us, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2 ml-4">
              <li>Account registration information</li>
              <li>Contact details</li>
              <li>Trading activity data</li>
              <li>Device and usage information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-white/80">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2 ml-4">
              <li>Provide and maintain our services</li>
              <li>Process transactions and manage your account</li>
              <li>Communicate with you about our services</li>
              <li>Comply with legal and regulatory requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Protection</h2>
            <p className="text-white/80">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
            <p className="text-white/80">
              You have the right to access, update, or delete your personal information. You may also opt out of certain communications from us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Contact Us</h2>
            <p className="text-white/80">
              If you have any questions about this Privacy Agreement, please contact us through our support channels.
            </p>
          </section>

          <section>
            <p className="text-sm text-white/60 mt-8">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
