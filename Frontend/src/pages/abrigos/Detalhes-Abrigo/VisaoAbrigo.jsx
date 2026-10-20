// Detalhes do abrigo — modo visualização (o modo edição é o formulário do index.jsx)
//
// Topo com o nome, tipo e status; faixa de alerta; números do abrigo (vagas,
// acolhidos, pedidos de ajuda, contatos no WhatsApp); painéis de Cadastro,
// Pedidos de ajuda e Vítimas; e os responsáveis/voluntários no WhatsApp.
// Cards e selos de estrutura reaproveitam o Hub de Abrigos (../Hub-Abrigos/style.css).
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LuBedDouble, LuChevronRight, LuHandHeart, LuImage, LuMapPin, LuMessageCircle, LuPencil, LuPhone, LuPlus,
  LuSiren, LuTriangleAlert, LuUser, LuUsers
} from 'react-icons/lu';
import { Vazio } from '../../../components/EstadosPagina';
import ResponsaveisWhatsapp from './ResponsaveisWhatsapp';
import { ESTRUTURAS, ocupacaoDe, vagasDe, corOcupacao, plural, tipoDe } from '../../../utils/listagem';
import { CATEGORIAS, urgenciaDe, statusPedidoDe, porUrgencia } from '../../../utils/pedidosAjuda';
import '../Hub-Abrigos/style.css';
import './visao.css';

const STATUS_ABRIGO = {
  ativo:      { label: 'Ativo',      classe: 'sv-tag--ok' },
  manutencao: { label: 'Manutenção', classe: 'sv-tag--atencao' },
  desativado: { label: 'Desativado', classe: 'sv-tag--neutro' },
}

