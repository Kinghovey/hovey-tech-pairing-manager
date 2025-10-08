// Pairing Algorithm Implementation
class PairingAlgorithm {
    constructor(participants, history) {
        this.participants = participants;
        this.history = history;
        this.pairingStats = this.calculatePairingStats();
    }

    // Calculate statistics about previous pairings
    calculatePairingStats() {
        const stats = {
            pairCounts: new Map(),
            lastPairingDate: new Map(),
            roleHistory: new Map()
        };

        this.history.forEach(session => {
            session.pairings.forEach(pairing => {
                if (pairing.coachee && pairing.coachee !== 'UNPAIRED') {
                    const pairKey = this.getPairKey(pairing.coach.id, pairing.coachee.id);
                    
                    // Update pair count
                    stats.pairCounts.set(pairKey, (stats.pairCounts.get(pairKey) || 0) + 1);
                    
                    // Update last pairing date
                    const sessionDate = new Date(session.createdAt);
                    const currentDate = stats.lastPairingDate.get(pairKey);
                    if (!currentDate || sessionDate > currentDate) {
                        stats.lastPairingDate.set(pairKey, sessionDate);
                    }
                    
                    // Update role history
                    this.updateRoleHistory(stats.roleHistory, pairing.coach.id, pairing.coachee.id, 'coach');
                    this.updateRoleHistory(stats.roleHistory, pairing.coachee.id, pairing.coach.id, 'coachee');
                }
            });
        });

        return stats;
    }

    getPairKey(id1, id2) {
        return [id1, id2].sort().join('_');
    }

    updateRoleHistory(roleHistory, personId, partnerId, role) {
        if (!roleHistory.has(personId)) {
            roleHistory.set(personId, new Map());
        }
        const personHistory = roleHistory.get(personId);
        if (!personHistory.has(partnerId)) {
            personHistory.set(partnerId, new Set());
        }
        personHistory.get(partnerId).add(role);
    }

    // Main pairing function
    generatePairings(locationPreference = 'Ignore', respectExclusions = true) {
        if (this.participants.length < 2) {
            return { pairings: [], warnings: ['Need at least 2 participants to generate pairings'] };
        }

        const available = [...this.participants];
        const pairings = [];
        const warnings = [];

        // Separate participants by category
        const coachesOnly = available.filter(p => p.category === 'Coach Only');
        const coacheesOnly = available.filter(p => p.category === 'Coachee Only');
        const both = available.filter(p => p.category === 'Both');

        // Phase 1: Pair restricted participants
        this.pairRestrictedParticipants(coachesOnly, coacheesOnly, both, pairings, available, respectExclusions, warnings);

        // Phase 2: Pair remaining participants
        this.pairRemainingParticipants(available, pairings, locationPreference, respectExclusions, warnings);

        return { pairings, warnings };
    }

    pairRestrictedParticipants(coachesOnly, coacheesOnly, both, pairings, available, respectExclusions, warnings) {
        // Pair Coach Only with Coachee Only first
        for (let i = coachesOnly.length - 1; i >= 0; i--) {
            const coach = coachesOnly[i];
            let bestCoachee = null;
            let bestScore = -Infinity;

            // Find best coachee match
            for (let j = coacheesOnly.length - 1; j >= 0; j--) {
                const coachee = coacheesOnly[j];
                if (respectExclusions && this.isExcluded(coach, coachee)) continue;
                
                const score = this.calculatePairingScore(coach, coachee, 'Different');
                if (score > bestScore) {
                    bestScore = score;
                    bestCoachee = coachee;
                }
            }

            if (bestCoachee) {
                pairings.push({ coach, coachee: bestCoachee });
                this.removeFromArray(available, coach);
                this.removeFromArray(available, bestCoachee);
                coachesOnly.splice(i, 1);
                coacheesOnly.splice(coacheesOnly.indexOf(bestCoachee), 1);
            } else if (coacheesOnly.length === 0) {
                warnings.push(`No available coachees for coach-only participant: ${coach.name}`);
            }
        }

        // Handle remaining restricted participants with "Both" category
        // Similar logic for coacheesOnly would go here...
    }

