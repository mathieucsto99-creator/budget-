/**
 * Application principale de budget automatisé
 */

// État de l'application
const AppState = {
    monthlyBudget: 0,
    weeklyBudget: 0,
    monthlySpent: 0,
    weeklySpent: 0,
    transactions: []
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    updateUI();
    checkNotificationPermission();
    
    // Enregistrer le service worker pour PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker enregistré'));
    }
});

/**
 * Charge les données depuis le localStorage
 */
function loadFromStorage() {
    const saved = localStorage.getItem('budgetApp');
    if (saved) {
        const data = JSON.parse(saved);
        AppState.monthlyBudget = data.monthlyBudget || 0;
        AppState.weeklyBudget = data.weeklyBudget || 0;
        AppState.monthlySpent = data.monthlySpent || 0;
        AppState.weeklySpent = data.weeklySpent || 0;
        AppState.transactions = data.transactions || [];
    }
}

/**
 * Sauvegarde dans le localStorage
 */
function saveToStorage() {
    const data = {
        monthlyBudget: AppState.monthlyBudget,
        weeklyBudget: AppState.weeklyBudget,
        monthlySpent: AppState.monthlySpent,
        weeklySpent: AppState.weeklySpent,
        transactions: AppState.transactions
    };
    localStorage.setItem('budgetApp', JSON.stringify(data));
}

/**
 * Met à jour l'interface utilisateur
 */
function updateUI() {
    // Budgets
    document.getElementById('monthlyTotal').textContent = formatMoney(AppState.monthlyBudget);
    document.getElementById('weeklyTotal').textContent = formatMoney(AppState.weeklyBudget);
    
    // Dépenses
    document.getElementById('monthlySpent').textContent = formatMoney(AppState.monthlySpent);
    document.getElementById('weeklySpent').textContent = formatMoney(AppState.weeklySpent);
    
    // Pourcentages
    const monthlyPercent = calculatePercent(AppState.monthlySpent, AppState.monthlyBudget);
    const weeklyPercent = calculatePercent(AppState.weeklySpent, AppState.weeklyBudget);
    
    document.getElementById('monthlyPercent').textContent = `${monthlyPercent}%`;
    document.getElementById('weeklyPercent').textContent = `${weeklyPercent}%`;
    
    // Barres de progression
    updateProgressBar('monthly', monthlyPercent);
    updateProgressBar('weekly', weeklyPercent);
    
    // Restes
    const monthlyRemaining = AppState.monthlyBudget - AppState.monthlySpent;
    const weeklyRemaining = AppState.weeklyBudget - AppState.weeklySpent;
    
    const monthlyRemainingEl = document.getElementById('monthlyRemaining');
    const weeklyRemainingEl = document.getElementById('weeklyRemaining');
    
    monthlyRemainingEl.textContent = `Reste: ${formatMoney(monthlyRemaining)}`;
    weeklyRemainingEl.textContent = `Reste: ${formatMoney(weeklyRemaining)}`;
    
    monthlyRemainingEl.className = 'remaining' + (monthlyRemaining < 0 ? ' negative' : '');
    weeklyRemainingEl.className = 'remaining' + (weeklyRemaining < 0 ? ' negative' : '');
    
    // Historique
    renderTransactions();
    
    // Statistiques
    renderCategoryStats();
}

/**
 * Met à jour une barre de progression
 */
function updateProgressBar(type, percent) {
    const progressEl = document.getElementById(`${type}Progress`);
    progressEl.style.width = `${Math.min(percent, 100)}%`;
    
    // Changement de couleur selon le pourcentage
    progressEl.className = 'progress-fill';
    if (percent >= 80) {
        progressEl.classList.add('danger');
    } else if (percent >= 50) {
        progressEl.classList.add('warning');
    }
}

/**
 * Sauvegarde le budget
 */
function saveBudget() {
    const monthlyInput = document.getElementById('monthlyBudget');
    const monthlyAmount = parseFloat(monthlyInput.value);
    
    if (!monthlyAmount || monthlyAmount <= 0) {
        alert('Veuillez entrer un budget mensuel valide');
        return;
    }
    
    AppState.monthlyBudget = monthlyAmount;
    AppState.weeklyBudget = calculateWeeklyFromMonthly(monthlyAmount);
    
    // Réinitialiser les dépenses
    AppState.monthlySpent = 0;
    AppState.weeklySpent = 0;
    AppState.transactions = [];
    
    saveToStorage();
    updateUI();
    
    alert(`✅ Budget enregistré !\nMensuel: ${formatMoney(monthlyAmount)}\nHebdomadaire: ${formatMoney(AppState.weeklyBudget)}`);
}

/**
 * Ajoute une dépense manuelle
 */
function addManualExpense() {
    const amountInput = document.getElementById('expenseAmount');
    const merchantInput = document.getElementById('expenseMerchant');
    const categorySelect = document.getElementById('expenseCategory');
    
    const amount = parseFloat(amountInput.value);
    const merchant = merchantInput.value.trim() || 'Dépense manuelle';
    const category = categorySelect.value;
    
    if (!amount || amount <= 0) {
        alert('Veuillez entrer un montant valide');
        return;
    }
    
    addTransaction({
        amount,
        merchant,
        category,
        timestamp: new Date(),
        source: 'manual'
    });
    
    // Reset form
    amountInput.value = '';
    merchantInput.value = '';
}

/**
 * Ajoute une transaction
 */
