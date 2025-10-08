// Enhanced Pairing Manager with 20+ Years History Storage
class PairingHistoryManager {
    constructor() {
        this.history = {};
        this.currentYear = new Date().getFullYear();
        this.init();
    }

    async init() {
        // Load recent history from localStorage
        const recentHistory = localStorage.getItem('pairingHistory');
        if (recentHistory) {
            this.history = JSON.parse(recentHistory);
        }
        
        // Load full history from IndexedDB
        await this.loadFullHistory();
        this.updateDisplay();
    }

    // Save pairing to history
    savePairing(pairs) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const week = this.getWeekNumber(now);
        const dateStr = now.toISOString().split('T')[0];
        
        console.log(`Saving pairing for ${dateStr}, week ${week}, year ${year}`);

        // Initialize year if not exists
        if (!this.history[year]) {
            this.history[year] = {};
        }
        
        // Store by week for organization
        const weekKey = `week-${week}`;
        if (!this.history[year][weekKey]) {
            this.history[year][weekKey] = [];
        }
        
        const entry = {
            date: dateStr,
            timestamp: now.toISOString(),
            pairs: pairs,
            week: week,
            totalPairs: pairs.length
        };
        
        this.history[year][weekKey].push(entry);
        
        // Keep only last 50 entries per week to prevent bloat
        if (this.history[year][weekKey].length > 50) {
            this.history[year][weekKey] = this.history[year][weekKey].slice(-50);
        }
        
        this.saveToStorage();
        this.updateDisplay();
        
