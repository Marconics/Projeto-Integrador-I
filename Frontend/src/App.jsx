import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import RotaProtegida from './components/RotaProtegida';
import Sosvale from './pages/sosvale';
import LoginAdm from './pages/login_adm';
import PgAdmGlass from './pages/PgAdmGlass/PgAdmGlass';
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
import Administradores from './pages/administradores';

// As telas antigas de teste "/login" e "/cadastro" ficam em pages/descontinuada
// (não são mais usadas; os endereços levam para a tela inicial)

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* 2. DEFINIÇÃO DAS ROTAS */}

          {/* Telas públicas */}
          <Route path="/" element={<Sosvale />} />
          <Route path="/login-adm" element={<LoginAdm />} />
          <Route path="/cadastro-voluntario" element={<CadastroVoluntario/>}/>
          <Route path="/login-voluntario" element={<LoginVoluntario/>}/>

          {/* Telas do ADMINISTRADOR — sem login de admin, vão para /login-adm */}
          <Route element={<RotaProtegida tipo="admin" />}>
            {/* Home do admin no novo visual. A antiga continua em pages/pg_adm, sem rota */}
            <Route path="/pg_adm" element={<PgAdmGlass />} />
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
            <Route path="/abrigos/:id/vitimas" element={<VitimasDoAbrigo/>}/>
            <Route path="/abrigos/:id/solicitacoes-ajuda" element={<SolicitacoesAjudaDoAbrigo/>}/>
            <Route path="/abrigos/:id/cadastrar-solicitacao-ajuda" element={<CadastrarSolicitacaoAjuda/>}/>
            <Route path="/visualizar-solicitacao-ajuda/:id" element={<DetalhesSolicitacaoAjuda/>}/>
            <Route path="/solicitacoes-ajuda" element={<ListarSolicitacoesAjuda/>}/>
            <Route path="/alertas" element={<ListarAlertas/>}/>
            <Route path="/alertas/:id" element={<DetalhesAlerta/>}/>
            <Route path="/inscritos" element={<ListarInscritos/>}/>
            <Route path="/inscritos/:id" element={<DetalhesInscrito/>}/>
            <Route path="/administradores" element={<Administradores/>}/>
          </Route>

          {/* Telas do VOLUNTÁRIO — sem login de voluntário, vão para /login-voluntario */}
          <Route element={<RotaProtegida tipo="voluntario" />}>
            <Route path="/painel-voluntario" element={<PainelVoluntario/>}/>
            <Route path="/solicitacoes-ajuda-voluntario" element={<SolicitacoesAjudaVoluntario/>}/>
            <Route path="/voluntario/mapa" element={<Mapa modulo="voluntario"/>}/>
            <Route path="/voluntario/abrigos" element={<AbrigosVoluntario/>}/>
          </Route>

          {/* Endereços antigos */}
          <Route path="/cadastrar-regiao" element={<Navigate to="/regioes" replace />}/>
          <Route path="/login" element={<Navigate to="/" replace />}/>
          <Route path="/cadastro" element={<Navigate to="/" replace />}/>

          {/* Qualquer endereço que não existe volta para a tela inicial */}
          <Route path="*" element={<Navigate to="/" replace />}/>
        </Routes>
      </Router>
    </div>
  );
}

export default App;
