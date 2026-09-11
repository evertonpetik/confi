import { Platform } from "react-native";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { storage } = require("../../firebaseConfig") as { storage: any };

const isWeb = Platform.OS === "web";

export async function uploadFile(path: string, file: Blob | string): Promise<string> {
  if (isWeb) {
    const { ref, uploadBytes, getDownloadURL } = require("firebase/storage");
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file as Blob);
    return await getDownloadURL(storageRef);
  } else {
    const reference = storage.ref(path);
    await reference.putFile(file as string);
    return await reference.getDownloadURL();
  }
}

export async function getDownloadUrl(path: string): Promise<string> {
  if (isWeb) {
    const { ref, getDownloadURL } = require("firebase/storage");
    return await getDownloadURL(ref(storage, path));
  } else {
    return await storage.ref(path).getDownloadURL();
  }
}

export async function deleteFile(path: string): Promise<void> {
  if (isWeb) {
    const { ref, deleteObject } = require("firebase/storage");
    await deleteObject(ref(storage, path));
  } else {
    await storage.ref(path).delete();
  }
}

/**
 * Envia conteúdo em base64 ao Storage.
 *
 * Usado para os PDFs das GTAs: guardá-los no documento do Firestore estoura o
 * limite de 1 MB por documento em qualquer guia um pouco maior, e o upload
 * falha sem o processo chegar a ser salvo.
 */
export async function uploadBase64(
  path: string,
  base64: string,
  contentType = "application/pdf"
): Promise<string> {
  if (isWeb) {
    const { ref, uploadString, getDownloadURL } = require("firebase/storage");
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64, "base64", { contentType });
    return await getDownloadURL(storageRef);
  }
  const reference = storage.ref(path);
  await reference.putString(base64, "base64", { contentType });
  return await reference.getDownloadURL();
}

/** Baixa um arquivo do Storage como bytes. */
export async function baixarBytes(url: string): Promise<Uint8Array> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao baixar (${resposta.status})`);
  return new Uint8Array(await resposta.arrayBuffer());
}

export async function uploadBlob(path: string, uri: string, contentType?: string): Promise<string> {
  if (isWeb) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await uploadFile(path, blob);
  } else {
    return await uploadFile(path, uri);
  }
}
