const DB_NAME = 'ag_notification_db';
const STORE_NAME = 'unread_state';
const UNREAD_KEY = 'ag_has_unread_notif';

export async function getUnreadStatusFromIndexedDB(): Promise<boolean> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return false;
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(false);
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get('status');
        getReq.onsuccess = () => {
          if (getReq.result && getReq.result.hasUnread === true) {
            resolve(true);
          } else {
            resolve(false);
          }
        };
        getReq.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function setUnreadStatusInIndexedDB(hasUnread: boolean, payload?: any): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve();
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          id: 'status',
          hasUnread,
          timestamp: Date.now(),
          payload: payload || null,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
