import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import EstoquePage from './pages/EstoquePage'
import ClientesPage from './pages/ClientesPage'
import ClientFormPage from './pages/ClientFormPage'
import MachineFormPage from './pages/MachineFormPage'
import CadastrarMaquinaPage from './pages/CadastrarMaquinaPage'
import MachineDetailPage from './pages/MachineDetailPage'
import ProducaoPage from './pages/ProducaoPage'
import EntregasPage from './pages/EntregasPage'
import DevolucoesPage from './pages/DevolucoesPage'
import DashboardPage from './pages/DashboardPage'
import MateriaisPage from './pages/MateriaisPage'
import ComprasPage from './pages/ComprasPage'
import VendasPage from './pages/VendasPage'
import AuditoriaPage from './pages/AuditoriaPage'
import ClienteDetailPage from './pages/ClienteDetailPage'
import SistemaPage from './pages/SistemaPage'
import TvPage from './pages/TvPage'
import RelatorioPage from './pages/RelatorioPage'
import ImportarMaquinasPage from './pages/ImportarMaquinasPage'
import OrdemProducaoPage from './pages/OrdemProducaoPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Modo TV: tela cheia, sem header/sidebar */}
        <Route path="/tv" element={<TvPage />} />
        <Route
          path="*"
          element={
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/estoque" element={<EstoquePage />} />
                <Route path="/vendas" element={<VendasPage />} />
                <Route path="/cadastrar" element={<CadastrarMaquinaPage />} />
                <Route path="/estoque/novo" element={<MachineFormPage />} />
                <Route path="/estoque/importar" element={<ImportarMaquinasPage />} />
                <Route path="/estoque/:id/editar" element={<MachineFormPage />} />
                <Route path="/maquinas/:id" element={<MachineDetailPage />} />
                <Route path="/maquinas/:id/op" element={<OrdemProducaoPage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/clientes/novo" element={<ClientFormPage />} />
                <Route path="/clientes/:id/editar" element={<ClientFormPage />} />
                <Route path="/clientes/:id" element={<ClienteDetailPage />} />
                <Route path="/producao" element={<ProducaoPage />} />
                <Route path="/entregas" element={<EntregasPage />} />
                <Route path="/devolucoes" element={<DevolucoesPage />} />
                <Route path="/materiais" element={<MateriaisPage />} />
                <Route path="/compras" element={<ComprasPage />} />
                <Route path="/auditoria" element={<AuditoriaPage />} />
                <Route path="/relatorio" element={<RelatorioPage />} />
                <Route path="/sistema" element={<SistemaPage />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
