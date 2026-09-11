/**
 * Regras de numeração SISBOV.
 *
 * Um número SISBOV tem 15 dígitos: 14 de base sequencial + 1 dígito verificador.
 * O "número de manejo" (o que se lê no brinco visual) são os dígitos 9 a 14.
 *
 *     1 0 5 5 0 0 5 0 8 0 7 8 0 3 5
 *     └──── base sequencial ────┘ └┘ DV
 *                     └─manejo─┘
 *     └─ prefixo ───┘ 807803        →  SISBOV 105500508078035
 *
 * O chip RFID é um número próprio do transponder; por convenção da fábrica ele
 * repete os últimos 4 dígitos do número de manejo, o que permite conferir no
 * mangueiro se o chip lido pertence mesmo ao brinco que está sendo aplicado.
 */

// ─── Dígito verificador ───────────────────────────────────────────────────────

/**
 * Dígito verificador do SISBOV: módulo 11 sobre os 14 dígitos da base, com
 * pesos 2..9 ciclando da direita para a esquerda. Resultado 10 ou 11 vira 0.
 */
export function dvSisbov(base14: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base14.length - 1; i >= 0; i--) {
    soma += Number(base14[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv >= 10 ? 0 : dv;
}

/** Verifica se um SISBOV de 15 dígitos tem o dígito verificador correto. */
export function validarSisbov(sisbov: string): boolean {
  if (!/^\d{15}$/.test(sisbov)) return false;
  return dvSisbov(sisbov.slice(0, 14)) === Number(sisbov[14]);
}

// ─── Manejo e sequência ───────────────────────────────────────────────────────

/** Número de manejo (6 dígitos) — posições 9 a 14 do SISBOV. */
export function manejoFromSisbov(sisbov: string): string {
  return sisbov.slice(8, 14);
}

/**
 * N-ésimo SISBOV a partir de um inicial (index 0-based).
 *
 * Incrementa a base de 14 dígitos e recalcula o DV — somar no número completo
 * de 15 dígitos produz números inválidos, pois trata o DV como parte da
 * sequência. Operar sobre a base também resolve o "vai-um" quando o manejo
 * passa de 999999 para o prefixo seguinte.
 */
export function sisbovByIndex(sisbovInicial: string, index: number): string {
  const base = (BigInt(sisbovInicial.slice(0, 14)) + BigInt(index))
    .toString()
    .padStart(14, "0");
  return base + dvSisbov(base);
}

/** Quantidade de brincos entre dois SISBOV, inclusive nas duas pontas. */
export function totalSisbov(sisbovInicial: string, sisbovFinal: string): number {
  return Number(BigInt(sisbovFinal.slice(0, 14)) - BigInt(sisbovInicial.slice(0, 14))) + 1;
}

// ─── Conferência do chip RFID ─────────────────────────────────────────────────

/**
 * O chip RFID deve terminar com os mesmos 4 dígitos do número de manejo.
 * Divergência indica que o chip lido é de outro animal — trava a gravação.
 */
export function chipConfereComManejo(chipRfid: string, manejo: string): boolean {
  if (!chipRfid || !manejo) return false;
  return chipRfid.slice(-4) === manejo.slice(-4);
}

// ─── Faixa etária declarada na GTA ────────────────────────────────────────────

export interface FaixaEtaria {
  /** Idade mínima da faixa, em meses. */
  minMeses: number;
  /** Idade máxima da faixa, em meses. Igual a minMeses quando a faixa é aberta. */
  maxMeses: number;
  /** Se a GTA declara "ACIMA DE N MESES" (sem limite superior). */
  aberta: boolean;
  /** Texto normalizado para exibição, ex: "13 a 24 meses". */
  label: string;
}

/**
 * Extrai a faixa etária da descrição do animal na GTA.
 * Reconhece "13 A 24 MESES", "ACIMA DE 36 MESES", "ATÉ 12 MESES" e "24 MESES".
 */
export function parseFaixaEtaria(descricao: string): FaixaEtaria | null {
  const texto = descricao.toUpperCase().replace(/\s+/g, " ");

  const intervalo = /(\d+)\s*A\s*(\d+)\s*MES/.exec(texto);
  if (intervalo) {
    const min = Number(intervalo[1]);
    const max = Number(intervalo[2]);
    return { minMeses: min, maxMeses: max, aberta: false, label: `${min} a ${max} meses` };
  }

  const acima = /ACIMA\s+DE\s+(\d+)\s*MES/.exec(texto);
  if (acima) {
    const min = Number(acima[1]);
    return { minMeses: min, maxMeses: min, aberta: true, label: `acima de ${min} meses` };
  }

  const ate = /AT[EÉ]\s+(\d+)\s*MES/.exec(texto);
  if (ate) {
    const max = Number(ate[1]);
    return { minMeses: 0, maxMeses: max, aberta: false, label: `até ${max} meses` };
  }

  const unico = /(\d+)\s*MES/.exec(texto);
  if (unico) {
    const m = Number(unico[1]);
    return { minMeses: m, maxMeses: m, aberta: false, label: `${m} meses` };
  }

  return null;
}

/** Dias médios por mês (365,25 / 12) — mantém a conversão determinística. */
const DIAS_POR_MES = 30.4375;

/**
 * Converte a data de referência para um Date no fuso local.
 *
 * `new Date("2026-07-20")` é interpretado como meia-noite UTC, o que a oeste de
 * Greenwich cai no dia anterior ao ser lido com getDate(). Datas de GTA são
 * civis (sem hora), então precisam ser construídas no fuso local.
 */
function paraDataLocal(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return new Date(valor);
}

/**
 * Data de nascimento estimada a partir da faixa etária da GTA, pelo ponto médio
 * da faixa e ancorada na data de emissão da guia.
 *
 * Faixa aberta ("acima de N meses") não tem ponto médio: usa o limite inferior,
 * que é o único valor que a GTA de fato afirma.
 *
 * @param dataReferencia data de emissão da GTA (ISO 8601 ou Date)
 * @returns data em ISO 8601 (yyyy-mm-dd)
 */
export function dataNascimentoPorFaixa(
  faixa: FaixaEtaria,
  dataReferencia: string | Date
): string {
  const ref = paraDataLocal(dataReferencia);
  const meses = faixa.aberta ? faixa.minMeses : (faixa.minMeses + faixa.maxMeses) / 2;

  const mesesInteiros = Math.floor(meses);
  const diasResto = Math.round((meses - mesesInteiros) * DIAS_POR_MES);

  // Subtrai os meses preservando o dia do mês (setMonth transborda em meses
  // curtos: 31/03 menos 1 mês viraria 03/03), depois desconta a fração em dias.
  const diaOriginal = ref.getDate();
  const data = new Date(ref.getFullYear(), ref.getMonth() - mesesInteiros, 1);
  const ultimoDiaDoMes = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(diaOriginal, ultimoDiaDoMes));
  data.setDate(data.getDate() - diasResto);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
