// Data Storage Management - Uses browser's local storage
class DataStorage {
    constructor() {
        this.storageKey = 'hoveyTechPairingData';
        this.defaultData = {
            participants: [],
            pairingsHistory: [],
            settings: {
                locationPreference: 'Ignore',
                lastSaved: new Date().toISOString()
            }
        };
        this.loadData();
    }

    // Load data from localStorage
    loadData() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                this.data = { ...this.defaultData, ...parsedData };
            } else {
                this.data = this.defaultData;
                this.saveData();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.data = this.defaultData;
            this.saveData();
        }
        return this.data;
    }

    // Save data to localStorage
    saveData() {
        try {
            this.data.settings.lastSaved = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            this.updateLastSavedDisplay();
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    // Update the "last saved" display
    updateLastSavedDisplay() {
        const lastSavedElement = document.getElementById('lastSaved');
        if (lastSavedElement) {
            const now = new Date();
            lastSavedElement.textContent = `Last saved: ${now.toLocaleTimeString()}`;
        }
    }

    // Participant management
    getParticipants() {
        return this.data.participants;
    }

    saveParticipant(participantData) {
        if (participantData.id) {
            // Update existing participant
            const index = this.data.participants.findIndex(p => p.id === participantData.id);
            if (index !== -1) {
                this.data.participants[index] = participantData;
            }
        } else {
            // Add new participant
            participantData.id = this.generateId();
            participantData.createdAt = new Date().toISOString();
            this.data.participants.push(participantData);
        }
        participantData.updatedAt = new Date().toISOString();
        return this.saveData();
    }

    deleteParticipant(participantId) {
        this.data.participants = this.data.participants.filter(p => p.id !== participantId);
        return this.saveData();
    }

    // Pairing history management
    getPairingHistory() {
        return this.data.pairingsHistory;
    }

    savePairingSession(sessionData) {
        sessionData.id = this.generateId();
        sessionData.createdAt = new Date().toISOString();
        this.data.pairingsHistory.unshift(sessionData);
        return this.saveData();
    }

    clearHistory() {
        this.data.pairingsHistory = [];
        return this.saveData();
    }

    // Settings management
    getSettings() {
        return this.data.settings;
    }

    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings };
        return this.saveData();
    }

    // Utility functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Export data as JSON
    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    // Import data from JSON
    importData(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            this.data = { ...this.defaultData, ...importedData };
            return this.saveData();
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Clear all data
    clearAllData() {
        this.data = this.defaultData;
        return this.saveData();
    }
}

// Initialize storage
const appStorage = new DataStorage();
