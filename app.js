const AppState = {
    monthlyBudget: 0,
    weeklyBudget: 0,
    payments: [],
    calendarDate: firstDayOfMonth(new Date())
};

document.addEventListener('DOMContentLoaded', function () {
    loadData();

    const budgetInput = document.getElementById('monthlyBudget');
    const dateInput = document.getElementById('expenseDate');

    if (budgetInput) {
        budgetInput.value = AppState.monthlyBudget || '';
    }

    if (dateInput) {
        dateInput.value = localDateString(new Date());
    }

    refreshApp();
});

function loadData() {
    const saved = localStorage.getItem('budgetApp');

    if (!saved) {
        return;
    }

    try {
        const data = JSON.parse(saved);

        AppState.monthlyBudget = Number(data.monthlyBudget) || 0;
        AppState.weeklyBudget = Number(data.weeklyBudget) || 0;

        const oldPayments = Array.isArray(data.payments)
            ? data.payments
            : Array.isArray(data.transactions)
                ? data.transactions
                : [];

        AppState.payments = oldPayments.map(function (payment, index) {
            return {
                id: String(payment.id || createLegacyId(payment, index)),
                amount: Number(payment.amount) || 0,
                merchant: payment.merchant || 'Paiement sans nom',
                category: payment.category || 'other',
                date: payment.date || localDateString(
                    new Date(payment.timestamp || new Date())
                ),
                frequency: validFrequency(payment.frequency),
                timestamp: payment.timestamp || new Date().toISOString()
            };
        });

        saveData();
    } catch (error) {
        console.error('Erreur de lecture des données :', error);

        AppState.monthlyBudget = 0;
        AppState.weeklyBudget = 0;
        AppState.payments = [];
    }
}

function saveData() {
    localStorage.setItem('budgetApp', JSON.stringify({
        monthlyBudget: AppState.monthlyBudget,
        weeklyBudget: AppState.weeklyBudget,
        payments: AppState.payments
    }));
}

function saveBudget() {
    const input = document.getElementById('monthlyBudget');

    if (!input) {
        return;
    }

    const amount = Number.parseFloat(input.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert('Veuillez entrer un budget mensuel valide.');
        return;
    }

    AppState.monthlyBudget = amount;
    AppState.weeklyBudget = amount / 4.33;

    saveData();
    refreshApp();
}

function addPayment() {
    try {
        const amountInput = document.getElementById('expenseAmount');
        const merchantInput = document.getElementById('expenseMerchant');
        const dateInput = document.getElementById('expenseDate');
        const frequencyInput = document.getElementById('expenseFrequency');
        const categoryInput = document.getElementById('expenseCategory');

        if (
            !amountInput ||
            !merchantInput ||
            !dateInput ||
            !frequencyInput ||
            !categoryInput
        ) {
            alert(
                'Un champ du formulaire est introuvable. Vérifiez que index.html a été remplacé correctement.'
            );
            return;
        }

        const amount = Number.parseFloat(amountInput.value);
        const merchant = merchantInput.value.trim() || 'Paiement sans nom';
        const date = dateInput.value;
        const frequency = validFrequency(frequencyInput.value);
        const category = categoryInput.value;

        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Veuillez entrer un montant valide, par exemple 24.99.');
            return;
        }

        if (!date) {
            alert('Veuillez choisir une date de départ.');
            return;
        }

        const payment = {
            id: createId(),
            amount: amount,
            merchant: merchant,
            category: category,
            date: date,
            frequency: frequency,
            timestamp: new Date().toISOString()
        };

        AppState.payments.unshift(payment);

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
    } catch (error) {
        console.error('Erreur lors de l’ajout :', error);
        alert('Une erreur est survenue pendant l’ajout du paiement.');
    }
}

