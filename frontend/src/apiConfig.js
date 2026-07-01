const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

export const isProductionApiMissing = () => {
  if (apiBaseUrl) {
    return false
  }

  if (typeof window === 'undefined') {
    return false
  }

  return !LOCAL_HOSTS.has(window.location.hostname)
}

export const missingApiMessage =
  'This deployment is missing VITE_API_BASE_URL. Point it to the backend service and redeploy the frontend.'