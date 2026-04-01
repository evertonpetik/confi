import { Platform } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { db } = require("../../firebaseConfig") as { db: any };

// ---- Fazenda path prefix ----

let _currentFazendaId: string | null = null;

export function setCurrentFazendaId(id: string | null) {
  _currentFazendaId = id;
}

export function getCurrentFazendaId(): string | null {
  return _currentFazendaId;
}

const ROOT_COLLECTIONS = new Set(["usuarios", "fazendas"]);

function resolvePath(colPath: string[]): string[] {
  if (!_currentFazendaId) return colPath;
  if (ROOT_COLLECTIONS.has(colPath[0])) return colPath;
  return ["fazendas", _currentFazendaId, ...colPath];
}

// ---- Tipos unificados ----

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

// Helpers para construir constraints
export const fsWhere = (field: string, op: WhereOp, value: any): QueryConstraint => ({
  type: "where", field, op, value,
});
export const fsOrderBy = (field: string, direction?: "asc" | "desc"): QueryConstraint => ({
  type: "orderBy", field, direction,
});
export const fsLimit = (count: number): QueryConstraint => ({
  type: "limit", count,
});

// ---- Implementação Web ----

let webFs: any = null;
function getWebFs() {
  if (!webFs) {
    webFs = require("firebase/firestore");
  }
  return webFs;
}

async function webGetDocs(colPath: string[]): Promise<QuerySnapshot> {
  const fs = getWebFs();
  const colRef = fs.collection(db, ...colPath);
  return await fs.getDocs(colRef);
}

async function webQueryDocs(colPath: string[], constraints: QueryConstraint[]): Promise<QuerySnapshot> {
  const fs = getWebFs();
  const colRef = fs.collection(db, ...colPath);
  const queryConstraints = constraints.map((c) => {
    if (c.type === "where") return fs.where(c.field, c.op, c.value);
    if (c.type === "orderBy") return fs.orderBy(c.field, c.direction);
    if (c.type === "limit") return fs.limit(c.count);
    return null;
  }).filter(Boolean);
  const q = fs.query(colRef, ...queryConstraints);
  return await fs.getDocs(q);
}

async function webAddDoc(colPath: string[], data: any): Promise<DocRef> {
  const fs = getWebFs();
  const colRef = fs.collection(db, ...colPath);
  return await fs.addDoc(colRef, data);
}

async function webUpdateDoc(colPath: string[], docId: string, data: any): Promise<void> {
  const fs = getWebFs();
  const docRef = fs.doc(db, ...colPath, docId);
  await fs.updateDoc(docRef, data);
}

async function webDeleteDoc(colPath: string[], docId: string): Promise<void> {
  const fs = getWebFs();
  const docRef = fs.doc(db, ...colPath, docId);
  await fs.deleteDoc(docRef);
}

async function webSetDoc(colPath: string[], docId: string, data: any, options?: { merge: boolean }): Promise<void> {
  const fs = getWebFs();
  const docRef = fs.doc(db, ...colPath, docId);
  if (options) {
    await fs.setDoc(docRef, data, options);
  } else {
    await fs.setDoc(docRef, data);
  }
}

async function webGetDoc(colPath: string[], docId: string): Promise<DocSnapshot> {
  const fs = getWebFs();
  const docRef = fs.doc(db, ...colPath, docId);
  const snap = await fs.getDoc(docRef);
  return snap;
}

function webCreateBatch() {
  const fs = getWebFs();
  const batch = fs.writeBatch(db);
  return {
    set: (colPath: string[], data: any) => {
      const colRef = fs.collection(db, ...colPath);
      const docRef = fs.doc(colRef);
      batch.set(docRef, data);
    },
    commit: () => batch.commit(),
  };
}

// ---- Implementação Native ----

function buildNativeRef(colPath: string[]) {
  let ref: any = db.collection(colPath[0]);
  for (let i = 1; i < colPath.length; i++) {
    if (i % 2 === 1) {
      ref = ref.doc(colPath[i]);
    } else {
      ref = ref.collection(colPath[i]);
    }
  }
  return ref;
}

async function nativeGetDocs(colPath: string[]): Promise<QuerySnapshot> {
  const ref = buildNativeRef(colPath);
  return await ref.get();
}

async function nativeQueryDocs(colPath: string[], constraints: QueryConstraint[]): Promise<QuerySnapshot> {
  let ref: any = buildNativeRef(colPath);
  for (const c of constraints) {
    if (c.type === "where") ref = ref.where(c.field, c.op, c.value);
    if (c.type === "orderBy") ref = ref.orderBy(c.field, c.direction);
    if (c.type === "limit") ref = ref.limit(c.count);
  }
  return await ref.get();
}

