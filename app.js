const STORAGE_KEY = 'budgetApp';

const AppState = {
    payments: [],
    incomes: [],
    plannedExpenses: [],
    debts: [],
    calendarDate: firstDayOfMonth(new Date())
};

document.addEventListener('DOMContentLoaded', function () {
    loadDataSafely();
    setTodayInDateInputs();
    refreshApp();
});

function loadDataSafely() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return;
    }

    try {
        const data = JSON.parse(saved);

        AppState.payments = Array.isArray(data.payments)
            ? data.payments.map(normalizePayment)
            : Array.isArray(data.transactions)
                ? data.transactions.map(normalizePayment)
                : [];

        AppState.incomes = Array.isArray(data.incomes)
            ? data.incomes.map(normalizeIncome)
            : [];

        AppState.plannedExpenses = Array.isArray(data.plannedExpenses)
            ? data.plannedExpenses.map(normalizePlannedExpense)
            : [];

        AppState.debts = Array.isArray(data.debts)
            ? data.debts.map(normalizeDebt)
            : [];
    } catch (error) {
        console.error('Impossible de lire les données sauvegardées.', error);
        alert(
            'Les données sauvegardées sont illisibles. Elles ne seront pas remplacées automatiquement.'
        );
    }
}

function saveData() {
    const data = {
        payments: AppState.payments,
        incomes: AppState.incomes,
        plannedExpenses: AppState.plannedExpenses,
        debts: AppState.debts
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizePayment(item) {
    return {
        id: String(item.id || createId()),
        amount: positiveNumber(item.amount),
        merchant: item.merchant || item.name || 'Paiement sans nom',
        category: item.category || 'other',
        date: validDateString(item.date),
        frequency: validFrequency(item.frequency),
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizeIncome(item) {
    return {
        id: String(item.id || createId()),
        amount: positiveNumber(item.amount),
        merchant: item.merchant || item.name || 'Revenu sans nom',
        category: 'income',
        date: validDateString(item.date),
        frequency: validFrequency(item.frequency),
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizePlannedExpense(item) {
    const savings = Array.isArray(item.savings)
        ? item.savings.map(function (saving) {
            return {
                id: String(saving.id || createId()),
                amount: positiveNumber(saving.amount),
                date: validDateString(saving.date),
                timestamp: saving.timestamp || new Date().toISOString()
            };
        })
        : [];

    return {
        id: String(item.id || createId()),
        amount: positiveNumber(item.amount),
        merchant: item.merchant || item.name || 'Dépense prévue',
        category: item.category || 'other',
        date: validDateString(item.date),
        frequency: 'one-time',
        savings: savings,
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizeDebt(item) {
    return {
        id: String(item.id || createId()),
        name: item.name || 'Dette sans nom',
        totalAmount: positiveNumber(item.totalAmount),
        paymentAmount: positiveNumber(item.paymentAmount),
        paymentDate: validDateString(item.paymentDate),
        frequency: validDebtFrequency(item.frequency),
        completedPayments: item.completedPayments || {},
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function setTodayInDateInputs() {
    const today = localDateString(new Date());

    setInputDateIfEmpty('incomeDate', today);
    setInputDateIfEmpty('expenseDate', today);
    setInputDateIfEmpty('plannedDate', today);
    setInputDateIfEmpty('debtPaymentDate', today);
}

function setInputDateIfEmpty(id, value) {
    const input = document.getElementById(id);

    if (input && !input.value) {
        input.value = value;
    }
}

function addIncome() {
    const amount = getNumber('incomeAmount');
    const merchant = getText('incomeName') || 'Revenu sans nom';
    const date = getText('incomeDate');
    const frequency = validFrequency(getText('incomeFrequency'));

    if (!isPositive(amount) || !date) {
        alert('Veuillez remplir un montant de revenu et une date valide.');
        return;
    }

    AppState.incomes.unshift({
        id: createId(),
        amount: amount,
        merchant: merchant,
        category: 'income',
        date: date,
        frequency: frequency,
        timestamp: new Date().toISOString()
    });

    AppState.calendarDate = firstDayOfMonth(dateFromString(date));

    saveData();
    refreshApp();

    clearInput('incomeAmount');
    clearInput('incomeName');
}

function addPayment() {
    const amount = getNumber('expenseAmount');
    const merchant = getText('expenseMerchant') || 'Paiement sans nom';
    const date = getText('expenseDate');
    const frequency = validFrequency(getText('expenseFrequency'));
    const category = getText('expenseCategory');

    if (!isPositive(amount) || !date) {
        alert('Veuillez remplir un montant de paiement et une date valide.');
        return;
    }

    AppState.payments.unshift({
        id: createId(),
        amount: amount,
        merchant: merchant,
        category: category,
        date: date,
        frequency: frequency,
        timestamp: new Date().toISOString()
    });

    AppState.calendarDate = firstDayOfMonth(dateFromString(date));

    saveData();
    refreshApp();

    clearInput('expenseAmount');
    clearInput('expenseMerchant');
}

function addPlannedExpense() {
    const amount = getNumber('plannedAmount');
    const merchant = getText('plannedName') || 'Dépense prévue';
    const date = getText('plannedDate');
    const category = getText('plannedCategory');

    if (!isPositive(amount) || !date) {
        alert('Veuillez remplir un montant prévu et une date valide.');
        return;
    }

    AppState.plannedExpenses.unshift({
        id: createId(),
        amount: amount,
        merchant: merchant,
        category: category,
        date: date,
        frequency: 'one-time',
        savings: [],
        timestamp: new Date().toISOString()
    });

    AppState.calendarDate = firstDayOfMonth(dateFromString(date));

    saveData();
    refreshApp();

    clearInput('plannedAmount');
    clearInput('plannedName');
}

function addSavingToPlannedExpense(plannedId) {
    const item = AppState.plannedExpenses.find(function (planned) {
        return planned.id === plannedId;
    });

    if (!item) {
        alert('Dépense prévue introuvable.');
        return;
    }

    const saved = totalSavings(item);
    const remaining = Math.max(0, item.amount - saved);

    if (remaining <= 0) {
        alert('Cet objectif est déjà financé à 100 %.');
        return;
    }

    const answer = prompt(
        'Montant à mettre de côté pour « ' + item.merchant + ' » :\n\n' +
        'Objectif : ' + money(item.amount) + '\n' +
        'Déjà réservé : ' + money(saved) + '\n' +
        'Reste : ' + money(remaining)
    );

    if (answer === null) {
        return;
    }

    const amount = Number.parseFloat(String(answer).replace(',', '.'));

    if (!isPositive(amount)) {
        alert('Veuillez entrer un montant valide.');
        return;
    }

    item.savings.unshift({
        id: createId(),
        amount: Math.min(amount, remaining),
        date: localDateString(new Date()),
        timestamp: new Date().toISOString()
    });

    saveData();
    refreshApp();
}

function deleteSaving(plannedId, savingId) {
    const item = AppState.plannedExpenses.find(function (planned) {
        return planned.id === plannedId;
    });

    if (!item || !Array.isArray(item.savings)) {
        return;
    }

    if (!confirm('Supprimer cette mise de côté ?')) {
        return;
    }

    item.savings = item.savings.filter(function (saving) {
        return saving.id !== savingId;
    });

    saveData();
    refreshApp();
}

function addDebt() {
    const name = getText('debtName') || 'Dette sans nom';
    const totalAmount = getNumber('debtTotal');
    const paymentAmount = getNumber('debtPaymentAmount');
    const paymentDate = getText('debtPaymentDate');
    const frequency = validDebtFrequency(getText('debtFrequency'));

    if (
        !isPositive(totalAmount) ||
        !isPositive(paymentAmount) ||
        !paymentDate
    ) {
        alert('Veuillez remplir le total dû, le montant de paiement et la date.');
        return;
    }

    AppState.debts.unshift({
        id: createId(),
        name: name,
        totalAmount: totalAmount,
        paymentAmount: paymentAmount,
        paymentDate: paymentDate,
        frequency: frequency,
        completedPayments: {},
        timestamp: new Date().toISOString()
    });

    AppState.calendarDate = firstDayOfMonth(dateFromString(paymentDate));

    saveData();
    refreshApp();

    clearInput('debtName');
    clearInput('debtTotal');
    clearInput('debtPaymentAmount');
}

function toggleDebtPayment(debtId, dateKey, checked) {
    const debt = AppState.debts.find(function (item) {
        return item.id === debtId;
    });

    if (!debt) {
        return;
    }

    debt.completedPayments[dateKey] = checked;

    saveData();
    refreshApp();
}

function deleteIncome(id) {
    deleteItem('incomes', id, 'Supprimer ce revenu ?');
}

function deletePayment(id) {
    deleteItem('payments', id, 'Supprimer ce paiement ?');
}

function deletePlannedExpense(id) {
    deleteItem(
        'plannedExpenses',
        id,
        'Supprimer cette dépense prévue et ses mises de côté ?'
    );
}

function deleteDebt(id) {
    deleteItem('debts', id, 'Supprimer cette dette ?');
}

function deleteItem(listName, id, message) {
    if (!confirm(message)) {
        return;
    }

    AppState[listName] = AppState[listName].filter(function (item) {
        return item.id !== id;
    });

    saveData();
    refreshApp();
}

function clearAllPayments() {
    if (!confirm('Voulez-vous vraiment effacer tous les paiements ?')) {
        return;
    }

    AppState.payments = [];
    saveData();
    refreshApp();
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

function refreshApp() {
    renderFinancialSummary();
    renderCalendar();
    renderIncomes();
    renderPayments();
    renderPlannedExpenses();
    renderDebts();
    renderCategoryStats();
}

function renderFinancialSummary() {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const monthlyIncome = amountForPeriod(
        AppState.incomes,
        monthStart,
        monthEnd
    );

    const weeklyIncome = amountForPeriod(
        AppState.incomes,
        weekStart,
        weekEnd
    );

    const monthlyExpenses =
        amountForPeriod(AppState.payments, monthStart, monthEnd) +
        amountForPeriod(AppState.plannedExpenses, monthStart, monthEnd) +
        confirmedDebtAmount(monthStart, monthEnd);

    const weeklyExpenses =
        amountForPeriod(AppState.payments, weekStart, weekEnd) +
        amountForPeriod(AppState.plannedExpenses, weekStart, weekEnd) +
        confirmedDebtAmount(weekStart, weekEnd);

    setText('monthlyIncome', money(monthlyIncome));
    setText('weeklyIncome', money(weeklyIncome));
    setText('monthlySpent', money(monthlyExpenses));
    setText('weeklySpent', money(weeklyExpenses));
    setText('monthlyBalance', money(monthlyIncome - monthlyExpenses));
    setText('weeklyBalance', money(weeklyIncome - weeklyExpenses));

    setText(
        'monthlyIncomeCount',
        occurrenceCount(AppState.incomes, monthStart, monthEnd) + ' paie(s)'
    );

    setText(
        'weeklyIncomeCount',
        occurrenceCount(AppState.incomes, weekStart, weekEnd) + ' paie(s)'
    );

    setText(
        'monthlyPercent',
        percent(monthlyExpenses, monthlyIncome) + '% des revenus'
    );

    setText(
        'weeklyPercent',
        percent(weeklyExpenses, weeklyIncome) + '% des revenus'
    );
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    const summary = document.getElementById('calendarSummary');

    if (!grid || !title || !summary) {
        return;
    }

    const year = AppState.calendarDate.getFullYear();
    const month = AppState.calendarDate.getMonth();
    const start = new Date(year, month, 1, 12, 0, 0);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    title.textContent = monthTitle(start);

    const incomeByDate = occurrencesByDate(AppState.incomes, year, month, 'income');
    const paymentByDate = occurrencesByDate(AppState.payments, year, month, 'payment');
    const plannedByDate = occurrencesByDate(AppState.plannedExpenses, year, month, 'planned');
    const debtByDate = debtOccurrencesByDate(year, month);

    const incomeTotal = sumItems(Object.values(incomeByDate).flat());
    const expenseTotal =
        sumItems(Object.values(paymentByDate).flat()) +
        sumItems(Object.values(plannedByDate).flat()) +
        sumItems(Object.values(debtByDate).flat());

    summary.textContent =
        'Revenus : ' + money(incomeTotal) +
        ' • Dépenses : ' + money(expenseTotal) +
        ' • Solde : ' + money(incomeTotal - expenseTotal);

    const cells = [];
    const startWeekday = mondayWeekday(start);

    for (let i = 0; i < startWeekday; i += 1) {
        cells.push('<div class="calendar-day empty-day"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const key = dateKey(year, month, day);

        const items = []
            .concat(incomeByDate[key] || [])
            .concat(paymentByDate[key] || [])
            .concat(plannedByDate[key] || [])
            .concat(debtByDate[key] || []);

        const visible = items.slice(0, 3);
        const hidden = items.length - visible.length;

        const content = visible.map(renderCalendarItem).join('');

        const more = hidden > 0
            ? '<div class="calendar-more">+' + hidden + ' autre(s)</div>'
            : '';

        cells.push(
            '<div class="calendar-day">' +
                '<div class="calendar-day-number">' + day + '</div>' +
                content +
                more +
            '</div>'
        );
    }

    const missing = cells.length % 7 === 0
        ? 0
        : 7 - (cells.length % 7);

    for (let i = 0; i < missing; i += 1) {
        cells.push('<div class="calendar-day empty-day"></div>');
    }

    grid.innerHTML = cells.join('');
}

function renderCalendarItem(item) {
    const prefix = item.type === 'income' ? '+' : '-';
    const className = item.type;

    let checkbox = '';

    if (item.type === 'debt') {
        checkbox =
            '<label class="debt-check">' +
                '<input type="checkbox" ' +
                    (item.completed ? 'checked ' : '') +
                    'onchange="toggleDebtPayment(\'' +
                    escapeAttribute(item.debtId) +
                    '\', \'' +
                    escapeAttribute(item.dateKey) +
                    '\', this.checked)">' +
                'payé' +
            '</label>';
    }

    return (
        '<div class="calendar-item ' + className + '">' +
            '<strong>' + escapeHtml(item.name) + '</strong>' +
            '<span>' + prefix + money(item.amount) + '</span>' +
            checkbox +
        '</div>'
    );
}

function renderIncomes() {
    const container = document.getElementById('incomesList');

    if (AppState.incomes.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucun revenu.</p>';
        return;
    }

    container.innerHTML = AppState.incomes.map(function (item) {
        return simpleListItem(
            item,
            'income',
            'deleteIncome',
            '+' + money(item.amount)
        );
    }).join('');
}

function renderPayments() {
    const container = document.getElementById('paymentsList');

    if (AppState.payments.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucun paiement.</p>';
        return;
    }

    container.innerHTML = AppState.payments.map(function (item) {
        return simpleListItem(
            item,
            'payment',
            'deletePayment',
            '-' + money(item.amount)
        );
    }).join('');
}

function simpleListItem(item, type, deleteFunction, amount) {
    return (
        '<div class="list-item">' +
            '<div>' +
                '<strong>' + escapeHtml(item.merchant) + '</strong>' +
                '<small>' +
                    escapeHtml(dateLabel(item.date)) +
                    ' • ' +
                    escapeHtml(frequencyName(item.frequency)) +
                '</small>' +
            '</div>' +
            '<div class="list-actions">' +
                '<span class="' + type + '-amount">' + amount + '</span>' +
                '<button onclick="' + deleteFunction + '(\'' +
                    escapeAttribute(item.id) +
                    '\')">Supprimer</button>' +
            '</div>' +
        '</div>'
    );
}

function renderPlannedExpenses() {
    const container = document.getElementById('plannedList');

    if (AppState.plannedExpenses.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune dépense prévue.</p>';
        return;
    }

    container.innerHTML = AppState.plannedExpenses.map(function (item) {
        const saved = totalSavings(item);
        const remaining = Math.max(0, item.amount - saved);
        const progress = item.amount > 0
            ? Math.min(Math.round((saved / item.amount) * 100), 100)
            : 0;

        const savings = item.savings.length === 0
            ? '<p class="empty-saving">Aucune mise de côté.</p>'
            : item.savings.map(function (saving) {
                return (
                    '<div class="saving-row">' +
                        '<span>' + dateLabel(saving.date) +
                            ' : +' + money(saving.amount) +
                        '</span>' +
                        '<button onclick="deleteSaving(\'' +
                            escapeAttribute(item.id) +
                            '\', \'' +
                            escapeAttribute(saving.id) +
                            '\')">Retirer</button>' +
                    '</div>'
                );
            }).join('');

        return (
            '<div class="planned-card">' +
                '<div class="planned-header">' +
                    '<div>' +
                        '<strong>' + escapeHtml(item.merchant) + '</strong>' +
                        '<small>' + dateLabel(item.date) + '</small>' +
                    '</div>' +
                    '<button onclick="deletePlannedExpense(\'' +
                        escapeAttribute(item.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
                '<div class="planned-values">' +
                    '<span>Objectif : <b>' + money(item.amount) + '</b></span>' +
                    '<span>Réservé : <b class="green">' + money(saved) + '</b></span>' +
                    '<span>Reste : <b>' + money(remaining) + '</b></span>' +
                '</div>' +
                '<div class="saving-bar"><div style="width:' +
                    progress +
                    '%"></div></div>' +
                '<p class="saving-status">' +
                    (progress >= 100
                        ? '✅ Objectif financé'
                        : progress + '% réservé') +
                '</p>' +
                '<button class="saving-button" onclick="addSavingToPlannedExpense(\'' +
                    escapeAttribute(item.id) +
                    '\')">💰 Ajouter une mise de côté</button>' +
                '<details>' +
                    '<summary>Voir les mises de côté</summary>' +
                    savings +
                '</details>' +
            '</div>'
        );
    }).join('');
}

function renderDebts() {
    const container = document.getElementById('debtsList');

    if (AppState.debts.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune dette.</p>';
        return;
    }

    container.innerHTML = AppState.debts.map(function (debt) {
        const paid = paidDebtAmount(debt);
        const
