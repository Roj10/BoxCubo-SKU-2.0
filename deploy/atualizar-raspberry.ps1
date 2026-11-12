# ============================================================
#  ATUALIZAR O RASPBERRY COM O SISTEMA DE SKU  (rodar no PC)
# ============================================================
#  Como usar: clique com o botão direito neste arquivo >
#  "Executar com o PowerShell"  (ou, no PowerShell, dentro desta pasta:
#  powershell -ExecutionPolicy Bypass -File .\atualizar-raspberry.ps1)
#
#  O que faz:
#   1. gera o build do frontend e do backend aqui no PC
#   2. junta tudo num pacote e manda para o Raspberry (pede a senha)
#   3. no Raspberry: backup do banco, copia a versão nova, atualiza o
#      banco (só acrescenta), coloca os SKUs (pergunta antes) e religa.
#      Se der erro, volta tudo como estava sozinho.
# ============================================================
$ErrorActionPreference = 'Stop'
$deploy = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $deploy
# IP do Raspberry: variável BOXCUBO_HOST, ou o último usado (deploy\raspberry-ip.txt,
# fica só neste PC), ou pergunta na hora. Precisa ser um IP, ex: 192.168.0.10
$ipFile = Join-Path $deploy 'raspberry-ip.txt'
$hostIp = $env:BOXCUBO_HOST
if (-not $hostIp -and (Test-Path $ipFile)) { $hostIp = (Get-Content $ipFile -Raw).Trim() }
while ($hostIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
  if ($hostIp) { Write-Host "'$hostIp' não é um IP. Digite os números, ex: 192.168.0.10" -ForegroundColor Yellow }
  $hostIp = (Read-Host 'IP do Raspberry (números, ex: 192.168.0.10)').Trim()
}
Set-Content -Path $ipFile -Value $hostIp -Encoding ascii

function Parar($msg) { Write-Host "`n$msg" -ForegroundColor Red; Read-Host 'Aperte Enter para fechar'; exit 1 }

Write-Host 'Atualizar o Controle BoxCubo no Raspberry' -ForegroundColor Cyan
$user = (Read-Host "Usuário do Raspberry em $hostIp (o mesmo do ssh, ex: pi)").Trim()
if (-not $user) { Parar 'Usuário não informado.' }

Write-Host "`n== Build do frontend ==" -ForegroundColor Cyan
Push-Location "$root\frontend"
npm run build
$ok = $LASTEXITCODE -eq 0
Pop-Location
if (-not $ok) { Parar 'O build do frontend falhou. Nada foi enviado ao Raspberry.' }

Write-Host "`n== Build do backend ==" -ForegroundColor Cyan
Push-Location "$root\backend"
npm run build
$ok = $LASTEXITCODE -eq 0
Pop-Location
if (-not $ok) { Parar 'O build do backend falhou. Nada foi enviado ao Raspberry.' }

Write-Host "`n== Montando o pacote ==" -ForegroundColor Cyan
$pkg = Join-Path $env:TEMP 'boxcubo-sku'
$tgz = Join-Path $env:TEMP 'boxcubo-sku.tgz'
Remove-Item $pkg, $tgz -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$pkg\dist", "$pkg\public", "$pkg\prisma", "$pkg\scripts" | Out-Null
Copy-Item "$root\backend\dist\*" "$pkg\dist" -Recurse
Copy-Item "$root\frontend\dist\*" "$pkg\public" -Recurse
Copy-Item "$root\backend\prisma\schema.prisma" "$pkg\prisma"
Copy-Item "$root\backend\scripts\aplicar-sku-producao.js", "$root\backend\scripts\sku-producao.json" "$pkg\scripts"
Copy-Item "$deploy\atualizar-raspberry.sh" $pkg
tar -czf $tgz -C $pkg .
if ($LASTEXITCODE -ne 0) { Parar 'Não consegui montar o pacote.' }

Write-Host "`n== Enviando para o Raspberry (digite a senha) ==" -ForegroundColor Cyan
scp $tgz "${user}@${hostIp}:/tmp/boxcubo-sku.tgz"
if ($LASTEXITCODE -ne 0) { Parar 'O envio falhou (usuário/senha ou rede?). Nada foi alterado no Raspberry.' }

Write-Host "`n== Atualizando no Raspberry (pode pedir a senha de novo, inclusive a do sudo) ==" -ForegroundColor Cyan
ssh -t "${user}@${hostIp}" 'rm -rf /tmp/boxcubo-sku && mkdir -p /tmp/boxcubo-sku && tar -xzf /tmp/boxcubo-sku.tgz -C /tmp/boxcubo-sku && bash /tmp/boxcubo-sku/atualizar-raspberry.sh'

Read-Host "`nAperte Enter para fechar"