function deletePayment(paymentId) {
    const payment = AppState.payments.find(function (item) {
        return String(item.id) === String(paymentId);
    });

    if (!payment) {
        alert('Paiement introuvable. Actualisez la page et réessayez.');
        return;
    }

    const message = payment.frequency === 'one-time'
        ? ''
        : '\n\nToutes les répétitions futures seront aussi retirées.';

    const confirmed = confirm(
        'Supprimer ce paiement ?\n\n' +
        payment.merchant +
        ' — ' +
        money(payment.amount) +
        message
    );

    if (!confirmed) {
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

    renderCalendar();
}

function refreshApp() {
    renderBudget();
    renderCalendar();
    renderHistory();
    renderCategoryStats();
}

function renderBudget() {
    const now = new Date();

    const monthlySpent = spentInPeriod(
        startOfMonth(now),
        endOfMonth(now)
    );

    const weeklySpent = spentInPeriod(
        startOfWeek(now),
        endOfWeek(now)
    );

    setText('monthlyTotal', money(AppState.monthlyBudget));
    setText('weeklyTotal', money(AppState.weeklyBudget));
    setText('monthlySpent', money(monthlySpent));
    setText('weeklySpent', money(weeklySpent));

    const monthlyPercent = percent(monthlySpent, AppState.monthlyBudget);
    const weeklyPercent = percent(weeklySpent, AppState.weeklyBudget);

    setText('monthlyPercent', monthlyPercent + '%');
    setText('weeklyPercent', weeklyPercent + '%');

    updateBar('monthlyProgress', monthlyPercent);
    updateBar('weeklyProgress', weeklyPercent);

    updateRemaining(
        'monthlyRemaining',
        AppState.monthlyBudget - monthlySpent
    );

    updateRemaining(
        'weeklyRemaining',
        AppState.weeklyBudget - weeklySpent
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

    const start = new Date(year, month, 1, 12, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 12, 0, 0, 0);

    title.textContent = monthTitle(start);

    const paymentsByDay = paymentsForMonth(year, month);

    const monthTotal = Object.values(paymentsByDay)
        .flat()
        .reduce(function (sum, payment) {
            return sum + payment.amount;
        }, 0);

    summary.textContent = money(monthTotal) + ' planifié ce mois-ci';

    const cells = [];
    const firstWeekday = mondayWeekday(start);
    const daysInMonth = end.getDate();

    for (let index = 0; index < firstWeekday; index += 1) {
        cells.push('<div class="calendar-day empty-day"></div>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const key = dateKey(year, month, day);

        const dayPayments = (paymentsByDay[key] || [])
            .sort(function (first, second) {
                return second.amount - first.amount;
            });

        const visiblePayments = dayPayments.slice(0, 3);
        const hiddenCount = dayPayments.length - visiblePayments.length;

        const paymentsHtml = visiblePayments.map(function (payment) {
            return (
                '<div class="calendar-payment ' + payment.frequency + '">' +
                    '<div class="calendar-payment-top">' +
                        '<span class="calendar-payment-name">' +
                            html(payment.merchant) +
                        '</span>' +
                        '<button type="button" class="calendar-delete-button" ' +
                            'onclick="deletePayment(\'' +
                            attribute(payment.id) +
                            '\')" title="Supprimer">×</button>' +
                    '</div>' +
                    '<span class="calendar-payment-amount">' +
                        compactMoney(payment.amount) +
                    '</span>' +
                '</div>'
            );
        }).join('');

        const moreHtml = hiddenCount > 0
            ? (
                '<button type="button" class="calendar-more-payments" ' +
                    'onclick="showDayPayments(\'' + key + '\')">' +
                    '+ ' + hiddenCount + ' autre' +
                    (hiddenCount > 1 ? 's' : '') +
                '</button>'
            )
            : '';

        const dayTotal = dayPayments.reduce(function (sum, payment) {
            return sum + payment.amount;
        }, 0);

        const totalHtml = dayPayments.length > 0
            ? '<div class="calendar-day-total">' +
                compactMoney(dayTotal) +
              '</div>'
            : '';

        const todayClass = sameDate(
            new Date(year, month, day),
            new Date()
        ) ? 'today' : '';

        const paymentClass = dayPayments.length > 0
            ? 'has-payments'
            : '';

        cells.push(
            '<div class="calendar-day ' + todayClass + ' ' + paymentClass + '">' +
                '<div class="calendar-day-number">' + day + '</div>' +
                paymentsHtml +
                moreHtml +
                totalHtml +
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

function showDayPayments(key) {
    const parts = key.split('-').map(Number);
    const year = parts[0];
    const month = parts[1] - 1;

    const payments = (paymentsForMonth(year, month)[key] || [])
        .sort(function (first, second) {
            return second.amount - first.amount;
        });

    if (payments.length === 0) {
        return;
    }

    const list = payments.map(function (payment, index) {
        return (
            (index + 1) + '. ' +
            payment.merchant +
            ' — ' +
            money(payment.amount) +
            ' (' +
            frequencyName(payment.frequency) +
            ')'
        );
    }).join('\n');

    const total = payments.reduce(function (sum, payment) {
        return sum + payment.amount;
    }, 0);

    alert(
        dateLabel(key) +
        '\n\n' +
        list +
        '\n\nTotal : ' + money(total)
    );
}

function renderHistory() {
    const container = document.getElementById('transactionsList');

    if (!container) {
        return;
    }

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

    if (!container) {
        return;
    }

    const now = new Date();
    const totals = {};

    AppState.payments.forEach(function (payment) {
        const count = occurrencesInPeriod(
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
    const paymentsByDay = paymentsForMonth(year, month);

    const allPayments = Object.values(paymentsByDay).flat();

    if (allPayments.length === 0) {
        alert(
            'Il n’y a aucun paiement prévu dans ' +
            monthTitle(monthStart) +
            '.'
        );
        return;
    }

    const monthTotal = allPayments.reduce(function (sum, payment) {
        return sum + payment.amount;
    }, 0);

    const detailedList = Object.entries(paymentsByDay)
        .sort(function (first, second) {
            return dateFromString(first[0]) - dateFromString(second[0]);
        })
        .map(function (entry) {
            const date = entry[0];
            const payments = entry[1].sort(function (first, second) {
                return second.amount - first.amount;
            });

            const dayTotal = payments.reduce(function (sum, payment) {
                return sum + payment.amount;
            }, 0);

            const paymentRows = payments.map(function (payment) {
                return (
                    '<li>' +
                        '<strong>' + html(payment.merchant) + '</strong>' +
                        ' — ' + html(money(payment.amount)) +
                        ' <span class="badge ' + payment.frequency + '">' +
                            html(frequencyName(payment.frequency)) +
                        '</span>' +
                        '<br><span class="details">' +
                            html(categoryIcon(payment.category) + ' ' + categoryName(payment.category)) +
                        '</span>' +
                    '</li>'
                );
            }).join('');

            return (
                '<section class="day-section">' +
                    '<div class="day-header">' +
                        '<h3>' + html(dateLabel(date)) + '</h3>' +
                        '<strong>Total : ' + html(money(dayTotal)) + '</strong>' +
                    '</div>' +
                    '<ul>' + paymentRows + '</ul>' +
                '</section>'
            );
        })
        .join('');

    const calendarHtml = printableCalendar(year, month, paymentsByDay);

    const reportWindow = window.open('', '_blank');

    if (!reportWindow) {
        alert(
            'Le navigateur a bloqué la fenêtre du rapport. Autorisez les fenêtres pop-up pour ce site et réessayez.'
        );
        return;
    }

    reportWindow.document.open();
    reportWindow.document.write(
        '<!DOCTYPE html>' +
        '<html lang="fr-CA">' +
        '<head>' +
            '<meta charset="UTF-8">' +
            '<title>Budget - ' + html(monthTitle(monthStart)) + '</title>' +
            '<style>' +
                '* { box-sizing: border-box; }' +
                'body { color: #111827; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; }' +
                'h1 { color: #312E81; margin: 0 0 4px; }' +
                'h2 { color: #312E81; margin: 28px 0 12px; }' +
                '.subtitle { color: #4B5563; margin: 0 0 18px; }' +
                '.summary { background: #EEF2FF; border-left: 5px solid #4F46E5; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; padding: 16px; }' +
                '.summary-item { min-width: 160px; }' +
                '.summary-label { color: #4B5563; display: block; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; }' +
                '.summary-value { font-size: 18px; font-weight: 700; }' +
                '.print-button { background: #0F766E; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 16px; font-weight: 700; margin-bottom: 20px; padding: 12px 18px; }' +
                '.calendar { border-left: 1px solid #9CA3AF; border-top: 1px solid #9CA3AF; display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 28px; }' +
                '.weekday { background: #EDE9FE; border-bottom: 1px solid #9CA3AF; border-right: 1px solid #9CA3AF; font-size: 12px; font-weight: 700; padding: 8px 4px; text-align: center; }' +
                '.day { border-bottom: 1px solid #9CA3AF; border-right: 1px solid #9CA3AF; min-height: 115px; padding: 6px; }' +
                '.empty-day { background: #F9FAFB; }' +
                '.day-number { font-weight: 700; margin-bottom: 5px; }' +
                '.calendar-payment { border-left: 4px solid #6B7280; border-radius: 3px; font-size: 10px; line-height: 1.3; margin-bottom: 4px; padding: 3px; word-break: break-word; }' +
                '.calendar-payment.one-time { background: #FEF3C7; border-left-color: #F59E0B; }' +
                '.calendar-payment.weekly { background: #DCFCE7; border-left-color: #10B981; }' +
                '.calendar-payment.biweekly { background: #FCE7F3; border-left-color: #DB2777; }' +
                '.calendar-payment.monthly { background: #E0E7FF; border-left-color: #4F46E5; }' +
                '.day-total { font-size: 10px; font-weight: 700; margin-top: 4px; }' +
                '.day-section { border: 1px solid #D1D5DB; border-radius: 8px; break-inside: avoid; margin-bottom: 12px; padding: 14px; }' +
                '.day-header { align-items: center; border-bottom: 1px solid #E5E7EB; display: flex; gap: 12px; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; }' +
                '.day-header h3 { margin: 0; }' +
                'ul { margin: 0; padding-left: 20px; }' +
                'li { margin-bottom: 8px; }' +
                '.details { color: #4B5563; font-size: 13px; }' +
                '.badge { border-radius: 12px; color: #111827; font-size: 11px; font-weight: 700; padding: 2px 7px; }' +
                '.badge.one-time { background: #FEF3C7; }' +
                '.badge.weekly { background: #DCFCE7; }' +
                '.badge.biweekly { background: #FCE7F3; }' +
                '.badge.monthly { background: #E0E7FF; }' +
                '.footer { color: #6B7280; font-size: 12px; margin-top: 24px; }' +
                '@media print { body { padding: 10mm; } .print-button { display: none; } .calendar { break-inside: avoid; } @page { margin: 10mm; size: landscape; } }' +
            '</style>' +
        '</head>' +
        '<body>' +
            '<h1>Budget Automatisé</h1>' +
            '<p class="subtitle">Rapport des paiements — ' +
                html(monthTitle(monthStart)) +
            '</p>' +
            '<button class="print-button" onclick="window.print()">' +
                '🖨️ Imprimer ou enregistrer en PDF' +
            '</button>' +
            '<div class="summary">' +
                '<div class="summary-item">' +
                    '<span class="summary-label">Mois</span>' +
                    '<span class="summary-value">' +
                        html(monthTitle(monthStart)) +
                    '</span>' +
                '</div>' +
                '<div class="summary-item">' +
                    '<span class="summary-label">Paiements prévus</span>' +
                    '<span class="summary-value">' +
                        allPayments.length +
                    '</span>' +
                '</div>' +
                '<div class="summary-item">' +
                    '<span class="summary-label">Total planifié</span>' +
                    '<span class="summary-value">' +
                        html(money(monthTotal)) +
                    '</span>' +
                '</div>' +
                '<div class="summary-item">' +
                    '<span class="summary-label">Budget mensuel</span>' +
                    '<span class="summary-value">' +
                        html(money(AppState.monthlyBudget)) +
                    '</span>' +
                '</div>' +
            '</div>' +
            '<h2>Calendrier du mois</h2>' +
            calendarHtml +
            '<h2>Tous les paiements prévus</h2>' +
            detailedList +
            '<p class="footer">Rapport généré le ' +
                html(new Intl.DateTimeFormat('fr-CA', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }).format(new Date())) +
            '.</p>' +
        '</body>' +
        '</html>'
    );

    reportWindow.document.close();
    reportWindow.focus();
}

function printableCalendar(year, month, paymentsByDay) {
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

        const payments = (paymentsByDay[key] || [])
            .sort(function (first, second) {
                return second.amount - first.amount;
            });

        const paymentHtml = payments.map(function (payment) {
            return (
                '<div class="calendar-payment ' + payment.frequency + '">' +
                    '<strong>' + html(payment.merchant) + '</strong><br>' +
                    html(money(payment.amount)) +
                '</div>'
            );
        }).join('');

        const total = payments.reduce(function (sum, payment) {
            return sum + payment.amount;
        }, 0);

        const totalHtml = payments.length > 0
            ? '<div class="day-total">Total : ' + html(money(total)) + '</div>'
            : '';

        output += (
            '<div class="day">' +
                '<div class="day-number">' + day + '</div>' +
                paymentHtml +
                totalHtml +
            '</div>'
        );
    }

    const usedCells = firstWeekday + end.getDate();
    const missingCells = usedCells % 7 === 0
        ? 0
        : 7 - (usedCells % 7);

    for (let index = 0; index < missingCells; index += 1)
