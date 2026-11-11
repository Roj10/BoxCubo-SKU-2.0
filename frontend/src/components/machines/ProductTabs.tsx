import type { ProductTab } from '../../types/machine'

interface ProductTabsProps {
  activeTab: ProductTab
  onChange: (tab: ProductTab) => void
}

const TABS: { value: ProductTab; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'BOXCUBO_V2', label: 'BoxCubo V2' },
  { value: 'SLIM', label: 'Slim' },
  { value: 'VISION', label: 'Vision' },
  { value: 'EYE', label: 'EYE' },
]

export default function ProductTabs({ activeTab, onChange }: ProductTabsProps) {
  return (
    <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
      <div className="flex items-end h-11 max-w-screen-xl mx-auto px-6 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            role="tab"
            aria-selected={activeTab === tab.value}
            className={
              activeTab === tab.value
                ? 'px-4 h-full text-sm text-brand-dark dark:text-neutral-100 font-semibold border-b-2 border-brand-orange'
                : 'px-4 h-full text-sm text-neutral-500 dark:text-neutral-400 font-normal border-b-2 border-transparent hover:text-brand-dark dark:hover:text-neutral-100 transition-colors'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