        // Show success message
        this.showMessage('Pairing saved to history!', 'success');
    }

    // Get week number
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    // Save to storage
    async saveToStorage() {
        // Save recent history to localStorage (last 2 years)
        const recentHistory = {};
        const currentYear = this.currentYear;
        
        for (let year = currentYear; year >= currentYear - 1; year--) {
            if (this.history[year]) {
                recentHistory[year] = this.history[year];
            }
        }
        
        localStorage.setItem('pairingHistory', JSON.stringify(recentHistory));
        
        // Save full history to IndexedDB
        await this.saveFullHistory();
    }

    // Save full history to IndexedDB
    async saveFullHistory() {
        if (!('indexedDB' in window)) return;
        
        try {
            const db = await this.getDB();
            const transaction = db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            await store.put(this.history, 'fullHistory');
        } catch (error) {
            console.warn('IndexedDB not available:', error);
        }
    }

    // Load full history from IndexedDB
    async loadFullHistory() {
        if (!('indexedDB' in window)) return;
        
        try {
            const db = await this.getDB();
            const transaction = db.transaction(['history'], 'readonly');
            const store = transaction.objectStore('history');
            const request = store.get('fullHistory');
            
            return new Promise((resolve) => {
                request.onsuccess = () => {
                    if (request.result) {
                        // Merge with existing history
                        this.history = this.mergeHistories(this.history, request.result);
                    }
                    resolve(this.history);
                };
                request.onerror = () => {
                    console.warn('Failed to load from IndexedDB');
                    resolve(this.history);
                };
            });
        } catch (error) {
            console.warn('IndexedDB load failed:', error);
            return this.history;
        }
    }

    // Initialize IndexedDB
    getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('PairingHistoryDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('history')) {
                    db.createObjectStore('history');
                }
            };
        });
    }

    // Merge two history objects
    mergeHistories(current, imported) {
        const merged = {...current};
        
        Object.keys(imported).forEach(year => {
            if (!merged[year]) {
                merged[year] = imported[year];
            } else {
                Object.keys(imported[year]).forEach(week => {
                    if (!merged[year][week]) {
                        merged[year][week] = imported[year][week];
                    } else {
                        // Merge and deduplicate entries
                        const combined = [...merged[year][week], ...imported[year][week]];
                        merged[year][week] = this.deduplicateEntries(combined);
                    }
                });
            }
        });
        
        return merged;
    }

    // Remove duplicate entries
    deduplicateEntries(entries) {
        const seen = new Set();
        return entries.filter(entry => {
            const key = `${entry.date}-${JSON.stringify(entry.pairs)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Search history by date range
    searchHistory(startDate, endDate) {
        if (!startDate || !endDate) {
            this.showMessage('Please select both start and end dates', 'error');
            return [];
        }
        
        const results = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Adjust end date to end of day
        end.setHours(23, 59, 59, 999);

        Object.keys(this.history).forEach(year => {
            const yearNum = parseInt(year);
            if (yearNum >= start.getFullYear() && yearNum <= end.getFullYear()) {
                Object.keys(this.history[year]).forEach(week => {
                    this.history[year][week].forEach(entry => {
                        const entryDate = new Date(entry.date);
                        if (entryDate >= start && entryDate <= end) {
                            results.push(entry);
                        }
                    });
                });
            }
        });
        
        return results.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Get all history
    getAllHistory() {
        const results = [];
        
        Object.keys(this.history).sort((a, b) => b - a).forEach(year => {
            Object.keys(this.history[year]).forEach(week => {
                this.history[year][week].forEach(entry => {
                    results.push(entry);
                });
            });
        });
        
        return results.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Get statistics
    getStatistics() {
        const stats = {
            totalPairings: 0,
            years: {},
            mostFrequentPairs: {},
            firstPairing: null,
            lastPairing: null
        };
        
        Object.keys(this.history).sort().forEach(year => {
            let yearCount = 0;
            const pairCounts = {};
            
            Object.keys(this.history[year]).forEach(week => {
                yearCount += this.history[year][week].length;
                
                this.history[year][week].forEach(entry => {
                    // Track first and last pairing
                    if (!stats.firstPairing || new Date(entry.date) < new Date(stats.firstPairing.date)) {
                        stats.firstPairing = entry;
                    }
                    if (!stats.lastPairing || new Date(entry.date) > new Date(stats.lastPairing.date)) {
                        stats.lastPairing = entry;
                    }
                    
                    // Count pairs
                    entry.pairs.forEach(pair => {
                        const pairKey = pair.sort().join(' & ');
                        pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
                    });
                });
            });
            
            stats.years[year] = yearCount;
            stats.totalPairings += yearCount;
            
            // Update overall most frequent pairs
            Object.keys(pairCounts).forEach(pairKey => {
                stats.mostFrequentPairs[pairKey] = 
                    (stats.mostFrequentPairs[pairKey] || 0) + pairCounts[pairKey];
            });
        });
        
        // Sort most frequent pairs
        stats.mostFrequentPairs = Object.entries(stats.mostFrequentPairs)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [key, val]) => {
                obj[key] = val;
                return obj;
            }, {});
            
        return stats;
    }

    // Export history to downloadable file
    exportHistory() {
        const dataStr = JSON.stringify(this.history, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `pairing-history-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showMessage('History exported successfully!', 'success');
    }

    // Import history from file
    async importHistory(file) {
        if (!file) return;
        
        try {
            const text = await this.readFileAsText(file);
            const importedHistory = JSON.parse(text);
            
            this.history = this.mergeHistories(this.history, importedHistory);
            await this.saveToStorage();
            this.updateDisplay();
            
            this.showMessage('History imported successfully!', 'success');
        } catch (error) {
            this.showMessage('Error importing history: ' + error.message, 'error');
        }
    }

    // Read file as text
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    }

    // Clear all history
    async clearHistory() {
        if (confirm('Are you sure you want to clear ALL pairing history? This cannot be undone!')) {
            this.history = {};
            localStorage.removeItem('pairingHistory');
            
            if ('indexedDB' in window) {
                try {
                    const db = await this.getDB();
                    const transaction = db.transaction(['history'], 'readwrite');
                    const store = transaction.objectStore('history');
                    await store.clear();
                } catch (error) {
                    console.warn('Failed to clear IndexedDB:', error);
                }
            }
            
            this.updateDisplay();
            this.showMessage('All history cleared!', 'success');
        }
    }

    // Update the history display
    updateDisplay(entries = null) {
        const historyContainer = document.getElementById('pairingHistory');
        if (!historyContainer) return;
        
        const displayEntries = entries || this.getAllHistory().slice(0, 20); // Show last 20 by default
        
        if (displayEntries.length === 0) {
            historyContainer.innerHTML = '<div class="loading">No pairing history yet. Generate your first pairs to see history here.</div>';
            return;
        }
        
        historyContainer.innerHTML = displayEntries.map(entry => `
            <div class="history-entry">
                <h4>${entry.date} (Week ${entry.week}) - ${entry.totalPairs} pairs</h4>
                <div class="history-pairs">
                    ${entry.pairs.map(pair => `
                        <div class="history-pair">${pair.join(' & ')}</div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    // Show search results
    showSearchResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        const historyContainer = document.getElementById('pairingHistory');
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="error">No pairings found in the selected date range.</div>';
            historyContainer.innerHTML = '';
        } else {
            resultsContainer.innerHTML = `<div class="success">Found ${results.length} pairings in the selected date range.</div>`;
            this.updateDisplay(results);
        }
    }

    // Show statistics
    showStatistics() {
        const stats = this.getStatistics();
        const statsContainer = document.getElementById('pairingStatistics');
        const historyContainer = document.getElementById('pairingHistory');
        
        if (stats.totalPairings === 0) {
            statsContainer.innerHTML = '<div class="error">No statistics available - no pairing history yet.</div>';
            return;
        }
        
        let yearsHtml = '';
        Object.keys(stats.years).sort((a, b) => b - a).forEach(year => {
            yearsHtml += `<div class="stat-card">
                <div class="stat-number">${stats.years[year]}</div>
                <div class="stat-label">Pairings in ${year}</div>
            </div>`;
        });
        
        let frequentPairsHtml = '';
        Object.entries(stats.mostFrequentPairs).forEach(([pair, count]) => {
            frequentPairsHtml += `<div class="frequent-pair">
                <span>${pair}</span>
                <span>${count} times</span>
            </div>`;
        });
        
        statsContainer.innerHTML = `
            <div class="success">Pairing Statistics</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalPairings}</div>
                    <div class="stat-label">Total Pairings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${Object.keys(stats.years).length}</div>
                    <div class="stat-label">Years of Data</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.firstPairing ? stats.firstPairing.date : 'N/A'}</div>
                    <div class="stat-label">First Pairing</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.lastPairing ? stats.lastPairing.date : 'N/A'}</div>
                    <div class="stat-label">Last Pairing</div>
                </div>
            </div>
            
            <h3>Pairings by Year</h3>
            <div class="stats-grid">
                ${yearsHtml}
            </div>
            
            <h3>Most Frequent Pairs</h3>
            <div class="frequent-pairs">
                ${frequentPairsHtml || '<div class="loading">No frequent pairs data yet.</div>'}
            </div>
        `;
        
        historyContainer.innerHTML = '';
    }

    // Show message
    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message-temp');
        existingMessages.forEach(msg => msg.remove());
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-temp ${type}`;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            z-index: 1000;
            font-weight: bold;
            background-color: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        `;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }
}

