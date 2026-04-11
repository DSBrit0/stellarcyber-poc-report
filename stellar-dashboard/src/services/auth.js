import axios from 'axios'

export async function authenticate({ url, username, password, tenant, jwtToken }) {
  // Demo mode — bypass auth entirely
  if (jwtToken === 'DEMO_MODE_TOKEN') return 'DEMO_MODE_TOKEN'

  // If a JWT token is manually provided, use it directly
  if (jwtToken && jwtToken.trim()) {
    return jwtToken.trim()
  }

  const endpoint = `${url.replace(/\/$/, '')}/connect/token`

  const params = new URLSearchParams()
  params.append('grant_type', 'password')
  params.append('username', username)
  params.append('password', password)
  params.append('tenant', tenant)

  try {
    const res = await axios.post(endpoint, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const token = res.data?.access_token
    if (!token) throw new Error('No access token returned from server')
    return token
  } catch (err) {
    if (err.response) {
      const status = err.response.status
      if (status === 401) throw new Error('Invalid credentials — check username/password')
      if (status === 403) throw new Error('Access denied — insufficient permissions')
      if (status === 404) throw new Error('Auth endpoint not found — check URL')
      throw new Error(`Server error (${status}): ${err.response.data?.message || 'Unknown error'}`)
    }
    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
      throw new Error('Cannot reach the server — check the URL and network connectivity')
    }
    throw new Error(err.message || 'Connection failed')
  }
}
