"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const HOME_PATH = "/home"

export default function WalletRedirector() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    let provider = null
    let detectionInterval = null

    const redirectToHome = () => {
      if (typeof window === "undefined") return
      if (window.location.pathname !== HOME_PATH) {
        router.push(HOME_PATH)
      }
    }

    const handleAccountsChanged = (accounts = []) => {
      if (Array.isArray(accounts) && accounts.length > 0) {
        redirectToHome()
      }
    }

    const handleConnect = () => {
      redirectToHome()
    }

    const detachListeners = () => {
      if (!provider) return
      const remove =
        (typeof provider.removeListener === "function" && provider.removeListener.bind(provider)) ||
        (typeof provider.off === "function" && provider.off.bind(provider))

      if (remove) {
        remove("accountsChanged", handleAccountsChanged)
        remove("connect", handleConnect)
      }
    }

    const attachListeners = () => {
      if (!provider) return
      const on = typeof provider.on === "function" ? provider.on.bind(provider) : null
      if (on) {
        on("accountsChanged", handleAccountsChanged)
        on("connect", handleConnect)
      }
    }

    const checkExistingConnection = async () => {
      if (!provider) return
      try {
        if (typeof provider.getAccounts === "function") {
          const accounts = await provider.getAccounts()
          if (Array.isArray(accounts) && accounts.length > 0) {
            redirectToHome()
            return
          }
        }

        if (typeof provider.isConnected === "boolean" && provider.isConnected) {
          redirectToHome()
        } else if (typeof provider.isConnected === "function") {
          try {
            if (provider.isConnected()) {
              redirectToHome()
            }
          } catch (error) {
            console.debug("Keeta provider isConnected check failed", error)
          }
        }
      } catch (error) {
        console.debug("Keeta connection check failed", error)
      }
    }

    const initializeProvider = () => {
      provider = window.keeta
      if (!provider) {
        return false
      }

      attachListeners()
      void checkExistingConnection()
      return true
    }

    if (!initializeProvider()) {
      detectionInterval = setInterval(() => {
        if (initializeProvider()) {
          clearInterval(detectionInterval)
        }
      }, 400)
    }

    return () => {
      if (detectionInterval) {
        clearInterval(detectionInterval)
      }
      detachListeners()
    }
  }, [router])

  return null
}
