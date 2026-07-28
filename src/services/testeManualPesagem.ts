/**
 * Script de teste manual para o módulo de pesagem
 * Execute este código em um componente para testar funcionalidades
 */

import { Alert } from "react-native";
import { obterBluetoothService } from "./bluetoothService";
import { PesagemFirestoreService } from "./pesagemFirestoreService";
import { PesagemLogger } from "./pesagemLogger";
import {
  Bovino,
  CategoriaBovino,
  LeituraChip,
  LeituraPeso,
  Pesagem,
  StatusPeso,
  TipoMovimentacao,
  DispositivoBluetooth,
} from "./weighing.types";

export class TesteManualPesagem {
  /**
   * Teste 1: Descoberta de Dispositivos
   * ✅ Deve encontrar ACR HD Easy e XRS2i
   */
  static async teste1_Descoberta(): Promise<DispositivoBluetooth[]> {
    PesagemLogger.info("TESTE_1", "Iniciando descoberta de dispositivos...");

    const bluetoothService = obterBluetoothService();
    const dispositivos = await bluetoothService.descobrirDispositivos(10000);

    PesagemLogger.info("TESTE_1", `Encontrados ${dispositivos.length} dispositivos`, {
      dispositivos: dispositivos.map((d) => ({ nome: d.nome, tipo: d.tipo })),
    });

    if (dispositivos.length === 0) {
      Alert.alert("Teste 1 FALHOU", "Nenhum dispositivo encontrado");
    } else {
      Alert.alert(
        "Teste 1 PASSOU",
        `${dispositivos.length} dispositivos encontrados`
      );
    }

    return dispositivos;
  }

  /**
   * Teste 2: Conexão à Balança ACR
   * ✅ Deve conectar e receber dados de peso
   */
  static async teste2_BalancaACR(
    dispositivoId: string
  ): Promise<boolean> {
    PesagemLogger.info("TESTE_2", `Conectando à balança: ${dispositivoId}...`);

    const bluetoothService = obterBluetoothService();
    let pesoRecebido = false;

    // Registra listener de peso
    bluetoothService.registrarListener("peso", (leitura: LeituraPeso) => {
      PesagemLogger.info("TESTE_2", "Peso recebido!", {
        peso: leitura.peso,
        status: leitura.status,
        timestamp: leitura.timestamp,
      });
      pesoRecebido = true;
    });

    // Tenta conectar
    const conectado = await bluetoothService.conectar(dispositivoId);
    if (!conectado) {
      Alert.alert("Teste 2 FALHOU", "Não foi possível conectar à balança");
      return false;
    }

    // Subscreve a peso
    const inscrito = await bluetoothService.subscritoPeso(dispositivoId);
    if (!inscrito) {
      Alert.alert("Teste 2 FALHOU", "Não foi possível subscribir a peso");
      return false;
    }

    PesagemLogger.info(
      "TESTE_2",
      "Conectado à balança. Aguardando peso por 30 segundos..."
    );

    // Aguarda 30 segundos por peso
    await new Promise((resolve) => setTimeout(resolve, 30000));

    if (pesoRecebido) {
      Alert.alert("Teste 2 PASSOU", "Peso recebido com sucesso!");
      return true;
    } else {
      Alert.alert(
        "Teste 2 FALHOU",
        "Nenhum peso recebido. Verifique se a balança está na área de cobertura."
      );
      return false;
    }
  }

