import { useCallback, useEffect, useState } from 'react'

/**
 * Data-fetch state hook: { loading, error, data, reload }.
 * `fetcher` runs whenever `deps` change; pass a bumped counter in deps to
 * refresh after an action (the board's live notices re-settle on remount).
 */
export default function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  const reload = useCallback(async () => {
    setState({ loading: true, error: null, data: null })
    try {
      const data = await fetcher()
      setState({ loading: false, error: null, data })
    } catch (err) {
      setState({
        loading: false,
        error: err.response?.data?.message || err.message || 'Request failed',
        data: null,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
