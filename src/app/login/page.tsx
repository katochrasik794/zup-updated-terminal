"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { LoadingWave } from "@/components/ui/loading-wave"
import { authApi, apiClient } from "@/lib/api"

export default function LoginPage() {
  const [showPassword, setShowPassword] = React.useState(false)
  const [signInEmail, setSignInEmail] = React.useState("")
  const [signInPassword, setSignInPassword] = React.useState("")
  const [signUpEmail, setSignUpEmail] = React.useState("")
  const [signUpPassword, setSignUpPassword] = React.useState("")
  const [signUpName, setSignUpName] = React.useState("")
  const [signUpPhone, setSignUpPhone] = React.useState("")
  const [agreeToTerms, setAgreeToTerms] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  // Check for auto-login on mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const autoLogin = params.get('autoLogin')
    const token = params.get('token')
    const clientId = params.get('clientId')
    const accountId = params.get('accountId') || params.get('mtLogin')

    if (autoLogin === 'true' && token && clientId) {
      // Store SSO params in sessionStorage so AuthProvider can pick them up
      // without showing them in the URL on the next page
      sessionStorage.setItem('sso_token', token)
      sessionStorage.setItem('sso_clientId', clientId)
      if (accountId) sessionStorage.setItem('sso_accountId', accountId)
      sessionStorage.setItem('sso_autoLogin', 'true')

      // Redirect to terminal (which will now handle the SSO logic via AuthProvider)
      // We purposefully do NOT include query parameters here to hide the token
      window.location.href = '/terminal'
    } else if (autoLogin === 'true') {
      // Fallback if params are missing but autoLogin is present
      window.location.href = `/terminal${window.location.search}`
    }
  }, [])

  // Password validation
  const hasMinLength = signUpPassword.length >= 8 && signUpPassword.length <= 15
  const hasUpperAndLower = /[A-Z]/.test(signUpPassword) && /[a-z]/.test(signUpPassword)
  const hasNumber = /\d/.test(signUpPassword)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(signUpPassword)
  const passwordScore = [hasMinLength, hasUpperAndLower, hasNumber, hasSpecialChar].filter(Boolean).length

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const data = await authApi.login(signInEmail, signInPassword)

      if (data.success) {
        // Store token if provided
        if (data.token) {
          localStorage.setItem('token', data.token)
          document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        }

        // Store user data in localStorage
        if (data.user) {
          if (data.user.name) {
            localStorage.setItem('userName', data.user.name)
          }
          if (data.user.email) {
            localStorage.setItem('userEmail', data.user.email)
          }
        }

        // Store MT5 account ID if available
        if (data.mt5Account && data.mt5Account.accountId) {
          localStorage.setItem("accountId", data.mt5Account.accountId);
        }

        // Redirect to terminal on successful login
        window.location.href = "/terminal"
      } else {
        setError(data.message || "Login failed. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!agreeToTerms) {
      setError("Please agree to the terms and conditions.")
      return
    }

    setIsLoading(true)

    try {
      const data = await authApi.register(signUpEmail, signUpPassword, signUpName, signUpPhone)

      if (data.success) {
        // Store token if provided
        if (data.token) {
          localStorage.setItem('token', data.token)
          document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        }

        // Redirect to terminal on successful registration
        window.location.href = "/terminal"
      } else {
        setError(data.message || "Registration failed. Please try again.")
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-[#01040D]">
        <div className="container mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/logo-full.png"
              alt="Zuperior logo"
              width={100}
              height={200}
              className="rounded-sm object-contain"
              unoptimized
              priority
            />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Normal loading state */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4 w-full">
              <LoadingWave />
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Welcome to Zuperior</h2>
              </div>

              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="w-full mb-8 h-12">
                  <TabsTrigger value="signin" className="flex-1 text-base">Sign in</TabsTrigger>
                </TabsList>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Sign In Form */}
                <TabsContent value="signin" className="space-y-6">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Your email address</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="!w-full" size="lg" disabled={isLoading}>
                      {isLoading ? "Signing in..." : "Continue"}
                    </Button>

                    <div className="text-center">
                      <Link href="/forgot-password" className="text-sm text-primary hover:text-primary/80 transition-colors">
                        I forgot my password
                      </Link>
                    </div>
                  </form>
                </TabsContent>

              </Tabs>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/8 bg-[#01040D]/50">
        <div className="container mx-auto px-6 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4 text-xs text-white/60 leading-relaxed">
              <p>
                Zuperior does not offer services to residents of certain jurisdictions including the USA, Iran, North Korea, the European Union,
                the United Kingdom and others. The content of the website including translations should not be construed as meaning for
                solicitation. Investors make their own and independent decisions.
              </p>
              <p>
                Trading in CFDs and generally leveraged products involves substantial risk of loss and you may lose all of your invested capital.
              </p>
              <p>
                Zuperior (SC) Ltd is a Securities Dealer registered in Seychelles with registration number 8423606-1 and authorised by the
                Financial Services Authority (FSA) with licence number SD025. The registered office of Zuperior (SC) Ltd is at 9A CT House,
                2nd floor, Providence, Mahe, Seychelles.
              </p>
            </div>

            <div className="flex flex-col md:items-end gap-4">
              <div className="flex flex-wrap gap-4 text-xs">
                <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
                  Privacy Agreement
                </Link>
                <Link href="/risk" className="text-primary hover:text-primary/80 transition-colors">
                  Risk disclosure
                </Link>
                <Link href="/aml" className="text-primary hover:text-primary/80 transition-colors">
                  Preventing money laundering
                </Link>
                <Link href="/security" className="text-primary hover:text-primary/80 transition-colors">
                  Security instructions
                </Link>
                <Link href="/legal" className="text-primary hover:text-primary/80 transition-colors">
                  Legal documents
                </Link>
                <Link href="/complaints" className="text-primary hover:text-primary/80 transition-colors">
                  Complaints Handling Policy
                </Link>
              </div>
              <p className="text-xs text-white/60">© 2008-2025, Zuperior</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
