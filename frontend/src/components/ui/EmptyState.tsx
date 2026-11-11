import React from 'react'

interface EmptyStateProps {
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  heading: string
  body: string
  action?: React.ReactNode
}

export default function EmptyState({ icon, heading, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-2 text-center py-16">
      {React.createElement(icon, { size: 28, className: 'text-neutral-300 dark:text-neutral-600 mb-1' })}
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{heading}</p>
      <p className="text-[13px] text-neutral-500 dark:text-neutral-500 max-w-xs">{body}</p>
      {action}
    </div>
  )
}
