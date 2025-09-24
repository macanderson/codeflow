"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

function GitHubCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')
  const hasHandled = useRef(false)

  useEffect(() => {
    if (hasHandled.current) return
    hasHandled.current = true
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      if (error) {
        setStatus('error')
        setError(`GitHub OAuth error: ${error}`)
        return
      }

      if (!code) {
        setStatus('error')
        setError('No authorization code received from GitHub')
        return
      }

      try {
        // Exchange code for access token directly
        const authUrl = new URL('/api/github/auth', window.location.origin)
        authUrl.searchParams.set('code', code)
        if (state) authUrl.searchParams.set('state', state)

        const authResponse = await fetch(authUrl.toString(), { method: 'GET' })
        const data = await authResponse.json()

        if (data.success) {
          // Store access token and user data
          localStorage.setItem('github_access_token', data.access_token)
          localStorage.setItem('github_user', JSON.stringify(data.user))

          // Trigger storage event for other tabs/windows
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'github_access_token',
            newValue: data.access_token,
            url: window.location.href
          }))

          setStatus('success')

          // Check if we should return to a specific URL
          const returnUrl = localStorage.getItem('github_auth_return_url')
          localStorage.removeItem('github_auth_return_url')

          // Redirect back to home and trigger modal reopen for repos selection
          setTimeout(() => {
            // Prefer returning to home with a flag to open the repos modal
            router.push('/?newProject=github')
          }, 1200)
        } else {
          setStatus('error')
          setError(data.error || 'Failed to authenticate with GitHub')
        }
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            {status === 'loading' && <Loader2 className="h-6 w-6 animate-spin" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-500" />}
          </div>
          <CardTitle>
            {status === 'loading' && 'Connecting to GitHub...'}
            {status === 'success' && 'Successfully Connected!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we authenticate your GitHub account.'}
            {status === 'success' && 'Your GitHub account has been connected successfully. Redirecting to dashboard...'}
            {status === 'error' && error}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'error' && (
            <Button onClick={() => router.push('/dashboard')} variant="outline">
              Return to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <CardTitle>Loading...</CardTitle>
          <CardDescription>Please wait while we process your GitHub authentication.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

export default function GitHubCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GitHubCallbackContent />
    </Suspense>
  )
}
