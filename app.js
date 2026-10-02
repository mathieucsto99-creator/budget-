const AppState = {
    monthlyBudget: 0,
    weeklyBudget: 0,
    transactions: [],
    calendarDate: getFirstDayOfMonth(new Date())
};

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();

    const monthlyBudgetInput = document.getElementById('monthlyBudget');
    const expenseDateInput = document.getElementById('expenseDate');

    if (monthlyBudgetInput) {
        monthlyBudgetInput.value = AppState.monthlyBudget || '';
    }

    if (expenseDateInput && !expenseDateInput.value) {
        expenseDateInput.value = getLocalDateString(new Date());
    }

    updateUI();
    checkNotificationPermission();
    registerServiceWorker();
});

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.register('sw.js')
        .catch(error => {
            console.warn('Le Service Worker n’a pas été enregistré :', error);
        });
}

function loadFromStorage() {
    const savedData = localStorage.getItem('budgetApp');

    if (!savedData) {
        return;
    }

    try {
        const data = JSON.parse(savedData);

        AppState.monthlyBudget = Number(data.monthlyBudget) || 0;
        AppState.weeklyBudget = Number(data.weeklyBudget) || 0;
        AppState.transactions = Array.isArray(data.transactions)
            ? data.transactions
            : [];

        AppState.transactions = AppState.transactions.map(transaction => {
            return {
                id: transaction.id || createId(),
                amount: Number(transaction.amount) || 0,
                merchant: transaction.merchant || 'Dépense sans nom',
                category: transaction.category || 'other',
                date: transaction.date || getLocalDateString(
                    new Date(transaction.timestamp || new Date())
                ),
                frequency: transaction.frequency || 'one-time',
                timestamp: transaction.timestamp || new Date().toISOString(),
                source: transaction.source || 'manual'
            };
        });
    } catch (error) {
        console.warn('Les données enregistrées ne peuvent pas être lues :', error);

        AppState.monthlyBudget = 0;
        AppState.weeklyBudget = 0;
        AppState.transactions = [];
    }
}

function saveToStorage() {
    localStorage.setItem('budgetApp', JSON.stringify(AppState));
}

function saveBudget() {
    const budgetInput = document.getElementById('monthlyBudget');
    const monthlyAmount = Number.parseFloat(budgetInput.value);

    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
        alert('Veuillez entrer un budget mensuel valide.');
        return;
    }

    AppState.monthlyBudget = monthlyAmount;
    AppState.weeklyBudget = monthlyAmount / 4.33;

    saveToStorage();
    updateUI();

    alert(
        'Budget enregistré.\n\n' +
        'Budget mensuel : ' + formatMoney(AppState.monthlyBudget) + '\n' +
        'Budget hebdomadaire estimé : ' + formatMoney(AppState.weeklyBudget)
    );
}

function addManualExpense() {
    const amountInput = document.getElementById('expenseAmount');
    const merchantInput = document.getElementById('expenseMerchant');
    const dateInput = document.getElementById('expenseDate');
    const frequencyInput = document.getElementById('expenseFrequency');
    const categoryInput = document.getElementById('expenseCategory');

    const amount = Number.parseFloat(amountInput.value);
    const merchant = merchantInput.value.trim() || 'Dépense sans nom';
    const date = dateInput.value;
    const frequency = frequencyInput.value;
    const category = categoryInput.value;

    if (!Number.isFinite(amount) || amount <= 0) {
        alert('Veuillez entrer un montant valide.');
        return;
    }

    if (!date) {
        alert('Veuillez sélectionner une date.');
        return;
    }

    const transaction = {
        id: createId(),
        amount: amount,
        merchant: merchant,
        category: category,
        date: date,
        frequency: frequency,
        timestamp: new Date().toISOString(),
        source: 'manual'
    };

    AppState.transactions.unshift(transaction);

    saveToStorage();

    const transactionDate = dateFromInput(date);

    if (
        transactionDate.getFullYear() !== AppState.calendarDate.getFullYear() ||
        transactionDate.getMonth() !== AppState.calendarDate.getMonth()
    ) {
        AppState.calendarDate = getFirstDayOfMonth(transactionDate);
    }

    updateUI();
    checkBudgetAlerts();

    amountInput.value = '';
    merchantInput.value = '';
    dateInput.value = getLocalDateString(new Date());
    frequencyInput.value = 'one-time';
    categoryInput.value = 'groceries';

    alert(
        'Dépense ajoutée.\n\n' +
        merchant + ' : ' + formatMoney(amount) + '\n' +
        'Date : ' + formatDateOnly(date) + '\n' +
        'Fréquence : ' + getFrequencyLabel(frequency)
    );
}

