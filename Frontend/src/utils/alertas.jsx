// Ícone de cada tipo de alerta (mesmas chaves de Backend/src/lib/alertas.js).
// A API também manda um emoji por tipo, usado nas mensagens do WhatsApp;
// nas telas usamos os ícones do tema (react-icons/lu).
import {
  LuWaves, LuMountain, LuTreePine, LuZap, LuFlame, LuConstruction, LuWind, LuTriangleAlert,
} from 'react-icons/lu';

const ICONES_TIPO_ALERTA = {
  alagamento:      <LuWaves />,
  deslizamento:    <LuMountain />,
  arvore_caida:    <LuTreePine />,
  falta_energia:   <LuZap />,
  incendio:        <LuFlame />,
  via_interditada: <LuConstruction />,
  vendaval:        <LuWind />,
}

// Tipo desconhecido (ou ainda não carregado) cai no ícone genérico de alerta
export const iconeDoTipoAlerta = (tipo) => ICONES_TIPO_ALERTA[tipo] ?? <LuTriangleAlert />
