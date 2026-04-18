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

export async function uploadBlob(path: string, uri: string, contentType?: string): Promise<string> {
  if (isWeb) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await uploadFile(path, blob);
  } else {
    return await uploadFile(path, uri);
  }
}
