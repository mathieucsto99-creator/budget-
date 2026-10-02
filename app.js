const AppState = {
    payments: [],
    incomes: [],
    plannedExpenses: [],
    debts: [],
    calendarDate: firstDayOfMonth(new Date())
};

document.addEventListener('DOMContentLoaded', function () {
    loadData();

    const today = localDateString(new Date());

    setInputDate('incomeDate', today);
    setInputDate('expenseDate', today);
    setInputDate('plannedDate', today);
    setInputDate('debtPaymentDate', today);

    refreshApp();
});

function setInputDate(id, date) {
    const input = document.getElementById(id);

    if (input) {
        input.value = date;
    }
}

function loadData() {
    const saved = localStorage.getItem('budgetApp');

    if (!saved) {
        return;
    }

    try {
        const data = JSON.parse(saved);

        const oldPayments = Array.isArray(data.payments)
            ? data.payments
            : Array.isArray(data.transactions)
                ? data.transactions
                : [];

        AppState.payments = oldPayments.map(function (item, index) {
            return normalizeRecurringItem(item, index, 'payment');
        });

        AppState.incomes = Array.isArray(data.incomes)
            ? data.incomes.map(function (item, index) {
                return normalizeRecurringItem(item, index, 'income');
            })
            : [];

        AppState.plannedExpenses = Array.isArray(data.plannedExpenses)
            ? data.plannedExpenses.map(function (item, index) {
                return normalizePlannedExpense(item, index);
            })
            : [];

        AppState.debts = Array.isArray(data.debts)
            ? data.debts.map(function (item, index) {
                return normalizeDebt(item, index);
            })
            : [];

        saveData();
    } catch (error) {
        console.error('Erreur de lecture des données :', error);

        AppState.payments = [];
        AppState.incomes = [];
        AppState.plannedExpenses = [];
        AppState.debts = [];
    }
}

