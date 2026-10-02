const STORAGE_KEY = 'budgetApp';

const State = {
    incomes: [],
    payments: [],
    goals: [],
    debts: [],
    calendarDate: firstDayOfMonth(new Date())
};

document.addEventListener('DOMContentLoaded', function () {
    loadData();
    setDefaultDates();
    renderAll();
});

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return;
    }

    try {
        const data = JSON.parse(saved);

        State.incomes = Array.isArray(data.incomes)
            ? data.incomes.map(normalizeIncome)
            : [];

        State.payments = Array.isArray(data.payments)
            ? data.payments.map(normalizePayment)
            : Array.isArray(data.transactions)
                ? data.transactions.map(normalizePayment)
                : [];

        State.goals = Array.isArray(data.goals)
            ? data.goals.map(normalizeGoal)
            : [];

        State.debts = Array.isArray(data.debts)
            ? data.debts.map(normalizeDebt)
            : [];
    } catch (error) {
        console.error(error);
        alert('Impossible de lire les données sauvegardées. Elles ne sont pas remplacées automatiquement.');
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        incomes: State.incomes,
        payments: State.payments,
        goals: State.goals,
        debts: State.debts
    }));
}

function normalizeIncome(item) {
    return {
        id: String(item.id || createId()),
        name: item.name || item.merchant || 'Revenu sans nom',
        amount: positive(item.amount),
        date: validDate(item.date),
        frequency: validFrequency(item.frequency),
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizePayment(item) {
    return {
        id: String(item.id || createId()),
        name: item.name || item.merchant || 'Paiement sans nom',
        amount: positive(item.amount),
        category: item.category || 'other',
        date: validDate(item.date),
        frequency: validFrequency(item.frequency),
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizeGoal(item) {
    return {
        id: String(item.id || createId()),
        name: item.name || 'Objectif sans nom',
        amount: positive(item.amount),
        date: validDate(item.date),
        savings: Array.isArray(item.savings)
            ? item.savings.map(function (saving) {
                return {
                    id: String(saving.id || createId()),
                    amount: positive(saving.amount),
                    date: validDate(saving.date),
                    timestamp: saving.timestamp || new Date().toISOString()
                };
            })
            : [],
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function normalizeDebt(item) {
    return {
        id: String(item.id || createId()),
        name: item.name || 'Dette sans nom',
        totalAmount: positive(item.totalAmount),
        paymentAmount: positive(item.paymentAmount),
        paymentDate: validDate(item.paymentDate),
        frequency: validDebtFrequency(item.frequency),
        completedPayments: item.completedPayments || {},
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function setDefaultDates() {
    const today = localDateString(new Date());

    [
        'incomeDate',
        'expenseDate',
        'goalDate',
        'debtPaymentDate'
    ].forEach(function (id) {
        const input = document.getElementById(id);

        if (input && !input.value) {
            input.value = today;
        }
    });
}

function addIncome() {
    const amount = readNumber('incomeAmount');
    const name = readText('incomeName') || 'Revenu sans nom';
    const date = readText('incomeDate');
    const frequency = validFrequency(readText('incomeFrequency'));

    if (!isPositive(amount) || !date) {
        alert('Entrez un montant et une date valide.');
        return;
    }

    State.incomes.unshift({
        id: createId(),
        name: name,
        amount: amount,
        date: date,
        frequency: frequency,
        timestamp: new Date().toISOString()
    });

    State.calendarDate = firstDayOfMonth(dateFromString(date));
    saveData();
    renderAll();

    clear('incomeAmount');
    clear('incomeName');
}

function addPayment() {
    const amount = readNumber('expenseAmount');
    const name = readText('expenseMerchant') || 'Paiement sans nom';
    const date = readText('expenseDate');
    const frequency = validFrequency(readText('expenseFrequency'));
    const category = readText('expenseCategory');

    if (!isPositive(amount) || !date) {
        alert('Entrez un montant et une date valide.');
        return;
    }

    State.payments.unshift({
        id: createId(),
        name: name,
        amount: amount,
        category: category,
        date: date,
        frequency: frequency,
        timestamp: new Date().toISOString()
    });

    State.calendarDate = firstDayOfMonth(dateFromString(date));
    saveData();
    renderAll();

    clear('expenseAmount');
    clear('expenseMerchant');
}

function addGoal() {
    const amount = readNumber('goalAmount');
    const name = readText('goalName') || 'Objectif sans nom';
    const date = readText('goalDate');

    if (!isPositive(amount) || !date) {
        alert('Entrez un montant objectif et une date valide.');
        return;
    }

    State.goals.unshift({
        id: createId(),
        name: name,
        amount: amount,
        date: date,
        savings: [],
        timestamp: new Date().toISOString()
    });

    saveData();
    renderAll();

    clear('goalAmount');
    clear('goalName');
}

function addGoalSaving(goalId) {
    const goal = State.goals.find(function (item) {
        return item.id === goalId;
    });

    if (!goal) {
        return;
    }

    const saved = goalSaved(goal);
    const remaining = Math.max(0, goal.amount - saved);

    if (remaining === 0) {
        alert('Cet objectif est déjà atteint.');
        return;
    }

    const answer = prompt(
        'Montant à ajouter à « ' + goal.name + ' »\n\n' +
        'Objectif : ' + money(goal.amount) + '\n' +
        'Déjà épargné : ' + money(saved) + '\n' +
        'Reste : ' + money(remaining)
    );

    if (answer === null) {
        return;
    }

    const amount = Number.parseFloat(String(answer).replace(',', '.'));

    if (!isPositive(amount)) {
        alert('Entrez un montant valide.');
        return;
    }

    goal.savings.unshift({
        id: createId(),
        amount: Math.min(amount, remaining),
        date: localDateString(new Date()),
        timestamp: new Date().toISOString()
    });

    saveData();
    renderAll();
}

function deleteGoalSaving(goalId, savingId) {
    const goal = State.goals.find(function (item) {
        return item.id === goalId;
    });

    if (!goal || !confirm('Retirer cette mise de côté ?')) {
        return;
    }

    goal.savings = goal.savings.filter(function (saving) {
        return saving.id !== savingId;
    });

    saveData();
    renderAll();
}

function deleteGoal(id) {
    if (!confirm('Supprimer cet objectif et ses mises de côté ?')) {
        return;
    }

    State.goals = State.goals.filter(function (goal) {
        return goal.id !== id;
    });

    saveData();
    renderAll();
}

function addDebt() {
    const name = readText('debtName') || 'Dette sans nom';
    const totalAmount = readNumber('debtTotal');
    const paymentAmount = readNumber('debtPaymentAmount');
    const paymentDate = readText('debtPaymentDate');
    const frequency = validDebtFrequency(readText('debtFrequency'));

    if (
        !isPositive(totalAmount) ||
        !isPositive(paymentAmount) ||
        !paymentDate
    ) {
        alert('Entrez le total dû, le paiement et la première date.');
        return;
    }

    State.debts.unshift({
        id: createId(),
        name: name,
        totalAmount: totalAmount,
        paymentAmount: paymentAmount,
        paymentDate: paymentDate,
        frequency: frequency,
        completedPayments: {},
        timestamp: new Date().toISOString()
    });

    State.calendarDate = firstDayOfMonth(dateFromString(paymentDate));
    saveData();
    renderAll();

    clear('debtName');
    clear('debtTotal');
    clear('debtPaymentAmount');
}

function toggleDebtPayment(debtId, dateKey, checked) {
    const debt = State.debts.find(function (item) {
        return item.id === debtId;
    });

    if (!debt) {
        return;
    }

    debt.completedPayments[dateKey] = checked;
    saveData();
    renderAll();
}

function deleteIncome(id) {
    if (!confirm('Supprimer ce revenu ?')) {
        return;
    }

    State.incomes = State.incomes.filter(function (item) {
        return item.id !== id;
    });

    saveData();
    renderAll();
}

function deletePayment(id) {
    if (!confirm('Supprimer ce paiement ?')) {
        return;
    }

    State.payments = State.payments.filter(function (item) {
        return item.id !== id;
    });

    saveData();
    renderAll();
}

function deleteDebt(id) {
    if (!confirm('Supprimer cette dette ?')) {
        return;
    }

    State.debts = State.debts.filter(function (item) {
        return item.id !== id;
    });

    saveData();
    renderAll();
}

function clearAllPayments() {
    if (!confirm('Effacer tous les paiements ?')) {
        return;
    }

    State.payments = [];
    saveData();
    renderAll();
}

function changeCalendarMonth(direction) {
    State.calendarDate = new Date(
        State.calendarDate.getFullYear(),
        State.calendarDate.getMonth() + direction,
        1
    );

    renderCalendar();
}

function renderAll() {
    renderSummary();
    renderCalendar();
    renderIncomes();
    renderPayments();
    renderGoals();
    renderDebts();
    renderCategories();
}

function renderSummary() {
    const now = new Date();

    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const monthIncome = totalRecurring(State.incomes, monthStart, monthEnd);
    const weekIncome = totalRecurring(State.incomes, weekStart, weekEnd);

    const monthExpenses =
        totalRecurring(State.payments, monthStart, monthEnd) +
        totalConfirmedDebt(monthStart, monthEnd);

    const weekExpenses =
        totalRecurring(State.payments, weekStart, weekEnd) +
        totalConfirmedDebt(weekStart, weekEnd);

    set('monthlyIncome', money(monthIncome));
    set('weeklyIncome', money(weekIncome));
    set('monthlySpent', money(monthExpenses));
    set('weeklySpent', money(weekExpenses));
    set('monthlyBalance', money(monthIncome - monthExpenses));
    set('weeklyBalance', money(weekIncome - weekExpenses));

    set(
        'monthlyIncomeCount',
        countRecurring(State.incomes, monthStart, monthEnd) + ' paie(s)'
    );

    set(
        'weeklyIncomeCount',
        countRecurring(State.incomes, weekStart, weekEnd) + ' paie(s)'
    );

    set(
        'monthlyPercent',
        percentage(monthExpenses, monthIncome) + '% des revenus'
    );

    set(
        'weeklyPercent',
        percentage(weekExpenses, weekIncome) + '% des revenus'
    );
}

function renderCalendar() {
    const year = State.calendarDate.getFullYear();
    const month = State.calendarDate.getMonth();
    const start = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();

    const incomeMap = recurringMap(State.incomes, year, month, 'income');
    const paymentMap = recurringMap(State.payments, year, month, 'payment');
    const debtMap = debtMapForMonth(year, month);

    set('calendarTitle', monthTitle(start));

    const incomeTotal = sum(Object.values(incomeMap).flat());
    const expenseTotal =
        sum(Object.values(paymentMap).flat()) +
        sum(Object.values(debtMap).flat());

    set(
        'calendarSummary',
        'Revenus : ' + money(incomeTotal) +
        ' • Dépenses : ' + money(expenseTotal) +
        ' • Solde : ' + money(incomeTotal - expenseTotal)
    );

    const cells = [];

    for (let i = 0; i < mondayWeekday(start); i += 1) {
        cells.push('<div class="calendar-day empty"></div>');
    }

    for (let day = 1; day <= days; day += 1) {
        const key = dateKey(year, month, day);

        const items = []
            .concat(incomeMap[key] || [])
            .concat(paymentMap[key] || [])
            .concat(debtMap[key] || []);

        const visible = items.slice(0, 3);
        const hidden = items.length - visible.length;

        cells.push(
            '<div class="calendar-day">' +
                '<div class="calendar-day-number">' + day + '</div>' +
                visible.map(calendarItem).join('') +
                (hidden > 0
                    ? '<div class="calendar-more">+' + hidden + ' autre(s)</div>'
                    : '') +
            '</div>'
        );
    }

    const remaining = cells.length % 7 === 0
        ? 0
        : 7 - (cells.length % 7);

    for (let i = 0; i < remaining; i += 1) {
        cells.push('<div class="calendar-day empty"></div>');
    }

    document.getElementById('calendarGrid').innerHTML = cells.join('');
}

function calendarItem(item) {
    let extra = '';

    if (item.type === 'debt') {
        extra =
            '<label class="debt-check">' +
                '<input type="checkbox" ' +
                    (item.completed ? 'checked ' : '') +
                    'onchange="toggleDebtPayment(\'' +
                    escapeAttribute(item.debtId) +
                    '\', \'' +
                    escapeAttribute(item.dateKey) +
                    '\', this.checked)"> payé' +
            '</label>';
    }

    return (
        '<div class="calendar-item ' + item.type + '">' +
            '<strong>' + escapeHtml(item.name) + '</strong>' +
            '<span>' +
                (item.type === 'income' ? '+' : '-') +
                money(item.amount) +
            '</span>' +
            extra +
        '</div>'
    );
}

function renderIncomes() {
    const container = document.getElementById('incomesList');

    container.innerHTML = State.incomes.length
        ? State.incomes.map(function (item) {
            return listRow(item, 'income', 'deleteIncome');
        }).join('')
        : '<p class="empty-state">Aucun revenu.</p>';
}

function renderPayments() {
    const container = document.getElementById('paymentsList');

    container.innerHTML = State.payments.length
        ? State.payments.map(function (item) {
            return listRow(item, 'payment', 'deletePayment');
        }).join('')
        : '<p class="empty-state">Aucun paiement.</p>';
}

function listRow(item, type, deleteFunction) {
    return (
        '<div class="list-row">' +
            '<div>' +
                '<strong>' + escapeHtml(item.name) + '</strong>' +
                '<small>' +
                    dateLabel(item.date) +
                    ' • ' +
                    frequencyName(item.frequency) +
                '</small>' +
            '</div>' +
            '<div class="actions">' +
                '<b class="' + type + '-amount">' +
                    (type === 'income' ? '+' : '-') +
                    money(item.amount) +
                '</b>' +
                '<button onclick="' + deleteFunction + '(\'' +
                    escapeAttribute(item.id) +
                    '\')">Supprimer</button>' +
            '</div>' +
        '</div>'
    );
}

function renderGoals() {
    const container = document.getElementById('goalsList');

    if (!State.goals.length) {
        container.innerHTML = '<p class="empty-state">Aucun objectif.</p>';
        return;
    }

    container.innerHTML = State.goals.map(function (goal) {
        const saved = goalSaved(goal);
        const remaining = Math.max(0, goal.amount - saved);
        const progress = percentage(saved, goal.amount);

        const savings = goal.savings.length
            ? goal.savings.map(function (saving) {
                return (
                    '<div class="saving-row">' +
                        '<span>' + dateLabel(saving.date) +
                            ' : +' + money(saving.amount) +
                        '</span>' +
                        '<button onclick="deleteGoalSaving(\'' +
                            escapeAttribute(goal.id) +
                            '\', \'' +
                            escapeAttribute(saving.id) +
                            '\')">Retirer</button>' +
                    '</div>'
                );
            }).join('')
            : '<p class="empty-saving">Aucune mise de côté.</p>';

        return (
            '<div class="goal-card">' +
                '<div class="goal-header">' +
                    '<div><strong>' + escapeHtml(goal.name) + '</strong>' +
                    '<small>Date objectif : ' + dateLabel(goal.date) + '</small></div>' +
                    '<button onclick="deleteGoal(\'' +
                        escapeAttribute(goal.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
                '<div class="goal-values">' +
                    '<span>Objectif : <b>' + money(goal.amount) + '</b></span>' +
                    '<span>Épargné : <b class="green">' + money(saved) + '</b></span>' +
                    '<span>Reste : <b>' + money(remaining) + '</b></span>' +
                '</div>' +
                '<div class="goal-bar"><div style="width:' +
                    progress +
                    '%"></div></div>' +
                '<p class="goal-status">' +
                    (progress >= 100
                        ? '✅ Objectif atteint'
                        : progress + '% épargné') +
                '</p>' +
                '<button class="btn btn-goal" onclick="addGoalSaving(\'' +
                    escapeAttribute(goal.id) +
                    '\')">💰 Ajouter un montant épargné</button>' +
                '<details><summary>Voir les mises de côté</summary>' +
                    savings +
                '</details>' +
            '</div>'
        );
    }).join('');
}

function renderDebts() {
    const container = document.getElementById('debtsList');

    if (!State.debts.length) {
        container.innerHTML = '<p class="empty-state">Aucune dette.</p>';
        return;
    }

    container.innerHTML = State.debts.map(function (debt) {
        const paid = debtPaid(debt);
        const remaining = Math.max(0, debt.totalAmount - paid);
        const progress = percentage(paid, debt.totalAmount);

        const occurrences = debtOccurrences(
            debt,
            dateFromString(debt.paymentDate),
            addYears(new Date(), 5)
        );

        return (
            '<div class="debt-card">' +
                '<div class="goal-header">' +
                    '<strong>' + escapeHtml(debt.name) + '</strong>' +
                    '<button onclick="deleteDebt(\'' +
                        escapeAttribute(debt.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
                '<p>Total initial : ' + money(debt.totalAmount) + '</p>' +
                '<p>Payé : ' + money(paid) + '</p>' +
                '<p><b>Solde : ' + money(remaining) + '</b></p>' +
                '<div class="goal-bar debt-bar"><div style="width:' +
                    progress +
                    '%"></div></div>' +
                '<p>' + progress + '% remboursé</p>' +
                '<details><summary>Voir les paiements</summary>' +
                occurrences.slice(0, 40).map(function (item) {
                    return (
                        '<label class="debt-row">' +
                            '<input type="checkbox" ' +
                                (item.completed ? 'checked ' : '') +
                                'onchange="toggleDebtPayment(\'' +
                                escapeAttribute(debt.id) +
                                '\', \'' +
                                escapeAttribute(item.dateKey) +
                                '\', this.checked)">' +
                            '<span>' + dateLabel(item.dateKey) +
                                ' — ' + money(item.amount) +
                            '</span>' +
                        '</label>'
                    );
                }).join('') +
                '</details>' +
            '</div>'
        );
    }).join('');
}

function renderCategories() {
    const container = document.getElementById('categoryStats');
    const now = new Date();
    const totals = {};

    State.payments.forEach(function (item) {
        const count = occurrenceDates(
            item.date,
            item.frequency,
            startOfMonth(now),
            endOfMonth(now)
        ).length;

        totals[item.category] =
            (totals[item.category] || 0) +
            item.amount * count;
    });

    const entries = Object.entries(totals);

    container.innerHTML = entries.length
        ? entries.map(function (entry) {
            return (
                '<div class="category-stat">' +
                    '<div>' + categoryIcon(entry[0]) + '</div>' +
                    '<strong>' + categoryName(entry[0]) + '</strong>' +
                    '<span>' + money(entry[1]) + '</span>' +
                '</div>'
            );
        }).join('')
        : '<p class="empty-state">Aucune dépense ce mois.</p>';
}

function exportCalendarOnly() {
    const year = State.calendarDate.getFullYear();
    const month = State.calendarDate.getMonth();
    const incomeMap = recurringMap(State.incomes, year, month, 'income');
    const paymentMap = recurringMap(State.payments, year, month, 'payment');
    const debtMap = debtMapForMonth(year, month);

    const calendar = printableCalendar(
        year,
        month,
        incomeMap,
        paymentMap,
        debtMap
    );

    const content =
        '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<title>Calendrier</title><style>' +
        'body{font-family:Arial;padding:20px}.print{background:#0f766e;color:#fff;border:0;padding:12px;border-radius:6px}.calendar{display:grid;grid-template-columns:repeat(7,1fr);border-top:1px solid #999;border-left:1px solid #999}.day,.week{border-right:1px solid #999;border-bottom:1px solid #999;padding:5px;min-height:120px}.week{background:#eee;text-align:center;font-weight:bold}.event{font-size:10px;margin:3px 0;padding:3px;border-left:4px solid #777}.income{background:#d1fae5;border-color:#047857}.payment{background:#e0e7ff;border-color:#4f46e5}.debt{background:#fee2e2;border-color:#dc2626}@media print{.print{display:none}@page{size:landscape;margin:8mm}}' +
        '</style></head><body><h1>Budget Automatisé</h1>' +
        '<button class="print" onclick="window.print()">Imprimer / PDF</button>' +
        calendar +
        '</body></html>';

    const blob = new Blob([content], {
        type: 'text/html;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
        'budget-calendrier-' +
        year + '-' +
        String(month + 1).padStart(2, '0') +
        '.html';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

function printableCalendar(year, month, incomeMap, paymentMap, debtMap) {
    const start = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    let output = '<div class="calendar">';

    names.forEach(function (name) {
        output += '<div class="week">' + name + '</div>';
    });

    for (let i = 0; i < mondayWeekday(start); i += 1) {
        output += '<div class="day"></div>';
    }

    for (let day = 1; day <= days; day += 1) {
        const key = dateKey(year, month, day);
        const items = []
            .concat(incomeMap[key] || [])
            .concat(paymentMap[key] || [])
            .concat(debtMap[key] || []);

        output += '<div class="day"><b>' + day + '</b>';

        items.forEach(function (item) {
            output +=
                '<div class="event ' + item.type + '">' +
                escapeHtml(item.name) +
                '<br>' +
                (item.type === 'income' ? '+' : '-') +
                escapeHtml(money(item.amount)) +
                '</div>';
        });

        output += '</div>';
    }

    const used = mondayWeekday(start) + days;
    const remaining = used % 7 === 0 ? 0 : 7 - (used % 7);

    for (let i = 0; i < remaining; i += 1) {
        output += '<div class="day"></div>';
    }

    return output + '</div>';
}

function recurringMap(items, year, month, type) {
    const map = {};
    const start = new Date(year, month, 1);
    const end = endOfMonth(start);

    items.forEach(function (item) {
        occurrenceDates(item.date, item.frequency, start, end)
            .forEach(function (date) {
                const key = localDateString(date);

                if (!map[key]) {
                    map[key] = [];
                }

                map[key].push({
                    type: type,
                    name: item.name,
                    amount: item.amount
                });
            });
    });

    return map;
}

function debtMapForMonth(year, month) {
    const map = {};
    const start = new Date(year, month, 1);
    const end = endOfMonth(start);

    State.debts.forEach(function (debt) {
        debtOccurrences(debt, start, end).forEach(function (item) {
            if (!map[item.dateKey]) {
                map[item.dateKey] = [];
            }

            map[item.dateKey].push({
                type: 'debt',
                name: debt.name,
                amount: item.amount,
                debtId: debt.id,
                dateKey: item.dateKey,
                completed: item.completed
            });
        });
    });

    return map;
}

function totalRecurring(items, start, end) {
    return items.reduce(function (sum, item) {
        return sum + item.amount *
            occurrenceDates(item.date, item.frequency, start, end).length;
    }, 0);
}

function countRecurring(items, start, end) {
    return items.reduce(function (count, item) {
        return count +
            occurrenceDates(item.date, item.frequency, start, end).length;
    }, 0);
}

function totalConfirmedDebt(start, end) {
    return State.debts.reduce(function (sum, debt) {
        return sum + debtOccurrences(debt, start, end)
            .filter(function (item) {
                return item.completed;
            })
            .reduce(function (debtSum, item) {
                return debtSum + item.amount;
            }, 0);
    }, 0);
}

function debtOccurrences(debt, start, end) {
    const dates = occurrenceDates(
        debt.paymentDate,
        debt.frequency,
        start,
        end
    );

    const output = [];
    let alreadyPaid = paidBefore(debt, start);

    dates.forEach(function (date) {
        const amount = Math.min(
            debt.paymentAmount,
            Math.max(0, debt.totalAmount - alreadyPaid)
        );

        if (amount <= 0) {
            return;
        }

        const dateKey = localDateString(date);
        const status = debtStatus(debt, dateKey, date);

        output.push({
            dateKey: dateKey,
            amount: amount,
            completed: status.completed,
            automatic: status.automatic
        });

        if (status.completed) {
            alreadyPaid += amount;
        }
    });

    return output;
}

function paidBefore(debt, before) {
    const start = dateFromString(debt.paymentDate);

    if (!start || start >= before) {
        return 0;
    }

    const end = new Date(before);
    end.setDate(end.getDate() - 1);

    const dates = occurrenceDates(
        debt.paymentDate,
        debt.frequency,
        start,
        end
    );

    let paid = 0;

    dates.forEach(function (date) {
        const key = localDateString(date);
        const status = debtStatus(debt, key, date);

        if (status.completed) {
            paid += Math.min(
                debt.paymentAmount,
                debt.totalAmount - paid
            );
        }
    });

    return paid;
}

function debtPaid(debt) {
    const start = dateFromString(debt.paymentDate);
    const end = addYears(new Date(), 5);

    return debtOccurrences(debt, start, end)
        .filter(function (item) {
            return item.completed;
        })
        .reduce(function (sum, item) {
            return sum + item.amount;
        }, 0);
}

function debtStatus(debt, key, date) {
    if (debt.completedPayments[key] === true) {
        return { completed: true, automatic: false };
    }

    if (debt.completedPayments[key] === false) {
        return { completed: false, automatic: false };
    }

    return {
        completed: endOfDay(date) < new Date(),
        automatic: true
    };
}

function occurrenceDates(dateString, frequency, start, end) {
    const first = dateFromString(dateString);

    if (!first || first > end) {
        return [];
    }

    if (frequency === 'one-time') {
        return first >= start && first <= end ? [first] : [];
    }

    const interval = frequency === 'weekly'
        ? 7
        : frequency === 'biweekly'
            ? 14
            : 0;

    if (interval) {
        const current = new Date(first);
        const dates = [];

        while (current < start) {
            current.setDate(current.getDate() + interval);
        }

        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + interval);
        }

        return dates;
    }

    if (frequency === 'monthly') {
        const dates = [];
        let current = new Date(first);

        while (current < start) {
            current = nextMonth(current, first.getDate());
        }

        while (current <= end) {
            dates.push(new Date(current));
            current = nextMonth(current, first.getDate());
        }

        return dates;
    }

    return [];
}

function nextMonth(date, day) {
    const next = date.getMonth() + 1;
    const year = date.getFullYear() + Math.floor(next / 12);
    const month = next % 12;
    const last = new Date(year, month + 1, 0).getDate();

    return new Date(year, month, Math.min(day, last));
}

function goalSaved(goal) {
    return goal.savings.reduce(function (sum, saving) {
        return sum + saving.amount;
    }, 0);
}

function sum(items) {
    return items.reduce(function (total, item) {
        return total + item.amount;
    }, 0);
}

function readText(id) {
    const input = document.getElementById(id);
    return input ? input.value.trim() : '';
}

function readNumber(id) {
    return Number.parseFloat(readText(id));
}

function clear(id) {
    const input = document.getElementById(id);

    if (input) {
        input.value = '';
    }
}

function set(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function positive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}

function validDate(value) {
    return dateFromString(value)
        ? value
        : localDateString(new Date());
}

function validFrequency(value) {
    return ['one-time', 'weekly', 'biweekly', 'monthly'].includes(value)
        ? value
        : 'one-time';
}

function validDebtFrequency(value) {
    return ['weekly', 'biweekly', 'monthly'].includes(value)
        ? value
        : 'monthly';
}

function percentage(value, total) {
    return total > 0
        ? Math.min(Math.round((value / total) * 100), 100)
        : 0;
}

function firstDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59
    );
}

function startOfWeek(date) {
    const result = new Date(date);
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    result.setHours(0, 0, 0, 0);
    return result;
}

function endOfWeek(date) {
    const result = startOfWeek(date);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
}

function endOfDay(date) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

function mondayWeekday(date) {
    return (date.getDay() + 6) % 7;
}

function dateFromString(value) {
    const parts = String(value || '').split('-').map(Number);

    return parts.length === 3 && parts[0] && parts[1] && parts[2]
        ? new Date(parts[0], parts[1] - 1, parts[2])
        : null;
}

function dateKey(year, month, day) {
    return year + '-' +
        String(month + 1).padStart(2, '0') + '-' +
        String(day).padStart(2, '0');
}

function localDateString(date) {
    return dateKey(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function dateLabel(value) {
    const date = dateFromString(value);

    return date
        ? new Intl.DateTimeFormat('fr-CA', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(date)
        : 'Date inconnue';
}

function monthTitle(date) {
    return new Intl.DateTimeFormat('fr-CA', {
        month: 'long',
        year: 'numeric'
    }).format(date);
}

function money(value) {
    return new Intl.NumberFormat('fr-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(value);
}

function frequencyName(value) {
    const names = {
        'one-time': 'Unique',
        weekly: 'Hebdomadaire',
        biweekly: 'Aux 2 semaines',
        monthly: 'Mensuelle'
    };

    return names[value] || 'Unique';
}

function categoryName(value) {
    const names = {
        groceries: 'Épicerie',
        food: 'Restaurants',
        transport: 'Transport',
        shopping: 'Achats',
        entertainment: 'Divertissement',
        bills: 'Factures',
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

function addYears(date, years) {
    return new Date(
        date.getFullYear() + years,
        date.getMonth(),
        date.getDate()
    );
}

function createId() {
    return window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now() + '-' + Math.random().toString(16).slice(2);
}

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value || '');
    return element.innerHTML;
}

function escapeAttribute(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
