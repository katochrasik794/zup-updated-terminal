"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LoadingWave } from "@/components/ui/loading-wave"
import { authApi } from "@/lib/api"

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [success, setSuccess] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (!email) {
      setError("Please enter your email address")
      return
    }

    setIsLoading(true)

    try {
      // TODO: Implement password reset API endpoint
      // For now, we'll simulate the request
      await new Promise(resolve => setTimeout(resolve, 1000))

      // If API endpoint exists, uncomment this:
      // await authApi.forgotPassword({ email })

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image
              src="/logo-full.png"
              alt="Zuperior Terminal"
              width={150}
              height={50}
              className="h-12 w-auto"
              unoptimized
              priority
            />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg p-8 shadow-lg">
          <div className="mb-6">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Forgot Password?
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Check your email
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button
                  onClick={() => {
                    setSuccess(false)
                    setEmail("")
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Resend email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingWave />
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground mb-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Agreement
            </Link>
            <Link href="/risk" className="hover:text-foreground transition-colors">
              Risk disclosure
            </Link>
            <Link href="/aml" className="hover:text-foreground transition-colors">
              Preventing money laundering
            </Link>
            <Link href="/security" className="hover:text-foreground transition-colors">
              Security instructions
            </Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">
              Legal documents
            </Link>
            <Link href="/complaints" className="hover:text-foreground transition-colors">
              Complaints Handling Policy
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2008-2025, Zuperior</p>
        </div>
      </div>
    </div>
  )
}
