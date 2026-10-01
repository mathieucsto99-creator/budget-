/**
 * Parser intelligent de transactions
 * Détecte automatiquement les montants, merchants et catégories
 */

const TransactionParser = {
    // Patterns pour détecter les montants
    amountPatterns: [
        /(\d+[.,]?\d*)\s*\$?/gi,
        /(\d+[.,]?\d*)\s*CAD/gi,
        /Total[:\s]+(\$?\d+[.,]?\d*)/gi,
        /Montant[:\s]+(\$?\d+[.,]?\d*)/gi,
        /Amount[:\s]+(\$?\d+[.,]?\d*)/gi,
    ],

    // Patterns pour détecter le merchant
    merchantPatterns: [
        /(?:at|to|chez|merchant|store|à|au|aux)\s+([A-Za-z0-9\s&\-']+)(?:\.|\s|$)/gi,
        /Merchant[:\s]+([A-Za-z0-9\s&\-']+)(?:\.|\s|$)/gi,
        /Commerce[:\s]+([A-Za-z0-9\s&\-']+)(?:\.|\s|$)/gi,
        /Paiement à\s+([A-Za-z0-9\s&\-']+)(?:\.|\s|$)/gi,
    ],

    // Mots-clés pour catégoriser automatiquement
    categoryKeywords: {
        food: ['restaurant', 'cafe', 'starbucks', 'mcdonald', 'tim hortons', 'pizza', 'burger', 'subway', 'doordash', 'uber eats', 'skip', 'food', 'resto', 'déjeuner', 'dîner', 'souper'],
        transport: ['uber', 'lyft', 'taxi', 'metro', 'stm', 'exo', 'essence', 'gas', 'parking', 'station', 'shell', 'esso', 'petro', 'chevron'],
        shopping: ['amazon', 'walmart', 'costco', 'target', 'canadian tire', 'best buy', 'decathlon', 'mall', 'magasin', 'boutique', 'shopping'],
        entertainment: ['netflix', 'spotify', 'cinema', 'movie', 'game', 'steam', 'prime video', 'disney', 'crave', 'concert', 'spectacle'],
        bills: ['hydro', 'electricite', 'water', 'gaz', 'internet', 'bell', 'videotron', 'rogers', 'telus', 'facture', 'bill', 'abonnement', 'subscription'],
        health: ['pharmacy', 'pharmacie', 'jean coutu', 'shoppers', 'medical', 'doctor', 'hopital', 'clinique', 'medicine'],
        groceries: ['metro', 'iga', 'sobey', 'provigo', 'maxi', 'super c', 'epicerie', 'grocery', 'food', 'alimentation']
    },

    /**
     * Parse un texte de notification ou SMS
     */
    parse(text) {
        if (!text || typeof text !== 'string') {
            return null;
        }

        const lowerText = text.toLowerCase();
        
        // Extraire le montant
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) {
            return null;
        }

        // Extraire le merchant
        const merchant = this.extractMerchant(text) || 'Transaction inconnue';

        // Catégoriser
        const category = this.categorize(merchant, lowerText);

        // Déterminer si c'est une dépense (et non un crédit)
        const isExpense = this.isExpense(lowerText);
        if (!isExpense) {
            return null;
        }

        return {
            amount,
            merchant,
            category,
            timestamp: new Date(),
            source: 'share'
        };
    },

    /**
     * Extrait le montant d'un texte
     */
    extractAmount(text) {
        for (const pattern of this.amountPatterns) {
            const match = pattern.exec(text);
            if (match) {
                const amountStr = match[1].replace(',', '.');
                const amount = parseFloat(amountStr);
                
                // Vérifier que c'est un montant réaliste
                if (amount > 0 && amount < 100000) {
                    return amount;
                }
            }
        }

        // Pattern de secours : cherche un nombre avec 2 décimales
        const fallbackPattern = /\b(\d+\.\d{2})\b/g;
        const matches = text.match(fallbackPattern);
        if (matches) {
            for (const match of matches) {
                const amount = parseFloat(match);
                if (amount > 0 && amount < 100000) {
                    return amount;
                }
            }
        }

        return null;
    },

    /**
     * Extrait le nom du merchant
     */
    extractMerchant(text) {
        for (const pattern of this.merchantPatterns) {
            const match = pattern.exec(text);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // Chercher des noms propres (majuscules)
        const capitalPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
        const matches = text.match(capitalPattern);
        if (matches && matches.length > 0) {
            // Retourner le premier nom propre qui n'est pas un mot commun
            const commonWords = ['total', 'amount', 'date', 'time', 'payment', 'transaction'];
            for (const match of matches) {
                if (!commonWords.includes(match.toLowerCase())) {
                    return match;
                }
            }
        }

        return null;
    },

    /**
     * Catégorise la transaction
     */
    categorize(merchant, text) {
        const combined = `${merchant} ${text}`.toLowerCase();

        for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
            for (const keyword of keywords) {
                if (combined.includes(keyword)) {
                    return category;
                }
            }
        }

        return 'other';
    },

    /**
     * Vérifie si c'est une dépense (et non un crédit)
     */
    isExpense(text) {
        const expenseKeywords = [
            'paid', 'debit', 'debited', 'spent', 'payment', 'achat', 
            'paiement', 'dépense', 'retrait', 'withdrawal', 'charge'
        ];

        const creditKeywords = [
            'credit', 'deposited', 'received', 'refund', 'remboursement',
            'virement reçu', 'dépôt'
        ];

        for (const keyword of expenseKeywords) {
            if (text.includes(keyword)) {
                return true;
            }
        }

        for (const keyword of creditKeywords) {
            if (text.includes(keyword)) {
                return false;
            }
        }

        // Par défaut, considérer comme dépense
        return true;
    },

    /**
     * Formate un montant en dollars canadiens
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-CA', {
            style: 'currency',
            currency: 'CAD'
        }).format(amount);
    },

    /**
     * Formate une date
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('fr-CA', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }
};

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransactionParser;
}