function changeCalendarMonth(direction) {
    AppState.calendarDate = new Date(
        AppState.calendarDate.getFullYear(),
        AppState.calendarDate.getMonth() + direction,
        1,
        12,
        0,
        0,
        0
    );

    renderCalendar();
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

    updateText('monthlyTotal', formatMoney(AppState.monthlyBudget));
    updateText('weeklyTotal', formatMoney(AppState.weeklyBudget));

    updateText('monthlySpent', formatMoney(monthlySpent));
    updateText('weeklySpent', formatMoney(weeklySpent));

    const monthlyPercent = calculatePercent(
        monthlySpent,
        AppState.monthlyBudget
    );

    const weeklyPercent = calculatePercent(
        weeklySpent,
        AppState.weeklyBudget
    );

    updateText('monthlyPercent', monthlyPercent + '%');
    updateText('weeklyPercent', weeklyPercent + '%');

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

    renderCalendar();
    renderTransactions();
    renderCategoryStats();
}

function updateText(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = value;
    }
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarTitle = document.getElementById('calendarTitle');
    const calendarSummary = document.getElementById('calendarSummary');

    if (!calendarGrid || !calendarTitle || !calendarSummary) {
        return;
    }

    const year = AppState.calendarDate.getFullYear();
    const month = AppState.calendarDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0, 0);

    calendarTitle.textContent = new Intl.DateTimeFormat('fr-CA', {
        month: 'long',
        year: 'numeric'
    }).format(firstDayOfMonth);

    const transactionsByDate = getTransactionsForMonth(year, month);

    const monthTotal = Object.values(transactionsByDate)
        .flat()
        .reduce((total, transaction) => total + transaction.amount, 0);

    calendarSummary.textContent =
        formatMoney(monthTotal) + ' planifié ce mois-ci';

    const firstWeekday = getMondayBasedWeekday(firstDayOfMonth);
    const daysInMonth = lastDayOfMonth.getDate();
    const cells = [];

    for (let emptyCell = 0; emptyCell < firstWeekday; emptyCell += 1) {
        cells.push('<div class="calendar-day empty-day" aria-hidden="true"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = getDateKey(year, month, day);
        const scheduledTransactions = transactionsByDate[dateKey] || [];

        const isToday = isSameDate(
            new Date(year, month, day),
            new Date()
        );

        const totalForDay = scheduledTransactions.reduce(
            (total, transaction) => total + transaction.amount,
            0
        );

        const paymentsHtml = scheduledTransactions
            .sort((a, b) => b.amount - a.amount)
            .map(transaction => {
                return `
                    <div class="calendar-payment ${transaction.frequency}">
                        <span class="calendar-payment-name">
                            ${escapeHtml(transaction.merchant)}
                        </span>
                        <span class="calendar-payment-amount">
                            ${formatCompactMoney(transaction.amount)}
                        </span>
                    </div>
                `;
            })
            .join('');

        const dayTotalHtml = scheduledTransactions.length > 0
            ? `<div class="calendar-day-total">${formatCompactMoney(totalForDay)}</div>`
            : '';

        cells.push(`
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-number">${day}</div>
                ${paymentsHtml}
                ${dayTotalHtml}
            </div>
        `);
    }

    const totalCells = cells.length;
    const trailingCells = totalCells % 7 === 0
        ? 0
        : 7 - (totalCells % 7);

    for (let emptyCell = 0; emptyCell < trailingCells; emptyCell += 1) {
        cells.push('<div class="calendar-day empty-day" aria-hidden="true"></div>');
    }

    calendarGrid.innerHTML = cells.join('');
}

function getTransactionsForMonth(year, month) {
    const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0, 0);
    const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const transactionsByDate = {};

    AppState.transactions.forEach(transaction => {
        const occurrences = getOccurrenceDatesInPeriod(
            transaction,
            firstDayOfMonth,
            lastDayOfMonth
        );

        occurrences.forEach(occurrenceDate => {
            const dateKey = getDateKey(
                occurrenceDate.getFullYear(),
                occurrenceDate.getMonth(),
                occurrenceDate.getDate()
            );

            if (!transactionsByDate[dateKey]) {
                transactionsByDate[dateKey] = [];
            }

            transactionsByDate[dateKey].push({
                ...transaction,
                occurrenceDate: occurrenceDate
            });
        });
    });

    return transactionsByDate;
}

