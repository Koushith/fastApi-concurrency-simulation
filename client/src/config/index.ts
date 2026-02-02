/**
 * Environment Configuration
 *
 * Automatically switches between local and production URLs based on VITE_ENV
 */

type Environment = 'development' | 'production'

const ENV = (import.meta.env.VITE_ENV as Environment) || 'development'

const config = {
  development: {
    SERVER_URL: 'http://localhost:8000',
    API_BASE_URL: 'http://localhost:8000/api',
    CLIENT_URL: 'http://localhost:5173',
  },
  production: {
    SERVER_URL: 'https://reports-generator-server.vercel.app',
    API_BASE_URL: 'https://reports-generator-server.vercel.app/api',
    CLIENT_URL: 'https://reports-generator-client.vercel.app',
  },
} as const

export const getServerUrl = (): string => {
  return config[ENV].SERVER_URL
}

export const getBaseUrl = (): string => {
  const baseUrl = config[ENV].API_BASE_URL

  // Log environment info (only once on app load)
  if (typeof window !== 'undefined' && !(window as any).__ENV_LOGGED__) {
    console.log(
      `%c[Config] Environment: ${ENV.toUpperCase()}`,
      'color: #10b981; font-weight: bold;'
    )
    console.log(
      `%c[Config] API URL: ${baseUrl}`,
      'color: #6366f1;'
    )
    ;(window as any).__ENV_LOGGED__ = true
  }

  return baseUrl
}

export const getClientUrl = (): string => {
  return config[ENV].CLIENT_URL
}

export const getEnv = (): Environment => ENV

export const isDev = (): boolean => ENV === 'development'
export const isProd = (): boolean => ENV === 'production'

export { ENV }
export default config
