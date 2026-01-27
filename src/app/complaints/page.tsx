export const metadata = {
  title: 'Complaints Handling Policy | Zuperior Terminal',
  description: 'Complaints Handling Policy for Zuperior Terminal',
};

export default function ComplaintsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Complaints Handling Policy</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
            <p className="text-white/80">
              Zuperior Terminal is committed to handling all complaints fairly, promptly, and transparently. We take customer feedback seriously and strive to resolve issues to your satisfaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">How to Submit a Complaint</h2>
            <p className="text-white/80">
              You can submit a complaint through:
            </p>
            <ul className="list-disc list-inside text-white/80 space-y-2 ml-4">
              <li>Our customer support portal</li>
              <li>Email to our support team</li>
              <li>Phone support during business hours</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Response Time</h2>
            <p className="text-white/80">
              We aim to acknowledge your complaint within 24 hours and provide a resolution or update within 5 business days. Complex issues may require additional time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Escalation</h2>
            <p className="text-white/80">
              If you are not satisfied with our response, you may escalate your complaint to our management team or relevant regulatory authority.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Record Keeping</h2>
            <p className="text-white/80">
              All complaints are recorded and tracked to ensure proper handling and to help us improve our services.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
