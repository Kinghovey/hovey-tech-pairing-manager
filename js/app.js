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
                                <span class="badge bg-success">Coachee</span
