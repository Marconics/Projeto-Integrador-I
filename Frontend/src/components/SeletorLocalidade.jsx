import { useEffect, useId, useState } from 'react';
import { LuMapPinned } from 'react-icons/lu';
import { API_URL } from '../services/api';
import { Obrigatorio, Opcional } from './MarcasCampo';

// Busca uma rota pública da API (estados, cidades e bairros não exigem login)
async function buscarJson(caminho) {
  const resposta = await fetch(`${API_URL}/api${caminho}`)
  if (!resposta.ok) throw new Error(`Erro ${resposta.status} ao buscar ${caminho}`)
  return resposta.json()
}

// ─── Seletor em cascata: Estado → Cidade → Bairro ─────────────────────────────
// Cada seleção limpa os níveis abaixo dela.
//
// Props:
//   cidadeId, bairroId     → valores atuais (controlados pelo componente pai)
//   onChange(localidade)   → recebe { cidadeId, bairroId, estado, cidade, bairro }
//                            (os nomes servem para o geocoding do endereço)
//   disabled               → trava os selects (modo visualização)
//   bairroObrigatorio      → exige escolher um bairro
//   mostrarBairro          → false esconde o select de bairro
//   obrigatorio            → false: nenhum select é obrigatório (use quando o seletor é
//                            opcional dentro de um formulário, para não travar o "Salvar")
function SeletorLocalidade({
  cidadeId, bairroId, onChange, disabled = false, bairroObrigatorio = false, mostrarBairro = true,
  obrigatorio = true
}) {
  const [estados, setEstados] = useState([])
  // ids únicos para ligar cada <label> ao seu <select> (pode haver mais de um seletor na tela)
  const idBase = useId()

  // Marca * / (opcional) só quando dá para editar
  const marca = (exigido) => disabled ? null : (exigido ? <Obrigatorio /> : <Opcional />)
  const [estadoEscolhido, setEstadoEscolhido] = useState(null)

  // Listas guardadas por id para não buscar de novo a cada troca
  const [cidadesPorEstado, setCidadesPorEstado] = useState({})
  const [bairrosPorCidade, setBairrosPorCidade] = useState({})
  const [estadoDaCidade, setEstadoDaCidade] = useState({})

  // O estado vem da escolha do usuário ou, ao abrir um registro já salvo,
  // da cidade que veio preenchida
  // (a cidade manda: se ela foi preenchida pelo CEP, o estado acompanha)
  const estadoId = (cidadeId ? estadoDaCidade[cidadeId] : null) ?? estadoEscolhido ?? ''
  const cidades = cidadesPorEstado[estadoId] ?? []
  const bairros = bairrosPorCidade[cidadeId] ?? []

  // Só estados que têm cidades cadastradas
  useEffect(() => {
    buscarJson('/estados/listar?comCidades=true')
      .then(dados => setEstados(dados.estados))
      .catch(console.error)
  }, [])

  // Descobre o estado da cidade que veio preenchida
  useEffect(() => {
    if (!cidadeId || estadoDaCidade[cidadeId]) return
    buscarJson(`/cidades/listar/${cidadeId}`)
      .then(cidade => setEstadoDaCidade(prev => ({ ...prev, [cidadeId]: cidade.estadoId })))
      .catch(console.error)
  }, [cidadeId, estadoDaCidade])

  useEffect(() => {
    if (!estadoId || cidadesPorEstado[estadoId]) return
    buscarJson(`/cidades/listar?estadoId=${estadoId}`)
      .then(dados => setCidadesPorEstado(prev => ({ ...prev, [estadoId]: dados.cidades })))
      .catch(console.error)
  }, [estadoId, cidadesPorEstado])

  useEffect(() => {
    if (!cidadeId || bairrosPorCidade[cidadeId]) return
    buscarJson(`/bairros/listar?cidadeId=${cidadeId}`)
      .then(dados => setBairrosPorCidade(prev => ({ ...prev, [cidadeId]: dados.bairros })))
      .catch(console.error)
  }, [cidadeId, bairrosPorCidade])

  // ─── Handlers ────────────────────────────────────────────────
  const handleEstado = (e) => {
    const id = Number(e.target.value)
    setEstadoEscolhido(id)
    const sigla = estados.find(est => est.id_estado === id)?.sigla ?? ''
    onChange({ cidadeId: null, bairroId: null, estado: sigla, cidade: '', bairro: '' })
  }

  const handleCidade = (e) => {
    const cidade = cidades.find(c => c.id_cidade === Number(e.target.value))
    if (!cidade) return
    setEstadoDaCidade(prev => ({ ...prev, [cidade.id_cidade]: cidade.estadoId }))
    onChange({ cidadeId: cidade.id_cidade, bairroId: null, estado: cidade.estado, cidade: cidade.nome, bairro: '' })
  }

  const handleBairro = (e) => {
    const bairro = bairros.find(b => b.id_bairro === Number(e.target.value))
    const cidade = cidades.find(c => c.id_cidade === cidadeId)
    onChange({
      cidadeId,
      bairroId: bairro?.id_bairro ?? null,
      estado: cidade?.estado ?? '',
      cidade: cidade?.nome ?? '',
      bairro: bairro?.nome ?? '',
    })
  }

  return (
    <>
      <div className="sv-campo">
        <label htmlFor={`${idBase}-estado`}><LuMapPinned /> Estado{marca(obrigatorio)}</label>
        <select id={`${idBase}-estado`} className="sv-entrada" value={estadoId} disabled={disabled} onChange={handleEstado} required={obrigatorio}>
          <option value="" disabled>Selecione o estado</option>
          {estados.map(est => (
            <option key={est.id_estado} value={est.id_estado}>{est.nome} ({est.sigla})</option>
          ))}
        </select>
        {!disabled && estados.length === 0 && (
          <span style={{ fontSize: '12px', color: 'var(--sv-tinta-3)' }}>
            Nenhuma cidade cadastrada. <a href="/regioes">Cadastre em Regiões</a>.
          </span>
        )}
      </div>

      <div className="sv-campo">
        <label htmlFor={`${idBase}-cidade`}><LuMapPinned /> Cidade{marca(obrigatorio)}</label>
        <select
          id={`${idBase}-cidade`}
          className="sv-entrada"
          value={cidadeId ?? ''}
          disabled={disabled || !estadoId}
          onChange={handleCidade}
          required={obrigatorio}
        >
          <option value="" disabled>Selecione a cidade</option>
          {cidades.map(c => (
            <option key={c.id_cidade} value={c.id_cidade}>{c.nome}</option>
          ))}
        </select>
      </div>

      {mostrarBairro && (
        <div className="sv-campo">
          <label htmlFor={`${idBase}-bairro`}><LuMapPinned /> Bairro{marca(obrigatorio && bairroObrigatorio)}</label>
          <select
            id={`${idBase}-bairro`}
            className="sv-entrada"
            value={bairroId ?? ''}
            disabled={disabled || !cidadeId}
            onChange={handleBairro}
            required={obrigatorio && bairroObrigatorio}
          >
            <option value="" disabled={bairroObrigatorio}>
              {bairroObrigatorio ? 'Selecione o bairro' : 'Sem bairro definido'}
            </option>
            {bairros.map(b => (
              <option key={b.id_bairro} value={b.id_bairro}>{b.nome}</option>
            ))}
          </select>
          {!disabled && cidadeId && bairros.length === 0 && (
            <span style={{ fontSize: '12px', color: 'var(--sv-tinta-3)' }}>
              Esta cidade ainda não tem bairros. <a href="/regioes">Cadastre em Regiões</a>.
            </span>
          )}
        </div>
      )}
    </>
  )
}

export default SeletorLocalidade;
