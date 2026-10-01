/**
 * Gestion des notifications push du navigateur
 */

const NotificationManager = {
    permission: 'default',

    /**
     * Demande la permission pour les notifications
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            alert('Votre navigateur ne supporte pas les notifications');
            return false;
        }

        try {
            this.permission = await Notification.requestPermission();
            
            if (this.permission === 'granted') {
                this.show('✅ Notifications activées !', {
                    body: 'Vous recevrez des alertes pour votre budget',
                    icon: '💰'
                });
                return true;
            } else {
                console.log('Permission refusée');
                return false;
            }
        } catch (error) {
            console.error('Erreur notification:', error);
            return false;
        }
    },

    /**
     * Affiche une notification
     */
    show(title, options = {}) {
        if (this.permission !== 'granted') {
            console.log('Permission non accordée');
            return;
        }

        const defaultOptions = {
            body: '',
            icon: '💰',
            badge: '💰',
            vibrate: [200, 100, 200],
            tag: 'budget-app',
            requireInteraction: false
        };

        const mergedOptions = { ...defaultOptions, ...options };

        try {
            const notification = new Notification(title, mergedOptions);
            
            // Auto-close après 5 secondes
            setTimeout(() => notification.close(), 5000);

            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            console.error('Erreur affichage notification:', error);
        }
    },

    /**
     * Alerte de budget
     */
    showBudgetAlert(type, percent, spent, total) {
        let title, body, urgency;

        if (percent >= 100) {
            title = '⚠️ Budget DÉPASSÉ !';
            body = `Votre budget ${type} est dépassé ! (${this.formatMoney(spent)} / ${this.formatMoney(total)})`;
            urgency = 'high';
        } else if (percent >= 80) {
            title = '⚠️ Attention budget';
            body = `Vous avez utilisé ${percent}% de votre budget ${type}`;
            urgency = 'medium';
        } else if (percent >= 50) {
            title = '💡 Point budget';
            body = `Vous avez utilisé ${percent}% de votre budget ${type}`;
            urgency = 'low';
        } else {
            return; // Pas d'alerte nécessaire
        }

        this.show(title, {
            body,
            tag: `budget-${type}-${urgency}`,
            requireInteraction: percent >= 80
        });
    },

    /**
     * Alerte de transaction détectée
     */
    showTransactionAlert(amount, merchant) {
        this.show('💳 Transaction détectée', {
            body: `${merchant}: ${this.formatMoney(amount)}`,
            tag: 'transaction-alert'
        });
    },

    /**
     * Formate un montant
     */
    formatMoney(amount) {
        return new Intl.NumberFormat('fr-CA', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    },

    /**
     * Vérifie le statut des permissions
     */
    checkPermission() {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
