// Tipos para o módulo de pesagem de bovinos com Bluetooth

/**
 * Tipos de movimentação de bovinos
 * Vinculado ao protocolo SISBOV
 */
export enum TipoMovimentacao {
  ENTRADA = "entrada",           // Animal entra na propriedade/confinamento
  TRANSFERENCIA = "transferencia", // Animal transferido entre lotes/piquetes
  SAIDA = "saida",                 // Animal sai da propriedade (venda/abate)
  RETORNO = "retorno",             // Animal retorna de transferência
}

/**
 * Categorias de bovinos (SISBOV)
 */
export enum CategoriaBovino {
  BEZERRO = "bezerro",           // 0-12 meses
  NOVILHO = "novilho",           // 12-24 meses (não castrado)
  NOVILHA = "novilha",           // 12-24 meses (fêmea)
  TOUROS = "touros",             // Macho inteiro > 24 meses
  VACAS = "vacas",               // Fêmea adulta
  BOIS = "bois",                 // Macho castrado > 24 meses
}

/**
 * Status da pesagem
 */
export enum StatusPesagem {
  PENDENTE = "pendente",         // Aguardando leitura
  EM_PROGRESSO = "em_progresso", // Lendo chip e peso
  CONCLUIDA = "concluida",       // Pesagem registrada
  ERRO = "erro",                 // Falha na leitura
  CANCELADA = "cancelada",       // Cancelada pelo usuário
}

/**
 * Status da leitura de peso
 */
export enum StatusPeso {
  AGUARDANDO = "aguardando",     // Esperando entrar na balança
  INSTAVEL = "instavel",         // Peso variando
  ESTAVEL = "estavel",           // Peso estável
  TIMEOUT = "timeout",           // Tempo limite atingido
}

/**
 * Dados SISBOV do animal (rastreabilidade individual)
 */
export interface DadosSisbov {
  numeroInscricao: string;       // 15 dígitos - número do brinco/chip oficial
  certificado: boolean;          // Se já foi certificado no SISBOV
  dataCertificacao?: string;     // ISO 8601
  numeroOrdemBrinco?: string;    // Ordem do brinco na numeração da propriedade
  codigoEstabelecimento?: string; // Código do estabelecimento rural no MAPA
}

/**
 * Evento sanitário (vacinação, tratamento, exame)
 */
export interface EventoSanitario {
  id?: string;
  animalId: string;
  tipo: "vacinacao" | "vermifugacao" | "tratamento" | "exame" | "outro";
  descricao: string;             // Nome do produto/procedimento
  dataAplicacao: string;         // ISO 8601
  dose?: string;                 // Dose aplicada (ex: "5ml")
  via?: "subcutanea" | "intramuscular" | "oral" | "topica" | "intravenosa";
  tecnico?: string;              // Nome do médico/técnico
  crmv?: string;                 // CRMV do médico veterinário
  lote?: string;                 // Lote do produto
  validade?: string;             // Validade do produto ISO 8601
  reentrada?: string;            // Data liberação para abate ISO 8601
  proxAplicacao?: string;        // Data da próxima aplicação ISO 8601
  observacoes?: string;
  farmedaId: string;
  criadoEm: string;
}

/**
 * Informações de um bovino individual
 * Vinculado ao SISBOV
 */