function getPeriodSpent(periodStart, periodEnd) {
    return AppState.transactions.reduce((total, transaction) => {
        const occurrences = getOccurrencesInPeriod(
            transaction,
            periodStart,
            periodEnd
        );

        return total + transaction.amount * occurrences;
    }, 0);
}

function getOccurrencesInPeriod(transaction, periodStart, periodEnd) {
    return getOccurrenceDatesInPeriod(
        transaction,
        periodStart,
        periodEnd
    ).length;
}

function getOccurrenceDatesInPeriod(transaction, periodStart, periodEnd) {
    const transactionStartDate = dateFromInput(transaction.date);

    if (!transactionStartDate || transactionStartDate > periodEnd) {
        return [];
    }

    if (transaction.frequency === 'one-time') {
        const isInPeriod =
            transactionStartDate >= periodStart &&
            transactionStartDate <= periodEnd;

        return isInPeriod ? [transactionStartDate] : [];
    }

    if (transaction.frequency === 'weekly') {
        return getWeeklyOccurrenceDates(
            transactionStartDate,
            periodStart,
            periodEnd
        );
    }

    if (transaction.frequency === 'biweekly') {
        return getBiweeklyOccurrenceDates(
            transactionStartDate,
            periodStart,
            periodEnd
        );
    }

    if (transaction.frequency === 'monthly') {
        return getMonthlyOccurrenceDates(
            transactionStartDate,
            periodStart,
            periodEnd
        );
    }

    return [];
}

function getWeeklyOccurrenceDates(startDate, periodStart, periodEnd) {
    const occurrence = new Date(startDate);
    occurrence.setHours(12, 0, 0, 0);

    while (occurrence < periodStart) {
        occurrence.setDate(occurrence.getDate() + 7);
    }

    const occurrences = [];

    while (occurrence <= periodEnd) {
        occurrences.push(new Date(occurrence));
        occurrence.setDate(occurrence.getDate() + 7);
    }

    return occurrences;
}

function getBiweeklyOccurrenceDates(startDate, periodStart, periodEnd) {
    const occurrence = new Date(startDate);
    occurrence.setHours(12, 0, 0, 0);

    while (occurrence < periodStart) {
        occurrence.setDate(occurrence.getDate() + 14);
    }

    const occurrences = [];

    while (occurrence <= periodEnd) {
        occurrences.push(new Date(occurrence));
        occurrence.setDate(occurrence.getDate() + 14);
    }

    return occurrences;
}

function getMonthlyOccurrenceDates(startDate, periodStart, periodEnd) {
    let year = startDate.getFullYear();
    let month = startDate.getMonth();
    const dayOfMonth = startDate.getDate();

    let occurrence = buildMonthlyOccurrence(year, month, dayOfMonth);

    while (occurrence < periodStart) {
        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        occurrence = buildMonthlyOccurrence(year, month, dayOfMonth);
    }

    const occurrences = [];

    while (occurrence <= periodEnd) {
        if (occurrence >= startDate) {
            occurrences.push(new Date(occurrence));
        }

        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        occurrence = buildMonthlyOccurrence(year, month, dayOfMonth);
    }

    return occurrences;
}

function buildMonthlyOccurrence(year, month, dayOfMonth) {
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    return new Date(
        year,
        month,
        Math.min(dayOfMonth, lastDayOfMonth),
        12,
        0,
        0,
        0
    );
}

function renderTransactions() {
    const container = document.getElementById('transactionsList');

    if (!container) {
        return;
    }

    if (AppState.transactions.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune transaction pour le moment.</p>';
        return;
    }

    const sortedTransactions = [...AppState.transactions].sort((a, b) => {
        return dateFromInput(b.date) - dateFromInput(a.date);
    });

    container.innerHTML = sortedTransactions.map(transaction => {
        return `
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
        `;
    }).join('');
}

