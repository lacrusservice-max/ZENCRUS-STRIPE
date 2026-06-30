import { useState, useEffect, useCallback, useRef } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'

export interface NetworkStatus {
  isConnected: boolean
  isInternetReachable: boolean | null
  type: string | null
  isWeak: boolean        // conexión lenta (2G o similar)
  wasOffline: boolean    // recién reconectó
}

const INITIAL: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  type: null,
  isWeak: false,
  wasOffline: false,
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>(INITIAL)
  const prevConnected = useRef(true)

  const evaluate = useCallback((state: NetInfoState): NetworkStatus => {
    const connected = state.isConnected ?? false
    const reachable = state.isInternetReachable
    const type = state.type
    const details = (state as any).details
    const isWeak = type === 'cellular' && details?.cellularGeneration === '2g'
    const wasOffline = !prevConnected.current && connected

    prevConnected.current = connected

    return { isConnected: connected, isInternetReachable: reachable, type, isWeak, wasOffline }
  }, [])

  useEffect(() => {
    // Estado inicial
    NetInfo.fetch().then(state => setStatus(evaluate(state)))

    const unsub = NetInfo.addEventListener(state => setStatus(evaluate(state)))
    return unsub
  }, [evaluate])

  return status
}
