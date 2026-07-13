import { useGetTodaySessions, useSaveSessionAttendance } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceSaveInputRecordsItem, AttendanceRecordStatus } from '@workspace/api-client-react/src/generated/api.schemas';
import { useAuth } from '@/contexts/AuthContext';

export default function TrainingsList() {
  const { data: sessions, isLoading, refetch } = useGetTodaySessions();
  const { mutate: saveAttendance, isPending } = useSaveSessionAttendance();
  const { toast } = useToast();
  const { user } = useAuth();
  const isTrainer = user?.role === 'trainer';

  // State maps sessionId -> array of attendance records
  const [attendanceData, setAttendanceData] = useState<Record<number, AttendanceSaveInputRecordsItem[]>>({});

  useEffect(() => {
    if (sessions) {
      const initialData: Record<number, AttendanceSaveInputRecordsItem[]> = {};
      sessions.forEach(session => {
        // If we have existing attendance, use it. Otherwise, default everyone to 'presente'
        if (session.existingAttendance && session.existingAttendance.length > 0) {
          initialData[session.id] = session.existingAttendance.map(a => ({
            athleteId: a.athleteId,
            status: a.status,
            observation: a.observation
          }));
        } else {
          initialData[session.id] = session.athletes.map(a => ({
            athleteId: a.id,
            status: 'presente' as AttendanceRecordStatus,
          }));
        }
      });
      setAttendanceData(initialData);
    }
  }, [sessions]);

  const toggleStatus = (sessionId: number, athleteId: number) => {
    setAttendanceData(prev => {
      const sessionRecords = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: sessionRecords.map(r => {
          if (r.athleteId === athleteId) {
            return {
              ...r,
              status: r.status === 'presente' ? 'ausente' : 'presente'
            };
          }
          return r;
        })
      };
    });
  };

  const handleSave = (sessionId: number) => {
    const records = attendanceData[sessionId];
    if (!records) return;

    saveAttendance({
      id: sessionId,
      data: { records }
    }, {
      onSuccess: () => {
        toast({
          title: "Presenças guardadas",
          description: "O registo de presenças foi atualizado com sucesso.",
        });
        refetch();
      },
      onError: () => {
        toast({
          title: "Erro",
          description: "Não foi possível guardar as presenças.",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return <div>A carregar treinos de hoje...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Treinos de Hoje</h1>
          <p className="text-muted-foreground">{new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {sessions?.length === 0 ? (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Info className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Sem treinos agendados</p>
            <p className="text-sm text-muted-foreground">Não tem nenhum treino atribuído para hoje.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sessions?.map(session => {
            const records = attendanceData[session.id] || [];
            const presentCount = records.filter(r => r.status === 'presente').length;
            const hasExisting = session.existingAttendance && session.existingAttendance.length > 0;

            return (
              <Card key={session.id} className="flex flex-col h-full border-primary/20 shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge className="mb-2 uppercase" variant="outline">{session.trainingType}</Badge>
                      <CardTitle className="text-xl">{session.groupCategory}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 font-mono">
                        {session.startTime} - {session.endTime}
                      </p>
                    </div>
                    {hasExisting && <Badge variant="secondary">Registado</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 flex flex-col">
                  <div className="p-4 bg-muted/10 border-b flex justify-between items-center text-sm">
                    <span className="font-medium">{session.athletes.length} Atletas inscritos</span>
                    <span className="text-muted-foreground">{presentCount} Presentes</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto max-h-[400px] p-2 space-y-1">
                    {session.athletes.map(athlete => {
                      const record = records.find(r => r.athleteId === athlete.id);
                      const isPresent = record?.status === 'presente';
                      
                      return (
                        <div 
                          key={athlete.id}
                          onClick={() => toggleStatus(session.id, athlete.id)}
                          className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors border ${
                            isPresent 
                              ? 'bg-success/5 border-success/20 hover:bg-success/10' 
                              : 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10'
                          }`}
                        >
                          <span className="font-medium text-sm">{athlete.name}</span>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            isPresent ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'
                          }`}>
                            {isPresent ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </div>
                        </div>
                      );
                    })}
                    {session.athletes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum atleta nesta categoria.</p>
                    )}
                  </div>

                  <div className="p-4 border-t mt-auto">
                    <Button 
                      className="w-full" 
                      onClick={() => handleSave(session.id)}
                      disabled={isPending || session.athletes.length === 0}
                    >
                      {hasExisting ? 'Atualizar Presenças' : 'Guardar Presenças'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