  /**
   * Teste 3: Conexão ao Leitor RFID XRS2i
   * ✅ Deve conectar e receber dados de chip
   */
  static async teste3_LeituraRFID(
    dispositivoId: string
  ): Promise<boolean> {
    PesagemLogger.info("TESTE_3", `Conectando ao leitor RFID: ${dispositivoId}...`);

    const bluetoothService = obterBluetoothService();
    let chipRecebido = false;

    // Registra listener de chip
    bluetoothService.registrarListener("chip", (leitura: LeituraChip) => {
      PesagemLogger.info("TESTE_3", "Chip recebido!", {
        chipId: leitura.chipId,
        sinal: leitura.sinSinal,
        valido: leitura.valido,
        timestamp: leitura.timestamp,
      });
      chipRecebido = true;
    });

    // Tenta conectar
    const conectado = await bluetoothService.conectar(dispositivoId);
    if (!conectado) {
      Alert.alert("Teste 3 FALHOU", "Não foi possível conectar ao leitor RFID");
      return false;
    }

    // Subscreve a chip
    const inscrito = await bluetoothService.subscritoChip(dispositivoId);
    if (!inscrito) {
      Alert.alert("Teste 3 FALHOU", "Não foi possível subscribir a chip");
      return false;
    }

    PesagemLogger.info(
      "TESTE_3",
      "Conectado ao leitor. Aproxime o leitor de um chip por 30 segundos..."
    );

    // Aguarda 30 segundos por chip
    await new Promise((resolve) => setTimeout(resolve, 30000));

    if (chipRecebido) {
      Alert.alert("Teste 3 PASSOU", "Chip recebido com sucesso!");
      return true;
    } else {
      Alert.alert(
        "Teste 3 FALHOU",
        "Nenhum chip recebido. Verifique se o leitor está funcionando."
      );
      return false;
    }
  }

