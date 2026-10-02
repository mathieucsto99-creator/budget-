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
                return normalizeRecurringItem(item, index, 'planned');
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
                : type === 'planned'
                    ? 'Dépense prévue'
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

    /*
     * true = paiement confirmé manuellement
     * false = paiement explicitement décoché
     * absence de valeur = automatisation selon la date
     */
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
    deleteFromList('plannedExpenses', id, 'Supprimer cette dépense prévue ?');
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

    container.innerHTML = renderGenericHistory(
        AppState.plannedExpenses,
        'planned',
        'deletePlannedExpense'
    );
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
            .filter(function (occurrence) {
                return occurrence.date <= futureDate();
            })
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
                        'onclick="deleteDebt(\'' +
                        attribute(debt.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
                '<p>Total initial : ' + money(debt.totalAmount) + '</p>' +
                '<p>Montant effectué : ' + money(paidAmount) + '</p>' +
                '<p class="debt-remaining">Solde restant : ' + money(remaining) + '</p>' +
                '<p>Paiement prévu : ' + money(debt.paymentAmount) + ' • ' +
                    frequencyName(debt.frequency) + '</p>' +
                '<p>Prochain paiement : ' +
                    (nextPayment
                        ? dateLabel(nextPayment.paymentDateKey)
                        : 'Dette terminée ou aucun paiement futur') +
                '</p>' +
                '<div class="debt-progress-bar">' +
                    '<div class="debt-progress-fill" style="width: ' +
                        progress +
                        '%"></div>' +
                '</div>' +
                '<p class="debt-progress-text">' + progress + '% remboursé</p>' +
                '<details class="debt-payment-details">' +
                    '<summary>Voir et modifier les paiements de cette dette</summary>' +
                    '<div class="debt-payment-list">' +
                        paymentRows +
                    '</div>' +
                '</details>' +
            '</div>'
        );
    }).join('');
}

function renderCategoryStats() {
    const container = document.getElementById('categoryStats');
    const now = new Date();
    const totals = {};

    const allExpenseItems = [
        ...AppState.payments,
        ...AppState.plannedExpenses
    ];

    allExpenseItems.forEach(function (item) {
        const count = occurrenceCountForItem(
            item,
            startOfMonth(now),
            endOfMonth(now)
        );

        if (count <= 0) {
            return;
        }

        totals[item.category] =
            (totals[item.category] || 0) +
            item.amount * count;
    });

    const total = Object.values(totals).reduce(function (sum, amount) {
        return sum + amount;
    }, 0);

    if (total <= 0) {
        container.innerHTML =
            '<p class="empty-state">Aucune dépense pour le mois actuel.</p>';
        return;
    }

    container.innerHTML = Object.entries(totals)
        .sort(function (first, second) {
            return second[1] - first[1];
        })
        .map(function (entry) {
            const category = entry[0];
            const amount = entry[1];
            const categoryPercent = Math.round((amount / total) * 100);

            return (
                '<div class="category-stat">' +
                    '<div class="icon">' + categoryIcon(category) + '</div>' +
                    '<div class="name">' + categoryName(category) + '</div>' +
                    '<div class="amount">' + money(amount) + '</div>' +
                    '<div class="percent">' + categoryPercent + '% du mois</div>' +
                '</div>'
            );
        })
        .join('');
}

