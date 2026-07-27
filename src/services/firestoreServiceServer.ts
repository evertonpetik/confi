/**
 * firestoreServiceServer.ts
 *
 * Equivalente a firestoreService.ts, mas para uso exclusivo em código de
 * backend (funções api/* na Vercel). Usa o Firebase Admin SDK em vez do
 * Client SDK:
 *   - Não depende de "react-native" (o Client SDK original quebra no
 *     runtime Node.js serverless da Vercel).
 *   - Ignora as Firestore Security Rules (o backend roda com privilégio de
 *     administrador, não como um usuário autenticado do app).
 *
 * Mesma API pública usada pelos arquivos de backend (getCollection,
 * queryCollection, addDocument, setDocument, fsWhere, fsOrderBy, fsLimit,
 * setCurrentFazendaId, getCurrentFazendaId) — só a implementação interna
 * muda. Não é usado pelo app mobile/web.
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// ---- Inicialização lazy do Admin SDK ----

let db: Firestore | null = null;

function getDb(): Firestore {
  if (!db) {
    if (getApps().length === 0) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!raw) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY não configurada — gere a chave em " +
          "Firebase Console > Project Settings > Service Accounts e cole o " +
          "JSON inteiro nessa env var na Vercel."
        );
      }
      const serviceAccount = JSON.parse(raw);
      initializeApp({ credential: cert(serviceAccount) });
    }
    db = getFirestore();
  }
  return db;
}

// ---- Fazenda path prefix ----

let _currentFazendaId: string | null = null;

export function setCurrentFazendaId(id: string | null) {
  _currentFazendaId = id;
}

export function getCurrentFazendaId(): string | null {
  return _currentFazendaId;
}

const ROOT_COLLECTIONS = new Set(["usuarios", "fazendas", "whatsappSessoes"]);

function resolvePath(colPath: string[]): string[] {
  if (!_currentFazendaId) return colPath;
  if (ROOT_COLLECTIONS.has(colPath[0])) return colPath;
  return ["fazendas", _currentFazendaId, ...colPath];
}

// ---- Tipos unificados (mesmo formato de firestoreService.ts) ----

export type DocSnapshot = {
  id: string;
  data: () => any;
  exists?: boolean;
};

export type QuerySnapshot = {
  docs: DocSnapshot[];
  empty: boolean;
  size: number;
  forEach: (callback: (doc: DocSnapshot) => void) => void;
};

export type DocRef = {
  id: string;
};

type WhereOp = "<" | "<=" | "==" | "!=" | ">=" | ">" | "array-contains" | "in" | "not-in" | "array-contains-any";

export type QueryConstraint =
  | { type: "where"; field: string; op: WhereOp; value: any }
  | { type: "orderBy"; field: string; direction?: "asc" | "desc" }
  | { type: "limit"; count: number };

export const fsWhere = (field: string, op: WhereOp, value: any): QueryConstraint => ({
  type: "where", field, op, value,
});
export const fsOrderBy = (field: string, direction?: "asc" | "desc"): QueryConstraint => ({
  type: "orderBy", field, direction,
});
export const fsLimit = (count: number): QueryConstraint => ({
  type: "limit", count,
});

// ---- Implementação (Admin SDK) ----

function buildRef(colPath: string[]) {
  let ref: any = getDb().collection(colPath[0]);
  for (let i = 1; i < colPath.length; i++) {
    if (i % 2 === 1) {
      ref = ref.doc(colPath[i]);
    } else {
      ref = ref.collection(colPath[i]);
    }
  }
  return ref;
}

// ---- API pública ----

export async function getCollection(...colPath: string[]): Promise<QuerySnapshot> {
  const resolved = resolvePath(colPath);
  const ref = buildRef(resolved);
  return await ref.get();
}

export async function queryCollection(colPath: string[], constraints: QueryConstraint[]): Promise<QuerySnapshot> {
  const resolved = resolvePath(colPath);
  let ref: any = buildRef(resolved);
  for (const c of constraints) {
    if (c.type === "where") ref = ref.where(c.field, c.op, c.value);
    if (c.type === "orderBy") ref = ref.orderBy(c.field, c.direction);
    if (c.type === "limit") ref = ref.limit(c.count);
  }
  return await ref.get();
}

export async function addDocument(colPath: string[], data: any): Promise<DocRef> {
  const resolved = resolvePath(colPath);
  const ref = buildRef(resolved);
  return await ref.add(data);
}

export async function setDocument(colPath: string[], docId: string, data: any, options?: { merge: boolean }): Promise<void> {
  const resolved = resolvePath(colPath);
  const ref = buildRef(resolved);
  if (options) {
    await ref.doc(docId).set(data, options);
  } else {
    await ref.doc(docId).set(data);
  }
}