  /**
   * Teste 4: Pesagem Completa (Chip + Peso)
   * ✅ Deve ler chip + peso e salvar em Firestore
   */
  static async teste4_PesagemCompleta(
    balancaId: string,
    rfidId: string,
    farmedaId: string
  ): Promise<boolean> {
    PesagemLogger.info("TESTE_4", "Iniciando pesagem completa...");

    const bluetoothService = obterBluetoothService();
    let chipLido: string | null = null;
    let pesoLido: number | null = null;

    // Setup listeners
    bluetoothService.registrarListener("chip", (leitura: LeituraChip) => {
      if (leitura.valido) {
        chipLido = leitura.chipId;
        PesagemLogger.info("TESTE_4", "Chip validado", { chip: chipLido });
      }
    });

    bluetoothService.registrarListener("peso", (leitura: LeituraPeso) => {
      if (leitura.status === StatusPeso.ESTAVEL) {
        pesoLido = leitura.peso;
        PesagemLogger.info("TESTE_4", "Peso estável", { peso: pesoLido });
      }
    });

    // Conecta ambos dispositivos
    const balancaOk = await bluetoothService.conectar(balancaId);
    const rfidOk = await bluetoothService.conectar(rfidId);

    if (!balancaOk || !rfidOk) {
      Alert.alert(
        "Teste 4 FALHOU",
        "Não foi possível conectar aos dispositivos"
      );
      return false;
    }

    // Subscreve
    await bluetoothService.subscritoPeso(balancaId);
    await bluetoothService.subscritoChip(rfidId);

    PesagemLogger.info(
      "TESTE_4",
      "Aguardando leitura: aproxime o leitor do chip e depois coloque o animal na balança..."
    );

    // Aguarda 60 segundos
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // Verifica se conseguiu ler
    if (!chipLido) {
      Alert.alert("Teste 4 FALHOU", "Chip não foi lido");
      return false;
    }

    if (!pesoLido) {
      Alert.alert("Teste 4 FALHOU", "Peso não foi lido");
      return false;
    }

    // Cria bovino de teste
    const bovinoTeste: Bovino = {
      id: `teste_${Date.now()}`,
      chipId: chipLido,
      nome: "Animal de Teste",
      categoria: CategoriaBovino.BOIS,
      raca: "Nelore",
      sexo: "M",
      dataNascimento: new Date().toISOString(),
      farmedaId,
    };

    // Salva bovino
    try {
      await PesagemFirestoreService.salvarBovino(bovinoTeste, farmedaId);
    } catch (error) {
      PesagemLogger.error("TESTE_4", "Erro ao salvar bovino", error);
    }

    // Cria pesagem
    const pesagem: Pesagem = {
      animalId: bovinoTeste.id!,
      chipId: chipLido!,
      peso: pesoLido,
      dataHora: new Date().toISOString(),
      tipoPesagem: TipoMovimentacao.ENTRADA,
      leituraChip: {
        chipId: chipLido!,
        timestamp: new Date().toISOString(),
        sinSinal: -65,
        dispositivoId: rfidId,
        valido: true,
      },
      leituraPeso: {
        peso: pesoLido,
        timestamp: new Date().toISOString(),
        status: StatusPeso.ESTAVEL,
        dispositivoId: balancaId,
        valido: true,
      },
      farmedaId,
      usuarioId: "teste",
      sincronizado: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // Salva pesagem
    try {
      const resultado = await PesagemFirestoreService.salvarPesagem(
        pesagem,
        farmedaId
      );

      if (resultado.sucesso) {
        PesagemLogger.info("TESTE_4", "Pesagem salva em Firestore", {
          pesagemId: resultado.pesagemId,
        });
        Alert.alert("Teste 4 PASSOU", "Pesagem completa e salva!");
        return true;
      } else {
        PesagemLogger.error("TESTE_4", "Erro ao salvar pesagem", resultado.erro);
        Alert.alert("Teste 4 FALHOU", "Erro ao salvar: " + resultado.erro);
        return false;
      }
    } catch (error) {
      PesagemLogger.error("TESTE_4", "Erro ao salvar pesagem", error);
      Alert.alert("Teste 4 FALHOU", "Erro ao salvar pesagem");
      return false;
    }
  }

  /**
   * Teste 5: Exportar Logs
   * ✅ Gera arquivo com logs de debug
   */
  static async teste5_ExportarLogs(): Promise<string> {
    PesagemLogger.info("TESTE_5", "Exportando logs...");

    try {
      const caminhoLogs = await PesagemLogger.exportarLogs(
        `teste-manual-${new Date().toISOString().split("T")[0]}`
      );

      const stats = PesagemLogger.gerarRelatório();
      PesagemLogger.info("TESTE_5", "Estatísticas de logs", stats);

      Alert.alert(
        "Teste 5 PASSOU",
        `Logs exportados:\n${caminhoLogs}\n\nTotal de entradas: ${stats.total}`
      );

      return caminhoLogs;
    } catch (error) {
      PesagemLogger.error("TESTE_5", "Erro ao exportar logs", error);
      Alert.alert("Teste 5 FALHOU", "Erro ao exportar logs");
      throw error;
    }
  }

  /**
   * Executa todos os testes em sequência
   */
  static async executarTodosTestes(
    farmedaId: string,
    balancaId?: string,
    rfidId?: string
  ): Promise<void> {
    try {
      PesagemLogger.info("TESTES_MANUAIS", "Iniciando suite de testes...");

      // Teste 1: Descoberta
      const dispositivos = await this.teste1_Descoberta();

      if (dispositivos.length < 2) {
        Alert.alert("Testes ABORTADOS", "Dispositivos insuficientes encontrados");
        return;
      }

      const balanca = dispositivos.find((d) => d.tipo === "balanca");
      const rfid = dispositivos.find((d) => d.tipo === "leitor_rfid");

      if (!balanca || !rfid) {
        Alert.alert(
          "Testes ABORTADOS",
          "Não encontrou balança ou leitor RFID"
        );
        return;
      }

      // Teste 2: Balança
      const teste2Ok = await this.teste2_BalancaACR(balanca.id);
      if (!teste2Ok) return;

      // Teste 3: RFID
      const teste3Ok = await this.teste3_LeituraRFID(rfid.id);
      if (!teste3Ok) return;

      // Teste 4: Pesagem Completa
      const teste4Ok = await this.teste4_PesagemCompleta(
        balanca.id,
        rfid.id,
        farmedaId
      );
      if (!teste4Ok) return;

      // Teste 5: Logs
      await this.teste5_ExportarLogs();

      PesagemLogger.info("TESTES_MANUAIS", "✅ TODOS OS TESTES PASSARAM!");
      Alert.alert("✅ SUCESSO", "Todos os testes passaram!");
    } catch (error) {
      PesagemLogger.error("TESTES_MANUAIS", "Erro durante testes", error);
      Alert.alert("❌ ERRO", "Verifique os logs para mais detalhes");
    }
  }
}

/**
 * Uso em um componente:
 *
 * import { TesteManualPesagem } from "./services/testeManualPesagem";
 *
 * export default function TelaTesteManual() {
 *   return (
 *     <TouchableOpacity onPress={() => {
 *       TesteManualPesagem.executarTodosTestes("fazenda-123");
 *     }}>
 *       <Text>Executar Testes Manuais</Text>
 *     </TouchableOpacity>
 *   );
 * }
 */
