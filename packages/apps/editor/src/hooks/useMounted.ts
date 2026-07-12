import { useEffect, type EffectCallback } from "react"

export const useMounted = (onMount: EffectCallback) => {
    useEffect(() => onMount(), []);
}
