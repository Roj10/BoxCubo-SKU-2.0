#!/usr/bin/env bash
# ============================================================
#  Roda NO RASPBERRY (chamado pelo atualizar-raspberry.ps1).
#  Atualiza o Controle BoxCubo com o sistema de SKU.
#  - faz backup do banco, do dist/ e do public/ antes de tudo
#  - o banco só GANHA tabelas/campos; nenhum material é apagado
#  - se algo der errado, volta tudo como estava e religa o sistema
# ============================================================
set -u
PKG=/tmp/boxcubo-sku

APP=$(systemctl show -p WorkingDirectory --value boxcubo 2>/dev/null)
if [ -z "$APP" ] || [ ! -f "$APP/prisma/prisma/dev.db" ]; then
  echo "Não achei a pasta do app pelo serviço boxcubo (achei: '$APP')."
  read -r -p "Digite a pasta do app (a que tem dist/, public/ e prisma/): " APP
fi
cd "$APP" || { echo "Pasta $APP não existe."; exit 1; }
# o serviço passa DATABASE_URL por Environment=; aqui no terminal precisa definir igual
SVC_DB=$(systemctl show -p Environment --value boxcubo 2>/dev/null | tr ' ' '\n' | sed -n 's/^DATABASE_URL=//p')
export DATABASE_URL="${SVC_DB:-file:./prisma/dev.db}"
echo "Banco usado: $DATABASE_URL" 
[ -f prisma/prisma/dev.db ] || { echo "Não achei prisma/prisma/dev.db em $APP. Nada foi alterado."; exit 1; }

TS=$(date +%F-%H%M)
echo
echo "Pasta do app: $APP"
ANTES=$(sqlite3 prisma/prisma/dev.db "select count(*) from materials" 2>/dev/null || echo "?")
echo "Materiais no banco agora: $ANTES"
echo

voltar() {
  echo
  echo "!!! Deu erro. Voltando tudo como estava..."
  sudo systemctl stop boxcubo 2>/dev/null
  [ -f "prisma/prisma/dev.db.antes-sku-$TS" ] && cp "prisma/prisma/dev.db.antes-sku-$TS" prisma/prisma/dev.db
  [ -f "prisma/schema.prisma.antes-sku-$TS" ] && cp "prisma/schema.prisma.antes-sku-$TS" prisma/schema.prisma
  if [ -d "dist.antes-sku-$TS" ]; then rm -rf dist; mv "dist.antes-sku-$TS" dist; fi
  if [ -d "public.antes-sku-$TS" ]; then rm -rf public; mv "public.antes-sku-$TS" public; fi
  npx prisma generate >/dev/null 2>&1
  sudo systemctl start boxcubo
  echo "Sistema voltou para a versão anterior e está ligado. Me mande a mensagem de erro acima."
  exit 1
}

echo "== 1/5 Parando o sistema e fazendo backup =="
sudo systemctl stop boxcubo || { echo "Não consegui parar o serviço. Nada foi alterado."; exit 1; }
cp prisma/prisma/dev.db "prisma/prisma/dev.db.antes-sku-$TS" || { sudo systemctl start boxcubo; echo "Backup falhou. Nada foi alterado."; exit 1; }
cp prisma/schema.prisma "prisma/schema.prisma.antes-sku-$TS" 2>/dev/null
echo "Backup do banco: $APP/prisma/prisma/dev.db.antes-sku-$TS"

echo "== 2/5 Copiando a versão nova =="
mv dist "dist.antes-sku-$TS" && mv public "public.antes-sku-$TS" || voltar
mkdir -p dist public scripts
cp -r "$PKG/dist/." dist/ && cp -r "$PKG/public/." public/ \
  && cp "$PKG/prisma/schema.prisma" prisma/schema.prisma \
  && cp "$PKG/scripts/"* scripts/ || voltar

echo "== 3/5 Atualizando o banco (só acrescenta tabelas e campos) =="
# sem --accept-data-loss: se o Prisma achar que perderia dado, ele para sozinho
npx prisma db push --skip-generate || voltar
npx prisma generate || voltar

echo "== 4/5 Colocando os SKUs (só preenche o SKU; não cria nem apaga) =="
node scripts/aplicar-sku-producao.js --simular || voltar
echo
read -r -p "Gravar esses SKUs? (s/n) " R
if [ "$R" = "s" ] || [ "$R" = "S" ]; then
  node scripts/aplicar-sku-producao.js || voltar
else
  echo "SKUs não gravados (dá para rodar depois: node scripts/aplicar-sku-producao.js)."
fi

echo "== 5/5 Ligando o sistema =="
sudo systemctl start boxcubo || voltar
sleep 3
DEPOIS=$(sqlite3 prisma/prisma/dev.db "select count(*) from materials" 2>/dev/null || echo "?")
echo
echo "PRONTO. Materiais: antes $ANTES, depois $DEPOIS."
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
systemctl is-active boxcubo >/dev/null && echo "Sistema ligado: abra http://$IP/materiais" || echo "ATENÇÃO: o serviço não está ativo. Veja: sudo journalctl -u boxcubo -n 50"
echo "Versão anterior guardada em: dist.antes-sku-$TS, public.antes-sku-$TS e prisma/prisma/dev.db.antes-sku-$TS"
