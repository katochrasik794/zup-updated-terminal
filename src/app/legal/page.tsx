export const metadata = {
  title: 'Legal Documents | Zuperior Terminal',
  description: 'Legal Documents for Zuperior Terminal',
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Legal Documents</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Terms and Conditions</h2>
            <p className="text-white/80">
              By using Zuperior Terminal, you agree to our Terms and Conditions. Please read these carefully before using our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Regulatory Compliance</h2>
            <p className="text-white/80">
              Zuperior Terminal operates in compliance with applicable financial regulations and maintains necessary licenses and registrations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Jurisdiction</h2>
            <p className="text-white/80">
              These legal documents are governed by the laws of the jurisdiction in which Zuperior Terminal operates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Updates</h2>
            <p className="text-white/80">
              We reserve the right to update these legal documents from time to time. Continued use of our services constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <p className="text-sm text-white/60 mt-8">
              For specific legal inquiries, please contact our legal department.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
