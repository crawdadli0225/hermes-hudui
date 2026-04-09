import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useApi<T = any>(path: string, refreshInterval = 0) {
  return useSWR<T>(`/api${path}`, fetcher, {
    refreshInterval,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  })
}