export interface Bovino {
  id: string;                    // ID único (chipId ou custom)
  chipId: string;                // Número de inscrição (15 dígitos)
  nome: string;                  // Nome/apelido
  categoria: CategoriaBovino;    // Categoria
  raca: string;                  // Raça (Angus, Nelore, etc)
  sexo: "M" | "F";              // Macho ou Fêmea
  dataNascimento: string;        // ISO 8601
  pesoEntrada?: number;          // Peso ao chegar (kg)
  pesoAnterior?: number;         // Última pesagem (kg)
  dataUltimaPesagem?: string;    // Data da última pesagem
  farmedaId: string;             // FK para fazenda
  loteId?: string;               // FK para lote (confinamento)
  loteNome?: string;             // Nome do lote (desnormalizado)
  piqueteId?: string;            // FK para piquete (pastos)
  ativo: boolean;                // Se o animal está ativo na fazenda
  dataEntrada?: string;          // Data de entrada na fazenda ISO 8601
  dataSaida?: string;            // Data de saída (venda/abate) ISO 8601
  motivoSaida?: "venda" | "abate" | "morte" | "transferencia" | "outro";
  pelagem?: string;              // Cor/padrão da pelagem
  pai?: string;                  // Identificação do pai
  mae?: string;                  // Identificação da mãe
  propriedadeOrigem?: string;    // CNPJ/CPF de origem
  municipioOrigem?: string;
  estadoOrigem?: string;
  sisbov?: DadosSisbov;
  metadados?: Record<string, any>;
}

/**
 * GMD - Ganho Médio Diário calculado
 */
export interface GanhoDiarioPeso {
  periodo: string;               // Ex: "2025-01 a 2025-03"
  pesagemInicio: number;         // kg
  pesagemFim: number;            // kg
  diasPeriodo: number;
  gmdKg: number;                 // kg/dia
  classificacao: "ruim" | "regular" | "bom" | "otimo";
}

/**
 * Leitura de chip RFID (XRS2i)
 */
export interface LeituraChip {
  chipId: string;                // 15 dígitos
  timestamp: string;             // ISO 8601
  sinSinal: number;              // Força do sinal (-80 a -30 dBm)
  dispositivoId: string;         // ID do leitor XRS2i
  valido: boolean;               // Passou na validação
  erro?: string;                 // Mensagem de erro se houver
}

/**
 * Leitura de peso (ACR HD Easy)
 */
export interface LeituraPeso {
  peso: number;                  // em kg
  timestamp: string;             // ISO 8601
  status: StatusPeso;            // Estado da leitura
  dispositivoId: string;         // ID da balança ACR
  valido: boolean;               // Passou na validação
  erro?: string;                 // Mensagem de erro se houver
}

/**
 * Registro de uma pesagem completa
 * Combina chip + peso + contexto
 */
export interface Pesagem {
  id?: string;                   // ID do Firestore (auto-gerado)
  animalId: string;              // FK para Bovino
  chipId: string;                // Referência redundante para SISBOV
  peso: number;                  // Peso lido (kg)
  pesoPrevisto?: number;         // Peso esperado pelo sistema
  diferencaPeso?: number;        // peso - pesoPrevisto
  dataHora: string;              // ISO 8601 (quando foi pesado)
  tipoPesagem: TipoMovimentacao; // Contexto da pesagem

  // Dados da leitura
  leituraChip: LeituraChip;      // Dados brutos do chip
  leituraPeso: LeituraPeso;      // Dados brutos do peso

  // Metadados
  farmedaId: string;             // FK para fazenda
  usuarioId: string;             // Quem realizou a pesagem
  fotoPesagem?: string;          // URL da foto (opcional)
  observacoes?: string;          // Anotações do operador
  validacao?: {
    validoPorSisbov: boolean;    // Passou na validação SISBOV
    validadoEm?: string;         // Quando foi validado
    validadoPor?: string;        // Quem validou
  };

  // Sincronização
  sincronizado: boolean;         // Enviado para servidor
  criadoEm: string;              // ISO 8601
  atualizadoEm: string;          // ISO 8601
}

/**
 * Movimentação de bovino
 * Documenta entrada, transferência ou saída
 */
export interface MovimentacaoBovino {
  id?: string;                   // ID do Firestore
  animalId: string;              // FK para Bovino
  chipId: string;                // Referência para SISBOV
  tipo: TipoMovimentacao;        // Tipo de movimentação

