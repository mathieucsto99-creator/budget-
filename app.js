const AppState = {
    monthlyBudget: 0,
    weeklyBudget: 0,
    transactions: []
};

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();

    const dateInput = document.getElementById('expenseDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = getLocalDateString(new Date());
    }

    updateUI();
    checkNotificationPermission();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .catch(error => console.warn('Service Worker non enregistré :', error));
    }
});

function loadFromStorage() {
    const saved = localStorage.getItem('budgetApp');

    if (!saved) return;

    try {
        const data = JSON.parse(saved);
        AppState.monthlyBudget = Number(data.monthlyBudget) || 0;
        AppState.weeklyBudget = Number(data.weeklyBudget) || 0;
        AppState.transactions = Array.isArray(data.transactions)
            ? data.transactions
            : [];

        // Compatibilité avec les transactions créées avant cette mise à jour.
        AppState.transactions = AppState.transactions.map(transaction => ({
            ...transaction,
            date: transaction.date || getLocalDateString(new Date(transaction.timestamp)),
            frequency: transaction.frequency || 'one-time'
        }));
    } catch (error) {
        console.warn('Impossible de charger les données :', error);
    }
}

function saveToStorage() {
    localStorage.setItem('budgetApp', JSON.stringify(AppState));
}

function saveBudget() {
    const monthlyInput = document.getElementById('monthlyBudget');
    const monthlyAmount = Number.parseFloat(monthlyInput.value);

    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
        alert('Veuillez entrer un budget mensuel valide.');
        return;
    }

    AppState.monthlyBudget = monthlyAmount;
    AppState.weeklyBudget = monthlyAmount / 4.33;

    saveToStorage();
    updateUI();

    alert(
        `Budget enregistré.\n\n` +
        `Mensuel : ${formatMoney(AppState.monthlyBudget)}\n` +
        `Hebdomadaire estimé : ${formatMoney(AppState.weeklyBudget)}`
    );
}

function addManualExpense() {
    const amount = Number.parseFloat(
        document.getElementById('expenseAmount').value
    );

    const merchant = document.getElementById('expenseMerchant').value.trim()
        || 'Dépense sans nom';

    const date = document.getElementById('expenseDate').value;
    const frequency = document.getElementById('expenseFrequency').value;
    const category = document.getElementById('expenseCategory').value;

    if (!Number.isFinite(amount) || amount <= 0) {
        alert('Veuillez entrer un montant valide.');
        return;
    }

    if (!date) {
        alert('Veuillez sélectionner une date.');
        return;
    }

    const transaction = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        amount,
        merchant,
        category,
        date,
        frequency,
        timestamp: new Date().toISOString(),
        source: 'manual'
    };

    AppState.transactions.unshift(transaction);
    saveToStorage();
    updateUI();

    const frequencyText = getFrequencyLabel(frequency);
    alert(
        `Dépense ajoutée.\n\n` +
        `${merchant} : ${formatMoney(amount)}\n` +
        `Date : ${formatDateOnly(date)}\n` +
        `Fréquence : ${frequencyText}`
    );

    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseMerchant').value = '';
    document.getElementById('expenseDate').value = getLocalDateString(new Date());

    checkBudgetAlerts();
}

function updateUI() {
    const now = new Date();
    const monthlySpent = getPeriodSpent(
        getStartOfMonth(now),
        getEndOfMonth(now)
    );

    const weeklySpent = getPeriodSpent(
        getStartOfWeek(now),
        getEndOfWeek(now)
    );

    document.getElementById('monthlyTotal').textContent =
        formatMoney(AppState.monthlyBudget);
    document.getElementById('weeklyTotal').textContent =
        formatMoney(AppState.weeklyBudget);

    document.getElementById('monthlySpent').textContent =
        formatMoney(monthlySpent);
    document.getElementById('weeklySpent').textContent =
        formatMoney(weeklySpent);

    const monthlyPercent = calculatePercent(monthlySpent, AppState.monthlyBudget);
    const weeklyPercent = calculatePercent(weeklySpent, AppState.weeklyBudget);

    document.getElementById('monthlyPercent').textContent = `${monthlyPercent}%`;
    document.getElementById('weeklyPercent').textContent = `${weeklyPercent}%`;

    updateProgressBar('monthly', monthlyPercent);
    updateProgressBar('weekly', weeklyPercent);

    updateRemaining(
        'monthlyRemaining',
        AppState.monthlyBudget - monthlySpent
    );

    updateRemaining(
        'weeklyRemaining',
        AppState.weeklyBudget - weeklySpent
    );

    renderTransactions();
    renderCategoryStats();
}

