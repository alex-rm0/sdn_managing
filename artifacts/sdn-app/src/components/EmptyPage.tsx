export default function EmptyPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="bg-card border rounded-md p-12 text-center text-muted-foreground">
        Esta página está em desenvolvimento e será disponibilizada numa fase futura do projeto.
      </div>
    </div>
  );
}
