// Escolha das deficiências de uma vítima: um chip por tipo, clique marca/desmarca.
// Usado no Cadastro de vítima e nos Detalhes da vítima.
// Os tipos vêm de GET /api/vitimas/deficiencias ([{ id, nome }]).
//
// Uso: <SeletorDeficiencias tipos={tipos} marcadas={ids} aoAlternar={(id) => ...} rotuloId="id-do-rotulo" />
import { LuCheck } from 'react-icons/lu';

function SeletorDeficiencias({ tipos, marcadas, aoAlternar, desabilitado = false, rotuloId }) {
  return (
    <div className="sv-chips" role="group" aria-labelledby={rotuloId}>
      {tipos.map(t => {
        const marcada = marcadas.includes(t.id)
        return (
          <button key={t.id} type="button" aria-pressed={marcada} disabled={desabilitado}
            className={`sv-chip${marcada ? ' sv-chip--ativo' : ''}`}
            onClick={() => aoAlternar(t.id)}>
            {marcada && <LuCheck aria-hidden="true" />} {t.nome}
          </button>
        )
      })}
    </div>
  )
}

export default SeletorDeficiencias;
