import { useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import { pb } from '../lib/pocketbase'

type AuthState = {
  user: RecordModel | null
  token: string
  isValid: boolean
}

function readAuth(): AuthState {
  return {
    user: pb.authStore.record,
    token: pb.authStore.token,
    isValid: pb.authStore.isValid,
  }
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(readAuth)

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setAuth(readAuth())
    })
  }, [])

  return auth
}

export function signInWithGoogle() {
  return pb.collection('users').authWithOAuth2({ provider: 'google' })
}

export function signOut() {
  pb.authStore.clear()
}

export function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (pb.authStore.token) {
    headers.set('Authorization', pb.authStore.token)
  }
  return headers
}
