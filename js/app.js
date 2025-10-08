// Main Application Logic
class PairingManagerApp {
    constructor() {
        this.currentPairings = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadParticipantsTable();
        this.updateParticipantCount();
        this.updateExclusionSelect();
        appStorage.updateLastSavedDisplay();
    }

    setupEventListeners() {
        // Participant form submission
        document.getElementById('participantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveParticipant();
        });

        // Tab change events
        document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (event) => {
                const target = event.target.getAttribute('href');
                this.onTabChange(target);
            });
        });
    }

    onTabChange(tabId) {
        switch (tabId) {
            case '#history':
                this.loadHistory();
                break;
            case '#pairing':
                this.updateExclusionSelect();
                break;
        }
    }

    // Participant management
    saveParticipant() {
        const participantId = document.getElementById('participantForm').dataset.editingId;
        
        const participantData = {
            name: document.getElementById('participantName').value.trim(),
            email: document.getElementById('participantEmail').value.trim(),
            location: document.getElementById('participantLocation').value.trim(),
            category: document.getElementById('participantCategory').value,
            exclusions: Array.from(document.getElementById('exclusionSelect').selectedOptions)
                           .map(option => option.value)
        };

        if (!participantData.name) {
            this.showAlert('Please enter a name', 'warning');
            return;
        }

        if (participantId) {
            participantData.id = participantId;
        }

        if (appStorage.saveParticipant(participantData)) {
            this.showAlert('Participant saved successfully!', 'success');
            this.loadParticipantsTable();
            this.clearParticipantForm();
            this.updateExclusionSelect();
        } else {
            this.showAlert('Error saving participant', 'danger');
        }
    }

    editParticipant(participantId) {
        const participant = appStorage.getParticipants().find(p => p.id === participantId);
        if (!participant) return;

        document.getElementById('participantName').value = participant.name;
        document.getElementById('participantEmail').value = participant.email || '';
        document.getElementById('participantLocation').value = participant.location || '';
        document.getElementById('participantCategory').value = participant.category;
        
        // Set editing mode
        document.getElementById('participantForm').dataset.editingId = participantId;
        document.querySelector('#participantForm button[type="submit"]').textContent = 'Update Participant';

        // Select exclusions
        const exclusionSelect = document.getElementById('exclusionSelect');
        Array.from(exclusionSelect.options).forEach(option => {
            option.selected = participant.exclusions && participant.exclusions.includes(option.value);
        });

        // Scroll to form
        document.getElementById('participantForm').scrollIntoView({ behavior: 'smooth' });
    }

    deleteParticipant(participantId) {
        if (confirm('Are you sure you want to delete this participant?')) {
            if (appStorage.deleteParticipant(participantId)) {
                this.showAlert('Participant deleted successfully!', 'success');
                this.loadParticipantsTable();
                this.updateExclusionSelect();
            } else {
                this.showAlert('Error deleting participant', 'danger');
            }
        }
    }

    loadParticipantsTable() {
        const participants = appStorage.getParticipants();
        const tbody = document.querySelector('#participantsTable tbody');
        
        tbody.innerHTML = participants.map(participant => `
            <tr>
                <td>${this.escapeHtml(participant.name)}</td>
                <td>${this.escapeHtml(participant.email || '')}</td>
                <td>${this.escapeHtml(participant.location || '')}</td>
                <td><span class="badge bg-secondary">${participant.category}</span></td>
                <td>
                    ${participant.exclusions && participant.exclusions.length > 0 ? 
                      participant.exclusions.map(id => {
                          const excluded = participants.find(p => p.id === id);
                          return excluded ? `<span class="badge bg-warning">${this.escapeHtml(excluded.name)}</span>` : '';
                      }).join(' ') : 
                      '<span class="text-muted">None</span>'}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="app.editParticipant('${participant.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="app.deleteParticipant('${participant.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.updateParticipantCount();
    }

    updateExclusionSelect() {
        const participants = appStorage.getParticipants();
        const exclusionSelect = document.getElementById('exclusionSelect');
        const currentEditingId = document.getElementById('participantForm').dataset.editingId;
        
        exclusionSelect.innerHTML = participants
            .filter(p => !currentEditingId || p.id !== currentEditingId)
            .map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`)
            .join('');
    }

    updateParticipantCount() {
        const count = appStorage.getParticipants().length;
        document.getElementById('participantCount').textContent = `${count} participant${count !== 1 ? 's' : ''}`;
    }

    // Pairing functionality
    generatePairings() {
        const participants = appStorage.getParticipants();
        const history = appStorage.getPairingHistory();
        const locationPreference = document.getElementById('locationPreference').value;
        const respectExclusions = document.getElementById('respectExclusions').checked;

        if (participants.length < 2) {
            this.showAlert('Need at least 2 participants to generate pairings', 'warning');
            return;
        }

        const algorithm = new PairingAlgorithm(participants, history);
        const result = algorithm.generatePairings(locationPreference, respectExclusions);
        
        this.currentPairings = result.pairings;
        this.displayPairings(result.pairings, result.warnings);
        
        // Show pairing actions
        document.getElementById('pairingActions').style.display = 'block';
    }

    displayPairings(pairings, warnings) {
        const resultsDiv = document.getElementById('pairingResults');
        const sessionName = document.getElementById('sessionName').value || 'Pairing Session';
        
        let html = `
            <h5>${this.escapeHtml(sessionName)}</h5>
            <div class="mb-3">Generated on ${new Date().toLocaleDateString()}</div>
            <div class="list-group">
        `;

        pairings.forEach((pairing, index) => {
            if (pairing.coachee === 'UNPAIRED') {
                html += `
                    <div class="list-group-item pairing-item unpaired">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${index + 1}. Unpaired:</strong> ${this.escapeHtml(pairing.coach.name)}
                            </div>
                            <span class="badge bg-danger">Unpaired</span>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="list-group-item pairing-item">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <strong>${index + 1}. ${this.escapeHtml(pairing.coach.name)}</strong> 
                                <i class="fas fa-arrow-right mx-2 text-muted"></i>
                                <strong>${this.escapeHtml(pairing.coachee.name)}</strong>
                                <br>
                                <small class="text-muted">
                                    <i class="fas fa-map-marker-alt"></i> 
                                    ${this.escapeHtml(pairing.coach.location || 'No location')} → 
                                    ${this.escapeHtml(pairing.coachee.location || 'No location')}
                                </small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-primary">Coach</span>
                                <span class="badge bg-success">Coachee</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        html += `</div>`;

        if (warnings && warnings.length > 0) {
            html += `
                <div class="alert alert-warning mt-3">
                    <h6><i class="fas fa-exclamation-triangle"></i> Notes:</h6>
                    <ul class="mb-0">
                        ${warnings.map(warning => `<li>${this.escapeHtml(warning)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        resultsDiv.innerHTML = html;
    }

    savePairings() {
        const sessionName = document.getElementById('sessionName').value || 'Pairing Session';
        const locationPreference = document.getElementById('locationPreference').value;
        
        const sessionData = {
            name: sessionName,
            pairings: this.currentPairings,
            locationPreference: locationPreference,
            participantCount: appStorage.getParticipants().length
        };

        if (appStorage.savePairingSession(sessionData)) {
            this.showAlert('Pairings saved to history!', 'success');
            this.loadHistory();
        } else {
            this.showAlert('Error saving pairings', 'danger');
        }
    }

    // History management
    loadHistory() {
        const history = appStorage.getPairingHistory();
        const historyContent = document.getElementById('historyContent');
        
        if (history.length === 0) {
            historyContent.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-history fa-3x mb-3"></i>
                    <p>No pairing history yet.<br>Generate and save pairings to see them here.</p>
                </div>
            `;
            return;
        }

        historyContent.innerHTML = history.map(session => `
            <div class="history-session">
                <div class="history-session-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">${this.escapeHtml(session.name)}</h6>
                        <small class="text-muted">${new Date(session.createdAt).toLocaleDateString()}</small>
                    </div>
                    <small class="text-muted">
                        ${session.pairings.filter(p => p.coachee !== 'UNPAIRED').length} pairs | 
                        Location: ${session.locationPreference}
                    </small>
                </div>
                <div class="history-pairings">
                    ${session.pairings.map((pairing, index) => `
                        <div class="history-pairing">
                            <strong>${index + 1}.</strong> 
                            ${this.escapeHtml(pairing.coach.name)} 
                            <i class="fas fa-arrow-right mx-1 text-muted small"></i>
                            ${pairing.coachee === 'UNPAIRED' ? 
                              '<span class="text-danger">UNPAIRED</span>' : 
                              this.escapeHtml(pairing.coachee.name)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all pairing history? This cannot be undone.')) {
            if (appStorage.clearHistory()) {
                this.showAlert('History cleared successfully!', 'success');
                this.loadHistory();
            } else {
                this.showAlert('Error clearing history', 'danger');
            }
        }
    }

    // Export functionality
    exportPairingsCSV() {
        const sessionName = document.getElementById('sessionName').value || 'Pairing Session';
        const date = new Date().toISOString().split('T')[0];
        
        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Pairing Session,Coach Name,Coach Email,Coach Location,Coachee Name,Coachee Email,Coachee Location\n';
        
        this.currentPairings.forEach((pairing, index) => {
            if (pairing.coachee === 'UNPAIRED') {
                csvContent += `${sessionName},"${pairing.coach.name}","${pairing.coach.email || ''}","${pairing.coach.location || ''}",UNPAIRED,,\n`;
            } else {
                csvContent += `${sessionName},"${pairing.coach.name}","${pairing.coach.email || ''}","${pairing.coach.location || ''}","${pairing.coachee.name}","${pairing.coachee.email || ''}","${pairing.coachee.location || ''}"\n`;
            }
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `pairings-${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Utility functions
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 80px; right: 20px; z-index: 1050; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    clearParticipantForm() {
        document.getElementById('participantForm').reset();
        delete document.getElementById('participantForm').dataset.editingId;
        document.querySelector('#participantForm button[type="submit"]').textContent = 'Save Participant';
        document.getElementById('exclusionSelect').selectedIndex = -1;
    }
}

// Global functions for HTML onclick handlers
function clearParticipantForm() {
    app.clearParticipantForm();
}

function generatePairings() {
    app.generatePairings();
}

function savePairings() {
    app.savePairings();
}

function exportPairingsCSV() {
    app.exportPairingsCSV();
}

function clearHistory() {
    app.clearHistory();
}

function importFromCSV() {
    alert('CSV import feature would be implemented here');
}

function exportToCSV() {
    alert('CSV export feature would be implemented here');
}

function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This will delete all participants and history permanently.')) {
        if (appStorage.clearAllData()) {
            app.showAlert('All data cleared successfully!', 'success');
            app.loadParticipantsTable();
            app.loadHistory();
        } else {
            app.showAlert('Error clearing data', 'danger');
        }
    }
}

// Initialize the application when the page loads
let app;
document.addEventListener('DOMContentLoaded', function() {
    app = new PairingManagerApp();
});
