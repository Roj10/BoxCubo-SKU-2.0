# Design system BoxCubo


O usuário pediu explicitamente (jul/2026) que o app NÃO pareça feito por IA. Foram 4 rodadas de
restyling (pesquisa com agentes + auditorias). Plano completo em `.planning/RESTYLE-PLAN.md` do repo.

**Why:** UI genérica de IA (pills semáforo, tarjas coloridas, KPI com ícone em quadradinho,
arco-íris Tailwind, "Erro ao X. Tente novamente.") denuncia o app; o usuário quer identidade Box Cubo.

**How to apply — regras para QUALQUER UI nova neste projeto:**
- Cores: neutros quentes customizados (tailwind.config) + escala brand-50..950 do laranja #da8301. Laranja só onde significa algo (ação primária, ativo, focus). Nunca cores default decorativas (purple/indigo/violet); semânticas ok (emerald/amber/red/blue para status).
- Status = dot 1.5 + texto neutro 13px (StatusBadge); tipos/categorias = tag `rounded bg-neutral-100` (TypeBadge); NUNCA pill `rounded-full` colorido.
- Cards: `rounded-lg border border-neutral-200/70` sem shadow (hairline). Um raio só: rounded-lg (md p/ menores). Sombra em camadas só em overlay/toast.
- Tabelas: cabeçalho fantasma (`text-xs font-medium text-neutral-500` + border-b), nunca barra escura; números `tabular-nums text-right`.
- KPIs: label pequeno com ícone 13px colorido + número `text-2xl font-semibold tabular-nums`; sem quadradinho de ícone.
- Títulos de página: `text-xl font-semibold tracking-tight` (não text-2xl font-bold). Labels de seção sem uppercase/tracking-wide.
- Overlays de modal: `bg-neutral-950/60` (não bg-black/50).
- Proibido: border-l-4 colorido, emojis no JSX (usar lucide), active:scale fora do Button primário/CTA sidebar, transition-all decorativo, gradientes.
- Microcopy: erros = "Não foi possível X." (nunca "Erro ao X. Tente novamente."); sucessos secos ("Máquina cadastrada."); sem "com sucesso", sem "essa ação não pode ser desfeita"; texto no vocabulário da fábrica (série, OP, flash). Placeholders só quando adicionam formato/exemplo.