function getPeriodSpent(periodStart, periodEnd) {
    return AppState.transactions.reduce((total, transaction) => {
        const occurrences = getOccurrencesInPeriod(
            transaction,
            periodStart,
            periodEnd
        );

        return total + (transaction.amount * occurrences);
    }, 0);
}

function getOccurrencesInPeriod(transaction, periodStart, periodEnd) {
    const start = dateFromInput(transaction.date);

    if (!start || start > periodEnd) {
        return 0;
    }

    if (transaction.frequency === 'one-time') {
        return start >= periodStart && start <= periodEnd ? 1 : 0;
    }

    if (transaction.frequency === 'weekly') {
        return countWeeklyOccurrences(start, periodStart, periodEnd);
    }

    if (transaction.frequency === 'monthly') {
        return countMonthlyOccurrences(start, periodStart, periodEnd);
    }

    return 0;
}

function countWeeklyOccurrences(startDate, periodStart, periodEnd) {
    let occurrence = new Date(startDate);
    occurrence.setHours(0, 0, 0, 0);

    while (occurrence < periodStart) {
        occurrence.setDate(occurrence.getDate() + 7);
    }

    let count = 0;

    while (occurrence <= periodEnd) {
        count += 1;
        occurrence.setDate(occurrence.getDate() + 7);
    }

    return count;
}

function countMonthlyOccurrences(startDate, periodStart, periodEnd) {
    let year = startDate.getFullYear();
    let month = startDate.getMonth();
    const targetDay = startDate.getDate();

    let occurrence = buildMonthlyOccurrence(year, month, targetDay);

    while (occurrence < periodStart) {
        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        occurrence = buildMonthlyOccurrence(year, month, targetDay);
    }

    let count = 0;

    while (occurrence <= periodEnd) {
        if (occurrence >= startDate) {
            count += 1;
        }

        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        occurrence = buildMonthlyOccurrence(year, month, targetDay);
    }

    return count;
}

