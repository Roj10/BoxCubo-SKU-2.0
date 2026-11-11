/// <reference types="vite/client" />

// Variáveis do frontend/.env (veja frontend/.env.example)
interface ImportMetaEnv {
  readonly VITE_EQUIPE?: string
  readonly VITE_EMPRESA_RODAPE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
