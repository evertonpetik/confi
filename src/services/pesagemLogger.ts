/**
 * Utilitário de logging e debug para módulo de pesagem
 * Facilita rastreamento de eventos e detecção de problemas
 */

import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: any;
}

export class PesagemLogger {
  private static logDirectory = `${FileSystem.DocumentationDirectory}confi-logs`;
  private static logFile = `${FileSystem.DocumentationDirectory}confi-logs/pesagem.log`;
  private static maxLogSize = 5 * 1024 * 1024; // 5MB
  private static logs: LogEntry[] = [];
  private static initialized = false;

  static async initialize(): Promise<void> {
    try {
      // Cria diretório se não existir
      const dirInfo = await FileSystem.getInfoAsync(this.logDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.logDirectory, {
          intermediates: true,
        });
      }

      this.initialized = true;
      this.log("INFO", "Logger", "Logger inicializado");
    } catch (error) {
      console.error("[Logger] Erro ao inicializar:", error);
    }
  }

  /**
   * Registra um evento
   */
  static log(level: LogLevel, tag: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      tag,
      message,
      data,
    };

    this.logs.push(entry);

    // Log no console
    const prefix = `[${entry.timestamp}] [${level}] [${tag}]`;
    switch (level) {
      case "DEBUG":
        console.debug(`${prefix} ${message}`, data);
        break;
      case "INFO":
        console.log(`${prefix} ${message}`, data);
        break;
      case "WARN":
        console.warn(`${prefix} ${message}`, data);
        break;
      case "ERROR":
        console.error(`${prefix} ${message}`, data);
        break;
    }

    // Persiste se inicializado
    if (this.initialized) {
      this.persistLog(entry).catch((e) => console.error(e));
    }
  }

  static debug(tag: string, message: string, data?: any): void {
    this.log("DEBUG", tag, message, data);
  }

  static info(tag: string, message: string, data?: any): void {
    this.log("INFO", tag, message, data);
  }

  static warn(tag: string, message: string, data?: any): void {
    this.log("WARN", tag, message, data);
  }

  static error(tag: string, message: string, data?: any): void {
    this.log("ERROR", tag, message, data);
  }

  /**
   * Persiste log em arquivo
   */
  private static async persistLog(entry: LogEntry): Promise<void> {
    try {
      const logLine = `${entry.timestamp} | ${entry.level} | ${entry.tag} | ${entry.message}${
        entry.data ? " | " + JSON.stringify(entry.data) : ""
      }\n`;

      // Verifica tamanho do arquivo
      const fileInfo = await FileSystem.getInfoAsync(this.logFile);
      if (fileInfo.exists && fileInfo.size > this.maxLogSize) {
        // Rotaciona arquivo (renomeia para .old e cria novo)
        const oldFile = `${this.logFile}.old`;
        try {
          await FileSystem.deleteAsync(oldFile);
        } catch {}
        await FileSystem.moveAsync({
          from: this.logFile,
          to: oldFile,
        });
      }

      // Escreve no arquivo
      await FileSystem.writeAsStringAsync(this.logFile, logLine, {
        encoding: FileSystem.EncodingType.UTF8,
        append: true,
      });
    } catch (error) {
      console.error("[Logger] Erro ao persistir log:", error);
    }
  }

  /**
   * Retorna todos os logs em memória
   */
  static obterLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Filtra logs por tag
   */
  static obterLogsPorTag(tag: string): LogEntry[] {
    return this.logs.filter((l) => l.tag.includes(tag));
  }

  /**
   * Filtra logs por nível
   */
  static obterLogsPorNivel(nivel: LogLevel): LogEntry[] {
    return this.logs.filter((l) => l.level === nivel);
  }

  /**
   * Filtra logs por intervalo de tempo
   */
  static obterLogsNoIntervalo(inicio: Date, fim: Date): LogEntry[] {
    const inicioMs = inicio.getTime();
    const fimMs = fim.getTime();
    return this.logs.filter((l) => {
      const logMs = new Date(l.timestamp).getTime();
      return logMs >= inicioMs && logMs <= fimMs;
    });
  }

  /**
   * Exporta logs para arquivo
   */
  static async exportarLogs(nomePersonalizado?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const nomeArquivo = nomePersonalizado || `pesagem-logs-${timestamp}.txt`;
      const caminhoExportacao = `${this.logDirectory}/${nomeArquivo}`;

      let conteudo = "=== LOGS DE PESAGEM ===\n";
      conteudo += `Data de Exportação: ${new Date().toISOString()}\n`;
      conteudo += `Platform: ${Platform.OS}\n`;
      conteudo += `Total de entradas: ${this.logs.length}\n\n`;

      // Agrupa por tag
      const porTag: { [tag: string]: LogEntry[] } = {};
      this.logs.forEach((log) => {
        if (!porTag[log.tag]) {
          porTag[log.tag] = [];
        }
        porTag[log.tag].push(log);
      });

      // Escreve agrupado
      Object.entries(porTag).forEach(([tag, logs]) => {
        conteudo += `\n=== ${tag} (${logs.length} entradas) ===\n`;
        logs.forEach((log) => {
          conteudo += `${log.timestamp} [${log.level}] ${log.message}`;
          if (log.data) {
            conteudo += ` | ${JSON.stringify(log.data)}`;
          }
          conteudo += "\n";
        });
      });

      await FileSystem.writeAsStringAsync(caminhoExportacao, conteudo);
      this.info("Logger", `Logs exportados para: ${caminhoExquivo}`);

      return caminhoExportacao;
    } catch (error) {
      this.error("Logger", "Erro ao exportar logs", error);
      throw error;
    }
  }

  /**
   * Limpa os logs
   */
  static async limparLogs(): Promise<void> {
    try {
      this.logs = [];
      await FileSystem.deleteAsync(this.logFile).catch(() => {});
      this.info("Logger", "Logs limpos");
    } catch (error) {
      this.error("Logger", "Erro ao limpar logs", error);
    }
  }

  /**
   * Gera relatório de eventos
   */
  static gerarRelatório(): {
    total: number;
    porNivel: { [key in LogLevel]: number };
    porTag: { [tag: string]: number };
    periodoInicio: string;
    periodoFim: string;
  } {
    const porNivel: { [key in LogLevel]: number } = {
      DEBUG: 0,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
    };

    const porTag: { [tag: string]: number } = {};

    this.logs.forEach((log) => {
      porNivel[log.level]++;

      if (!porTag[log.tag]) {
        porTag[log.tag] = 0;
      }
      porTag[log.tag]++;
    });

    return {
      total: this.logs.length,
      porNivel,
      porTag,
      periodoInicio: this.logs[0]?.timestamp || "",
      periodoFim: this.logs[this.logs.length - 1]?.timestamp || "",
    };
  }

  /**
   * Monitora performance de operação
   */
  static monitorarOperacao<T>(
    tag: string,
    operacao: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const inicio = performance.now();
      this.info(tag, `Iniciando: ${operacao}`);

      try {
        const resultado = await fn();
        const duracao = performance.now() - inicio;
        this.info(tag, `Concluído: ${operacao}`, { duracao: `${duracao.toFixed(2)}ms` });
        resolve(resultado);
      } catch (error) {
        const duracao = performance.now() - inicio;
        this.error(tag, `Erro em: ${operacao}`, { duracao: `${duracao.toFixed(2)}ms`, erro: error });
        reject(error);
      }
    });
  }
}

/**
 * Inicializa logger automaticamente
 */
PesagemLogger.initialize().catch((e) => console.error(e));
