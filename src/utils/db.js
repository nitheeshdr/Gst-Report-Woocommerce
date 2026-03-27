export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("WooCommerceDB", 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("config")) {
        db.createObjectStore("config", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("appData")) {
        db.createObjectStore("appData", { keyPath: "id" });
      }
    };
  });
};

export const saveConfigToDB = async (configData) => {
  const db = await initDB();
  const transaction = db.transaction(["config"], "readwrite");
  const store = transaction.objectStore("config");
  await store.put({ id: "main", ...configData });
};

export const loadConfigFromDB = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction(["config"], "readonly");
    const store = transaction.objectStore("config");
    const request = store.get("main");

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Error loading config:", err);
    return null;
  }
};

export const clearConfigFromDB = async () => {
  const db = await initDB();
  const transaction = db.transaction(["config"], "readwrite");
  const store = transaction.objectStore("config");
  await store.delete("main");
};

export const saveDataToDB = async (id, data) => {
  const db = await initDB();
  const transaction = db.transaction(["appData"], "readwrite");
  const store = transaction.objectStore("appData");
  await store.put({ id, data, timestamp: Date.now() });
};

export const loadDataFromDB = async (id) => {
  try {
    const db = await initDB();
    const transaction = db.transaction(["appData"], "readonly");
    const store = transaction.objectStore("appData");
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error(`Error loading ${id} from DB:`, err);
    return null;
  }
};
