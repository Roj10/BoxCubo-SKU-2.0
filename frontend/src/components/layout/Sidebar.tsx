import { useLocation, Link } from 'react-router-dom'
import { Layers, Users, Wrench, Truck, RotateCcw, LayoutDashboard, Boxes, Store, History, PlusCircle, Database, FileText, ShoppingCart } from 'lucide-react'
import NavItem from './NavItem'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Estoque', icon: Layers, href: '/estoque' },
  { label: 'Vendas/Aluguéis', icon: Store, href: '/vendas' },
  { label: 'Clientes', icon: Users, href: '/clientes' },
  { label: 'Produção', icon: Wrench, href: '/producao' },
  { label: 'Entregas', icon: Truck, href: '/entregas' },
  { label: 'Devoluções', icon: RotateCcw, href: '/devolucoes' },
  { label: 'Materiais', icon: Boxes, href: '/materiais' },
  { label: 'Compras', icon: ShoppingCart, href: '/compras' },
  { label: 'Auditoria', icon: History, href: '/auditoria' },
  { label: 'Relatório', icon: FileText, href: '/relatorio' },
  { label: 'Sistema', icon: Database, href: '/sistema' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={`fixed left-0 top-14 h-[calc(100vh-56px)] w-60 z-40 bg-brand-dark flex flex-col transition-transform duration-200 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 no-print`}
    >
      <div className="px-3 pt-4 pb-2">
        <Link
          to="/cadastrar"
          onClick={onClose}
          className={`flex items-center justify-center gap-2 h-11 rounded-lg bg-brand-orange text-white font-semibold text-sm transition-colors hover:bg-brand-600 active:scale-[0.98] ${
            location.pathname.startsWith('/cadastrar') ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-brand-dark' : ''
          }`}
        >
          <PlusCircle size={18} />
          <span>Cadastrar Máquina</span>
        </Link>
      </div>

      <nav className="flex-1 pb-4">
        {navItems.map((item) => (
          <div key={item.href} onClick={onClose}>
            <NavItem
              label={item.label}
              icon={item.icon}
              href={item.href}
              active={location.pathname.startsWith(item.href)}
            />
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 text-xs text-neutral-500">v1.0.0</div>
    </aside>
  )
}
