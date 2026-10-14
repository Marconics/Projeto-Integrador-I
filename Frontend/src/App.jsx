import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Sosvale from './pages/sosvale';
import LoginAdm from './pages/login_adm';
import Login from './pages/login';
import PgAdm from './pages/pg_adm';
import PgAdmGlass from './pages/PgAdmGlass/PgAdmGlass';
import Cadastro from './pages/cadastro';
import ListarAbrigos from './pages/abrigos/Hub-Abrigos';
import CadastroVitima from './pages/vitimas/Cadastro-Vitima';
import ListarVitimas from './pages/vitimas/Hub-Vitimas';
import CadastrarAbrigo from './pages/abrigos/Cadastrar-Abrigo';
import DetalhesAbrigo from './pages/abrigos/Detalhes-Abrigo';
import DetalhesVitimas from './pages/vitimas/Detalhes-Vitima';
import DetalhesSolicitacaoAbrigo from './pages/Solicitacoes-Abrigo/Detalhes-solicitacao'
import ListaSolicitacoesAbrigo from './pages/Solicitacoes-Abrigo/Listar-Solicitacoes'
import GerenciarRegioes from './pages/regioes/Gerenciar-Regioes';
import Mapa from './pages/regioes/mapa';
import CadastroVoluntario from './pages/cadastro-voluntario';
import LoginVoluntario from './pages/login-voluntario';
import PainelVoluntario from './pages/pg-voluntario';
import VitimasDoAbrigo from './pages/abrigos/Vitimas-Abrigo';
import AbrigosVoluntario from './pages/abrigos/Abrigos-Voluntario';
import SolicitacoesAjudaDoAbrigo from './pages/Solicitacoes-Ajuda/listar-solicitacoes-do-abrigo';
import CadastrarSolicitacaoAjuda from './pages/Solicitacoes-Ajuda/cadastrar-solicitacao-ajuda';
import DetalhesSolicitacaoAjuda from './pages/Solicitacoes-Ajuda/detalhes-solicitacao-ajuda';
import SolicitacoesAjudaVoluntario from './pages/Solicitacoes-Ajuda/solicitacoes-ajuda-voluntario';
import ListarSolicitacoesAjuda from './pages/Solicitacoes-Ajuda/listar-todas';
import ListarAlertas from './pages/alertas/Listar-Alertas';
import DetalhesAlerta from './pages/alertas/Detalhes-Alerta';
import ListarInscritos from './pages/inscritos/Listar-Inscritos';
import DetalhesInscrito from './pages/inscritos/Detalhes-Inscrito';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* 2. DEFINIÇÃO DAS ROTAS */}
          <Route path="/" element={<Sosvale />} />
          <Route path="/login-adm" element={<LoginAdm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pg_adm" element={<PgAdm />} />
          {/* Rota de teste do novo design da home (a /pg_adm continua sendo a oficial) */}
          <Route path="/adm-nova" element={<PgAdmGlass />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/abrigos" element={<ListarAbrigos />} />
          <Route path="/cadastro-vitima" element={<CadastroVitima />} />
          <Route path="/vitimas" element={<ListarVitimas />} />
          <Route path="/cadastrar-abrigos" element={<CadastrarAbrigo />} />
          <Route path="/detalhes-abrigos/:id" element={<DetalhesAbrigo />} />
          <Route path="/detalhes-vitimas/:id" element={<DetalhesVitimas/>}/>
          <Route path="/mapa" element={<Mapa/>}/>
          <Route path="/visualizar-solicitação-abrigo/:id" element={<DetalhesSolicitacaoAbrigo/>}/>
          <Route path="/listar-solicitação-abrigo" element={<ListaSolicitacoesAbrigo/>}/>
          <Route path="/regioes" element={<GerenciarRegioes/>}/>
          {/* Endereço antigo da tela de regiões */}
          <Route path="/cadastrar-regiao" element={<Navigate to="/regioes" replace />}/>
          <Route path="/cadastro-voluntario" element={<CadastroVoluntario/>}/>
          <Route path="/login-voluntario" element={<LoginVoluntario/>}/>
          <Route path="/painel-voluntario" element={<PainelVoluntario/>}/>
          <Route path="/abrigos/:id/vitimas" element={<VitimasDoAbrigo/>}/>
          <Route path="/abrigos/:id/solicitacoes-ajuda" element={<SolicitacoesAjudaDoAbrigo/>}/>
          <Route path="/abrigos/:id/cadastrar-solicitacao-ajuda" element={<CadastrarSolicitacaoAjuda/>}/>
          <Route path="/visualizar-solicitacao-ajuda/:id" element={<DetalhesSolicitacaoAjuda/>}/>
          <Route path="/solicitacoes-ajuda-voluntario" element={<SolicitacoesAjudaVoluntario/>}/>
          <Route path="/solicitacoes-ajuda" element={<ListarSolicitacoesAjuda/>}/>
          <Route path="/voluntario/mapa" element={<Mapa modulo="voluntario"/>}/>
          <Route path="/voluntario/abrigos" element={<AbrigosVoluntario/>}/>
          <Route path="/alertas" element={<ListarAlertas/>}/>
          <Route path="/alertas/:id" element={<DetalhesAlerta/>}/>
          <Route path="/inscritos" element={<ListarInscritos/>}/>
          <Route path="/inscritos/:id" element={<DetalhesInscrito/>}/>


        </Routes>
      </Router>
    </div>
  );
}

export default App;