function renderCategoryStats() {
    const container = document.getElementById('categoryStats');

    if (!container) {
        return;
    }

    const now = new Date();

    const startOfMonth = getStartOfMonth(now);
    const endOfMonth = getEndOfMonth(now);

    const categoryTotals = {};

    AppState.transactions.forEach(transaction => {
        const occurrences = getOccurrencesInPeriod(
            transaction,
            startOfMonth,
            endOfMonth
        );

        if (occurrences <= 0) {
            return;
        }

        const category = transaction.category || 'other';

        if (!categoryTotals[category]) {
            categoryTotals[category] = 0;
        }

        categoryTotals[category] += transaction.amount * occurrences;
    });

    const totalSpent = Object.values(categoryTotals).reduce(
        (total, amount) => total + amount,
        0
    );

    if (totalSpent <= 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune dépense pour le mois actuel.</p>';
        return;
    }

    const sortedCategories = Object.entries(categoryTotals).sort(
        ([, amountA], [, amountB]) => amountB - amountA
    );

    container.innerHTML = sortedCategories.map(([category, amount]) => {
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
    const confirmed = confirm(
        'Voulez-vous vraiment effacer toutes les dépenses enregistrées ?'
    );

    if (!confirmed) {
        return;
    }

    AppState.transactions = [];

    saveToStorage();
    updateUI();
}

function updateProgressBar(type, percent) {
    const progressElement = document.getElementById(type + 'Progress');

    if (!progressElement) {
        return;
    }

    progressElement.style.width = Math.min(percent, 100) + '%';
    progressElement.className = 'progress-fill';

    if (percent >= 80) {
        progressElement.classList.add('danger');
    } else if (percent >= 50) {
        progressElement.classList.add('warning');
    }
}

function updateRemaining(elementId, amount) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = 'Reste : ' + formatMoney(amount);
    element.className = amount < 0
        ? 'remaining negative'
        : 'remaining';
}

function checkBudgetAlerts() {
    if (!window.NotificationManager) {
        return;
    }

    const now = new Date();

    const monthlySpent = getPeriodSpent(
        getStartOfMonth(now),
        getEndOfMonth(now)
    );

    const weeklySpent = getPeriodSpent(
        getStartOfWeek(now),
        getEndOfWeek(now)
    );

    const monthlyPercent = calculatePercent(
        monthlySpent,
        AppState.monthlyBudget
    );

    const weeklyPercent = calculatePercent(
        weeklySpent,
        AppState.weeklyBudget
    );

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
    if (!window.NotificationManager) {
        alert('Les notifications ne sont pas disponibles dans ce navigateur.');
        return;
    }

    const granted = await NotificationManager.requestPermission();

    if (granted) {
        const permissionSection = document.getElementById('permissionsSection');

        if (permissionSection) {
            permissionSection.style.display = 'none';
        }
    }
}

function checkNotificationPermission() {
    if (!window.NotificationManager) {
        return;
    }

    if (NotificationManager.checkPermission() === 'granted') {
        const permissionSection = document.getElementById('permissionsSection');

        if (permissionSection) {
            permissionSection.style.display = 'none';
        }
    }
}

function calculatePercent(spent, total) {
    if (!Number.isFinite(total) || total <= 0) {
        return 0;
    }

    return Math.min(Math.round((spent / total) * 100), 100);
}

function dateFromInput(dateString) {
    if (!dateString) {
        return null;
    }

    const parts = dateString.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    if (!year || !month || !day) {
        return null;
    }

    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getFirstDayOfMonth(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        1,
        12,
        0,
        0,
        0
    );
}

function getStartOfMonth(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        1,
        0,
        0,
        0,
        0
    );
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
    const dayOfWeek = result.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;

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

function getMondayBasedWeekday(date) {
    return (date.getDay() + 6) % 7;
}

function getDateKey(year, month, day) {
    return (
        year + '-' +
        String(month + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0')
    );
}

function getLocalDateString(date) {
    return getDateKey(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function isSameDate(dateA, dateB) {
    return (
        dateA.getFullYear() === dateB.getFullYear() &&
        dateA.getMonth() === dateB.getMonth() &&
        dateA.getDate() === dateB.getDate()
    );
}

function formatMoney(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

function formatCompactMoney(amount) {
    const formatted = new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0
    }).format(amount);

    return formatted.replace(/\s/g, '');
}

function formatDateOnly(dateString) {
    const date = dateFromInput(dateString);

    if (!date) {
        return 'Date inconnue';
    }

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
        biweekly: 'Aux 2 semaines',
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

function createId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return Date.now().toString() + '-' + Math.random().toString(16).slice(2);
}

function escapeHtml(text) {
    const element = document.createElement('div');
    element.textContent = text || '';

    return element.innerHTML;
}