const idadeDe = (dataNascimento) => {
  if (!dataNascimento) return null
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const mes = hoje.getMonth() - nasc.getMonth()
  if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

// "hoje", "ontem", "há 3 dias"
const haQuanto = (data) => {
  if (!data) return ''
  const dias = Math.floor((Date.now() - new Date(data)) / 86400000)
  return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`
}

function VisaoAbrigo({ abrigo, fotoUrl, pedidos, onEditar }) {
  const navigate = useNavigate()
  const id = abrigo.id_abrigo
  const [contatos, setContatos] = useState(null) // { responsaveis, voluntarios } vindo da seção do WhatsApp
  const aoCarregarContatos = useCallback((c) => setContatos(c), [])

  const pct = ocupacaoDe(abrigo)
  const vagas = vagasDe(abrigo)
  const status = STATUS_ABRIGO[abrigo.status] ?? { label: abrigo.status, classe: 'sv-tag--neutro' }
  const estruturas = ESTRUTURAS.filter(e => abrigo[e.campo])

  // Pedidos em aberto primeiro, mais urgentes primeiro
  const pedidosAtivos = pedidos
    .filter(p => p.status === 'aberto' || p.status === 'em_andamento')
    .sort(porUrgencia)
  const criticos = pedidosAtivos.filter(p => p.urgencia === 'critica').length

  const vitimas = [...(abrigo.vitimas ?? [])]
    .sort((a, b) => new Date(b.dataEntrada ?? b.createdAt) - new Date(a.dataEntrada ?? a.createdAt))

  const irParaWhatsapp = () => document.getElementById('titulo-responsaveis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const resumo = [
    {
      id: 'vagas', icone: <LuBedDouble />, tom: pct >= 100 ? 'sirene' : 'azul', valor: vagas, label: vagas === 1 ? 'Vaga livre' : 'Vagas livres',
      detalhe: `${abrigo.capacidadeOcupada}/${abrigo.capacidadeTotal} ocupadas · ${pct}%`, barra: true, urgente: pct >= 100,
    },
    {
      id: 'acolhidos', icone: <LuUsers />, tom: 'ciano', valor: vitimas.length, label: 'Vítimas no abrigo',
      detalhe: 'Ver as vítimas do abrigo', aoClicar: () => navigate(`/abrigos/${id}/vitimas`),
    },
    {
      id: 'pedidos', icone: <LuHandHeart />, tom: criticos > 0 ? 'sirene' : 'anil', valor: pedidosAtivos.length, label: 'Pedidos de ajuda abertos',
      detalhe: criticos > 0 ? plural(criticos, 'crítico', 'críticos') : 'Ver todos os pedidos', urgente: criticos > 0,
      aoClicar: () => navigate(`/abrigos/${id}/solicitacoes-ajuda`),
    },
    {
      id: 'whatsapp', icone: <LuMessageCircle />, tom: 'petroleo',
      valor: contatos ? contatos.responsaveis + contatos.voluntarios : '–', label: 'No WhatsApp',
      detalhe: contatos
        ? `${plural(contatos.responsaveis, 'responsável', 'responsáveis')} · ${plural(contatos.voluntarios, 'voluntário', 'voluntários')}`
        : 'Carregando...',
      aoClicar: irParaWhatsapp,
    },
  ]

  return (
    <>
      <header className="sv-topo">
        <div className="sv-topo-texto">
          <p className="sv-trilha"><a href="/abrigos">Abrigos</a> &gt; <span>{abrigo.nome}</span></p>
          <h1 className="sv-titulo">{abrigo.nome}</h1>
          <p className="sv-subtitulo da-subtitulo">
            <span className="sv-tag sv-tag--lisa sv-tag--neutro">{tipoDe(abrigo.tipoAbrigo).label}</span>
            <span className={`sv-tag sv-tag--lisa ${status.classe}`}>{status.label}</span>
            <span><LuMapPin aria-hidden="true" /> {[abrigo.endereco, abrigo.bairro, `${abrigo.cidade}/${abrigo.estado}`].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
        <div className="sv-topo-acoes">
          <button type="button" className="sv-btn sv-btn--vidro sv-anima" onClick={onEditar}>
            <span data-anim="pulo"><LuPencil /></span> Editar
          </button>
          <button type="button" className="sv-btn sv-btn--primario sv-anima" onClick={() => navigate(`/abrigos/${id}/cadastrar-solicitacao-ajuda`)}>
            <span data-anim="giro"><LuPlus /></span> Novo pedido de ajuda
          </button>
        </div>
      </header>

      {abrigo.statusAlerta && (
        <div className="da-alerta" role="status">
          <LuSiren aria-hidden="true" />
          <span><strong>Alerta ativo no bairro {abrigo.bairro}.</strong> Confira a situação antes de encaminhar pessoas.</span>
          <button type="button" className="sv-btn sv-btn--perigo sv-btn--p" onClick={() => navigate('/alertas')}>
            Ver alertas <LuChevronRight />
          </button>
        </div>
      )}

      <div className="da-grade">
        {/* ── CADASTRO ── */}
        <section className="sv-vidro sv-painel da-cadastro" aria-labelledby="titulo-cadastro">
          <h2 id="titulo-cadastro" className="sv-secao-titulo">Cadastro</h2>
          {/* Foto grande, na largura do painel (como era antes do novo layout) */}
          {fotoUrl ? (
            <img className="da-foto" src={fotoUrl} alt={`Foto de ${abrigo.nome}`} loading="lazy" />
          ) : (
            <div className="da-foto da-foto--vazia">
              <LuImage aria-hidden="true" />
              <span>Sem foto cadastrada</span>
              <button type="button" className="sv-btn sv-btn--vidro sv-btn--p" onClick={onEditar}>Adicionar foto</button>
            </div>
          )}

          <div className="da-cadastro-topo">
            <dl className="da-dados">
              <div><dt><LuUser /> Responsável</dt><dd>{abrigo.responsavel || 'Não informado'}</dd></div>
              <div><dt><LuPhone /> Telefone</dt><dd>{abrigo.telefone || 'Não informado'}</dd></div>
              <div><dt><LuMapPin /> CEP</dt><dd>{abrigo.cep || '—'}</dd></div>
            </dl>
          </div>

          {!(abrigo.latitude && abrigo.longitude) && (
            <p className="sv-aviso sv-aviso--atencao da-aviso">
              <LuTriangleAlert /> Sem localização: este abrigo não aparece no mapa. Clique em <strong>Editar</strong> e em "Buscar localização".
            </p>
          )}

          <h3 className="da-subtitulo-painel">Estrutura</h3>
          {estruturas.length === 0 ? (
            <p className="sv-apoio">Nenhuma estrutura informada.</p>
          ) : (
            <ul className="da-estruturas">
              {estruturas.map(e => (
                <li key={e.campo}><span className="ha-selo" aria-hidden="true">{e.icone}</span> {e.label}</li>
              ))}
            </ul>
          )}
        </section>

        <div className="da-coluna">
          {/* ── PEDIDOS DE AJUDA ── */}
          <section className="sv-vidro sv-painel" aria-labelledby="titulo-pedidos">
            <div className="sv-secao-linha">
              <h2 id="titulo-pedidos" className="sv-secao-titulo">Pedidos de ajuda</h2>
              <button type="button" className="sv-btn sv-btn--vidro sv-btn--p" onClick={() => navigate(`/abrigos/${id}/solicitacoes-ajuda`)}>
                Ver todos ({pedidos.length}) <LuChevronRight className="sv-seta" />
              </button>
            </div>
            {pedidosAtivos.length === 0 ? (
              <Vazio
                icone={<LuHandHeart />}
                titulo="Nenhum pedido de ajuda em aberto."
                dica="Crie um quando o abrigo precisar de doações, medicamentos ou voluntários."
              />
            ) : (
              <div className="sv-lista">
                {pedidosAtivos.slice(0, 4).map(p => {
                  const urg = urgenciaDe(p.urgencia)
                  const st = statusPedidoDe(p.status)
                  return (
                    <div key={p.id_solicitacao} className="sv-linha sv-linha--clicavel" role="link" tabIndex={0}
                      onClick={() => navigate(`/visualizar-solicitacao-ajuda/${p.id_solicitacao}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/visualizar-solicitacao-ajuda/${p.id_solicitacao}`) }}>
                      <span className={`sv-tag sv-tag--lisa ${urg.classe}`}>{urg.label}</span>
                      <div className="sv-linha-info">
                        <p className="sv-linha-titulo">{p.titulo}</p>
                        <p className="sv-linha-meta">
                          <span>{CATEGORIAS[p.categoria] ?? p.categoria}</span>
                          {p._count?.interesses > 0 && <span><LuUsers aria-hidden="true" /> {plural(p._count.interesses, 'interessado', 'interessados')}</span>}
                        </p>
                      </div>
                      <span className={`sv-tag sv-tag--lisa ${st.classe}`}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── VÍTIMAS ── */}
          <section className="sv-vidro sv-painel" aria-labelledby="titulo-vitimas">
            <div className="sv-secao-linha">
              <h2 id="titulo-vitimas" className="sv-secao-titulo">Vítimas no abrigo</h2>
              <button type="button" className="sv-btn sv-btn--vidro sv-btn--p" onClick={() => navigate(`/abrigos/${id}/vitimas`)}>
                Ver todas ({vitimas.length}) <LuChevronRight className="sv-seta" />
              </button>
            </div>
            {vitimas.length === 0 ? (
              <Vazio
                icone={<LuUsers />}
                titulo="Nenhuma vítima vinculada a este abrigo."
                dica="Para vincular vítimas a este abrigo, use “Ver todas”."
              />
            ) : (
              <div className="sv-lista">
                {vitimas.slice(0, 5).map(v => {
                  const idade = idadeDe(v.dataNascimento)
                  return (
                    <div key={v.id_vitima} className="sv-linha sv-linha--clicavel" role="link" tabIndex={0}
                      onClick={() => navigate(`/detalhes-vitimas/${v.id_vitima}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/detalhes-vitimas/${v.id_vitima}`) }}>
                      <span className="sv-poco sv-poco--p sv-poco--ciano"><LuUser /></span>
                      <div className="sv-linha-info">
                        <p className="sv-linha-titulo">{v.nome}</p>
                        <p className="sv-linha-meta">
                          {idade !== null && <span>{plural(idade, 'ano', 'anos')}</span>}
                          <span>entrou {haQuanto(v.dataEntrada ?? v.createdAt)}</span>
                        </p>
                      </div>
                      <LuChevronRight className="sv-seta" aria-hidden="true" />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── NÚMEROS DO ABRIGO ── faixa de vidro única (no estilo dos painéis glass), abaixo dos painéis */}
      <section className="sv-vidro da-indicadores" aria-label="Resumo do abrigo">
        {resumo.map(card => {
          const Elemento = card.aoClicar ? 'button' : 'div'
          return (
            <Elemento
              key={card.id}
              {...(card.aoClicar ? { type: 'button', onClick: card.aoClicar } : {})}
              className={`da-indicador da-indicador--${card.tom}${card.urgente ? ' da-indicador--urgente' : ''}`}
            >
              <span className="da-indicador-icone" aria-hidden="true">{card.icone}</span>
              <span className="da-indicador-texto">
                <span className="da-indicador-valor">{card.valor}</span>
                <span className="da-indicador-rotulo">{card.label}</span>
                {card.barra && (
                  <span className="sv-barra da-barra" role="img" aria-label={`Ocupação de ${pct}%`}>
                    <span style={{ width: `${pct}%`, background: corOcupacao(pct) }} />
                  </span>
                )}
                <span className="da-indicador-detalhe">{card.detalhe}</span>
              </span>
              {card.aoClicar && <LuChevronRight className="da-indicador-seta" aria-hidden="true" />}
            </Elemento>
          )
        })}
      </section>

      {/* ── WHATSAPP ── */}
      <ResponsaveisWhatsapp
        abrigoId={id}
        telefoneAbrigo={abrigo.telefone}
        nomeResponsavelAbrigo={abrigo.responsavel}
        aoCarregar={aoCarregarContatos}
      />
    </>
  )
}

export default VisaoAbrigo