function normalizeRecurringItem(item, index, type) {
    return {
        id: String(
            item.id ||
            type + '-' + Date.now() + '-' + index
        ),
        amount: Number(item.amount) || 0,
        merchant: item.merchant || item.name || (
            type === 'income'
                ? 'Revenu sans nom'
                : 'Paiement sans nom'
        ),
        category: item.category || 'other',
        date: item.date || localDateString(
            new Date(item.timestamp || new Date())
        ),
        frequency: validFrequency(item.frequency),
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizePlannedExpense(item, index) {
    const savings = Array.isArray(item.savings)
        ? item.savings.map(function (saving, savingIndex) {
            return {
                id: String(
                    saving.id ||
                    'saving-' + Date.now() + '-' + index + '-' + savingIndex
                ),
                amount: Number(saving.amount) || 0,
                date: saving.date || localDateString(
                    new Date(saving.timestamp || new Date())
                ),
                timestamp: saving.timestamp || new Date().toISOString()
            };
        })
        : [];

    return {
        id: String(item.id || 'planned-' + Date.now() + '-' + index),
        amount: Number(item.amount) || 0,
        merchant: item.merchant || item.name || 'Dépense prévue',
        category: item.category || 'other',
        date: item.date || localDateString(
            new Date(item.timestamp || new Date())
        ),
        frequency: 'one-time',
        savings: savings,
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizeDebt(item, index) {
    return {
        id: String(item.id || 'debt-' + Date.now() + '-' + index),
        name: item.name || 'Dette sans nom',
        totalAmount: Number(item.totalAmount) || 0,
        paymentAmount: Number(item.paymentAmount) || 0,
        paymentDate: item.paymentDate || localDateString(new Date()),
        frequency: validDebtFrequency(item.frequency),
        completedPayments: item.completedPayments || {},
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function saveData() {
    localStorage.setItem('budgetApp', JSON.stringify({
        payments: AppState.payments,
        incomes: AppState.incomes,
        plannedExpenses: AppState.plannedExpenses,
        debts: AppState.debts
    }));
}

function addIncome() {
    const amount = getNumber('incomeAmount');
    const merchant = getValue('incomeName') || 'Revenu sans nom';
    const date = getValue('incomeDate');
    const frequency = validFrequency(getValue('incomeFrequency'));

    if (!isPositive(amount)) {
        alert('Veuillez entrer un montant de revenu valide.');
        return;
    }

    if (!date) {
        alert('Veuillez choisir une première date de paie.');
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
    setInputDate('incomeDate', localDateString(new Date()));
    setValue('incomeFrequency', 'biweekly');
}

function addPayment() {
    const amount = getNumber('expenseAmount');
    const merchant = getValue('expenseMerchant') || 'Paiement sans nom';
    const date = getValue('expenseDate');
    const frequency = validFrequency(getValue('expenseFrequency'));
    const category = getValue('expenseCategory');

    if (!isPositive(amount)) {
        alert('Veuillez entrer un montant valide.');
        return;
    }

    if (!date) {
        alert('Veuillez choisir une date de départ.');
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
    setInputDate('expenseDate', localDateString(new Date()));
    setValue('expenseFrequency', 'one-time');
    setValue('expenseCategory', 'groceries');
}

function addPlannedExpense() {
    const amount = getNumber('plannedAmount');
    const merchant = getValue('plannedName') || 'Dépense prévue';
    const date = getValue('plannedDate');
    const category = getValue('plannedCategory');

    if (!isPositive(amount)) {
        alert('Veuillez entrer un montant prévu valide.');
        return;
    }

    if (!date) {
        alert('Veuillez choisir une date prévue.');
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
    setInputDate('plannedDate', localDateString(new Date()));
    setValue('plannedCategory', 'other');
}

function addSavingToPlannedExpense(plannedId) {
    const plannedExpense = AppState.plannedExpenses.find(function (item) {
        return String(item.id) === String(plannedId);
    });

    if (!plannedExpense) {
        alert('Dépense prévue introuvable.');
        return;
    }

    const alreadySaved = totalSavings(plannedExpense);
    const remaining = Math.max(0, plannedExpense.amount - alreadySaved);

    if (remaining <= 0) {
        alert('Cette dépense est déjà entièrement financée.');
        return;
    }

    const answer = prompt(
        'Combien voulez-vous mettre de côté pour : ' +
        plannedExpense.merchant +
        ' ?\n\n' +
        'Objectif : ' + money(plannedExpense.amount) +
        '\nDéjà mis de côté : ' + money(alreadySaved) +
        '\nReste à réserver : ' + money(remaining)
    );

    if (answer === null) {
        return;
    }

    const amount = Number.parseFloat(
        String(answer).replace(',', '.')
    );

    if (!isPositive(amount)) {
        alert('Veuillez entrer un montant valide.');
        return;
    }

    if (!plannedExpense.savings) {
        plannedExpense.savings = [];
    }

    plannedExpense.savings.unshift({
        id: createId(),
        amount: Math.min(amount, remaining),
        date: localDateString(new Date()),
        timestamp: new Date().toISOString()
    });

    saveData();
    refreshApp();

    if (amount > remaining) {
        alert(
            'Le montant ajouté a été limité à ' +
            money(remaining) +
            ', car l’objectif est maintenant financé.'
        );
    }
}

function deleteSavingFromPlannedExpense(plannedId, savingId) {
    const plannedExpense = AppState.plannedExpenses.find(function (item) {
        return String(item.id) === String(plannedId);
    });

    if (!plannedExpense || !Array.isArray(plannedExpense.savings)) {
        return;
    }

    if (!confirm('Supprimer cette mise de côté ?')) {
        return;
    }

    plannedExpense.savings = plannedExpense.savings.filter(function (saving) {
        return String(saving.id) !== String(savingId);
    });

    saveData();
    refreshApp();
}

function addDebt() {
    const name = getValue('debtName') || 'Dette sans nom';
    const totalAmount = getNumber('debtTotal');
    const paymentAmount = getNumber('debtPaymentAmount');
    const paymentDate = getValue('debtPaymentDate');
    const frequency = validDebtFrequency(getValue('debtFrequency'));

    if (!isPositive(totalAmount)) {
        alert('Veuillez entrer le montant total dû.');
        return;
    }

    if (!isPositive(paymentAmount)) {
        alert('Veuillez entrer le montant de chaque paiement.');
        return;
    }

    if (!paymentDate) {
        alert('Veuillez choisir la première date de paiement.');
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
    setInputDate('debtPaymentDate', localDateString(new Date()));
    setValue('debtFrequency', 'monthly');
}

function toggleDebtPayment(debtId, paymentDateKey, isChecked) {
    const debt = AppState.debts.find(function (item) {
        return String(item.id) === String(debtId);
    });

    if (!debt) {
        return;
    }

    if (!debt.completedPayments) {
        debt.completedPayments = {};
    }

    debt.completedPayments[paymentDateKey] = isChecked ? true : false;

    saveData();
    refreshApp();
}

function deleteIncome(id) {
    deleteFromList('incomes', id, 'Supprimer ce revenu ?');
}

function deletePayment(id) {
    deleteFromList('payments', id, 'Supprimer ce paiement ?');
}

function deletePlannedExpense(id) {
    deleteFromList(
        'plannedExpenses',
        id,
        'Supprimer cette dépense prévue et tout son suivi d’épargne ?'
    );
}

function deleteDebt(id) {
    deleteFromList('debts', id, 'Supprimer cette dette ?');
}

function deleteFromList(listName, id, message) {
    if (!confirm(message)) {
        return;
    }

    AppState[listName] = AppState[listName].filter(function (item) {
        return String(item.id) !== String(id);
    });

    saveData();
    refreshApp();
}

function clearAllPayments() {
    if (!confirm('Voulez-vous vraiment effacer tous les paiements réguliers ?')) {
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

    refreshApp();
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

    const monthlyIncome = amountInPeriod(
        AppState.incomes,
        monthStart,
        monthEnd
    );

    const weeklyIncome = amountInPeriod(
        AppState.incomes,
        weekStart,
        weekEnd
    );

    const monthlyIncomeCount = occurrenceCountInPeriod(
        AppState.incomes,
        monthStart,
        monthEnd
    );

    const weeklyIncomeCount = occurrenceCountInPeriod(
        AppState.incomes,
        weekStart,
        weekEnd
    );

    const monthlyPaymentSpent =
        amountInPeriod(AppState.payments, monthStart, monthEnd) +
        amountInPeriod(AppState.plannedExpenses, monthStart, monthEnd) +
        confirmedDebtPaymentsInPeriod(monthStart, monthEnd);

    const weeklyPaymentSpent =
        amountInPeriod(AppState.payments, weekStart, weekEnd) +
        amountInPeriod(AppState.plannedExpenses, weekStart, weekEnd) +
        confirmedDebtPaymentsInPeriod(weekStart, weekEnd);

    setText('monthlyIncome', money(monthlyIncome));
    setText('weeklyIncome', money(weeklyIncome));
    setText(
        'monthlyIncomeCount',
        monthlyIncomeCount + (monthlyIncomeCount > 1 ? ' paies' : ' paie')
    );
    setText(
        'weeklyIncomeCount',
        weeklyIncomeCount + (weeklyIncomeCount > 1 ? ' paies' : ' paie')
    );

    setText(
        'monthlyBalance',
        'Solde planifié : ' + money(monthlyIncome - monthlyPaymentSpent)
    );
    setText(
        'weeklyBalance',
        'Solde planifié : ' + money(weeklyIncome - weeklyPaymentSpent)
    );

    setText('monthlySpent', money(monthlyPaymentSpent));
    setText('weeklySpent', money(weeklyPaymentSpent));
    setText('monthlyTotal', money(monthlyIncome));
    setText('weeklyTotal', money(weeklyIncome));

    const monthlyPercent = percent(monthlyPaymentSpent, monthlyIncome);
    const weeklyPercent = percent(weeklyPaymentSpent, weeklyIncome);

    setText('monthlyPercent', monthlyPercent + '%');
    setText('weeklyPercent', weeklyPercent + '%');

    updateBar('monthlyProgress', monthlyPercent);
    updateBar('weeklyProgress', weeklyPercent);

    updateRemaining(
        'monthlyRemaining',
        monthlyIncome - monthlyPaymentSpent
    );

    updateRemaining(
        'weeklyRemaining',
        weeklyIncome - weeklyPaymentSpent
    );
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    const summary = document.getElementById('calendarSummary');

    const year = AppState.calendarDate.getFullYear();
    const month = AppState.calendarDate.getMonth();
    const start = new Date(year, month, 1, 12, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 12, 0, 0, 0);

    title.textContent = monthTitle(start);

    const incomesByDay = itemsForMonth(AppState.incomes, year, month);
    const paymentsByDay = itemsForMonth(AppState.payments, year, month);
    const plannedByDay = itemsForMonth(AppState.plannedExpenses, year, month);
    const debtsByDay = debtItemsForMonth(year, month);

    const incomeTotal = totalByDay(incomesByDay);
    const paymentTotal =
        totalByDay(paymentsByDay) +
        totalByDay(plannedByDay) +
        totalByDay(debtsByDay);

    summary.textContent =
        'Revenus : ' +
        money(incomeTotal) +
        ' • Dépenses : ' +
        money(paymentTotal) +
        ' • Solde : ' +
        money(incomeTotal - paymentTotal);

    const cells = [];
    const firstWeekday = mondayWeekday(start);

    for (let index = 0; index < firstWeekday; index += 1) {
        cells.push('<div class="calendar-day empty-day"></div>');
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
        const key = dateKey(year, month, day);
        const calendarItems = [];

        pushCalendarItems(calendarItems, incomesByDay[key], 'income');
        pushCalendarItems(calendarItems, paymentsByDay[key], 'payment');
        pushCalendarItems(calendarItems, plannedByDay[key], 'planned');
        pushCalendarItems(calendarItems, debtsByDay[key], 'debt');

        calendarItems.sort(function (first, second) {
            const order = {
                income: 1,
                debt: 2,
                planned: 3,
                payment: 4
            };

            if (first.itemType !== second.itemType) {
                return order[first.itemType] - order[second.itemType];
            }

            return second.amount - first.amount;
        });

        const visibleItems = calendarItems.slice(0, 3);
        const hiddenCount = calendarItems.length - visibleItems.length;

        const itemsHtml = visibleItems.map(function (item) {
            return calendarItemHtml(item);
        }).join('');

        const moreHtml = hiddenCount > 0
            ? (
                '<button type="button" class="calendar-more-payments" ' +
                    'onclick="showDayItems(\'' + key + '\')">' +
                    '+ ' + hiddenCount + ' autre' +
                    (hiddenCount > 1 ? 's' : '') +
                '</button>'
            )
            : '';

        const dayIncome = sumByType(calendarItems, 'income');
        const dayExpenses =
            sumByType(calendarItems, 'payment') +
            sumByType(calendarItems, 'planned') +
            sumByType(calendarItems, 'debt');

        const dayTotalHtml = calendarItems.length > 0
            ? (
                '<div class="calendar-day-total">' +
                    'Solde : ' +
                    compactMoney(dayIncome - dayExpenses) +
                '</div>'
            )
            : '';

        const todayClass = sameDate(
            new Date(year, month, day),
            new Date()
        ) ? 'today' : '';

        const itemsClass = calendarItems.length > 0 ? 'has-payments' : '';

        cells.push(
            '<div class="calendar-day ' + todayClass + ' ' + itemsClass + '">' +
                '<div class="calendar-day-number">' + day + '</div>' +
                itemsHtml +
                moreHtml +
                dayTotalHtml +
            '</div>'
        );
    }

    const missingCells = cells.length % 7 === 0
        ? 0
        : 7 - (cells.length % 7);

    for (let index = 0; index < missingCells; index += 1) {
        cells.push('<div class="calendar-day empty-day"></div>');
    }

    grid.innerHTML = cells.join('');
}

function pushCalendarItems(target, items, itemType) {
    (items || []).forEach(function (item) {
        target.push({
            ...item,
            itemType: itemType
        });
    });
}

function calendarItemHtml(item) {
    const className = item.itemType === 'income'
        ? 'income-event'
        : item.itemType === 'planned'
            ? 'planned-event'
            : item.itemType === 'debt'
                ? 'debt-event'
                : item.frequency;

    const deleteFunction = item.itemType === 'income'
        ? 'deleteIncome'
        : item.itemType === 'planned'
            ? 'deletePlannedExpense'
            : item.itemType === 'debt'
                ? 'deleteDebt'
                : 'deletePayment';

    const prefix = item.itemType === 'income' ? '+' : '-';

    const debtCheckbox = item.itemType === 'debt'
        ? (
            '<label class="debt-calendar-check">' +
                '<input type="checkbox" ' +
                    (item.isCompleted ? 'checked ' : '') +
                    'onchange="toggleDebtPayment(\'' +
                    attribute(item.debtId) +
                    '\', \'' +
                    attribute(item.paymentDateKey) +
                    '\', this.checked)">' +
                'Payé' +
            '</label>'
        )
        : '';

    return (
        '<div class="calendar-payment ' + className + '">' +
            '<div class="calendar-payment-top">' +
                '<span class="calendar-payment-name">' +
                    html(item.merchant || item.name) +
                '</span>' +
                '<button type="button" class="calendar-delete-button" ' +
                    'onclick="' + deleteFunction + '(\'' +
                    attribute(item.id) +
                    '\')" title="Supprimer">×</button>' +
            '</div>' +
            '<span class="calendar-payment-amount">' +
                prefix + compactMoney(item.amount) +
            '</span>' +
            debtCheckbox +
        '</div>'
    );
}

function sumByType(items, type) {
    return items
        .filter(function (item) {
            return item.itemType === type;
        })
        .reduce(function (sum, item) {
            return sum + item.amount;
        }, 0);
}

function showDayItems(key) {
    const parts = key.split('-').map(Number);
    const year = parts[0];
    const month = parts[1] - 1;

    const incomes = itemsForMonth(AppState.incomes, year, month)[key] || [];
    const payments = itemsForMonth(AppState.payments, year, month)[key] || [];
    const planned = itemsForMonth(AppState.plannedExpenses, year, month)[key] || [];
    const debts = debtItemsForMonth(year, month)[key] || [];

    const lines = [];

    incomes.forEach(function (item) {
        lines.push('• Revenu : ' + item.merchant + ' — +' + money(item.amount));
    });

    payments.forEach(function (item) {
        lines.push('• Paiement : ' + item.merchant + ' — -' + money(item.amount));
    });

    planned.forEach(function (item) {
        lines.push('• À prévoir : ' + item.merchant + ' — -' + money(item.amount));
    });

    debts.forEach(function (item) {
        lines.push(
            '• Dette : ' +
            item.merchant +
            ' — -' +
            money(item.amount) +
            (item.isCompleted ? ' (effectué)' : ' (non effectué)')
        );
    });

    alert(
        dateLabel(key) +
        '\n\n' +
        lines.join('\n')
    );
}

function renderIncomes() {
    const container = document.getElementById('incomesList');

    if (AppState.incomes.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucun revenu pour le moment.</p>';
        return;
    }

    container.innerHTML = renderGenericHistory(
        AppState.incomes,
        'income',
        'deleteIncome'
    );
}

function renderPayments() {
    const container = document.getElementById('transactionsList');

    if (AppState.payments.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucun paiement pour le moment.</p>';
        return;
    }

    container.innerHTML = renderGenericHistory(
        AppState.payments,
        'payment',
        'deletePayment'
    );
}

function renderPlannedExpenses() {
    const container = document.getElementById('plannedList');

    if (AppState.plannedExpenses.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune dépense prévue pour le moment.</p>';
        return;
    }

    const sorted = [...AppState.plannedExpenses].sort(function (first, second) {
        return dateFromString(first.date) - dateFromString(second.date);
    });

    container.innerHTML = sorted.map(function (item) {
        const saved = totalSavings(item);
        const remaining = Math.max(0, item.amount - saved);
        const progress = item.amount > 0
            ? Math.min(Math.round((saved / item.amount) * 100), 100)
            : 0;

        const savingsRows = item.savings && item.savings.length > 0
            ? item.savings.map(function (saving) {
                return (
                    '<div class="saving-row">' +
                        '<span>' +
                            html(dateLabel(saving.date)) +
                            ' — +' +
                            html(money(saving.amount)) +
                        '</span>' +
                        '<button type="button" class="remove-saving-button" ' +
                            'onclick="deleteSavingFromPlannedExpense(\'' +
                            attribute(item.id) +
                            '\', \'' +
                            attribute(saving.id) +
                            '\')">Retirer</button>' +
                    '</div>'
                );
            }).join('')
            : '<p class="saving-empty">Aucune mise de côté pour le moment.</p>';

        return (
            '<div class="planned-saving-item">' +
                '<div class="planned-saving-header">' +
                    '<div>' +
                        '<strong>' + html(item.merchant) + '</strong>' +
                        '<p>' + html(dateLabel(item.date)) + ' • ' +
                            html(categoryIcon(item.category) + ' ' + categoryName(item.category)) +
                        '</p>' +
                    '</div>' +
                    '<button type="button" class="delete-transaction-button" ' +
                        'onclick="deletePlannedExpense(\'' +
                        attribute(item.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
                '<div class="saving-summary">' +
                    '<span>Objectif : <strong>' + money(item.amount) + '</strong></span>' +
                    '<span>Mis de côté : <strong class="saving-green">' +
                        money(saved) +
                    '</strong></span>' +
                    '<span>Reste : <strong class="' +
                        (remaining <= 0 ? 'saving-green' : 'saving-orange') +
                    '">' + money(remaining) + '</strong></span>' +
                '</div>' +
                '<div class="saving-progress-bar">' +
                    '<div class="saving-progress-fill" style="width: ' +
                        progress +
                        '%"></div>' +
                '</div>' +
                '<p class="saving-progress-text">' +
                    (progress >= 100
                        ? '✅ Objectif financé'
                        : progress + '% mis de côté') +
                '</p>' +
                '<button type="button" class="btn btn-saving" ' +
                    'onclick="addSavingToPlannedExpense(\'' +
                    attribute(item.id) +
                    '\')">' +
                    '💰 Ajouter une mise de côté' +
                '</button>' +
                '<details class="saving-details">' +
                    '<summary>Voir les mises de côté</summary>' +
                    '<div class="saving-list">' +
                        savingsRows +
                    '</div>' +
                '</details>' +
            '</div>'
        );
    }).join('');
}

function totalSavings(plannedExpense) {
    if (!plannedExpense.savings || !Array.isArray(plannedExpense.savings)) {
        return 0;
    }

    return plannedExpense.savings.reduce(function (sum, saving) {
        return sum + (Number(saving.amount) || 0);
    }, 0);
}

function renderGenericHistory(items, type, deleteFunction) {
    const sorted = [...items].sort(function (first, second) {
        return dateFromString(first.date) - dateFromString(second.date);
    });

    return sorted.map(function (item) {
        const amountClass = type === 'income'
            ? 'income-amount'
            : 'transaction-amount';

        const prefix = type === 'income' ? '+' : '-';

        const details = type === 'income'
            ? dateLabel(item.date) + ' • ' + frequencyName(item.frequency)
            : dateLabel(item.date) +
                ' • ' +
                categoryIcon(item.category) +
                ' ' +
                categoryName(item.category) +
                ' • ' +
                frequencyName(item.frequency);

        return (
            '<div class="transaction-item">' +
                '<div class="transaction-info">' +
                    '<div class="transaction-merchant">' +
                        html(item.merchant) +
                    '</div>' +
                    '<div class="transaction-meta">' +
                        details +
                    '</div>' +
                '</div>' +
                '<div class="transaction-actions">' +
                    '<div class="' + amountClass + '">' +
                        prefix + money(item.amount) +
                    '</div>' +
                    '<button type="button" class="delete-transaction-button" ' +
                        'onclick="' + deleteFunction + '(\'' +
                        attribute(item.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
            '</div>'
        );
    }).join('');
}

function renderDebts() {
    const container = document.getElementById('debtsList');

    if (AppState.debts.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune dette pour le moment.</p>';
        return;
    }

    const today = endOfToday();

    container.innerHTML = AppState.debts.map(function (debt) {
        const allOccurrences = debtPaymentOccurrences(
            debt,
            dateFromString(debt.paymentDate),
            futureDate()
        );

        const paidAmount = allOccurrences
            .filter(function (occurrence) {
                return occurrence.isCompleted;
            })
            .reduce(function (sum, occurrence) {
                return sum + occurrence.amount;
            }, 0);

        const remaining = Math.max(0, debt.totalAmount - paidAmount);
        const progress = debt.totalAmount > 0
            ? Math.min(Math.round((paidAmount / debt.totalAmount) * 100), 100)
            : 0;

        const nextPayment = allOccurrences.find(function (occurrence) {
            return !occurrence.isCompleted && occurrence.date > today;
        });

        const paymentRows = allOccurrences
            .slice(0, 50)
            .map(function (occurrence) {
                return (
                    '<label class="debt-payment-row">' +
                        '<input type="checkbox" ' +
                            (occurrence.isCompleted ? 'checked ' : '') +
                            'onchange="toggleDebtPayment(\'' +
                            attribute(debt.id) +
                            '\', \'' +
                            attribute(occurrence.paymentDateKey) +
                            '\', this.checked)">' +
                        '<span>' +
                            html(dateLabel(occurrence.paymentDateKey)) +
                            ' — ' +
                            html(money(occurrence.amount)) +
                        '</span>' +
                        '<small>' +
                            (occurrence.isAutomatic
                                ? 'Automatique selon la date'
                                : occurrence.isCompleted
                                    ? 'Confirmé manuellement'
                                    : 'Décoché manuellement') +
                        '</small>' +
                    '</label>'
                );
            }).join('');

        return (
            '<div class="debt-item">' +
                '<div class="debt-item-header">' +
                    '<strong>' + html(debt.name) + '</strong>' +
                    '<button type="button" class="delete-transaction-button" ' +
                        'onclick="delete
