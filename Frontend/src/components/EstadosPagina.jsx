// Estados padrão das páginas (o mesmo jeito da home):
//
//   <Esqueleto forma="lista" />            → enquanto a API responde
//   <ErroPagina mensagem="..." onTentar={buscar} />  → falhou: explica e deixa tentar de novo
//   <Vazio icone={<LuInbox />} titulo="..." dica="..." acao={<button>...</button>} />
//
// Estilos: styles/sosvale-glass.css (seções "Estados da página" e "Esqueleto").
import { LuRefreshCw, LuWifiOff } from 'react-icons/lu';

// forma: 'lista' (resumo + linhas), 'linhas' (só as linhas), 'cards' (grade de cards),
//        'detalhe' (duas colunas) ou 'formulario' (campos)
export function Esqueleto({ forma = 'lista', linhas = 5, resumo = 3 }) {
  const repetir = (n, render) => Array.from({ length: n }, (_, i) => render(i))
  const linhasEsq = (
    <div className="sv-esq-painel">
      <div className="sv-esqueleto sv-esq-titulo" />
      {repetir(linhas, i => <div key={i} className="sv-esqueleto sv-esq-linha" />)}
    </div>
  )

  return (
    <div className="sv-esq-pilha" aria-busy="true" aria-label="Carregando">
      {forma === 'lista' && resumo > 0 && (
        <div className="sv-esq-resumo">
          {repetir(resumo, i => <div key={i} className="sv-esqueleto sv-esq-card" />)}
        </div>
      )}
      {(forma === 'lista' || forma === 'linhas') && linhasEsq}
      {forma === 'cards' && (
        <div className="sv-grade">
          {repetir(linhas, i => <div key={i} className="sv-esqueleto sv-esq-card" />)}
        </div>
      )}
      {forma === 'detalhe' && (
        <div className="sv-esq-duas">
          <div className="sv-esqueleto sv-esq-bloco" />
          <div className="sv-esqueleto sv-esq-bloco" />
        </div>
      )}
      {forma === 'formulario' && (
        <div className="sv-esq-painel">
          <div className="sv-esqueleto sv-esq-titulo" />
          {repetir(linhas, i => <div key={i} className="sv-esqueleto sv-esq-campo" />)}
        </div>
      )}
    </div>
  )
}

export function ErroPagina({
  titulo = 'Não foi possível carregar esta página',
  mensagem = 'O servidor não respondeu. Verifique a conexão e tente novamente.',
  onTentar,
}) {
  return (
    <section className="sv-erro-pagina sv-vidro" role="alert">
      <span className="sv-poco sv-poco--g sv-poco--sirene"><LuWifiOff /></span>
      <h2>{titulo}</h2>
      <p>{mensagem}</p>
      {onTentar && (
        <button type="button" className="sv-btn sv-btn--primario sv-anima" onClick={onTentar}>
          <span data-anim="volta"><LuRefreshCw /></span>
          Tentar novamente
        </button>
      )}
    </section>
  )
}

export function Vazio({ icone, titulo, dica, acao }) {
  return (
    <div className="sv-vazio">
      {icone && <span className="sv-poco sv-poco--g">{icone}</span>}
      {titulo && <p className="sv-vazio-titulo">{titulo}</p>}
      {dica && <p className="sv-vazio-dica">{dica}</p>}
      {acao}
    </div>
  )
}