  // Dados da movimentação
  dataHora: string;              // ISO 8601
  pesoAoMover: number;           // Peso no momento (kg)
  pesagem: Pesagem;              // Referência à pesagem

  // Origem e destino
  de?: {
    tipo: "lote" | "piquete" | "externo";
    id?: string;                 // ID do lote/piquete
    nome?: string;               // Nome legível
  };
  para?: {
    tipo: "lote" | "piquete" | "abate" | "venda";
    id?: string;                 // ID do destino
    nome?: string;               // Nome legível
  };

  // Referências
  farmedaId: string;
  usuarioId: string;

  // Documentação SISBOV
  documentos?: {
    gta?: string;                // Número da GTA
    certificadoOriginacao?: string;
    nfeId?: string;              // NF-e se for venda
  };

  observacoes?: string;
  criadoEm: string;              // ISO 8601
}

/**
 * Dispositivo Bluetooth conectado
 */
export interface DispositivoBluetooth {
  id: string;                    // ID único/MAC address
  nome: string;                  // Nome exibido
  tipo: "balanca" | "leitor_rfid" | "outro";
  modelo: string;                // Ex: "ACR HD Easy", "XRS2i"
  conectado: boolean;            // Status atual
  ultimaConexao?: string;        // ISO 8601
  sinSinal?: number;             // Força do sinal (dBm)
  bateria?: number;              // Nível de bateria (%)
}

/**
 * Sessão de pesagem em andamento
 */
export interface SessaoPesagem {
  id: string;                    // ID único
  dataInicio: string;            // ISO 8601
  tipoMovimentacao: TipoMovimentacao;

  // Estado atual
  etapa: "aguardando_chip" | "lendo_chip" | "aguardando_peso" | "lendo_peso" | "confirmacao" | "concluida";

  // Dados coletados
  chipLido?: LeituraChip;
  pesoLido?: LeituraPeso;
  animalIdentificado?: Bovino;

  // Dispositivos
  dispositivoBalanca?: DispositivoBluetooth;
  dispositivoRfid?: DispositivoBluetooth;

  // Controle
  tentativas: number;
  erros: string[];
  podeConfirmar: boolean;

  // Rastreamento
  farmedaId: string;
  usuarioId: string;
  criadoEm: string;              // ISO 8601
}

/**
 * Erro de Bluetooth
 */
export interface ErroBluetooth {
  codigo: string;
  mensagem: string;
  timestamp: string;             // ISO 8601
  dispositivo?: string;
  recuperavel: boolean;
}

/**
 * Configuração de pesagem
 */
export interface ConfiguracaoPesagem {
  // Limites e validações
  pesoMinimoKg: number;          // Ex: 100 kg
  pesoMaximoKg: number;          // Ex: 1500 kg
  toleranciaVariacaoPeso: number; // Ex: 5% (para detectar erros)

  // Timeouts (segundos)
  timeoutLeituraChip: number;    // Ex: 10 segundos
  timeoutLeituraPeso: number;    // Ex: 30 segundos
  timeoutEstabilizacao: number;  // Ex: 5 segundos

  // Comportamento
  permitirManual: boolean;       // Digitar chip/peso se falhar
  requerFoto: boolean;           // Obrigatória foto da pesagem
  validarSisbov: boolean;        // Validar contra SISBOV
  sincronizarAuto: boolean;      // Enviar para servidor automático

  // Dispositivos
  balancaMacAddress?: string;
  rfidMacAddress?: string;
}

/**
 * Resultado de uma pesagem salva
 */
export interface ResultadoPesagem {
  sucesso: boolean;
  pesagemId?: string;
  movimentacaoId?: string;
  erro?: string;
  validacoes?: {
    campo: string;
    valido: boolean;
    mensagem?: string;
  }[];
}

// ─── Módulo SISBOV: Brincos, GTA, Locais, Processos ─────────────────────────

