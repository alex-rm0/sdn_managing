import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sailboat, Wrench, Truck } from 'lucide-react';
import FleetList from '@/pages/fleet/index';
import EquipmentList from '@/pages/equipment/index';

export default function InventarioPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">Gestão de embarcações, viaturas e equipamento da secção</p>
      </div>

      <Tabs defaultValue="embarcacoes">
        <TabsList className="mb-2">
          <TabsTrigger value="embarcacoes" className="flex items-center gap-2">
            <Sailboat className="w-4 h-4" /> Embarcações
          </TabsTrigger>
          <TabsTrigger value="viaturas" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Viaturas
          </TabsTrigger>
          <TabsTrigger value="equipamento" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Equipamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="embarcacoes">
          <FleetList category="embarcacoes" />
        </TabsContent>

        <TabsContent value="viaturas">
          <FleetList category="viaturas" />
        </TabsContent>

        <TabsContent value="equipamento">
          <EquipmentList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
