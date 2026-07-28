import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  DispositivoBluetooth,
  LeituraChip,
  LeituraPeso,
  SessaoPesagem,
  Bovino,
  ErroBluetooth,
  ConfiguracaoPesagem,
} from "../services/weighing.types";
import { obterBluetoothService } from "../services/bluetoothService";

/**
 * Configuração padrão para pesagem
 */
const CONFIGURACAO_PADRAO: ConfiguracaoPesagem = {
  pesoMinimoKg: 50,
  pesoMaximoKg: 1500,
  toleranciaVariacaoPeso: 5, // %
  timeoutLeituraChip: 10000, // ms
  timeoutLeituraPeso: 30000, // ms
  timeoutEstabilizacao: 5000, // ms
  permitirManual: true,
  requerFoto: false,
  validarSisbov: false,
  sincronizarAuto: true,
};

interface WeighingContextType {
  // Estado de dispositivos
  dispositivosDisponiveis: DispositivoBluetooth[];
  dispositivosConectados: DispositivoBluetooth[];
  balancaConectada: DispositivoBluetooth | null;
  rfidConectada: DispositivoBluetooth | null;

  // Estado de sessão
  sessaoAtiva: SessaoPesagem | null;
  leituraChipAtual: LeituraChip | null;
  leituraPesoAtual: LeituraPeso | null;
  animalIdentificado: Bovino | null;

  // Histórico
  historicoPesagens: SessaoPesagem[];
  errosRecentes: ErroBluetooth[];

  // Configuração
  configuracao: ConfiguracaoPesagem;

  // Funções de controle
  iniciarDescoberta: () => Promise<void>;
  conectarBalanca: (dispositivoId: string) => Promise<boolean>;
  conectarRfid: (dispositivoId: string) => Promise<boolean>;
  desconectar: (dispositivoId: string) => Promise<boolean>;

  // Funções de pesagem
  iniciarPesagem: (tipoMovimentacao: string) => Promise<void>;
  identificarAnimal: (bovino: Bovino) => void;
  confirmarPesagem: () => Promise<void>;
  cancelarPesagem: () => void;

  // Configuração
  atualizarConfiguracao: (config: Partial<ConfiguracaoPesagem>) => void;
  limpar: () => Promise<void>;
}

const WeighingContext = createContext<WeighingContextType | undefined>(undefined);

interface WeighingProviderProps {
  children: React.ReactNode;
}

/**
 * Provider do contexto de pesagem
 * Gerencia estado global de pesagem e comunicação Bluetooth
 */