    pairRemainingParticipants(available, pairings, locationPreference, respectExclusions, warnings) {
        while (available.length >= 2) {
            let bestPair = null;
            let bestScore = -Infinity;

            // Find the best available pair
            for (let i = 0; i < available.length; i++) {
                for (let j = i + 1; j < available.length; j++) {
                    const person1 = available[i];
                    const person2 = available[j];
                    
                    if (respectExclusions && this.isExcluded(person1, person2)) continue;
                    
                    const score = this.calculatePairingScore(person1, person2, locationPreference);
                    if (score > bestScore) {
                        bestScore = score;
                        bestPair = { person1, person2, score };
                    }
                }
            }

            if (bestPair) {
                const { person1, person2 } = bestPair;
                const coach = this.determineCoach(person1, person2);
                const coachee = coach === person1 ? person2 : person1;
                
                pairings.push({ coach, coachee });
                this.removeFromArray(available, person1);
                this.removeFromArray(available, person2);
            } else {
                // No valid pairs found
                break;
            }
        }

        // Handle any remaining unpaired participants
        if (available.length === 1) {
            pairings.push({ coach: available[0], coachee: 'UNPAIRED' });
            warnings.push(`${available[0].name} could not be paired and will work alone`);
        } else if (available.length > 1) {
            warnings.push(`${available.length} participants could not be paired due to restrictions`);
        }
    }

    calculatePairingScore(person1, person2, locationPreference) {
        let score = 0;
        const pairKey = this.getPairKey(person1.id, person2.id);

        // Prefer pairs that have never been paired before
        const pairCount = this.pairingStats.pairCounts.get(pairKey) || 0;
        score -= pairCount * 100;

        // Location preference scoring
        if (locationPreference !== 'Ignore' && person1.location && person2.location) {
            if (locationPreference === 'Same' && person1.location === person2.location) {
                score += 50;
            } else if (locationPreference === 'Different' && person1.location !== person2.location) {
                score += 50;
            }
        }

        // Prefer role reversal for previous pairs
        if (this.shouldReverseRoles(person1, person2)) {
            score += 25;
        }

        // Small random factor to break ties
        score += Math.random() * 10;

        return score;
    }

    isExcluded(person1, person2) {
        return (person1.exclusions && person1.exclusions.includes(person2.id)) ||
               (person2.exclusions && person2.exclusions.includes(person1.id));
    }

    shouldReverseRoles(person1, person2) {
        const roleHistory1 = this.pairingStats.roleHistory.get(person1.id);
        const roleHistory2 = this.pairingStats.roleHistory.get(person2.id);

        if (roleHistory1 && roleHistory1.has(person2.id)) {
            return roleHistory1.get(person2.id).has('coachee');
        }
        if (roleHistory2 && roleHistory2.has(person1.id)) {
            return roleHistory2.get(person1.id).has('coachee');
        }
        return false;
    }

    determineCoach(person1, person2) {
        // If one is Coach Only and other is Coachee Only, it's clear
        if (person1.category === 'Coach Only' && person2.category !== 'Coach Only') return person1;
        if (person2.category === 'Coach Only' && person1.category !== 'Coach Only') return person2;
        if (person1.category === 'Coachee Only' && person2.category !== 'Coachee Only') return person2;
        if (person2.category === 'Coachee Only' && person1.category !== 'Coachee Only') return person1;

        // Try to reverse roles from previous pairings
        if (this.shouldReverseRoles(person1, person2)) {
            const roleHistory1 = this.pairingStats.roleHistory.get(person1.id);
            if (roleHistory1 && roleHistory1.has(person2.id) && roleHistory1.get(person2.id).has('coachee')) {
                return person1;
            }
            return person2;
        }

        // Default: person with fewer coaching experiences becomes coach
        const coachCount1 = this.getCoachCount(person1);
        const coachCount2 = this.getCoachCount(person2);
        
        return coachCount1 <= coachCount2 ? person1 : person2;
    }

    getCoachCount(person) {
        const roleHistory = this.pairingStats.roleHistory.get(person.id);
        if (!roleHistory) return 0;
        
        let count = 0;
        for (let roles of roleHistory.values()) {
            if (roles.has('coach')) count++;
        }
        return count;
    }

    removeFromArray(array, item) {
        const index = array.indexOf(item);
        if (index !== -1) {
            array.splice(index, 1);
        }
    }
}
