import { useEffect } from 'react'
import { useSettings } from './useSettings'

/**
 * Swap the static placeholder favicon (public/favicon.svg) for the company's
 * own logo once it's loaded from settings. Shares the cached ['settings']
 * query, so this costs nothing extra. Before login (no settings loaded yet)
 * the static file stays as-is.
 */
export function useBrandFavicon() {
  const { data: settings } = useSettings()
  const href = settings?.logoUrl || settings?.logoDataUrl

  useEffect(() => {
    if (!href) return
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) link.href = href
  }, [href])
}
