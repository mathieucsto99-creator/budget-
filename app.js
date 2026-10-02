const AppState = {
    payments: [],
    incomes: [],
    calendarDate: firstDayOfMonth(new Date())
};

document.addEventListener('DOMContentLoaded', function () {
    loadData();

    const today = localDateString(new Date());

    document.getElementById('expenseDate').value = today;
    document.getElementById('incomeDate').value = today;

    refreshApp();
});

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

        AppState.payments = oldPayments.map(function (payment, index) {
            return normalizeItem(payment, index, 'payment');
        });

        AppState.incomes = Array.isArray(data.incomes)
            ? data.incomes.map(function (income, index) {
                return normalizeItem(income, index, 'income');
            })
            : [];

        saveData();
    } catch (error) {
        console.error('Erreur de lecture des données :', error);

        AppState.payments = [];
        AppState.incomes = [];
    }
}

function normalizeItem(item, index, type) {
    return {
        id: String(
            item.id ||
            type + '-' +
            Date.now() +
            '-' +
            index +
            '-' +
            Math.random().toString(16).slice(2)
        ),
        amount: Number(item.amount) || 0,
        merchant: item.merchant || item.name || (
            type === 'income' ? 'Revenu sans nom' : 'Paiement sans nom'
        ),
        category: item.category || 'other',
        date: item.date || localDateString(
            new Date(item.timestamp || new Date())
        ),
        frequency: validFrequency(item.frequency),
        timestamp: item.timestamp || new Date().toISOString()
    };
}

function saveData() {
    localStorage.setItem('budgetApp', JSON.stringify({
        payments: AppState.payments,
        incomes: AppState.incomes
    }));
}

