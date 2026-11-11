import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import type { Machine } from '../../types/machine'
import ProductBadge from '../ui/ProductBadge'
import SearchModal from './SearchModal'

interface ClientResult {
  id: string
  nome: string
  cnpj: string | null
}

interface SearchResults {
  machines: Machine[]
  clients: ClientResult[]
}

const EMPTY_RESULTS: SearchResults = { machines: [], clients: [] }

export default function GlobalSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults(EMPTY_RESULTS)
      setIsOpen(false)
      return
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
      const data: SearchResults = await res.json()
      setResults({ machines: data.machines ?? [], clients: data.clients ?? [] })
      setIsOpen(true)
    } catch (e) {
      console.error(e)
      setResults(EMPTY_RESULTS)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchResults(value), 300)
  }

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
        setResults(EMPTY_RESULTS)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeydown)
    }
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [isOpen])

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      const isCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable === true
      const isSlash = e.key === '/' && !isTyping
      if (isCtrlK || isSlash) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const hasResults = results.machines.length > 0 || results.clients.length > 0

  return (
    <>
      <div ref={containerRef} className="relative w-72 lg:w-96">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-orange pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Buscar por N° série, MAC, cliente... (Ctrl+K)"
          className="bg-white/10 border border-white/20 text-white placeholder-white/50 rounded-md h-9 px-3 pl-9 text-sm w-full focus:bg-white/20 focus:border-white/40 focus:outline-none transition-colors"
        />
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {!hasResults ? (
              <p className="px-3 py-2.5 text-sm text-neutral-500 dark:text-neutral-400">
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;
              </p>
            ) : (
              <>
                {results.machines.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      Máquinas
                    </p>
                    {results.machines.map((machine) => (
                      <button
                        key={machine.id}
                        role="option"
                        aria-selected={false}
                        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer text-left"
                        onClick={() => {
                          setSelectedMachine(machine)
                          setIsOpen(false)
                        }}
                      >
                        <ProductBadge size="sm" product={machine.product_type} />
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{machine.serial_number}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto">{machine.client?.nome || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
                {results.clients.length > 0 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                      Clientes
                    </p>
                    {results.clients.map((client) => (
                      <button
                        key={client.id}
                        role="option"
                        aria-selected={false}
                        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer text-left"
                        onClick={() => {
                          navigate('/clientes')
                          setIsOpen(false)
                          setQuery('')
                        }}
                      >
                        <Users size={16} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{client.nome}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-auto">{client.cnpj || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {selectedMachine && (
        <SearchModal machine={selectedMachine} onClose={() => setSelectedMachine(null)} />
      )}
    </>
  )
}
