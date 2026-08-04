import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';

// Page Imports
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Lembretes from '@/pages/lembretes';
import Estatisticas from '@/pages/estatisticas';
import AthletesList from '@/pages/athletes/index';
import AthleteDetail from '@/pages/athletes/detail';
import SeasonsList from '@/pages/seasons/index';
import ResultsList from '@/pages/results/index';
import CompetitionsList from '@/pages/competitions/index';
import FinancialList from '@/pages/financial/index';
import QuotasList from '@/pages/quotas/index';
import InventarioPage from '@/pages/inventario/index';
import FleetList from '@/pages/fleet/index';
import EquipmentList from '@/pages/equipment/index';
import TrainingsList from '@/pages/trainings/index';
import SchedulesList from '@/pages/schedules/index';
import UsersList from '@/pages/users/index';
import DocumentsList from '@/pages/documents/index';
import MeetingsList from '@/pages/meetings/index';
import MeetingDetail from '@/pages/meetings/detail';
import MeetingEdit from '@/pages/meetings/edit';
import MeetingPrepare from '@/pages/meetings/prepare';
import NoticiaIA from '@/pages/noticia-ia';
import EquipaPage from '@/pages/equipa/index';
import { useEffect } from 'react';

const queryClient = new QueryClient();

// Route Guard
function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading, isFetching } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isFetching && !user) {
      setLocation('/login');
    } else if (!isLoading && !isFetching && user && adminOnly && user.role !== 'admin') {
      setLocation('/treinos');
    }
  }, [user, isLoading, isFetching, setLocation, adminOnly]);

  if (isLoading || isFetching || !user || (adminOnly && user.role !== 'admin')) {
    return null;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} adminOnly />}
      </Route>
      <Route path="/lembretes">
        {() => <ProtectedRoute component={Lembretes} adminOnly />}
      </Route>
      <Route path="/atletas">
        {() => <ProtectedRoute component={AthletesList} adminOnly />}
      </Route>
      <Route path="/atletas/:id">
        {() => <ProtectedRoute component={AthleteDetail} adminOnly />}
      </Route>
      <Route path="/epocas">
        {() => <ProtectedRoute component={SeasonsList} adminOnly />}
      </Route>
      <Route path="/resultados">
        {() => <ProtectedRoute component={ResultsList} adminOnly />}
      </Route>
      <Route path="/competicoes">
        {() => <ProtectedRoute component={CompetitionsList} adminOnly />}
      </Route>
      <Route path="/financeiro">
        {() => <ProtectedRoute component={FinancialList} adminOnly />}
      </Route>
      <Route path="/quotas">
        {() => <ProtectedRoute component={QuotasList} adminOnly />}
      </Route>
      <Route path="/inventario">
        {() => <ProtectedRoute component={InventarioPage} adminOnly />}
      </Route>
      <Route path="/embarcacoes">
        {() => <ProtectedRoute component={FleetList} adminOnly />}
      </Route>
      <Route path="/equipamento">
        {() => <ProtectedRoute component={EquipmentList} adminOnly />}
      </Route>
      <Route path="/estatisticas">
        {() => <ProtectedRoute component={Estatisticas} adminOnly />}
      </Route>
      <Route path="/treinos">
        {() => <ProtectedRoute component={TrainingsList} />}
      </Route>
      <Route path="/horarios">
        {() => <ProtectedRoute component={SchedulesList} adminOnly />}
      </Route>
      <Route path="/utilizadores">
        {() => <ProtectedRoute component={UsersList} adminOnly />}
      </Route>
      <Route path="/documentos">
        {() => <ProtectedRoute component={DocumentsList} adminOnly />}
      </Route>
      <Route path="/equipa">
        {() => <ProtectedRoute component={EquipaPage} adminOnly />}
      </Route>
      <Route path="/reunioes">
        {() => <ProtectedRoute component={MeetingsList} adminOnly />}
      </Route>
      <Route path="/reunioes/:id/editar">
        {() => <ProtectedRoute component={MeetingEdit} adminOnly />}
      </Route>
      <Route path="/reunioes/:id/preparar">
        {() => <ProtectedRoute component={MeetingPrepare} adminOnly />}
      </Route>
      <Route path="/reunioes/:id">
        {() => <ProtectedRoute component={MeetingDetail} adminOnly />}
      </Route>
      <Route path="/noticia-ia">
        {() => <ProtectedRoute component={NoticiaIA} adminOnly />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