function addIncome() {
    const amountInput = document.getElementById('incomeAmount');
    const nameInput = document.getElementById('incomeName');
    const dateInput = document.getElementById('incomeDate');
    const frequencyInput = document.getElementById('incomeFrequency');

    const amount = Number.parseFloat(amountInput.value);
    const merchant = nameInput.value.trim() || 'Revenu sans nom';
    const date = dateInput.value;
    const frequency = validFrequency(frequencyInput.value);

    if (!Number.isFinite(amount) || amount <= 0) {
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

    const incomeDate = dateFromString(date);

    if (incomeDate) {
        AppState.calendarDate = firstDayOfMonth(incomeDate);
    }

    saveData();
    refreshApp();

    amountInput.value = '';
    nameInput.value = '';
    dateInput.value = localDateString(new Date());
    frequencyInput.value = 'biweekly';
}

function deleteIncome(incomeId) {
    const income = AppState.incomes.find(function (item) {
        return String(item.id) === String(incomeId);
    });

    if (!income) {
        return;
    }

    if (!confirm(
        'Supprimer ce revenu ?\n\n' +
        income.merchant +
        ' — ' +
        money(income.amount)
    )) {
        return;
    }

    AppState.incomes = AppState.incomes.filter(function (item) {
        return String(item.id) !== String(incomeId);
    });

    saveData();
    refreshApp();
}

function addPayment() {
    const amountInput = document.getElementById('expenseAmount');
    const merchantInput = document.getElementById('expenseMerchant');
    const dateInput = document.getElementById('expenseDate');
    const frequencyInput = document.getElementById('expenseFrequency');
    const categoryInput = document.getElementById('expenseCategory');

    const amount = Number.parseFloat(amountInput.value);
    const merchant = merchantInput.value.trim() || 'Paiement sans nom';
    const date = dateInput.value;
    const frequency = validFrequency(frequencyInput.value);
    const category = categoryInput.value;

    if (!Number.isFinite(amount) || amount <= 0) {
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

    const paymentDate = dateFromString(date);

    if (paymentDate) {
        AppState.calendarDate = firstDayOfMonth(paymentDate);
    }

    saveData();
    refreshApp();

    amountInput.value = '';
    merchantInput.value = '';
    dateInput.value = localDateString(new Date());
    frequencyInput.value = 'one-time';
    categoryInput.value = 'groceries';
}

function deletePayment(paymentId) {
    const payment = AppState.payments.find(function (item) {
        return String(item.id) === String(paymentId);
    });

    if (!payment) {
        return;
    }

    if (!confirm(
        'Supprimer ce paiement ?\n\n' +
        payment.merchant +
        ' — ' +
        money(payment.amount)
    )) {
        return;
    }

    AppState.payments = AppState.payments.filter(function (item) {
        return String(item.id) !== String(paymentId);
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

    refreshApp();
}

function refreshApp() {
    renderFinancialSummary();
    renderCalendar();
    renderIncomes();
    renderPayments();
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

    const monthlySpent = amountInPeriod(
        AppState.payments,
        monthStart,
        monthEnd
    );

    const weeklySpent = amountInPeriod(
        AppState.payments,
        weekStart,
        weekEnd
    );

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
        'Solde planifié : ' + money(monthlyIncome - monthlySpent)
    );
    setText(
        'weeklyBalance',
        'Solde planifié : ' + money(weeklyIncome - weeklySpent)
    );

    setText('monthlySpent', money(monthlySpent));
    setText('weeklySpent', money(weeklySpent));
    setText('monthlyTotal', money(monthlyIncome));
    setText('weeklyTotal', money(weeklyIncome));

    const monthlyPercent = percent(monthlySpent, monthlyIncome);
    const weeklyPercent = percent(weeklySpent, weeklyIncome);

    setText('monthlyPercent', monthlyPercent + '%');
    setText('weeklyPercent', weeklyPercent + '%');

    updateBar('monthlyProgress', monthlyPercent);
    updateBar('weeklyProgress', weeklyPercent);

    updateRemaining(
        'monthlyRemaining',
        monthlyIncome - monthlySpent
    );

    updateRemaining(
        'weeklyRemaining',
        weeklyIncome - weeklySpent
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

    const incomeTotal = totalByDay(incomesByDay);
    const paymentTotal = totalByDay(paymentsByDay);

    summary.textContent =
        'Revenus : ' +
        money(incomeTotal) +
        ' • Paiements : ' +
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
        const incomeItems = incomesByDay[key] || [];
        const paymentItems = paymentsByDay[key] || [];
        const allItems = [];

        incomeItems.forEach(function (item) {
            allItems.push({
                ...item,
                itemType: 'income'
            });
        });

        paymentItems.forEach(function (item) {
            allItems.push({
                ...item,
                itemType: 'payment'
            });
        });

        allItems.sort(function (first, second) {
            if (first.itemType !== second.itemType) {
                return first.itemType === 'income' ? -1 : 1;
            }

            return second.amount - first.amount;
        });

        const visibleItems = allItems.slice(0, 3);
        const hiddenCount = allItems.length - visibleItems.length;

        const itemsHtml = visibleItems.map(function (item) {
            const className = item.itemType === 'income'
                ? 'income-event'
                : item.frequency;

            const deleteCall = item.itemType === 'income'
                ? 'deleteIncome'
                : 'deletePayment';

            const prefix = item.itemType === 'income' ? '+' : '-';

            return (
                '<div class="calendar-payment ' + className + '">' +
                    '<div class="calendar-payment-top">' +
                        '<span class="calendar-payment-name">' +
                            html(item.merchant) +
                        '</span>' +
                        '<button type="button" class="calendar-delete-button" ' +
                            'onclick="' + deleteCall + '(\'' +
                            attribute(item.id) +
                            '\')" title="Supprimer">×</button>' +
                    '</div>' +
                    '<span class="calendar-payment-amount">' +
                        prefix + compactMoney(item.amount) +
                    '</span>' +
                '</div>'
            );
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

        const dayIncome = incomeItems.reduce(function (sum, item) {
            return sum + item.amount;
        }, 0);

        const dayPayments = paymentItems.reduce(function (sum, item) {
            return sum + item.amount;
        }, 0);

        const dayTotalHtml = allItems.length > 0
            ? (
                '<div class="calendar-day-total">' +
                    'Solde : ' +
                    compactMoney(dayIncome - dayPayments) +
                '</div>'
            )
            : '';

        const todayClass = sameDate(
            new Date(year, month, day),
            new Date()
        ) ? 'today' : '';

        const itemsClass = allItems.length > 0 ? 'has-payments' : '';

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

function showDayItems(key) {
    const parts = key.split('-').map(Number);
    const year = parts[0];
    const month = parts[1] - 1;

    const incomes = itemsForMonth(AppState.incomes, year, month)[key] || [];
    const payments = itemsForMonth(AppState.payments, year, month)[key] || [];

    const incomeText = incomes.map(function (item) {
        return '• Revenu : ' + item.merchant + ' — +' + money(item.amount);
    }).join('\n');

    const paymentText = payments.map(function (item) {
        return '• Paiement : ' + item.merchant + ' — -' + money(item.amount);
    }).join('\n');

    const incomeTotal = incomes.reduce(function (sum, item) {
        return sum + item.amount;
    }, 0);

    const paymentTotal = payments.reduce(function (sum, item) {
        return sum + item.amount;
    }, 0);

    alert(
        dateLabel(key) +
        '\n\n' +
        (incomeText || '') +
        (incomeText && paymentText ? '\n' : '') +
        (paymentText || '') +
        '\n\nRevenus : ' +
        money(incomeTotal) +
        '\nPaiements : ' +
        money(paymentTotal) +
        '\nSolde : ' +
        money(incomeTotal - paymentTotal)
    );
}

function renderIncomes() {
    const container = document.getElementById('incomesList');

    if (AppState.incomes.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucun revenu pour le moment.</p>';
        return;
    }

    const sortedIncomes = [...AppState.incomes].sort(function (first, second) {
        return dateFromString(first.date) - dateFromString(second.date);
    });

    container.innerHTML = sortedIncomes.map(function (income) {
        return (
            '<div class="transaction-item income-history-item">' +
                '<div class="transaction-info">' +
                    '<div class="transaction-merchant">' +
                        html(income.merchant) +
                    '</div>' +
                    '<div class="transaction-meta">' +
                        dateLabel(income.date) +
                        ' • ' +
                        frequencyName(income.frequency) +
                    '</div>' +
                '</div>' +
                '<div class="transaction-actions">' +
                    '<div class="income-amount">+' +
                        money(income.amount) +
                    '</div>' +
                    '<button type="button" class="delete-transaction-button" ' +
                        'onclick="deleteIncome(\'' +
                        attribute(income.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
            '</div>'
        );
    }).join('');
}

function renderPayments() {
    const container = document.getElementById('transactionsList');

    if (AppState.payments.length === 0) {
        container.innerHTML =
            '<p class="empty-state">Aucun paiement pour le moment.</p>';
        return;
    }

    const sortedPayments = [...AppState.payments].sort(function (first, second) {
        return dateFromString(second.date) - dateFromString(first.date);
    });

    container.innerHTML = sortedPayments.map(function (payment) {
        return (
            '<div class="transaction-item">' +
                '<div class="transaction-info">' +
                    '<div class="transaction-merchant">' +
                        html(payment.merchant) +
                    '</div>' +
                    '<div class="transaction-meta">' +
                        dateLabel(payment.date) +
                        ' • ' +
                        categoryIcon(payment.category) +
                        ' ' +
                        categoryName(payment.category) +
                        ' • ' +
                        frequencyName(payment.frequency) +
                    '</div>' +
                '</div>' +
                '<div class="transaction-actions">' +
                    '<div class="transaction-amount">-' +
                        money(payment.amount) +
                    '</div>' +
                    '<button type="button" class="delete-transaction-button" ' +
                        'onclick="deletePayment(\'' +
                        attribute(payment.id) +
                        '\')">Supprimer</button>' +
                '</div>' +
            '</div>'
        );
    }).join('');
}

function renderCategoryStats() {
    const container = document.getElementById('categoryStats');
    const now = new Date();
    const totals = {};

    AppState.payments.forEach(function (payment) {
        const count = occurrenceCountForItem(
            payment,
            startOfMonth(now),
            endOfMonth(now)
        );

        if (count <= 0) {
            return;
        }

        totals[payment.category] =
            (totals[payment.category] || 0) +
            payment.amount * count;
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
                    '<div class="icon">' +
                        categoryIcon(category) +
                    '</div>' +
                    '<div class="name">' +
                        categoryName(category) +
                    '</div>' +
                    '<div class="amount">' +
                        money(amount) +
                    '</div>' +
                    '<div class="percent">' +
                        categoryPercent +
                        '% du mois</div>' +
                '</div>'
            );
        })
        .join('');
}

function exportPrintableReport() {
    const year = AppState.calendarDate.getFullYear();
    const month = AppState.calendarDate.getMonth();
    const monthStart = new Date(year, month, 1, 12, 0, 0, 0);

    const incomesByDay = itemsForMonth(AppState.incomes, year, month);
    const paymentsByDay = itemsForMonth(AppState.payments, year, month);

    const incomeTotal = totalByDay(incomesByDay);
    const paymentTotal = totalByDay(paymentsByDay);

    if (incomeTotal === 0 && paymentTotal === 0) {
        alert('Aucune donnée à exporter pour ce mois.');
        return;
    }

    const report = buildIncomeReportHtml(
        monthStart,
        incomesByDay,
        paymentsByDay,
        incomeTotal,
        paymentTotal
    );

    const blob = new Blob(
        [report],
        { type: 'text/html;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
        'budget-rapport-' +
        year +
        '-' +
        String(month + 1).padStart(2, '0') +
        '.html';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);

    alert(
        'Le rapport a été téléchargé. Ouvrez le fichier HTML puis imprimez-le ou enregistrez-le en PDF.'
    );
}

function buildIncomeReportHtml(
    monthStart,
    incomesByDay,
    paymentsByDay,
    incomeTotal,
    paymentTotal
) {
    const details = buildReportDetails(
        incomesByDay,
        paymentsByDay
    );

    return (
        '<!DOCTYPE html>' +
        '<html lang="fr-CA">' +
        '<head>' +
            '<meta charset="UTF-8">' +
            '<title>Budget - ' + html(monthTitle(monthStart)) + '</title>' +
            '<style>' +
                '* { box-sizing: border-box; }' +
                'body { color: #111827; font-family: Arial, sans-serif; margin: 0; padding: 24px; }' +
                'h1 { color: #312E81; }' +
                '.summary { background: #EEF2FF; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }' +
                '.summary div { min-width: 170px; }' +
                '.label { color: #4B5563; display: block; font-size: 12px; text-transform: uppercase; }' +
                '.value { font-size: 20px; font-weight: 700; }' +
                '.print { background: #0F766E; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 16px; font-weight: 700; margin: 20px 0; padding: 12px 18px; }' +
                '.day { border: 1px solid #D1D5DB; border-radius: 8px; break-inside: avoid; margin: 12px 0; padding: 14px; }' +
                '.day-header { border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; padding-bottom: 8px; }' +
                '.income { color: #047857; }' +
                '.expense { color: #B91C1C; }' +
                'ul { margin-bottom: 0; }' +
                '@media print { .print { display: none; } }' +
            '</style>' +
        '</head>' +
        '<body>' +
            '<h1>Budget Automatisé</h1>' +
            '<h2>' + html(monthTitle(monthStart)) + '</h2>' +
            '<button class="print" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button>' +
            '<div class="summary">' +
                '<div><span class="label">Revenus prévus</span><span class="value income">+' +
                    html(money(incomeTotal)) +
                '</span></div>' +
                '<div><span class="label">Paiements prévus</span><span class="value expense">-' +
                    html(money(paymentTotal)) +
                '</span></div>' +
                '<div><span class="label">Solde planifié</span><span class="value">' +
                    html(money(incomeTotal - paymentTotal)) +
                '</span></div>' +
            '</div>' +
            '<h2>Tous les revenus et paiements</h2>' +
            details +
        '</body>' +
        '</html>'
    );
}

function buildReportDetails(incomesByDay, paymentsByDay) {
    const allDates = new Set([
        ...Object.keys(incomesByDay),
        ...Object.keys(paymentsByDay)
    ]);

    return Array.from(allDates)
        .sort(function (first, second) {
            return dateFromString(first) - dateFromString(second);
        })
        .map(function (date) {
            const incomes = incomesByDay[date] || [];
            const payments = paymentsByDay[date] || [];

            const incomeRows = incomes.map(function (item) {
                return '<li class="income">Revenu : ' +
                    html(item.merchant) +
                    ' — +' +
                    html(money(item.amount)) +
                    ' (' +
                    html(frequencyName(item.frequency)) +
                    ')</li>';
            }).join('');

            const paymentRows = payments.map(function (item) {
                return '<li class="expense">Paiement : ' +
                    html(item.merchant) +
                    ' — -' +
                    html(money(item.amount)) +
                    ' (' +
                    html(frequencyName(item.frequency)) +
                    ')</li>';
            }).join('');

            const incomeTotal = incomes.reduce(function (sum, item) {
                return sum + item.amount;
            }, 0);

            const paymentTotal = payments.reduce(function (sum, item) {
                return sum + item.amount;
            }, 0);

            return (
                '<section class="day">' +
                    '<div class="day-header">' +
                        '<strong>' + html(dateLabel(date)) + '</strong>' +
                        '<strong>Solde : ' +
                            html(money(incomeTotal - paymentTotal)) +
                        '</strong>' +
                    '</div>' +
                    '<ul>' +
                        incomeRows +
                        paymentRows +
                    '</ul>' +
                '</section>'
            );
        })
        .join('');
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

    if (!firstDate || firstDate > end) {
        return [];
    }

    if (item.frequency === 'one-time') {
        return firstDate >= start && firstDate <= end
            ? [firstDate]
            : [];
    }

    const interval = item.frequency === 'weekly'
        ? 7
        : item.frequency === 'biweekly'
            ? 14
            : 0;

    if (interval > 0) {
        const current = new Date(firstDate);
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

    if (item.frequency === 'monthly') {
        return monthlyDates(firstDate, start, end);
    }

    return [];
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
    document.getElementById(id).textContent = text;
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
