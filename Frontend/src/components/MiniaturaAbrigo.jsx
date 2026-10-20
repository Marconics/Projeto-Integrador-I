// Foto pequena do abrigo nos cards das listagens (Hub de Abrigos e Abrigos do voluntário).
// Sem foto (ou se ela não carregar), mostra o ícone do tipo do abrigo.
import { useState } from 'react';
import { tipoDe } from '../utils/listagem';

export default function MiniaturaAbrigo({ abrigo }) {
  const [falhou, setFalhou] = useState(false)
  if (abrigo.fotoAbrigo && !falhou) {
    return (
      <span className="sv-miniatura">
        <img src={abrigo.fotoAbrigo} alt="" width="60" height="60" loading="lazy" decoding="async" onError={() => setFalhou(true)} />
      </span>
    )
  }
  return <span className="sv-miniatura sv-miniatura--reserva" aria-hidden="true">{tipoDe(abrigo.tipoAbrigo).icone}</span>
}
