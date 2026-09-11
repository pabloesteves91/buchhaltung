import { useEffect } from 'react'

const BASE_TITLE = 'nipponnites Buchhaltung'

/** Sets the browser tab title to "<title> · nipponnites Buchhaltung" while mounted. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = previous
    }
  }, [title])
}