function addTransaction(transaction) {
    // Ajouter aux transactions
    AppState.transactions.unshift(transaction);
    
    // Mettre à jour les totaux
    AppState.monthlySpent += transaction.amount;
    AppState.weeklySpent += transaction.amount;
    
    // Sauvegarder
    saveToStorage();
    
    // Mettre à jour l'UI
    updateUI();
    
    // Notifications
    NotificationManager.showTransactionAlert(transaction.amount, transaction.merchant);
    
    // Vérifier les alertes de budget
    checkBudgetAlerts();
}

/**
 * Vérifie les alertes de budget
 */
function checkBudgetAlerts() {
    const monthlyPercent = calculatePercent(AppState.monthlySpent, AppState.monthlyBudget);
    const weeklyPercent = calculatePercent(AppState.weeklySpent, AppState.weeklyBudget);
    
    if (monthlyPercent >= 50) {
        NotificationManager.showBudgetAlert('mensuel', monthlyPercent, AppState.monthlySpent, AppState.monthlyBudget);
    }
    
    if (weeklyPercent >= 50) {
        NotificationManager.showBudgetAlert('hebdomadaire', weeklyPercent, AppState.weeklySpent, AppState.weeklyBudget);
    }
}

/**
 * Partage un paiement (Web Share API)
 */
async function sharePayment() {
    if (!navigator.share) {
        alert('Votre navigateur ne supporte pas le partage Web. Utilisez Chrome ou Samsung Internet.');
        return;
    }
    
    try {
        const shareData = {
            title: 'Partager un paiement',
            text: 'Partagez votre reçu de paiement (Google Pay, Samsung Pay, PayPal, etc.)',
            url: window.location.href
        };
        
        await navigator.share(shareData);
        
        // Après le partage, l'utilisateur peut coller le texte du reçu
        const receivedText = prompt('Collez le texte de votre reçu de paiement:');
        
        if (receivedText) {
            const transaction = TransactionParser.parse(receivedText);
            
            if (transaction) {
                const confirmed = confirm(
                    `Transaction détectée :\n` +
                    `Merchant: ${transaction.merchant}\n` +
                    `Montant: ${formatMoney(transaction.amount)}\n` +
                    `Catégorie: ${transaction.category}\n\n` +
                    `Confirmer ?`
                );
                
                if (confirmed) {
                    addTransaction(transaction);
                }
            } else {
                alert('Aucune transaction détectée dans ce texte. Veuillez vérifier le format.');
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Erreur de partage:', error);
            alert('Erreur lors du partage: ' + error.message);
        }
    }
}

/**
 * Demande la permission pour les notifications
 */
async function requestNotificationPermission() {
    const granted = await NotificationManager.requestPermission();
    
    if (granted) {
        document.getElementById('permissionsSection').style.display = 'none';
    }
}

/**
 * Vérifie la permission des notifications
 */
function checkNotificationPermission() {
    const permission = NotificationManager.checkPermission();
    
    if (permission === 'granted') {
        document.getElementById('permissionsSection').style.display = 'none';
    }
}

/**
 * Affiche l'historique des transactions
 */
function renderTransactions() {
    const container = document.getElementById('transactionsList');
    
    if (AppState.transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune transaction pour le moment</p>';
        return;
    }
    
    container.innerHTML = AppState.transactions.map(t => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-merchant">${escapeHtml(t.merchant)}</div>
                <div class="transaction-meta">
                    ${formatDate(t.timestamp)} • ${getCategoryIcon(t.category)} ${t.category}
                </div>
            </div>
            <div class="transaction-amount">-${formatMoney(t.amount)}</div>
        </div>
    `).join('');
}

/**
 * Affiche les statistiques par catégorie
 */
function renderCategoryStats() {
    const container = document.getElementById('categoryStats');
    
    // Calculer les totaux par catégorie
    const categoryTotals = {};
    
    AppState.transactions.forEach(t => {
        if (!categoryTotals[t.category]) {
            categoryTotals[t.category] = 0;
        }
        categoryTotals[t.category] += t.amount;
    });
    
    // Calculer le total général
    const totalSpent = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    
    if (totalSpent === 0) {
        container.innerHTML = '<p class="empty-state">Aucune donnée statistique</p>';
        return;
    }
    
    // Trier par montant décroissant
    const sortedCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1]);
    
    container.innerHTML = sortedCategories.map(([category, amount]) => {
        const percent = Math.round((amount / totalSpent) * 100);
        return `
            <div class="category-stat">
                <div class="icon">${getCategoryIcon(category)}</div>
                <div class="name">${category}</div>
                <div class="amount">${formatMoney(amount)}</div>
                <div class="percent">${percent}%</div>
            </div>
        `;
    }).join('');
}

/**
 * Efface l'historique
 */
function clearTransactions() {
    if (confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
        AppState.transactions = [];
        AppState.monthlySpent = 0;
        AppState.weeklySpent = 0;
        saveToStorage();
        updateUI();
    }
}

// Utilitaires

function calculateWeeklyFromMonthly(monthly) {
    return monthly / 4.33;
}

function calculatePercent(spent, total) {
    if (total <= 0) return 0;
    return Math.min(Math.round((spent / total) * 100), 100);
}

function formatMoney(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('fr-CA', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

function getCategoryIcon(category) {
    const icons = {
        food: '🍔',
        transport: '🚗',
        shopping: '🛒',
        entertainment: '🎬',
        bills: '📄',
        health: '💊',
        groceries: '🥬',
        other: '📦'
    };
    return icons[category] || '📦';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Gestion du partage Web (quand l'app est ouverte via share)
window.addEventListener('share_target', async (event) => {
    const files = event.data.getAll('text');
    const text = await files[0].text();
    
    const transaction = TransactionParser.parse(text);
    if (transaction) {
        addTransaction(transaction);
    }
});