// Initialize the history manager
const historyManager = new PairingHistoryManager();

// Original pairing functions
function pairProgrammers() {
    const developersText = document.getElementById('developers').value;
    const developers = developersText.split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);

    if (developers.length < 2) {
        alert('Please enter at least 2 developer names.');
        return;
    }

    // Shuffle array
    const shuffled = [...developers].sort(() => Math.random() - 0.5);
    
    // Create pairs
    const pairs = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
            pairs.push([shuffled[i], shuffled[i + 1]]);
        } else {
            // Handle odd number - last person pairs with previous pair or works alone
            if (pairs.length > 0) {
                pairs[pairs.length - 1].push(shuffled[i]);
            } else {
                pairs.push([shuffled[i]]);
            }
        }
    }

    // Display pairs
    const pairsContainer = document.getElementById('pairsContainer');
    pairsContainer.innerHTML = '<h2>Generated Pairs</h2><div class="pairs-container">' +
        pairs.map(pair => `<div class="pair">${pair.join(' & ')}</div>`).join('') +
        '</div>';

    // Save to history
    historyManager.savePairing(pairs);
}

function addRandomPerson() {
    const randomNames = [
        'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Peyton',
        'Quinn', 'Blake', 'Rowan', 'Charlie', 'Emerson', 'Finley', 'Hayden', 'Dakota'
    ];
    
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const textarea = document.getElementById('developers');
    const currentValue = textarea.value.trim();
    
    if (currentValue) {
        textarea.value = currentValue + '\n' + randomName;
    } else {
        textarea.value = randomName;
    }
}

function clearAll() {
    document.getElementById('developers').value = '';
    document.getElementById('pairsContainer').innerHTML = '';
}

// History UI functions
function searchHistory() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        historyManager.showMessage('Please select both start and end dates', 'error');
        return;
    }
    
    const results = historyManager.searchHistory(startDate, endDate);
    historyManager.showSearchResults(results);
}

function showAllHistory() {
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('pairingStatistics').innerHTML = '';
    historyManager.updateDisplay();
}

function showStatistics() {
    document.getElementById('searchResults').innerHTML = '';
    historyManager.showStatistics();
}

function exportHistory() {
    historyManager.exportHistory();
}

function importHistory(file) {
    historyManager.importHistory(file);
}

function clearHistory() {
    historyManager.clearHistory();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set default dates for search (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    
    // Load initial history display
    setTimeout(() => {
        historyManager.updateDisplay();
    }, 100);
});