function exportCalendarOnly() {
    const year = AppState.calendarDate.getFullYear();
    const month = AppState.calendarDate.getMonth();
    const monthStart = new Date(year, month, 1, 12, 0, 0, 0);

    const incomesByDay = itemsForMonth(AppState.incomes, year, month);
    const paymentsByDay = itemsForMonth(AppState.payments, year, month);
    const plannedByDay = itemsForMonth(AppState.plannedExpenses, year, month);
    const debtsByDay = debtItemsForMonth(year, month);

    const totalItems =
        totalByDay(incomesByDay) +
        totalByDay(paymentsByDay) +
        totalByDay(plannedByDay) +
        totalByDay(debtsByDay);

    if (totalItems <= 0) {
        alert('Aucun revenu, paiement ou dette à exporter pour ce mois.');
        return;
    }

    const reportCalendar = buildPrintableCalendar(
        year,
        month,
        incomesByDay,
        paymentsByDay,
        plannedByDay,
        debtsByDay
    );

    const report = (
        '<!DOCTYPE html>' +
        '<html lang="fr-CA">' +
        '<head>' +
            '<meta charset="UTF-8">' +
            '<title>Calendrier - ' + html(monthTitle(monthStart)) + '</title>' +
            '<style>' +
                '* { box-sizing: border-box; }' +
                'body { color: #111827; font-family: Arial, sans-serif; margin: 0; padding: 20px; }' +
                'h1 { color: #312E81; margin: 0; }' +
                'p { color: #4B5563; }' +
                '.print { background: #0F766E; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 16px; font-weight: 700; margin: 15px 0; padding: 12px 18px; }' +
                '.calendar { border-left: 1px solid #9CA3AF; border-top: 1px solid #9CA3AF; display: grid; grid-template-columns: repeat(7, 1fr); }' +
                '.weekday { background: #EDE9FE; border-bottom: 1px solid #9CA3AF; border-right: 1px solid #9CA3AF; font-size: 12px; font-weight: 700; padding: 8px 4px; text-align: center; }' +
                '.day { border-bottom: 1px solid #9CA3AF; border-right: 1px solid #9CA3AF; min-height: 125px; padding: 5px; }' +
                '.empty-day { background: #F9FAFB; }' +
                '.day-number { font-weight: 700; margin-bottom: 4px; }' +
                '.item { border-left: 4px solid #6B7280; border-radius: 3px; font-size: 10px; margin-bottom: 3px; padding: 3px; word-break: break-word; }' +
                '.income { background: #D1FAE5; border-left-color: #047857; }' +
                '.payment { background: #E0E7FF; border-left-color: #4F46E5; }' +
                '.planned { background: #FFEDD5; border-left-color: #EA580C; }' +
                '.debt { background: #FEE2E2; border-left-color: #DC2626; }' +
                '.total { font-size: 10px; font-weight: 700; margin-top: 4px; }' +
                '@media print { body { padding: 8mm; } .print { display: none; } @page { margin: 8mm; size: landscape; } }' +
            '</style>' +
        '</head>' +
        '<body>' +
            '<h1>Budget Automatisé</h1>' +
            '<p>Calendrier — ' + html(monthTitle(monthStart)) + '</p>' +
            '<button class="print" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button>' +
            reportCalendar +
        '</body>' +
        '</html>'
    );

    downloadHtmlFile(
        report,
        'budget-calendrier-' +
        year +
        '-' +
        String(month + 1).padStart(2, '0') +
        '.html'
    );
}

