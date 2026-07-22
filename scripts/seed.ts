import bcrypt from "bcrypt";
import { db } from "../lib/db/src/index";
import {
  usersTable,
  seasonsTable,
  categoryRulesTable,
  athletesTable,
  crewsTable,
  crewAthletesTable,
  fleetItemsTable,
  fleetValuationsTable,
  equipmentTable,
  trainingSchedulesTable,
  trainingSessionsTable,
  competitionsTable,
  racesTable,
  resultsTable,
  financialMovementsTable,
  quotaPlansTable,
  quotasTable,
  paymentsTable,
  documentsTable,
} from "../lib/db/src/schema/index";

async function seed() {
  console.log("🌱 A semear dados de exemplo...");

  // Users
  const adminHash = await bcrypt.hash("admin", 10);
  const trainerHash = await bcrypt.hash("treino123", 10);

  const [admin] = await db.insert(usersTable).values({
    name: "Administrador",
    email: "admin",
    passwordHash: adminHash,
    role: "admin",
    active: true,
    assignedCategories: [],
  }).returning().onConflictDoNothing();

  const [trainer] = await db.insert(usersTable).values({
    name: "Carlos Treinador",
    email: "treinador@sdn-aac.pt",
    passwordHash: trainerHash,
    role: "trainer",
    active: true,
    assignedCategories: ["Sénior", "Sub-23"],
  }).returning().onConflictDoNothing();

  console.log("✅ Utilizadores criados");

  // Seasons
  const [season] = await db.insert(seasonsTable).values({
    name: "2025/2026",
    startDate: "2025-09-01",
    endDate: "2026-07-31",
    active: true,
  }).returning();

  const [prevSeason] = await db.insert(seasonsTable).values({
    name: "2024/2025",
    startDate: "2024-09-01",
    endDate: "2025-07-31",
    active: false,
  }).returning();

  console.log("✅ Épocas criadas");

  // Category Rules
  await db.insert(categoryRulesTable).values([
    { name: "Jovem", minAge: 12, maxAge: 14, description: "12-14 anos" },
    { name: "Juvenil", minAge: 15, maxAge: 16, description: "15-16 anos" },
    { name: "Júnior", minAge: 17, maxAge: 18, description: "17-18 anos" },
    { name: "Sub-23", minAge: 19, maxAge: 22, description: "19-22 anos" },
    { name: "Sénior", minAge: 23, maxAge: 35, description: "23-35 anos" },
    { name: "Master", minAge: 36, maxAge: null, description: "36+ anos" },
  ]);

  console.log("✅ Categorias criadas");

  // Athletes
  const athletes = await db.insert(athletesTable).values([
    {
      name: "João Ferreira",
      birthDate: "2001-03-15",
      gender: "M",
      email: "joao.ferreira@email.pt",
      phone: "912345678",
      memberNumber: "AAC001",
      fprNumber: "FPR2345",
      affiliationDate: "2018-09-01",
      status: "ativo",
      notes: "Remador de referência da secção",
    },
    {
      name: "Maria Santos",
      birthDate: "2003-07-22",
      gender: "F",
      email: "maria.santos@email.pt",
      phone: "913456789",
      memberNumber: "AAC002",
      fprNumber: "FPR2346",
      affiliationDate: "2020-09-01",
      status: "ativo",
    },
    {
      name: "Pedro Almeida",
      birthDate: "2000-11-08",
      gender: "M",
      email: "pedro.almeida@email.pt",
      phone: "914567890",
      memberNumber: "AAC003",
      fprNumber: "FPR2347",
      affiliationDate: "2017-09-01",
      status: "ativo",
    },
    {
      name: "Ana Costa",
      birthDate: "2002-05-30",
      gender: "F",
      email: "ana.costa@email.pt",
      phone: "915678901",
      memberNumber: "AAC004",
      fprNumber: "FPR2348",
      affiliationDate: "2019-09-01",
      status: "ativo",
    },
    {
      name: "Rui Gomes",
      birthDate: "1995-12-04",
      gender: "M",
      email: "rui.gomes@email.pt",
      phone: "916789012",
      memberNumber: "AAC005",
      fprNumber: "FPR2349",
      affiliationDate: "2014-09-01",
      status: "ativo",
    },
    {
      name: "Sofia Mendes",
      birthDate: "1990-02-18",
      gender: "F",
      email: "sofia.mendes@email.pt",
      phone: "917890123",
      memberNumber: "AAC006",
      fprNumber: "FPR2350",
      affiliationDate: "2010-09-01",
      status: "inativo",
      notes: "Suspensa temporariamente por motivos académicos",
    },
  ]).returning();

  console.log("✅ Atletas criados");

  // Crews
  const [crew1] = await db.insert(crewsTable).values({
    name: "SDN-M2x-Sénior",
    boatClass: "2x",
    category: "Sénior",
    seasonId: season.id,
  }).returning();

  const [crew2] = await db.insert(crewsTable).values({
    name: "SDN-F1x-Sub23",
    boatClass: "1x",
    category: "Sub-23",
    seasonId: season.id,
  }).returning();

  await db.insert(crewAthletesTable).values([
    { crewId: crew1.id, athleteId: athletes[0].id },
    { crewId: crew1.id, athleteId: athletes[2].id },
    { crewId: crew2.id, athleteId: athletes[1].id },
  ]);

  console.log("✅ Tripulações criadas");

  // Fleet
  const [boat1] = await db.insert(fleetItemsTable).values({
    identifier: "AAC-001",
    brand: "Filippi",
    year: 2019,
    type: "barco_remo",
    subtype: "2x",
    status: "ativo",
  }).returning();

  const [boat2] = await db.insert(fleetItemsTable).values({
    identifier: "AAC-002",
    brand: "Concept2",
    year: 2021,
    type: "barco_remo",
    subtype: "1x",
    status: "manutencao",
    breakdownDescription: "Pá do remo danificada — aguarda peça",
  }).returning();

  await db.insert(fleetItemsTable).values({
    identifier: "AAC-VAN-01",
    brand: "Mercedes-Benz",
    year: 2018,
    type: "carrinha",
    status: "ativo",
  });

  await db.insert(fleetValuationsTable).values([
    { fleetItemId: boat1.id, value: "12000.00", date: "2025-01-15", notes: "Avaliação anual" },
    { fleetItemId: boat1.id, value: "11500.00", date: "2024-01-10" },
    { fleetItemId: boat2.id, value: "4500.00", date: "2025-01-15" },
  ]);

  console.log("✅ Frota criada");

  // Equipment
  await db.insert(equipmentTable).values([
    { name: "Remo individual (pá simples)", category: "remos", totalQuantity: 20, availableQuantity: 18, status: "bom" },
    { name: "Colete salva-vidas", category: "segurança", totalQuantity: 12, availableQuantity: 12, status: "bom" },
    { name: "Ergómetro Concept2", category: "ginasio", totalQuantity: 4, availableQuantity: 3, status: "bom", assignedTo: "Ginásio SDN" },
  ]);

  console.log("✅ Equipamento criado");

  // Training Schedules
  await db.insert(trainingSchedulesTable).values([
    {
      seasonId: season.id,
      groupCategory: "Sénior",
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      startTime: "07:30",
      endTime: "09:30",
      trainingType: "agua",
      trainerIds: trainer?.id ? [trainer.id] : [],
    },
    {
      seasonId: season.id,
      groupCategory: "Sub-23",
      daysOfWeek: [2, 4], // Tue, Thu
      startTime: "17:30",
      endTime: "19:30",
      trainingType: "agua",
      trainerIds: trainer?.id ? [trainer.id] : [],
    },
  ]);

  console.log("✅ Horários criados");

  // Training Sessions (today + recent)
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  await db.insert(trainingSessionsTable).values([
    {
      date: today,
      groupCategory: "Sénior",
      trainingType: "agua",
      startTime: "07:30",
      endTime: "09:30",
      seasonId: season.id,
      trainerId: trainer?.id ?? null,
    },
    {
      date: yesterday,
      groupCategory: "Sub-23",
      trainingType: "ginasio",
      startTime: "17:30",
      endTime: "19:30",
      seasonId: season.id,
      trainerId: trainer?.id ?? null,
    },
  ]);

  console.log("✅ Sessões de treino criadas");

  // Competitions
  const [comp] = await db.insert(competitionsTable).values({
    name: "Campeonato Nacional de Canoagem 2025",
    location: "Coimbra — Mondego",
    startDate: "2025-06-14",
    endDate: "2025-06-15",
    seasonId: prevSeason.id,
    organizer: "FPCanoagem",
  }).returning();

  const [race1] = await db.insert(racesTable).values({
    name: "Prova Final A — M2x Sénior 1000m",
    competitionId: comp.id,
    modality: "Sprint",
    distance: "1000m",
    category: "Sénior",
  }).returning();

  const [race2] = await db.insert(racesTable).values({
    name: "Prova Final A — F1x Sub-23 500m",
    competitionId: comp.id,
    modality: "Sprint",
    distance: "500m",
    category: "Sub-23",
  }).returning();

  await db.insert(resultsTable).values([
    { raceId: race1.id, crewId: crew1.id, position: 2, time: "3:28.4", points: "18" },
    { raceId: race2.id, athleteId: athletes[1].id, position: 1, time: "1:52.1", points: "22" },
  ]);

  console.log("✅ Resultados criados");

  // Financial
  await db.insert(financialMovementsTable).values([
    {
      type: "receita",
      category: "quotas",
      amount: "2400.00",
      date: "2025-09-30",
      description: "Quotas anuais — setembro 2025",
      seasonId: season.id,
    },
    {
      type: "receita",
      category: "patrocinadores",
      amount: "5000.00",
      date: "2025-10-15",
      description: "Patrocínio Caixa Agrícola 2025/2026",
      seasonId: season.id,
    },
    {
      type: "despesa",
      category: "transporte",
      amount: "380.00",
      date: "2025-11-02",
      description: "Combustível e portagens — deslocação a Lisboa",
      seasonId: season.id,
    },
    {
      type: "despesa",
      category: "equipamento",
      amount: "240.00",
      date: "2025-11-20",
      description: "Substituição de remos danificados",
      seasonId: season.id,
    },
    {
      type: "receita",
      category: "quotas",
      amount: "1800.00",
      date: new Date().toISOString().split("T")[0],
      description: `Quotas — ${new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}`,
      seasonId: season.id,
    },
    {
      type: "despesa",
      category: "manutenção",
      amount: "120.00",
      date: new Date().toISOString().split("T")[0],
      description: "Reparação embarcação AAC-002",
      seasonId: season.id,
    },
  ]);

  console.log("✅ Movimentos financeiros criados");

  // Quota Plans
  const [plan] = await db.insert(quotaPlansTable).values({
    seasonId: season.id,
    category: "Sénior",
    amount: "480.00",
    periodicity: "anual",
  }).returning();

  // Quotas
  await db.insert(quotasTable).values([
    { athleteId: athletes[0].id, seasonId: season.id, period: "2025/2026", amountDue: "480.00", dueDate: "2025-10-31" },
    { athleteId: athletes[1].id, seasonId: season.id, period: "2025/2026", amountDue: "480.00", dueDate: "2025-10-31" },
    { athleteId: athletes[2].id, seasonId: season.id, period: "2025/2026", amountDue: "480.00", dueDate: "2025-10-31" },
    { athleteId: athletes[3].id, seasonId: season.id, period: "2025/2026", amountDue: "480.00", dueDate: "2025-10-31" },
    { athleteId: athletes[4].id, seasonId: season.id, period: "2025/2026", amountDue: "480.00", dueDate: "2025-10-31" },
  ]);

  // Fetch quotas for payments
  const allQuotas = await db.select().from(quotasTable);

  // Payment for João — paid in full
  if (allQuotas[0]) {
    await db.insert(paymentsTable).values({
      quotaId: allQuotas[0].id,
      amount: "480.00",
      date: "2025-10-05",
      method: "transferencia",
    });
  }
  // Partial for Maria
  if (allQuotas[1]) {
    await db.insert(paymentsTable).values({
      quotaId: allQuotas[1].id,
      amount: "240.00",
      date: "2025-10-12",
      method: "mbway",
    });
  }

  console.log("✅ Quotas e pagamentos criados");

  // Documents
  await db.insert(documentsTable).values([
    {
      title: "SDN vence dois ouros no Nacional",
      type: "noticia",
      date: "2025-06-16",
      content: "A Secção de Desportos Náuticos da AAC conquistou dois ouros no Campeonato Nacional realizado em Coimbra.",
      category: "resultados",
    },
    {
      title: "Contrato Apoio Câmara Municipal de Coimbra",
      type: "contrato",
      date: "2025-01-15",
      entity: "Câmara Municipal de Coimbra",
      contractStart: "2025-01-15",
      contractEnd: "2025-12-31",
      contractStatus: "ativo",
      content: "Protocolo de cooperação desportiva e cedência de instalações.",
      category: "protocolos",
    },
  ]);

  console.log("✅ Documentos criados");
  console.log("\n🎉 Seed completo!");
  console.log("\n📋 Credenciais de acesso:");
  console.log("  Admin:     admin@sdn-aac.pt / admin123");
  console.log("  Treinador: treinador@sdn-aac.pt / treino123");

  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
