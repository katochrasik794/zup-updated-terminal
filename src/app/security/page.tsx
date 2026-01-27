export const metadata = {
  title: 'Security Instructions | Zuperior Terminal',
  description: 'Security Instructions for Zuperior Terminal',
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Security Instructions</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Account Security</h2>
            <p className="text-white/80">
              Protect your account with strong, unique passwords and enable two-factor authentication when available.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Secure Connection</h2>
            <p className="text-white/80">
              Always ensure you are using a secure connection (HTTPS) when accessing your account. Avoid using public Wi-Fi networks for trading activities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Phishing Awareness</h2>
            <p className="text-white/80">
              Be cautious of emails or messages claiming to be from Zuperior Terminal. We will never ask for your password via email or phone.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Regular Monitoring</h2>
            <p className="text-white/80">
              Regularly review your account activity and report any suspicious transactions immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Device Security</h2>
            <p className="text-white/80">
              Keep your devices updated with the latest security patches and use reputable antivirus software.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
