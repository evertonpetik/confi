/**
 * Progresso de carregamento (0–100 %) para alimentar o `LoadingIndicator`.
 *
 * O Firestore não informa progresso de uma consulta, então o percentual é
 * calculado por ETAPAS concluídas: cada `await` (consulta, leitura de cache,
 * processamento pesado) conta como uma etapa. Quando uma etapa dispara N
 * sub-consultas (ex.: uma por lote), use `adicionarEtapas(N)` + `rastrear` para
 * o percentual avançar a cada sub-consulta resolvida.
 *
 * Uso típico em uma tela:
 *
 *   const progresso = useProgresso();
 *   async function carregar() {
 *     progresso.iniciar(3);                 // 3 etapas previstas
 *     setLoading(true);
 *     try {
 *       const lotes = await progresso.rastrear(getCollection("lotes"));   // 33 %
 *       const [a, b] = await progresso.todas([getA(), getB()]);           // 66 % → 100 %
 *       ...
 *     } finally {
 *       progresso.concluir();               // garante 100 %
 *       setLoading(false);
 *     }
 *   }
 *   ...
 *   {loading ? <LoadingIndicator progresso={progresso} /> : ...}
 *
 * `valor` é o progresso REAL (só muda quando uma etapa termina). `teto` é o
 * limite até onde o indicador pode animar uma estimativa suave enquanto a etapa
 * atual ainda não terminou (nunca alcança a próxima etapa nem 100 %), para o
 * número não parecer travado em consultas demoradas.
 */
import { useCallback, useMemo, useRef, useState } from "react";

export type Progresso = {
  /** Progresso real concluído, 0–100. */
  valor: number;
  /** Limite para a animação estimada da etapa em andamento (sempre < 100 até concluir). */
  teto: number;
  /** Incrementado a cada `iniciar()`; permite ao indicador zerar a animação. */
  ciclo: number;
  /** Total de etapas previstas (0 = desconhecido). */
  total: number;
  /** Zera e define quantas etapas o carregamento terá. */
  iniciar: (totalEtapas?: number) => void;
  /** Marca `n` etapas como concluídas (padrão 1). */
  avancar: (n?: number) => void;
  /** Acrescenta etapas descobertas durante o carregamento (ex.: uma sub-consulta por lote). */
  adicionarEtapas: (n: number) => void;
  /** Define diretamente etapas concluídas/total (para fontes externas de progresso). */
  definir: (concluidas: number, total: number) => void;
  /** Força 100 %. Chamar no `finally`. */
  concluir: () => void;
  /** Envolve uma promise: ao resolver (ou falhar) conta uma etapa. */
  rastrear: <T>(promise: Promise<T>) => Promise<T>;
  /** `Promise.all` que conta uma etapa por promise resolvida. */
  todas: <T extends readonly unknown[] | []>(
    promises: T
  ) => Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
};

/** Subconjunto do `Progresso` para funções de serviço/utils que recebem o rastreador como parâmetro opcional. */
export type RastreadorProgresso = Pick<
  Progresso,
  "iniciar" | "avancar" | "adicionarEtapas" | "definir" | "concluir" | "rastrear" | "todas"
>;

/** Fração da etapa atual que a animação estimada pode percorrer antes de a etapa terminar. */
const FRACAO_ESTIMADA = 0.9;

function calcular(concluidas: number, total: number) {
  if (total <= 0) {
    // Total desconhecido: sem progresso real; a estimativa pode ir até 90 %.
    return { valor: 0, teto: 90 };
  }
  const valor = Math.min(100, (concluidas / total) * 100);
  if (valor >= 100) return { valor: 100, teto: 100 };
  const tamanhoEtapa = 100 / total;
  const teto = Math.min(99, valor + tamanhoEtapa * FRACAO_ESTIMADA);
  return { valor, teto };
}

export function useProgresso(): Progresso {
  const concluidasRef = useRef(0);
  const totalRef = useRef(0);
  const cicloRef = useRef(0);
  const [estado, setEstado] = useState(() => ({ valor: 0, teto: 90, ciclo: 0, total: 0 }));

  const publicar = useCallback(() => {
    const { valor, teto } = calcular(concluidasRef.current, totalRef.current);
    setEstado((prev) => {
      if (
        prev.valor === valor &&
        prev.teto === teto &&
        prev.ciclo === cicloRef.current &&
        prev.total === totalRef.current
      ) {
        return prev;
      }
      return { valor, teto, ciclo: cicloRef.current, total: totalRef.current };
    });
  }, []);

  const iniciar = useCallback(
    (totalEtapas: number = 0) => {
      concluidasRef.current = 0;
      totalRef.current = Math.max(0, Math.floor(totalEtapas));
      cicloRef.current += 1;
      publicar();
    },
    [publicar]
  );

  const avancar = useCallback(
    (n: number = 1) => {
      if (totalRef.current <= 0) return;
      concluidasRef.current = Math.min(totalRef.current, concluidasRef.current + n);
      publicar();
    },
    [publicar]
  );

  const adicionarEtapas = useCallback(
    (n: number) => {
      if (n <= 0) return;
      totalRef.current += Math.floor(n);
      publicar();
    },
    [publicar]
  );

  const definir = useCallback(
    (concluidas: number, total: number) => {
      totalRef.current = Math.max(0, Math.floor(total));
      concluidasRef.current = Math.max(0, Math.min(totalRef.current, Math.floor(concluidas)));
      publicar();
    },
    [publicar]
  );

  const concluir = useCallback(() => {
    if (totalRef.current <= 0) totalRef.current = 1;
    concluidasRef.current = totalRef.current;
    publicar();
  }, [publicar]);

  const rastrear = useCallback(
    <T,>(promise: Promise<T>): Promise<T> => {
      const ciclo = cicloRef.current;
      const marcar = () => {
        // Ignora promises de um carregamento anterior que terminaram atrasadas.
        if (cicloRef.current === ciclo) avancar(1);
      };
      return promise.then(
        (v) => {
          marcar();
          return v;
        },
        (e) => {
          marcar();
          throw e;
        }
      );
    },
    [avancar]
  );

  const todas = useCallback(
    <T extends readonly unknown[] | []>(promises: T) =>
      Promise.all((promises as readonly Promise<unknown>[]).map((p) => rastrear(p))) as Promise<{
        -readonly [P in keyof T]: Awaited<T[P]>;
      }>,
    [rastrear]
  );

  return useMemo(
    () => ({
      valor: estado.valor,
      teto: estado.teto,
      ciclo: estado.ciclo,
      total: estado.total,
      iniciar,
      avancar,
      adicionarEtapas,
      definir,
      concluir,
      rastrear,
      todas,
    }),
    [estado, iniciar, avancar, adicionarEtapas, definir, concluir, rastrear, todas]
  );
}
