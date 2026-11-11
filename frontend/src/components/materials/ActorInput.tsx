import { TEAM } from './shared'

// Campo "nome de quem está fazendo" (o sistema não tem login). Texto livre,
// com os nomes da equipe como sugestão.
export default function ActorInput({ id, value, onChange, className, placeholder = 'Digite seu nome', autoFocus }: {
  id: string
  value: string
  onChange: (v: string) => void
  className: string
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <>
      <input
        id={id}
        list={`${id}-nomes`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={80}
        className={className}
      />
      <datalist id={`${id}-nomes`}>
        {TEAM.map((t) => <option key={t} value={t} />)}
      </datalist>
    </>
  )
}