function buildMonthlyOccurrence(year, month, day) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay), 12, 0, 0, 0);
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');

    if (AppState.transactions.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune transaction pour le moment</p>';
        return;
    }

    const sortedTransactions = [...AppState.transactions].sort((a, b) =>
        dateFromInput(b.date) - dateFromInput(a.date)
    );

    container.innerHTML = sortedTransactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-merchant">
                    ${escapeHtml(transaction.merchant)}
                </div>
                <div class="transaction-meta">
                    ${formatDateOnly(transaction.date)}
                    • ${getCategoryIcon(transaction.category)}
                    ${getCategoryLabel(transaction.category)}
                    • ${getFrequencyLabel(transaction.frequency)}
                </div>
            </div>
            <div class="transaction-amount">
                -${formatMoney(transaction.amount)}
            </div>
        </div>
    `).join('');
}

function renderCategoryStats() {
    const container = document.getElementById('categoryStats');
    const now = new Date();

    const categoryTotals = {};

    AppState.transactions.forEach(transaction => {
        const occurrences = getOccurrencesInPeriod(
            transaction,
            getStartOfMonth(now),
            getEndOfMonth(now)
        );

        if (occurrences <= 0) return;

        const category = transaction.category || 'other';
        categoryTotals[category] =
            (categoryTotals[category] || 0) +
            transaction.amount * occurrences;
    });

    const totalSpent = Object.values(categoryTotals)
        .reduce((total, amount) => total + amount, 0);

    if (totalSpent <= 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune dépense pour le mois actuel</p>';
        return;
    }

    const categories = Object.entries(categoryTotals)
        .sort(([, amountA], [, amountB]) => amountB - amountA);

    container.innerHTML = categories.map(([category, amount]) => {
        const percent = Math.round((amount / totalSpent) * 100);

        return `
            <div class="category-stat">
                <div class="icon">${getCategoryIcon(category)}</div>
                <div class="name">${getCategoryLabel(category)}</div>
                <div class="amount">${formatMoney(amount)}</div>
                <div class="percent">${percent}% du mois</div>
            </div>
        `;
    }).join('');
}

function clearTransactions() {
    if (!confirm('Voulez-vous vraiment effacer toutes les dépenses ?')) {
        return;
    }

    AppState.transactions = [];
    saveToStorage();
    updateUI();
}

function updateProgressBar(type, percent) {
    const progressElement = document.getElementById(`${type}Progress`);
    progressElement.style.width = `${Math.min(percent, 100)}%`;
    progressElement.className = 'progress-fill';

    if (percent >= 80) {
        progressElement.classList.add('danger');
    } else if (percent >= 50) {
        progressElement.classList.add('warning');
    }
}

function updateRemaining(elementId, amount) {
    const element = document.getElementById(elementId);
    element.textContent = `Reste : ${formatMoney(amount)}`;
    element.className = amount < 0 ? 'remaining negative' : 'remaining';
}

function checkBudgetAlerts() {
    if (!window.NotificationManager) return;

    const now = new Date();
    const monthlySpent = getPeriodSpent(
        getStartOfMonth(now),
        getEndOfMonth(now)
    );

    const weeklySpent = getPeriodSpent(
        getStartOfWeek(now),
        getEndOfWeek(now)
    );

    const monthlyPercent = calculatePercent(monthlySpent, AppState.monthlyBudget);
    const weeklyPercent = calculatePercent(weeklySpent, AppState.weeklyBudget);

    if (monthlyPercent >= 50) {
        NotificationManager.showBudgetAlert(
            'mensuel',
            monthlyPercent,
            monthlySpent,
            AppState.monthlyBudget
        );
    }

    if (weeklyPercent >= 50) {
        NotificationManager.showBudgetAlert(
            'hebdomadaire',
            weeklyPercent,
            weeklySpent,
            AppState.weeklyBudget
        );
    }
}

async function requestNotificationPermission() {
    if (!window.NotificationManager) return;

    const granted = await NotificationManager.requestPermission();

    if (granted) {
        document.getElementById('permissionsSection').style.display = 'none';
    }
}

function checkNotificationPermission() {
    if (
        window.NotificationManager &&
        NotificationManager.checkPermission() === 'granted'
    ) {
        document.getElementById('permissionsSection').style.display = 'none';
    }
}

function calculatePercent(spent, total) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.min(Math.round((spent / total) * 100), 100);
}

function dateFromInput(dateString) {
    if (!dateString) return null;

    const [year, month, day] = dateString.split('-').map(Number);

    if (!year || !month || !day) return null;

    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getStartOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getEndOfMonth(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
    );
}

function getStartOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
    const daysSinceMonday = (day + 6) % 7;

    result.setDate(result.getDate() - daysSinceMonday);
    result.setHours(0, 0, 0, 0);

    return result;
}

function getEndOfWeek(date) {
    const result = getStartOfWeek(date);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);

    return result;
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

function formatDateOnly(dateString) {
    const date = dateFromInput(dateString);

    if (!date) return 'Date inconnue';

    return new Intl.DateTimeFormat('fr-CA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function getFrequencyLabel(frequency) {
    const labels = {
        'one-time': 'Unique',
        weekly: 'Hebdomadaire',
        monthly: 'Mensuelle'
    };

    return labels[frequency] || 'Unique';
}

function getCategoryIcon(category) {
    const icons = {
        groceries: '🥬',
        food: '🍔',
        transport: '🚗',
        shopping: '🛒',
        entertainment: '🎬',
        bills: '📄',
        health: '💊',
        other: '📦'
    };

    return icons[category] || '📦';
}

function getCategoryLabel(category) {
    const labels = {
        groceries: 'Épicerie',
        food: 'Restaurants et repas',
        transport: 'Transport',
        shopping: 'Achats',
        entertainment: 'Divertissement',
        bills: 'Factures et logement',
        health: 'Santé',
        other: 'Autre'
    };

    return labels[category] || 'Autre';
}

function escapeHtml(text) {
    const element = document.createElement('div');
    element.textContent = text || '';
    return element.innerHTML;
}
