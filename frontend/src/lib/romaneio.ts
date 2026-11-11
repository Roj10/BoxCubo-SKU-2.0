import type { Delivery } from '../types/delivery'
import type { Client } from '../types/client'
import { PRODUCT_LABELS } from '../types/machine'
import { DELIVERY_STATUS_LABELS } from '../types/delivery'

// Abre uma janela de impressão com o romaneio (protocolo de entrega) da máquina.
// O cliente completo (cnpj/endereço) é buscado à parte porque a listagem de
// entregas só traz id+nome.
export async function printRomaneio(delivery: Delivery): Promise<void> {
  let client: Client | null = null
  if (delivery.machine.client?.id) {
    try {
      const res = await fetch(`/api/clients/${delivery.machine.client.id}`)
      if (res.ok) client = await res.json()
    } catch {
      // segue sem cnpj/endereço — o romaneio sai com o nome que já temos
    }
  }

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—')
  const m = delivery.machine
  const romaneioNum = delivery.id.slice(-8).toUpperCase()

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Romaneio ${romaneioNum} — ${m.serial_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 12mm; font-size: 10pt; }
  .doc { max-width: 180mm; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 4mm; }
  .brand { font-size: 16pt; font-weight: bold; letter-spacing: 1px; }
  .brand small { display: block; font-size: 8pt; font-weight: normal; letter-spacing: 0; color: #555; margin-top: 1mm; }
  .docnum { text-align: right; font-size: 9pt; color: #333; }
  .docnum b { font-size: 12pt; color: #000; }
  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.5px; background: #f0f0f0; padding: 2mm 3mm; margin: 5mm 0 2mm; border-left: 3px solid #da8301; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.5mm 3mm; vertical-align: top; }
  td.k { width: 38mm; color: #555; font-size: 8.5pt; text-transform: uppercase; }
  td.v { font-weight: bold; }
  .mono { font-family: 'Courier New', monospace; }
  .sign { display: flex; gap: 10mm; margin-top: 14mm; }
  .sign div { flex: 1; text-align: center; }
  .sign .line { border-top: 1px solid #000; margin-top: 16mm; padding-top: 2mm; font-size: 8.5pt; color: #333; }
  .foot { margin-top: 10mm; font-size: 7.5pt; color: #777; text-align: center; }
  @media print { body { padding: 0; } @page { margin: 12mm; } }
</style>
</head>
<body onload="window.print()">
  <div class="doc">
    <div class="head">
      <div class="brand">BOX CUBO<small>Romaneio / Protocolo de Entrega</small></div>
      <div class="docnum">Romaneio<br/><b>Nº ${romaneioNum}</b><br/>Emitido em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>

    <h2>Equipamento</h2>
    <table>
      <tr><td class="k">Produto</td><td class="v">${PRODUCT_LABELS[m.product_type]}</td></tr>
      <tr><td class="k">N° de Série</td><td class="v mono">${m.serial_number}</td></tr>
      ${m.mac_address ? `<tr><td class="k">MAC Address</td><td class="v mono">${m.mac_address}</td></tr>` : ''}
      <tr><td class="k">Tipo</td><td class="v">${m.type}</td></tr>
      ${m.support_plan ? `<tr><td class="k">Plano de Suporte</td><td class="v">Sim</td></tr>` : ''}
    </table>

    <h2>Destinatário</h2>
    <table>
      <tr><td class="k">Cliente</td><td class="v">${m.client?.nome ?? '—'}</td></tr>
      ${client?.cnpj ? `<tr><td class="k">CNPJ</td><td class="v">${client.cnpj}</td></tr>` : ''}
      ${client?.endereco ? `<tr><td class="k">Endereço</td><td class="v">${client.endereco}</td></tr>` : ''}
    </table>

    <h2>Transporte</h2>
    <table>
      <tr><td class="k">Transportadora</td><td class="v">${delivery.carrier || '—'}</td></tr>
      <tr><td class="k">Data de Coleta</td><td class="v">${fmtDate(delivery.pickup_date)}</td></tr>
      <tr><td class="k">Previsão de Entrega</td><td class="v">${fmtDate(delivery.expected_date)}</td></tr>
      <tr><td class="k">Situação Atual</td><td class="v">${DELIVERY_STATUS_LABELS[delivery.status]}</td></tr>
    </table>

    <div class="sign">
      <div><div class="line">Expedido por (Box Cubo)</div></div>
      <div><div class="line">Transportadora</div></div>
      <div><div class="line">Recebido por (Cliente) — Data</div></div>
    </div>

    <div class="foot">Documento gerado pelo Controle BoxCubo em ${new Date().toLocaleString('pt-BR')} · Registro ${delivery.id}</div>
  </div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return
  w.document.write(html)
  w.document.close()
}
