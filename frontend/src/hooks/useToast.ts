import { useState, useCallback } from 'react'
import Toast from '../components/ui/Toast'
import React from 'react'

interface ToastState {
  message: string
  type: 'success' | 'error'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  const ToastComponent = toast
    ? React.createElement(Toast, { message: toast.message, type: toast.type, onDismiss: hideToast })
    : null

  return { toast, showToast, hideToast, ToastComponent }
}
