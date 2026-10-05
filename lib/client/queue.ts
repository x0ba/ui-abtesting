import type { StudyEvent } from "../study/events.ts";

const DB_NAME = "ui-abtesting";
const STORE = "events";

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: ["sessionId", "seq"] });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function enqueue(event: StudyEvent): Promise<unknown> {
  return run("readwrite", (s) => s.put(event));
}

export async function peek(limit: number): Promise<StudyEvent[]> {
  return (await run("readonly", (s) => s.getAll(null, limit) as IDBRequest<StudyEvent[]>)) ?? [];
}

export function remove(keys: [string, number][]): Promise<unknown> {
  return run("readwrite", (s) => {
    for (const key of keys) s.delete(key);
  });
}
