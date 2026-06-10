export const LOGIN_USERNAME = 'Pesho'
export const LOGIN_PASSWORD = 'MADCAMP'
export const AUTH_STORAGE_KEY = 'camp_tournament_logged_in'

export function isLoggedIn() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

export function login(username: string, password: string) {
  const isValid = username.trim() === LOGIN_USERNAME && password === LOGIN_PASSWORD
  if (isValid && typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
    document.cookie = `${AUTH_STORAGE_KEY}=true; path=/; max-age=604800; SameSite=Lax`
  }
  return isValid
}

export function logout() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    document.cookie = `${AUTH_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`
    window.location.href = '/'
  }
}