export const WeighingProvider: React.FC<WeighingProviderProps> = ({ children }) => {
  // Estado de dispositivos
  const [dispositivosDisponiveis, setDispositivosDisponiveis] = useState<
    DispositivoBluetooth[]
  >([]);
  const [dispositivosConectados, setDispositivosConectados] = useState<
    DispositivoBluetooth[]
  >([]);
  const [balancaConectada, setBalancaConectada] = useState<DispositivoBluetooth | null>(null);
  const [rfidConectada, setRfidConectada] = useState<DispositivoBluetooth | null>(null);

  // Estado de sessão
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoPesagem | null>(null);
  const [leituraChipAtual, setLeituraChipAtual] = useState<LeituraChip | null>(null);
  const [leituraPesoAtual, setLeituraPesoAtual] = useState<LeituraPeso | null>(null);
  const [animalIdentificado, setAnimalIdentificado] = useState<Bovino | null>(null);

  // Histórico
  const [historicoPesagens, setHistoricoPesagens] = useState<SessaoPesagem[]>([]);
  const [errosRecentes, setErrosRecentes] = useState<ErroBluetooth[]>([]);

  // Configuração
  const [configuracao, setConfiguracao] = useState<ConfiguracaoPesagem>(CONFIGURACAO_PADRAO);

  // Referência ao serviço Bluetooth
  const bluetoothService = obterBluetoothService();

  /**
   * Inicializa listeners do Bluetooth na primeira renderização
   */
  useEffect(() => {
    const configurarListeners = () => {
      bluetoothService.registrarListener("peso", (leitura: LeituraPeso) => {
        console.log("[Context] Peso recebido:", leitura);
        setLeituraPesoAtual(leitura);

        // Atualiza sessão ativa
        setSessaoAtiva((prev) => {
          if (prev) {
            return {
              ...prev,
              pesoLido: leitura,
              etapa: leitura.status === "estavel" ? "confirmacao" : "lendo_peso",
            };
          }
          return null;
        });
      });

      bluetoothService.registrarListener("chip", (leitura: LeituraChip) => {
        console.log("[Context] Chip recebido:", leitura);
        setLeituraChipAtual(leitura);

        // Atualiza sessão ativa
        setSessaoAtiva((prev) => {
          if (prev) {
            return {
              ...prev,
              chipLido: leitura,
              etapa: leitura.valido ? "aguardando_peso" : "aguardando_chip",
            };
          }
          return null;
        });
      });

      bluetoothService.registrarListener("erro", (erro: ErroBluetooth) => {
        console.error("[Context] Erro Bluetooth:", erro);
        setErrosRecentes((prev) => [erro, ...prev.slice(0, 9)]); // Mantém últimos 10
      });

      bluetoothService.registrarListener("conectado", (dispositivo: DispositivoBluetooth) => {
        console.log("[Context] Dispositivo conectado:", dispositivo);
        setDispositivosConectados((prev) => {
          const filtrado = prev.filter((d) => d.id !== dispositivo.id);
          return [dispositivo, ...filtrado];
        });

        // Atualiza referência específica
        if (dispositivo.tipo === "balanca") {
          setBalancaConectada(dispositivo);
        } else if (dispositivo.tipo === "leitor_rfid") {
          setRfidConectada(dispositivo);
        }
      });

      bluetoothService.registrarListener("desconectado", (dispositivo: DispositivoBluetooth) => {
        console.log("[Context] Dispositivo desconectado:", dispositivo);
        setDispositivosConectados((prev) => prev.filter((d) => d.id !== dispositivo.id));

        if (dispositivo.tipo === "balanca") {
          setBalancaConectada(null);
        } else if (dispositivo.tipo === "leitor_rfid") {
          setRfidConectada(null);
        }
      });
    };

    configurarListeners();

    // Cleanup
    return () => {
      // Context não remove listeners automaticamente
      // Isso é proposital para manter conexões ativas
    };
  }, [bluetoothService]);

  /**
   * Inicia descoberta de dispositivos Bluetooth
   */
  const iniciarDescoberta = useCallback(async () => {
    try {
      console.log("[Context] Iniciando descoberta...");
      const dispositivos = await bluetoothService.descobrirDispositivos(10000);
      setDispositivosDisponiveis(dispositivos);
    } catch (error) {
      console.error("[Context] Erro na descoberta:", error);
      setErrosRecentes((prev) => [
        {
          codigo: "DISCOVERY_ERROR",
          mensagem: error instanceof Error ? error.message : "Erro desconhecido",
          timestamp: new Date().toISOString(),
          recuperavel: true,
        },
        ...prev.slice(0, 9),
      ]);
    }
  }, [bluetoothService]);

  /**
   * Conecta à balança
   */
  const conectarBalanca = useCallback(
    async (dispositivoId: string): Promise<boolean> => {
      try {
        const sucesso = await bluetoothService.conectar(dispositivoId);
        if (sucesso) {
          await bluetoothService.subscritoPeso(dispositivoId);
        }
        return sucesso;
      } catch (error) {
        console.error("[Context] Erro ao conectar balança:", error);
        return false;
      }
    },
    [bluetoothService]
  );

  /**
   * Conecta ao leitor RFID
   */
  const conectarRfid = useCallback(
    async (dispositivoId: string): Promise<boolean> => {
      try {
        const sucesso = await bluetoothService.conectar(dispositivoId);
        if (sucesso) {
          await bluetoothService.subscritoChip(dispositivoId);
        }
        return sucesso;
      } catch (error) {
        console.error("[Context] Erro ao conectar RFID:", error);
        return false;
      }
    },
    [bluetoothService]
  );

  /**
   * Desconecta de um dispositivo
   */
  const desconectar = useCallback(
    async (dispositivoId: string): Promise<boolean> => {
      try {
        return await bluetoothService.desconectar(dispositivoId);
      } catch (error) {
        console.error("[Context] Erro ao desconectar:", error);
        return false;
      }
    },
    [bluetoothService]
  );

  /**
   * Inicia uma nova sessão de pesagem
   */
  const iniciarPesagem = useCallback(
    async (tipoMovimentacao: string) => {
      try {
        const sessao: SessaoPesagem = {
          id: `pesagem_${Date.now()}`,
          dataInicio: new Date().toISOString(),
          tipoMovimentacao: tipoMovimentacao as any,
          etapa: "lendo_chip",
          tentativas: 0,
          erros: [],
          podeConfirmar: false,
          farmedaId: "", // Preenchido pela tela
          usuarioId: "", // Preenchido pela tela
          criadoEm: new Date().toISOString(),
        };

        setSessaoAtiva(sessao);
        setLeituraChipAtual(null);
        setLeituraPesoAtual(null);
        setAnimalIdentificado(null);

        console.log("[Context] Sessão de pesagem iniciada:", tipoMovimentacao);
      } catch (error) {
        console.error("[Context] Erro ao iniciar pesagem:", error);
      }
    },
    []
  );

  /**
   * Identifica um animal na sessão
   */
  const identificarAnimal = useCallback((bovino: Bovino) => {
    console.log("[Context] Animal identificado:", bovino.chipId);
    setAnimalIdentificado(bovino);

    setSessaoAtiva((prev) => {
      if (prev) {
        return {
          ...prev,
          animalIdentificado: bovino,
          etapa: "aguardando_peso",
        };
      }
      return null;
    });
  }, []);

  /**
   * Confirma a pesagem atual
   */
  const confirmarPesagem = useCallback(async () => {
    if (!sessaoAtiva || !leituraChipAtual || !leituraPesoAtual) {
      console.warn("[Context] Sessão incompleta para confirmação");
      return;
    }

    try {
      setSessaoAtiva((prev) => {
        if (prev) {
          return {
            ...prev,
            etapa: "concluida",
            podeConfirmar: false,
          };
        }
        return null;
      });

      // Adiciona ao histórico
      setHistoricoPesagens((prev) => [
        sessaoAtiva as SessaoPesagem,
        ...prev.slice(0, 49),
      ]); // Mantém últimas 50

      console.log("[Context] Pesagem confirmada e adicionada ao histórico");
    } catch (error) {
      console.error("[Context] Erro ao confirmar pesagem:", error);
    }
  }, [sessaoAtiva, leituraChipAtual, leituraPesoAtual]);

  /**
   * Cancela a sessão atual
   */
  const cancelarPesagem = useCallback(() => {
    console.log("[Context] Sessão cancelada");
    setSessaoAtiva(null);
    setLeituraChipAtual(null);
    setLeituraPesoAtual(null);
    setAnimalIdentificado(null);
  }, []);

  /**
   * Atualiza configurações
   */
  const atualizarConfiguracao = useCallback((novaConfig: Partial<ConfiguracaoPesagem>) => {
    setConfiguracao((prev) => ({
      ...prev,
      ...novaConfig,
    }));
  }, []);

  /**
   * Limpa todos os recursos
   */
  const limpar = useCallback(async () => {
    console.log("[Context] Limpando recursos...");
    await bluetoothService.limpar();
    setSessaoAtiva(null);
    setLeituraChipAtual(null);
    setLeituraPesoAtual(null);
    setAnimalIdentificado(null);
    setDispositivosConectados([]);
    setBalancaConectada(null);
    setRfidConectada(null);
  }, [bluetoothService]);

  const value: WeighingContextType = {
    dispositivosDisponiveis,
    dispositivosConectados,
    balancaConectada,
    rfidConectada,
    sessaoAtiva,
    leituraChipAtual,
    leituraPesoAtual,
    animalIdentificado,
    historicoPesagens,
    errosRecentes,
    configuracao,
    iniciarDescoberta,
    conectarBalanca,
    conectarRfid,
    desconectar,
    iniciarPesagem,
    identificarAnimal,
    confirmarPesagem,
    cancelarPesagem,
    atualizarConfiguracao,
    limpar,
  };

  return (
    <WeighingContext.Provider value={value}>{children}</WeighingContext.Provider>
  );
};

/**
 * Hook customizado para usar o contexto de pesagem
 */
export const useWeighing = (): WeighingContextType => {
  const context = useContext(WeighingContext);
  if (!context) {
    throw new Error("useWeighing deve ser usado dentro de WeighingProvider");
  }
  return context;
};
