import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import React from 'react'

interface NavItemProps {
  label: string
  icon: LucideIcon
  href: string
  active: boolean
}

export default function NavItem({ label, icon, href, active }: NavItemProps) {
  return (
    <Link
      to={href}
      className={`flex items-center gap-3 h-11 px-4 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors relative ${
        active ? 'text-white bg-white/5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-brand-orange' : ''
      }`}
    >
      {React.createElement(icon, { size: 18 })}
      <span>{label}</span>
    </Link>
  )
}