async function nativeAddDoc(colPath: string[], data: any): Promise<DocRef> {
  const ref = buildNativeRef(colPath);
  return await ref.add(data);
}

async function nativeUpdateDoc(colPath: string[], docId: string, data: any): Promise<void> {
  const ref = buildNativeRef(colPath);
  await ref.doc(docId).update(data);
}

async function nativeDeleteDoc(colPath: string[], docId: string): Promise<void> {
  const ref = buildNativeRef(colPath);
  await ref.doc(docId).delete();
}

async function nativeSetDoc(colPath: string[], docId: string, data: any, options?: { merge: boolean }): Promise<void> {
  const ref = buildNativeRef(colPath);
  if (options) {
    await ref.doc(docId).set(data, options);
  } else {
    await ref.doc(docId).set(data);
  }
}

async function nativeGetDoc(colPath: string[], docId: string): Promise<DocSnapshot> {
  const ref = buildNativeRef(colPath);
  return await ref.doc(docId).get();
}

function nativeCreateBatch() {
  const batch = db.batch();
  return {
    set: (colPath: string[], data: any) => {
      const ref = buildNativeRef(colPath);
      const docRef = ref.doc();
      batch.set(docRef, data);
    },
    commit: () => batch.commit(),
  };
}

// ---- API pública unificada ----

const isWeb = Platform.OS === "web";

export async function getCollection(...colPath: string[]): Promise<QuerySnapshot> {
  const resolved = resolvePath(colPath);
  return isWeb ? webGetDocs(resolved) : nativeGetDocs(resolved);
}

export async function queryCollection(colPath: string[], constraints: QueryConstraint[]): Promise<QuerySnapshot> {
  const resolved = resolvePath(colPath);
  return isWeb ? webQueryDocs(resolved, constraints) : nativeQueryDocs(resolved, constraints);
}

export async function addDocument(colPath: string[], data: any): Promise<DocRef> {
  const resolved = resolvePath(colPath);
  return isWeb ? webAddDoc(resolved, data) : nativeAddDoc(resolved, data);
}

export async function updateDocument(colPath: string[], docId: string, data: any): Promise<void> {
  const resolved = resolvePath(colPath);
  return isWeb ? webUpdateDoc(resolved, docId, data) : nativeUpdateDoc(resolved, docId, data);
}

export async function deleteDocument(colPath: string[], docId: string): Promise<void> {
  const resolved = resolvePath(colPath);
  return isWeb ? webDeleteDoc(resolved, docId) : nativeDeleteDoc(resolved, docId);
}

export async function setDocument(colPath: string[], docId: string, data: any, options?: { merge: boolean }): Promise<void> {
  const resolved = resolvePath(colPath);
  return isWeb ? webSetDoc(resolved, docId, data, options) : nativeSetDoc(resolved, docId, data, options);
}

export async function getDocument(colPath: string[], docId: string): Promise<DocSnapshot> {
  const resolved = resolvePath(colPath);
  return isWeb ? webGetDoc(resolved, docId) : nativeGetDoc(resolved, docId);
}

export function createBatch() {
  const inner = isWeb ? webCreateBatch() : nativeCreateBatch();
  return {
    set: (colPath: string[], data: any) => {
      const resolved = resolvePath(colPath);
      inner.set(resolved, data);
    },
    commit: () => inner.commit(),
  };
}

// ---- Funcoes RAW (sem prefixo de fazenda) ----

export async function getRawCollection(...colPath: string[]): Promise<QuerySnapshot> {
  return isWeb ? webGetDocs(colPath) : nativeGetDocs(colPath);
}

export async function getRawDocument(colPath: string[], docId: string): Promise<DocSnapshot> {
  return isWeb ? webGetDoc(colPath, docId) : nativeGetDoc(colPath, docId);
}

export async function setRawDocument(colPath: string[], docId: string, data: any, options?: { merge: boolean }): Promise<void> {
  return isWeb ? webSetDoc(colPath, docId, data, options) : nativeSetDoc(colPath, docId, data, options);
}

export async function addRawDocument(colPath: string[], data: any): Promise<DocRef> {
  return isWeb ? webAddDoc(colPath, data) : nativeAddDoc(colPath, data);
}

export async function updateRawDocument(colPath: string[], docId: string, data: any): Promise<void> {
  return isWeb ? webUpdateDoc(colPath, docId, data) : nativeUpdateDoc(colPath, docId, data);
}

export async function deleteRawDocument(colPath: string[], docId: string): Promise<void> {
  return isWeb ? webDeleteDoc(colPath, docId) : nativeDeleteDoc(colPath, docId);
}
