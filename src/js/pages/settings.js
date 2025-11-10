// This file contains the logic for the settings page, including functions for exporting and importing data.

document.addEventListener('DOMContentLoaded', () => {
    const exportButton = document.getElementById('export-data');
    const importButton = document.getElementById('import-data');
    const resetButton = document.getElementById('reset-app');

    exportButton.addEventListener('click', exportData);
    importButton.addEventListener('change', importData);
    resetButton.addEventListener('click', resetApp);
});

function exportData() {
    // Logic to export data to Excel
    localforage.getItem('appData').then(data => {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'appData.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }).catch(err => {
        console.error('Error exporting data:', err);
    });
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        localforage.setItem('appData', data).then(() => {
            alert('Data imported successfully!');
        }).catch(err => {
            console.error('Error importing data:', err);
        });
    };
    reader.readAsText(file);
}

function resetApp() {
    // Logic to reset the app for a new month
    localforage.clear().then(() => {
        alert('App has been reset for a new month.');
    }).catch(err => {
        console.error('Error resetting app:', err);
    });
}