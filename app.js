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
        alert(
            'Impossible de lire les données sauvegardées. Elles ne sont pas remplacées automatiquement.'
        );
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
        alert('Entrez