function buildPrintableCalendar(
    year,
    month,
    incomesByDay,
    paymentsByDay,
    plannedByDay,
    debtsByDay
) {
    const start = new Date(year, month, 1, 12, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    let output = '<div class="calendar">';

    weekdays.forEach(function (weekday) {
        output += '<div class="weekday">' + weekday + '</div>';
    });

    const firstWeekday = mondayWeekday(start);

    for (let index = 0; index < firstWeekday; index += 1) {
        output += '<div class="day empty-day"></div>';
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
        const key = dateKey(year, month, day);
        const items = [];

        pushPrintItems(items, incomesByDay[key], 'income', '+');
        pushPrintItems(items, paymentsByDay[key], 'payment', '-');
        pushPrintItems(items, plannedByDay[key], 'planned', '-');
        pushPrintItems(items, debtsByDay[key], 'debt', '-');

        const itemHtml = items.map(function (item) {
            return (
                '<div class="item ' + item.type + '">' +
                    '<strong>' + html(item.name) + '</strong><br>' +
                    item.prefix + html(money(item.amount)) +
                    (item.type === 'debt'
                        ? '<br><small>' +
                            (item.isCompleted ? 'Effectué' : 'À confirmer') +
                          '</small>'
                        : '') +
                '</div>'
            );
        }).join('');

        const totalIncome = items
            .filter(function (item) {
                return item.type === 'income';
            })
            .reduce(function (sum, item) {
                return sum + item.amount;
            }, 0);

        const totalExpenses = items
            .filter(function (item) {
                return item.type !== 'income';
            })
            .reduce(function (sum, item) {
                return sum + item.amount;
            }, 0);

        const totalHtml = items.length > 0
            ? '<div class="total">Solde : ' +
                html(money(totalIncome - totalExpenses)) +
              '</div>'
            : '';

        output += (
            '<div class="day">' +
                '<div class="day-number">' + day + '</div>' +
                itemHtml +
                totalHtml +
            '</div>'
        );
    }

    const usedCells = firstWeekday + end.getDate();
    const missingCells = usedCells % 7 === 0
        ? 0
        : 7 - (usedCells % 7);

    for (let index = 0; index < missingCells; index += 1) {
        output += '<div class="day empty-day"></div>';
    }

    output += '</div>';

    return output;
}

function pushPrintItems(target, items, type, prefix) {
    (items || []).forEach(function (item) {
        target.push({
            name: item.merchant || item.name,
            amount: item.amount,
            type: type,
            prefix: prefix,
            isCompleted: item.isCompleted
        });
    });
}

function downloadHtmlFile(content, filename) {
    const blob = new Blob(
        [content],
        { type: 'text/html;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);

    alert(
        'Le calendrier imprimable a été téléchargé. Ouvrez le fichier HTML dans vos téléchargements, puis imprimez-le ou enregistrez-le en PDF.'
    );
}

function debtItemsForMonth(year, month) {
    const start = new Date(year, month, 1, 12, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const byDay = {};

    AppState.debts.forEach(function (debt) {
        debtPaymentOccurrences(debt, start, end).forEach(function (occurrence) {
            const key = occurrence.paymentDateKey;

            if (!byDay[key]) {
                byDay[key] = [];
            }

            byDay[key].push({
                id: debt.id,
                debtId: debt.id,
                merchant: debt.name,
                amount: occurrence.amount,
                category: 'debt',
                date: key,
                frequency: debt.frequency,
                paymentDateKey: key,
                isCompleted: occurrence.isCompleted,
                isAutomatic: occurrence.isAutomatic
            });
        });
    });

    return byDay;
}

function confirmedDebtPaymentsInPeriod(start, end) {
    return AppState.debts.reduce(function (sum, debt) {
        return sum + debtPaymentOccurrences(debt, start, end)
            .filter(function (occurrence) {
                return occurrence.isCompleted;
            })
            .reduce(function (paymentSum, occurrence) {
                return paymentSum + occurrence.amount;
            }, 0);
    }, 0);
}

function debtPaymentOccurrences(debt, start, end) {
    const debtStart = dateFromString(debt.paymentDate);

    if (!debtStart || debtStart > end) {
        return [];
    }

    const dates = recurringDates(
        debtStart,
        debt.frequency,
        start,
        end
    );

    let paidBeforePeriod = debtConfirmedAmountBefore(debt, start);
    const occurrences = [];

    dates.forEach(function (date) {
        const remainingBeforePayment = debt.totalAmount - paidBeforePeriod;

        if (remainingBeforePayment <= 0) {
            return;
        }

        const paymentDateKey = localDateString(date);
        const status = debtPaymentStatus(
            debt,
            paymentDateKey,
            date
        );

        const amount = Math.min(
            debt.paymentAmount,
            remainingBeforePayment
        );

        occurrences.push({
            date: date,
            paymentDateKey: paymentDateKey,
            amount: amount,
            isCompleted: status.isCompleted,
            isAutomatic: status.isAutomatic
        });

        if (status.isCompleted) {
            paidBeforePeriod += amount;
        }
    });

    return occurrences;
}

function debtConfirmedAmountBefore(debt, beforeDate) {
    const start = dateFromString(debt.paymentDate);

    if (!start || start >= beforeDate) {
        return 0;
    }

    const dayBefore = new Date(beforeDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(23, 59, 59, 999);

    const dates = recurringDates(
        start,
        debt.frequency,
        start,
        dayBefore
    );

    let paid = 0;

    dates.forEach(function (date) {
        const key = localDateString(date);
        const status = debtPaymentStatus(debt, key, date);

        if (status.isCompleted) {
            paid += Math.min(
                debt.paymentAmount,
                Math.max(0, debt.totalAmount - paid)
            );
        }
    });

    return paid;
}

function debtPaymentStatus(debt, paymentDateKey, date) {
    const completedPayments = debt.completedPayments || {};

    if (completedPayments[paymentDateKey] === true) {
        return {
            isCompleted: true,
            isAutomatic: false
        };
    }

    if (completedPayments[paymentDateKey] === false) {
        return {
            isCompleted: false,
            isAutomatic: false
        };
    }

    return {
        isCompleted: endOfDay(date) < new Date(),
        isAutomatic: true
    };
}

function recurringDates(startDate, frequency, periodStart, periodEnd) {
    if (startDate > periodEnd) {
        return [];
    }

    if (frequency === 'one-time') {
        return startDate >= periodStart && startDate <= periodEnd
            ? [new Date(startDate)]
            : [];
    }

    const interval = frequency === 'weekly'
        ? 7
        : frequency === 'biweekly'
            ? 14
            : 0;

    if (interval > 0) {
        const current = new Date(startDate);
        const dates = [];

        while (current < periodStart) {
            current.setDate(current.getDate() + interval);
        }

        while (current <= periodEnd) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + interval);
        }

        return dates;
    }

    if (frequency === 'monthly') {
        return monthlyDates(startDate, periodStart, periodEnd);
    }

    return [];
}

function itemsForMonth(items, year, month) {
    const start = new Date(year, month, 1, 12, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const byDay = {};

    items.forEach(function (item) {
        occurrenceDatesForItem(item, start, end).forEach(function (date) {
            const key = dateKey(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );

            if (!byDay[key]) {
                byDay[key] = [];
            }

            byDay[key].push(item);
        });
    });

    return byDay;
}

function totalByDay(byDay) {
    return Object.values(byDay)
        .flat()
        .reduce(function (sum, item) {
            return sum + item.amount;
        }, 0);
}

function amountInPeriod(items, start, end) {
    return items.reduce(function (sum, item) {
        return sum + item.amount * occurrenceCountForItem(
            item,
            start,
            end
        );
    }, 0);
}

function occurrenceCountInPeriod(items, start, end) {
    return items.reduce(function (count, item) {
        return count + occurrenceCountForItem(item, start, end);
    }, 0);
}

function occurrenceCountForItem(item, start, end) {
    return occurrenceDatesForItem(item, start, end).length;
}

function occurrenceDatesForItem(item, start, end) {
    const firstDate = dateFromString(item.date);

    if (!firstDate) {
        return [];
    }

    return recurringDates(
        firstDate,
        item.frequency,
        start,
        end
    );
}

function monthlyDates(firstDate, start, end) {
    let year = firstDate.getFullYear();
    let month = firstDate.getMonth();
    const day = firstDate.getDate();

    let current = monthlyDate(year, month, day);

    while (current < start) {
        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        current = monthlyDate(year, month, day);
    }

    const dates = [];

    while (current <= end) {
        if (current >= firstDate) {
            dates.push(new Date(current));
        }

        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        current = monthlyDate(year, month, day);
    }

    return dates;
}

function monthlyDate(year, month, day) {
    const lastDay = new Date(year, month + 1, 0).getDate();

    return new Date(
        year,
        month,
        Math.min(day, lastDay),
        12,
        0,
        0,
        0
    );
}

function getNumber(id) {
    const input = document.getElementById(id);
    return input ? Number.parseFloat(input.value) : NaN;
}

function getValue(id) {
    const input = document.getElementById(id);
    return input ? input.value.trim() : '';
}

function setValue(id, value) {
    const input = document.getElementById(id);

    if (input) {
        input.value = value;
    }
}

function clearInput(id) {
    const input = document.getElementById(id);

    if (input) {
        input.value = '';
    }
}

function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}

function updateBar(id, value) {
    const element = document.getElementById(id);

    element.style.width = Math.min(value, 100) + '%';
    element.className = 'progress-fill';

    if (value >= 80) {
        element.classList.add('danger');
    } else if (value >= 50) {
        element.classList.add('warning');
    }
}

function updateRemaining(id, value) {
    const element = document.getElementById(id);

    element.textContent = 'Reste : ' + money(value);
    element.className = value < 0
        ? 'remaining negative'
        : 'remaining';
}

function setText(id, text) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}

function percent(spent, total) {
    if (!Number.isFinite(total) || total <= 0) {
        return 0;
    }

    return Math.min(Math.round((spent / total) * 100), 100);
}

function validFrequency(value) {
    const frequencies = [
        'one-time',
        'weekly',
        'biweekly',
        'monthly'
    ];

    return frequencies.includes(value) ? value : 'one-time';
}

function validDebtFrequency(value) {
    const frequencies = [
        'weekly',
        'biweekly',
        'monthly'
    ];

    return frequencies.includes(value) ? value : 'monthly';
}

function firstDayOfMonth(date) {
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

function startOfMonth(date) {
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

function endOfMonth(date) {
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

function startOfWeek(date) {
    const result = new Date(date);
    const daysSinceMonday = (result.getDay() + 6) % 7;

    result.setDate(result.getDate() - daysSinceMonday);
    result.setHours(0, 0, 0, 0);

    return result;
}

function endOfWeek(date) {
    const result = startOfWeek(date);

    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);

    return result;
}

function endOfToday() {
    const result = new Date();
    result.setHours(23, 59, 59, 999);
    return result;
}

function endOfDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

function futureDate() {
    return new Date(
        new Date().getFullYear() + 10,
        11,
        31,
        23,
        59,
        59,
        999
    );
}

function mondayWeekday(date) {
    return (date.getDay() + 6) % 7;
}

function dateFromString(value) {
    const parts = String(value).split('-').map(Number);

    if (!parts[0] || !parts[1] || !parts[2]) {
        return null;
    }

    return new Date(
        parts[0],
        parts[1] - 1,
        parts[2],
        12,
        0,
        0,
        0
    );
}

function dateKey(year, month, day) {
    return (
        year + '-' +
        String(month + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0')
    );
}

function localDateString(date) {
    return dateKey(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function sameDate(first, second) {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function money(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(amount);
}

function compactMoney(amount) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: 0
    }).format(amount).replace(/\s/g, '');
}

function dateLabel(value) {
    const date = dateFromString(value);

    return new Intl.DateTimeFormat('fr-CA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function monthTitle(date) {
    return new Intl.DateTimeFormat('fr-CA', {
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function frequencyName(value) {
    const names = {
        'one-time': 'Une seule fois',
        weekly: 'Chaque semaine',
        biweekly: 'Aux 2 semaines',
        monthly: 'Chaque mois'
    };

    return names[value] || 'Une seule fois';
}

function categoryName(value) {
    const names = {
        groceries: 'Épicerie',
        food: 'Restaurants et repas',
        transport: 'Transport',
        shopping: 'Achats',
        entertainment: 'Divertissement',
        bills: 'Factures et logement',
        health: 'Santé',
        other: 'Autre'
    };

    return names[value] || 'Autre';
}

function categoryIcon(value) {
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

    return icons[value] || '📦';
}

function createId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return Date.now() + '-' + Math.random().toString(16).slice(2);
}

function html(text) {
    const element = document.createElement('div');
    element.textContent = text || '';
    return element.innerHTML;
}

function attribute(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
