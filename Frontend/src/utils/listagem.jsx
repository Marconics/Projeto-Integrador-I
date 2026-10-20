// Auxiliares das telas de listagem com filtros e cards:
// Abrigos do voluntário, Abrigos do admin e Vítimas do admin.
import { useSyncExternalStore } from 'react';
import {
  LuAccessibility, LuChurch, LuDumbbell, LuHotel, LuHouse, LuLandmark, LuPawPrint, LuSchool, LuStethoscope,
  LuSyringe, LuTent, LuUtensils, LuWarehouse
} from 'react-icons/lu';

// Estrutura do abrigo: campo da API → rótulo e ícone (filtros e cards)
export const ESTRUTURAS = [
  { campo: 'possuiPets',              label: 'Aceita pets',        icone: <LuPawPrint /> },
  { campo: 'possuiAcessibilidade',    label: 'Acessibilidade',     icone: <LuAccessibility /> },
  { campo: 'possuiAtendimentoMedico', label: 'Atendimento médico', icone: <LuStethoscope /> },
  { campo: 'possuiEnfermagem',        label: 'Enfermagem',         icone: <LuSyringe /> },
  { campo: 'possuiCozinha',           label: 'Cozinha',            icone: <LuUtensils /> },
]

// Situação pela ocupação (chips de filtro)
export const SITUACOES = [
  { valor: 'todas',   label: 'Todos' },
  { valor: 'vagas',   label: 'Com vagas' },
  { valor: 'quase',   label: 'Quase lotados' },
  { valor: 'lotados', label: 'Lotados' },
]

export const ocupacaoDe = (abrigo) => abrigo.capacidadeTotal > 0
  ? Math.min(100, Math.round((abrigo.capacidadeOcupada / abrigo.capacidadeTotal) * 100))
  : 0

export const vagasDe = (abrigo) => Math.max(0, abrigo.capacidadeTotal - abrigo.capacidadeOcupada)

export const corOcupacao = (pct) => pct >= 100 ? 'var(--sv-sirene)' : pct >= 80 ? 'var(--sv-atencao)' : 'var(--sv-ok)'

// O abrigo passa no filtro de situação escolhido?
export const passaSituacao = (abrigo, situacao) => {
  const pct = ocupacaoDe(abrigo)
  if (situacao === 'vagas')   return vagasDe(abrigo) > 0
  if (situacao === 'quase')   return pct >= 80 && pct < 100
  if (situacao === 'lotados') return pct >= 100
  return true
}

// Minúsculo e sem acento, para as buscas ("São José" acha "sao jose")
export const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// "12 abrigos encontrados" / "1 abrigo encontrado"
export const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`

// Celular (até 600px)? Nas listagens, os filtros extras abrem numa gaveta em vez de no painel.
const CONSULTA_CELULAR = '(max-width: 600px)'
const assinarCelular = (avisar) => {
  const consulta = window.matchMedia(CONSULTA_CELULAR)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}
export const useCelular = () =>
  useSyncExternalStore(assinarCelular, () => window.matchMedia(CONSULTA_CELULAR).matches, () => false)

// Tipo do abrigo → nome para exibir e ícone (miniatura do card quando não há foto)
export const TIPOS_ABRIGO = {
  'Escola':            { label: 'Escola',             icone: <LuSchool /> },
  'Ginásio':           { label: 'Ginásio',            icone: <LuDumbbell /> },
  'Igreja':            { label: 'Igreja',             icone: <LuChurch /> },
  'Hotel':             { label: 'Hotel',              icone: <LuHotel /> },
  'Pousada':           { label: 'Pousada',            icone: <LuHotel /> },
  'CentroCultural':    { label: 'Centro Cultural',    icone: <LuLandmark /> },
  'CentroComunitário': { label: 'Centro Comunitário', icone: <LuWarehouse /> },
  'Campo':             { label: 'Campo',              icone: <LuTent /> },
}
export const tipoDe = (tipo) => TIPOS_ABRIGO[tipo] ?? { label: tipo, icone: <LuHouse /> }
