const AppState = {
    monthlyBudget: 0,
    weeklyBudget: 0,
    payments: [],
    calendarDate: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
        12,
        0,
        0,
        0
    )
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
                id: String(
                    payment.id ||
                    createLegacyId(payment, index)
                ),
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

    alert('Budget enregistré.');
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
                'Un champ du formulaire est introuvable. Vérifiez que index.html a été remplacé au complet.'
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
            AppState.calendarDate = new Date(
                paymentDate.getFullYear(),
                paymentDate.getMonth(),
                1,
                12,
                0,
                0,
                0
            );
        }

        saveData();
        refreshApp();

        amountInput.value = '';
        merchantInput.value = '';
        dateInput.value = localDateString(new Date());
        frequencyInput.value = 'one-time';
        categoryInput.value = 'groceries';

        alert('Paiement ajouté : ' + merchant + ' — ' + money(amount));
    } catch (error) {
        console.error('Erreur lors de l’ajout :', error);
        alert(
            'Une erreur est survenue lors de l’ajout. Vérifiez que le montant, la date et les autres champs sont remplis.'
        );
    }
}

function deletePayment(paymentId) {
    const payment = AppState.payments.find(function (item) {
        return String(item.id) === String(paymentId);
    });

    if (!payment) {
        alert('Paiement introuvable. Actualisez la page puis réessayez.');
        return;
    }

    const recurringMessage = payment.frequency === 'one-time'
        ? ''
        : '\n\nToutes les répétitions futures seront aussi retirées.';

    const confirmed = confirm(
        'Supprimer ce paiement ?\n\n' +
        payment.merchant +
        ' — ' +
        money(payment.amount) +
        recurringMessage
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
    const confirmed = confirm(
        'Voulez-vous vraiment effacer tous les paiements ?'
    );

    if (!confirmed) {
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

    title.textContent = new Intl.DateTimeFormat('fr-CA', {
        month: 'long',
        year: 'numeric'
    }).format(start);

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

    const byDay = paymentsForMonth(year, month);

    const payments = (byDay[key] || []).sort(function (first, second) {
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
        '\n\nTotal : ' +
        money(total) +
        '\n\nPour supprimer : utilisez le × sur un paiement visible ou le bouton Supprimer dans l’historique.'
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

function exportCalendar() {
    if (AppState.payments.length === 0) {
        alert('Ajoutez au moins un paiement avant d’exporter.');
        return;
    }

    const stamp = icsDateTime(new Date());

    const events = AppState.payments.map(function (payment) {
        const start = dateFromString(payment.date);
        const end = new Date(start);

        end.setDate(end.getDate() + 1);

        const lines = [
            'BEGIN:VEVENT',
            'UID:' + icsText(payment.id) + '@budget-automatise',
            'DTSTAMP:' + stamp,
            'DTSTART;VALUE=DATE:' + icsDate(start),
            'DTEND;VALUE=DATE:' + icsDate(end),
            'SUMMARY:' + icsText(
                'Paiement : ' +
                payment.merchant +
                ' (' +
                money(payment.amount) +
                ')'
            ),
            'DESCRIPTION:' + icsText(
                'Montant : ' + money(payment.amount) + '\n' +
                'Catégorie : ' + categoryName(payment.category) + '\n' +
                'Fréquence : ' + frequencyName(payment.frequency)
            )
        ];

        const recurrence = icsRecurrence(payment.frequency);

        if (recurrence) {
            lines.push(recurrence);
        }

        lines.push('END:VEVENT');

        return lines.join('\r\n');
    });

    const content = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'CALSCALE:GREGORIAN',
        'PRODID:-//Budget Automatisé//FR-CA//',
        'X-WR-CALNAME:Paiements Budget',
        ...events,
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob(
        [content],
        { type: 'text/calendar;charset=utf-8' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'budget-calendrier-' +
        localDateString(new Date()) +
        '.ics';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);

    alert(
        'Le fichier .ics a été téléchargé. Ouvrez-le dans vos téléchargements pour l’importer dans votre calendrier.'
    );
}

function icsRecurrence(frequency) {
    if (frequency === 'weekly') {
        return 'RRULE:FREQ=WEEKLY;INTERVAL=1';
    }

    if (frequency === 'biweekly') {
        return 'RRULE:FREQ=WEEKLY;INTERVAL=2';
    }

    if (frequency === 'monthly') {
        return 'RRULE:FREQ=MONTHLY;INTERVAL=1';
    }

    return '';
}

function paymentsForMonth(year, month) {
    const start = new Date(year, month, 1, 12, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 12, 0, 0, 0);
    const byDay = {};

    AppState.payments.forEach(function (payment) {
        occurrenceDates(payment, start, end).forEach(function (date) {
            const key = dateKey(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );

            if (!byDay[key]) {
                byDay[key] = [];
            }

            byDay[key].push(payment);
        });
    });

    return byDay;
}

function spentInPeriod(start, end) {
    return AppState.payments.reduce(function (total, payment) {
        return total + payment.amount * occurrencesInPeriod(
            payment,
            start,
            end
        );
    }, 0);
}

function occurrencesInPeriod(payment, start, end) {
    return occurrenceDates(payment, start, end).length;
}

function occurrenceDates(payment, start, end) {
    const paymentStart = dateFromString(payment.date);

    if (!paymentStart || paymentStart > end) {
        return [];
    }

    if (payment.frequency === 'one-time') {
        return paymentStart >= start && paymentStart <= end
            ? [paymentStart]
            : [];
    }

    const interval = payment.frequency === 'weekly'
        ? 7
        : payment.frequency === 'biweekly'
            ? 14
            : 0;

    if (interval > 0) {
        const date = new Date(paymentStart);
        const dates = [];

        while (date < start) {
            date.setDate(date.getDate() + interval);
        }

        while (date <= end) {
            dates.push(new Date(date));
            date.setDate(date.getDate() + interval);
        }

        return dates;
    }

    if (payment.frequency === 'monthly') {
        return monthlyDates(paymentStart, start, end);
    }

    return [];
}

function monthlyDates(paymentStart, start, end) {
    let year = paymentStart.getFullYear();
    let month = paymentStart.getMonth();
    const day = paymentStart.getDate();

    let date = monthlyDate(year, month, day);

    while (date < start) {
        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        date = monthlyDate(year, month, day);
    }

    const dates = [];

    while (date <= end) {
        if (date >= paymentStart) {
            dates.push(new Date(date));
        }

        month += 1;

        if (month > 11) {
            month = 0;
            year += 1;
        }

        date = monthlyDate(year, month, day);
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

    if (!element) {
        return;
    }

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

    if (!element) {
        return;
    }

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

function percent(spent, budget) {
    if (!Number.isFinite(budget) || budget <= 0) {
        return 0;
    }

    return Math.min(Math.round((spent / budget) * 100), 100);
}

function validFrequency(value) {
    const values = [
        'one-time',
        'weekly',
        'biweekly',
        'monthly'
    ];

    return values.includes(value) ? value : 'one-time';
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
    const day = result.getDay();
    const sinceMonday = (day + 6) % 7;

    result.setDate(result.getDate() - sinceMonday);
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

    if (!date) {
        return 'Date inconnue';
    }

    return new Intl.DateTimeFormat('fr-CA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(date);
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

function icsDate(date) {
    return (
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0')
    );
}

function icsDateTime(date) {
    return (
        date.getUTCFullYear() +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        String(date.getUTCDate()).padStart(2, '0') +
        'T' +
        String(date.getUTCHours()).padStart(2, '0') +
        String(date.getUTCMinutes()).padStart(2, '0') +
        String(date.getUTCSeconds()).padStart(2, '0') +
        'Z'
    );
}

function icsText(text) {
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function createId() {
    if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return Date.now() + '-' + Math.random().toString(16).slice(2);
}

function createLegacyId(payment, index) {
    return (
        'old-' +
        String(payment.merchant || 'payment') +
        '-' +
        String(payment.amount || 0) +
        '-' +
        String(payment.date || '') +
        '-' +
        index
    ).replace(/\s/g, '-');
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
