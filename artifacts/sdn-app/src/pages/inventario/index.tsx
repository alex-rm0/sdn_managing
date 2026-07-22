import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sailboat, Wrench } from 'lucide-react';
import FleetList from '@/pages/fleet/index';
import EquipmentList from '@/pages/equipment/index';

export default function InventarioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventário</h1>
        <p className="text-muted-foreground mt-1">Gestão de embarcações, viaturas e equipamento da secção</p>
      </div>

      <Tabs defaultValue="embarcacoes">
        <TabsList className="mb-2">
          <TabsTrigger value="embarcacoes" className="flex items-center gap-2">
            <Sailboat className="w-4 h-4" /> Embarcações & Viaturas
          </TabsTrigger>
          <TabsTrigger value="equipamento" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Equipamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="embarcacoes">
          {/* Strip the inner page title — rendered inline here */}
          <FleetInline />
        </TabsContent>

        <TabsContent value="equipamento">
          <EquipmentInline />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Re-export the page components without their outer title
// We render them directly so they manage their own state/dialogs
function FleetInline() {
  return <FleetList />;
}

function EquipmentInline() {
  return <EquipmentList />;
}
