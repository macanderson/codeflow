import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.json({ error: "Authorization code not provided" }, { status: 400 })
    }

    // Exchange code for access token
    const redirectUri = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/github/callback`
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        state,
        // Must match redirect_uri used in the authorize step
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error_description }, { status: 400 })
    }

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    const userData = await userResponse.json()

    if (!userResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 400 })
    }

    // Store the access token securely (in a real app, you'd store this in a database)
    // For now, we'll return it to the client to store in localStorage
    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        public_repos: userData.public_repos,
      },
    })
  } catch (error) {
    console.error("[GitHub Auth] Error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    if (action === 'get_auth_url') {
      const clientId = process.env.GITHUB_CLIENT_ID
      // Redirect URI must EXACTLY match your GitHub OAuth app configuration
      const redirectUri = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/github/callback`
      const state = Math.random().toString(36).substring(7)

      const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo&state=${state}`

      return NextResponse.json({
        success: true,
        auth_url: authUrl,
        state,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[GitHub Auth] Error:", error)
    return NextResponse.json({ error: "Failed to generate auth URL" }, { status: 500 })
  }
}