export enum RegimeAnimal {
  PASTO = "pasto",
  CONFINAMENTO = "confinamento",
  BOITEL = "boitel",
  SEMI_CONFINAMENTO = "semi_confinamento",
}

/** Pedido de brincos emitido pelo MAPA */
export interface PedidoBrinco {
  id?: string;
  fabrica: string;               // Ex: "Animalltag", "Zee Tags"
  numeroPedidoMapa: string;      // Número da solicitação no MAPA
  brincoInicial: string;         // 15 dígitos (ex: 105500508077691)
  brincoFinal: string;           // 15 dígitos (ex: 105500508097684)
  controleInicial: string;       // 6 dígitos derivados do brinco (pos 9-14)
  controleFinal: string;
  brincosTotal: number;
  proximoIndice: number;         // quantos já foram utilizados (0-based)
  ativo: boolean;
  farmedaId: string;
  criadoEm: string;
}

/** Animal transportado em uma GTA */
export interface GtaAnimal {
  descricao: string;             // Ex: "BOVINO MACHO ACIMA DE 36 MESES"
  quantidade: number;
  sexo: "M" | "F" | "ambos";
  idadeCategoria?: string;       // Ex: "ACIMA DE 36 MESES"
}

/** Guia de Trânsito Animal (e-GTA) */
export interface GTA {
  id?: string;
  numero: string;                // Ex: "614660"
  serie: string;                 // Ex: "Q"
  uf: string;                    // UF emissora
  // Procedência
  procCpfCnpj: string;
  procNome: string;
  procFazenda: string;
  procCodigoMapa: string;
  procInscricaoEstadual: string;
  procMunicipio: string;
  procUf: string;
  procRegiao?: string;
  // Destino
  destCpfCnpj: string;
  destNome: string;
  destFazenda: string;
  destCodigoMapa: string;
  destInscricaoEstadual: string;
  destMunicipio: string;
  destUf: string;
  destRegiao?: string;
  // Carga
  finalidade: string;            // "ENGORDA"
  transporte: string;            // "RODOVIÁRIO"
  animais: GtaAnimal[];
  totalMachos: number;
  totalFemeas: number;
  total: number;
  rota?: string;
  dataEmissao: string;           // ISO 8601
  dataValidade: string;          // ISO 8601
  unidadeExpedidora?: string;
  // Sistema
  farmedaId: string;
  status: "ativa" | "vencida" | "processada";
  criadoEm: string;
}

/** Local físico na propriedade (piquete, baia, etc.) */
export interface LocalAnimal {
  id?: string;
  nome: string;                  // Ex: "Piquete 1", "Baia 10"
  tipo: "piquete" | "baia" | "curral" | "pasto" | "outro";
  capacidade?: number;
  regime: RegimeAnimal;
  ativo: boolean;
  farmedaId: string;
}

/** Animal em processo de cadastro (antes de salvar como Bovino) */
export interface AnimalEntrada {
  sequencia: number;             // 1-based dentro da GTA
  gtaId: string;
  sexo: "M" | "F";
  raca: string;
  categoria: CategoriaBovino;
  dataNascimento?: string;
  pesoEntrada?: number;
  regime: RegimeAnimal;
  localId?: string;
  localNome?: string;
  brincoNumero?: string;         // 15 dígitos atribuído
  brincoControle?: string;       // 6 dígitos
  chipRfid?: string;             // chip lido
  pedidoBrincoId?: string;
  status: "pendente" | "concluido" | "pulado";
}

/** Processo de certificação SISBOV */
export interface ProcessoSisbov {
  id?: string;
  nome: string;                  // Ex: "Entrada 5M - Jorge Veimar"
  gtaIds: string[];
  animalIds: string[];
  status: "aberto" | "aguardando_certificadora" | "aprovado" | "rejeitado";
  dataAbertura: string;
  dataEnvio?: string;
  dataResposta?: string;
  observacoes?: string;
  farmedaId: string;
  criadoEm: string;
}
