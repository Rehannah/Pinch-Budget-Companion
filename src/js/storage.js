// This file manages interactions with LocalForage for local offline storage, including saving and retrieving data.

const storage = localforage.createInstance({
    name: "mobileFirstApp"
});

// Function to save data
function saveData(key, value) {
    return storage.setItem(key, value)
        .then(() => {
            console.log(`Data saved for key: ${key}`);
        })
        .catch((err) => {
            console.error(`Error saving data for key: ${key}`, err);
        });
}

// Function to retrieve data
function getData(key) {
    return storage.getItem(key)
        .then((value) => {
            console.log(`Data retrieved for key: ${key}`, value);
            return value;
        })
        .catch((err) => {
            console.error(`Error retrieving data for key: ${key}`, err);
        });
}

// Function to remove data
function removeData(key) {
    return storage.removeItem(key)
        .then(() => {
            console.log(`Data removed for key: ${key}`);
        })
        .catch((err) => {
            console.error(`Error removing data for key: ${key}`, err);
        });
}

// Function to clear all data
function clearAllData() {
    return storage.clear()
        .then(() => {
            console.log("All data cleared");
        })
        .catch((err) => {
            console.error("Error clearing data", err);
        });
}

// Exporting functions for use in other modules
export { saveData, getData, removeData, clearAllData };