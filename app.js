const CATEGORIES = [
  { name: "Alimentación", icon: "🍲", tone: "food" },
  { name: "Vivienda", icon: "⌂", tone: "home" },
  { name: "Transporte", icon: "↗", tone: "transport" },
  { name: "Salud", icon: "✚", tone: "health" },
  { name: "Entretenimiento", icon: "♫", tone: "fun" },
  { name: "Compras", icon: "◇", tone: "shopping" },
  { name: "Servicios", icon: "⌁", tone: "services" },
  { name: "Obligaciones o deudas", icon: "$", tone: "debt" },
  { name: "Ahorro", icon: "↗", tone: "savings" },
  { name: "Otros", icon: "•••", tone: "other" },
];
const TYPES = [
  { name: "Necesario", color: "#44ae87" },
  { name: "Hormiga", color: "#efa74c" },
  { name: "Recurrente", color: "#7394d1" },
  { name: "Ocasional", color: "#9584dd" },
];
const MOVEMENT_TYPES = [
  "Gasto",
  "Ingreso",
  "Pago a tarjeta",
  "Pago a entidad",
  "Transferencia propia",
  "Devolución / reembolso",
];
const INCOME_CATEGORIES = ["Salario", "Transferencia recibida", "Ventas", "Otros ingresos"];
const OTHER_CATEGORIES = ["Transferencia entre cuentas", "Devolución / reembolso"];
const ALL_CATEGORIES = [...CATEGORIES.map((category) => category.name), ...INCOME_CATEGORIES, ...OTHER_CATEGORIES];
const DEBT_CATEGORY = "Obligaciones o deudas";
const SAVINGS_CATEGORY = "Ahorro";
const PAYMENT_METHODS = [
  { name: "Nu", tone: "nu" },
  { name: "Bogotá", tone: "bogota" },
  { name: "Bancolombia", tone: "bank" },
  { name: "Nequi", tone: "bank" },
  { name: "Caja Social", tone: "bank" },
  { name: "Davivienda", tone: "bank" },
  { name: "BBVA", tone: "bank" },
  { name: "Scotiabank Colpatria", tone: "bank" },
  { name: "Banco Popular", tone: "bank" },
  { name: "Banco Agrario", tone: "bank" },
  { name: "AV Villas", tone: "bank" },
  { name: "Banco Falabella", tone: "bank" },
  { name: "DaviPlata", tone: "bank" },
  { name: "Lulo Bank", tone: "bank" },
  { name: "Ualá", tone: "bank" },
  { name: "No aplica", tone: "none" },
];
const UNCLASSIFIED_PAYMENT_METHOD = { name: "Sin clasificar", tone: "unknown" };
const CUSTOM_PAYMENT_METHOD_VALUE = "__custom_payment_method__";
const STORAGE_KEY = "misgastos-expenses-v1";
const BACKUP_FORMAT = "misgastos-backup";
const BACKUP_VERSION = 1;
const COP_FORMATTER = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const USD_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const $ = (selector) => document.querySelector(selector);
const dialog = $("#expense-dialog");
const form = $("#expense-form");
const paymentDialog = $("#payment-dialog");
const paymentForm = $("#payment-form");
const bulkPaymentDialog = $("#bulk-payment-dialog");
const bulkPaymentForm = $("#bulk-payment-form");
const monthFilter = $("#month-filter");
const backupFileInput = $("#backup-file");
let transactions = [];
let storageReady = true;
let toastTimer;
let editingPaymentExpenseId = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateTransactions(data) {
  if (!Array.isArray(data) || data.some((item) =>
    !item || typeof item.id !== "string" || typeof item.name !== "string" ||
    typeof item.amount !== "number" || !Number.isFinite(item.amount) ||
    !["COP", "USD"].includes(item.currency) || typeof item.date !== "string" ||
    (item.movementType !== undefined && !MOVEMENT_TYPES.includes(item.movementType))
  )) {
    throw new Error("Los datos guardados no tienen el formato esperado.");
  }
  return data;
}

function readTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    return validateTransactions(JSON.parse(saved));
  } catch (error) {
    storageReady = false;
    showToast(`No se pudieron leer tus movimientos guardados: ${error.message}`);
    return [];
  }
}

function saveTransactions() {
  if (!storageReady) {
    showToast("No se guardaron los cambios porque no se pudieron leer los movimientos previos.");
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    showToast(`No se pudieron guardar tus movimientos: ${error.message}`);
    return false;
  }
}

function exportBackup() {
  if (!storageReady) {
    showToast("No se puede crear una copia porque no se pudieron leer los movimientos guardados.");
    return;
  }
  try {
    const backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      transactions,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mis-gastos-copia-${localDateString()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Copia descargada. Guárdala en un lugar seguro.");
  } catch (error) {
    showToast(`No se pudo descargar la copia: ${error.message}`);
  }
}

async function importBackup(file) {
  if (!storageReady) {
    showToast("No se puede restaurar una copia porque no se pudieron leer los movimientos guardados.");
    return;
  }
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (error) {
    showToast(`No se pudo leer el archivo de copia: ${error.message}`);
    return;
  }
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
    showToast("El archivo no es una copia válida de Mis gastos.");
    return;
  }
  let importedTransactions;
  try {
    importedTransactions = validateTransactions(backup.transactions);
  } catch (error) {
    showToast(`La copia no contiene movimientos válidos: ${error.message}`);
    return;
  }
  const knownIds = new Set(transactions.map((transaction) => transaction.id));
  const newTransactions = importedTransactions.filter((transaction) => {
    if (knownIds.has(transaction.id)) return false;
    knownIds.add(transaction.id);
    return true;
  });
  if (newTransactions.length === 0) {
    showToast("La copia no contiene movimientos nuevos; tus datos actuales se conservaron.");
    return;
  }
  const previousTransactions = transactions;
  transactions = [...transactions, ...newTransactions];
  if (!saveTransactions()) {
    transactions = previousTransactions;
    return;
  }
  render();
  showToast(`Se agregaron ${newTransactions.length} movimientos sin borrar los que ya tenías.`);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 4000);
}

function formatCOP(value) {
  return COP_FORMATTER.format(Math.round(value));
}

function formatUSD(value) {
  return USD_FORMATTER.format(value);
}

function toCOP(transaction) {
  return transaction.currency === "USD" ? transaction.amount * transaction.exchangeRate : transaction.amount;
}

function getMovementType(transaction) {
  return MOVEMENT_TYPES.includes(transaction.movementType) ? transaction.movementType : "Gasto";
}

function movementLabel(movementType) {
  return movementType === "Transferencia propia" ? "Transferencia entre cuentas" : movementType;
}

function isExpense(transaction) {
  return ["Gasto", "Pago a tarjeta", "Pago a entidad"].includes(getMovementType(transaction));
}

function isSavingsTransfer(transaction) {
  return getMovementType(transaction) === "Transferencia propia" && transaction.paymentMethod === "Nu";
}

function getPaymentMethods() {
  const methods = PAYMENT_METHODS.filter((method) => method.name !== "No aplica");
  const knownNames = new Set(PAYMENT_METHODS.map((method) => method.name));
  const customNames = new Set();
  transactions.forEach((transaction) => {
    const name = typeof transaction.paymentMethod === "string" ? transaction.paymentMethod.trim() : "";
    if (name && !knownNames.has(name) && name !== UNCLASSIFIED_PAYMENT_METHOD.name) customNames.add(name);
  });
  customNames.forEach((name) => methods.push({ name, tone: "custom" }));
  return [PAYMENT_METHODS.find((method) => method.name === "No aplica"), ...methods];
}

function getCardPaymentMethods() {
  return getPaymentMethods().filter((method) => method.name !== "No aplica");
}

function isCreditPaymentMethod(paymentMethod) {
  return Boolean(paymentMethod) &&
    paymentMethod !== "No aplica" &&
    paymentMethod !== UNCLASSIFIED_PAYMENT_METHOD.name &&
    paymentMethod !== CUSTOM_PAYMENT_METHOD_VALUE;
}

function isDeferredCardPurchase(transaction) {
  return getMovementType(transaction) === "Gasto" && isCreditPaymentMethod(transaction.paymentMethod);
}

function getMovementCategory(transaction) {
  if (["Pago a tarjeta", "Pago a entidad"].includes(getMovementType(transaction))) return DEBT_CATEGORY;
  if (isSavingsTransfer(transaction)) return SAVINGS_CATEGORY;
  return transaction.category;
}

function getExpenseType(transaction) {
  return ["Pago a tarjeta", "Pago a entidad"].includes(getMovementType(transaction))
    ? "Necesario"
    : transaction.type;
}

function isIncome(transaction) {
  return ["Ingreso", "Devolución / reembolso"].includes(getMovementType(transaction));
}

function selectedMonthTransactions() {
  const month = monthFilter.value;
  return transactions.filter((transaction) => transaction.date.slice(0, 7) === month);
}

function dateLabel(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function monthLabel(monthString) {
  if (!monthString) return "";
  const [year, month] = monthString.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fillSelect(select, options, firstLabel) {
  select.replaceChildren(new Option(firstLabel, ""));
  options.forEach((option) => select.add(new Option(option, option)));
}

function fillPaymentSelect(select, { firstLabel, includeNoApply = true, includeCustom = false, includeUnclassified = false } = {}) {
  select.replaceChildren();
  if (firstLabel) select.add(new Option(firstLabel, ""));
  getPaymentMethods()
    .filter((method) => includeNoApply || method.name !== "No aplica")
    .forEach((method) => select.add(new Option(method.name, method.name)));
  if (includeUnclassified) select.add(new Option(UNCLASSIFIED_PAYMENT_METHOD.name, UNCLASSIFIED_PAYMENT_METHOD.name));
  if (includeCustom) select.add(new Option("Otro banco o tarjeta…", CUSTOM_PAYMENT_METHOD_VALUE));
}

function normalizePaymentMethod(name) {
  const cleanedName = name.trim().replace(/\s+/g, " ");
  const existingMethod = getPaymentMethods().find(
    (method) => method.name.toLocaleLowerCase("es") === cleanedName.toLocaleLowerCase("es")
  );
  return existingMethod ? existingMethod.name : cleanedName;
}

function selectedPaymentMethod(select, customNameInput) {
  return select.value === CUSTOM_PAYMENT_METHOD_VALUE
    ? normalizePaymentMethod(customNameInput.value)
    : select.value;
}

function updateCustomPaymentField(select, field, input) {
  const isCustomMethod = select.value === CUSTOM_PAYMENT_METHOD_VALUE;
  field.hidden = !isCustomMethod;
  input.required = isCustomMethod;
  if (!isCustomMethod) input.value = "";
}

function refreshPaymentSelectors() {
  const paymentFilter = $("#payment-filter");
  const previousFilter = paymentFilter.value;
  fillSelect(
    paymentFilter,
    [...getPaymentMethods().map((method) => method.name), UNCLASSIFIED_PAYMENT_METHOD.name],
    "Todos los medios"
  );
  if ([...getPaymentMethods().map((method) => method.name), UNCLASSIFIED_PAYMENT_METHOD.name].includes(previousFilter)) {
    paymentFilter.value = previousFilter;
  }

  const editPayment = $("#edit-payment-method");
  const previousEditMethod = editPayment.value;
  fillPaymentSelect(editPayment, { firstLabel: "Selecciona un medio de pago", includeUnclassified: true });
  const unclassifiedOption = Array.from(editPayment.options).find(
    (option) => option.value === UNCLASSIFIED_PAYMENT_METHOD.name
  );
  if (unclassifiedOption) unclassifiedOption.disabled = true;
  if (Array.from(editPayment.options).some((option) => option.value === previousEditMethod)) {
    editPayment.value = previousEditMethod;
  }

  const bulkPayment = $("#bulk-payment-method");
  const previousBulkMethod = bulkPayment.value;
  fillPaymentSelect(bulkPayment, { firstLabel: "Selecciona un medio de pago" });
  if (Array.from(bulkPayment.options).some((option) => option.value === previousBulkMethod)) {
    bulkPayment.value = previousBulkMethod;
  }
}

function fillMovementSelect(select, firstLabel) {
  select.replaceChildren(new Option(firstLabel, ""));
  MOVEMENT_TYPES.forEach((movementType) => select.add(new Option(movementLabel(movementType), movementType)));
}

function initializeFormOptions() {
  fillSelect($("#expense-type"), TYPES.map((type) => type.name), "Selecciona un tipo");
  fillMovementSelect($("#movement-filter"), "Todos los movimientos");
  fillSelect($("#type-filter"), TYPES.map((type) => type.name), "Todos los tipos");
  fillSelect($("#category-filter"), ALL_CATEGORIES, "Todas las categorías");
  refreshPaymentSelectors();
}

function updateMovementFields() {
  const movementType = $("#movement-type").value;
  const categorySelect = $("#expense-category");
  const previousCategory = categorySelect.value;
  const previousPayment = $("#expense-payment").value;
  let categories = CATEGORIES
    .filter((category) => category.name !== SAVINGS_CATEGORY)
    .map((category) => category.name);
  let categoryLabel = "Categoría";
  if (movementType === "Ingreso") {
    categories = INCOME_CATEGORIES;
    categoryLabel = "Tipo de ingreso";
  } else if (["Pago a tarjeta", "Pago a entidad"].includes(movementType)) {
    categories = [DEBT_CATEGORY];
    categoryLabel = "Categoría";
  } else if (movementType === "Transferencia propia") {
    categories = [previousPayment === "Nu" ? SAVINGS_CATEGORY : "Transferencia entre cuentas"];
    categoryLabel = "Categoría";
  } else if (movementType === "Devolución / reembolso") {
    categories = ["Devolución / reembolso"];
    categoryLabel = "Concepto";
  }
  fillSelect(categorySelect, categories, `Selecciona ${categoryLabel.toLowerCase()}`);
  if (["Pago a tarjeta", "Pago a entidad", "Transferencia propia"].includes(movementType)) {
    categorySelect.value = categories[0];
  } else if (categories.includes(previousCategory)) {
    categorySelect.value = previousCategory;
  }
  $("#expense-category-label").textContent = categoryLabel;
  categorySelect.required = true;

  const isExpenseMovement = movementType === "Gasto";
  const expenseTypeSelect = $("#expense-type");
  $("#expense-type-field").hidden = !isExpenseMovement;
  expenseTypeSelect.required = isExpenseMovement;
  if (!isExpenseMovement) expenseTypeSelect.value = "";

  const paymentSelect = $("#expense-payment");
  if (movementType === "Pago a tarjeta") {
    fillPaymentSelect(paymentSelect, { firstLabel: "Selecciona tarjeta", includeNoApply: false, includeCustom: true });
    paymentSelect.value = isCreditPaymentMethod(previousPayment) ? previousPayment : "";
    $("#expense-payment-label").textContent = "Tarjeta a la que abonaste";
  } else {
    fillPaymentSelect(paymentSelect, { includeCustom: true });
    paymentSelect.value = movementType === "Pago a entidad"
      ? "No aplica"
      : getPaymentMethods().some((method) => method.name === previousPayment) || previousPayment === CUSTOM_PAYMENT_METHOD_VALUE
        ? previousPayment
        : "No aplica";
    const paymentLabel = {
      "Gasto": "Tarjeta / medio de pago",
      "Transferencia propia": "Cuenta destino (opcional)",
      "Pago a entidad": "Cuenta desde donde pagaste (opcional)",
    };
    $("#expense-payment-label").textContent = paymentLabel[movementType] || "Cuenta o tarjeta donde entró";
  }
  paymentSelect.required = movementType === "Pago a tarjeta";
  updateCustomPaymentField(
    paymentSelect,
    $("#expense-custom-payment-field"),
    $("#custom-payment-name")
  );
}

function renderSummary(monthTransactions) {
  const monthExpenses = monthTransactions.filter(isExpense);
  const total = monthExpenses.reduce((sum, expense) => sum + toCOP(expense), 0);
  const necessary = monthExpenses.filter((expense) => getExpenseType(expense) === "Necesario").reduce((sum, expense) => sum + toCOP(expense), 0);
  const ant = monthExpenses.filter((expense) => getExpenseType(expense) === "Hormiga");
  const antAmount = ant.reduce((sum, expense) => sum + toCOP(expense), 0);
  const usd = monthExpenses.filter((expense) => expense.currency === "USD").reduce((sum, expense) => sum + expense.amount, 0);
  $("#total-spent").textContent = formatCOP(total);
  $("#usd-total").textContent = usd > 0 ? `· ${formatUSD(usd)} en USD` : "";
  $("#expense-count").textContent = monthExpenses.length;
  $("#necessary-total").textContent = formatCOP(necessary);
  $("#necessary-share").textContent = `${total ? Math.round((necessary / total) * 100) : 0}%`;
  $("#ant-total").textContent = formatCOP(antAmount);
  $("#ant-count").textContent = ant.length;
  $("#heading-month").textContent = monthLabel(monthFilter.value);
}

function renderCashflow(monthTransactions) {
  const monthExpenses = monthTransactions.filter(isExpense);
  const monthIncomes = monthTransactions.filter(isIncome);
  const cardPayments = monthTransactions.filter((transaction) => getMovementType(transaction) === "Pago a tarjeta");
  const entityPayments = monthTransactions.filter((transaction) => getMovementType(transaction) === "Pago a entidad");
  const ownTransfers = monthTransactions.filter((transaction) => getMovementType(transaction) === "Transferencia propia");
  const savingsTransfers = ownTransfers.filter(isSavingsTransfer);
  const otherTransfers = ownTransfers.filter((transaction) => !isSavingsTransfer(transaction));
  const incomeTotal = monthIncomes.reduce((sum, transaction) => sum + toCOP(transaction), 0);
  const cashExpenses = monthExpenses.filter((transaction) => !isDeferredCardPurchase(transaction));
  const cashOutflows = [...cashExpenses, ...savingsTransfers];
  const cashOutflowTotal = cashOutflows.reduce((sum, transaction) => sum + toCOP(transaction), 0);
  const maxAmount = Math.max(incomeTotal, cashOutflowTotal, 1);
  const rows = [
    { label: "Ingresos (+)", total: incomeTotal, count: monthIncomes.length, tone: "income" },
    { label: "Salidas pagadas y ahorro (−)", total: cashOutflowTotal, count: cashOutflows.length, tone: "expense" },
  ];
  $("#cashflow-chart").innerHTML = rows.map((row) => `
    <div class="flow-row">
      <div class="flow-label"><span>${row.label}</span><strong>${formatCOP(row.total)}</strong></div>
      <div class="flow-track" role="img" aria-label="${row.label}: ${formatCOP(row.total)}">
        <div class="flow-fill flow-${row.tone}" style="width:${row.total ? Math.max(2, row.total / maxAmount * 100) : 0}%"></div>
      </div>
      <small>${row.count} ${row.count === 1 ? "movimiento" : "movimientos"}</small>
    </div>
  `).join("");
  const netBalance = incomeTotal - cashOutflowTotal;
  $("#net-balance").textContent = formatCOP(netBalance);
  $("#net-balance").classList.toggle("negative", netBalance < 0);
  $("#card-payments-total").textContent = formatCOP(cardPayments.reduce((sum, transaction) => sum + toCOP(transaction), 0));
  $("#entity-payments-total").textContent = formatCOP(entityPayments.reduce((sum, transaction) => sum + toCOP(transaction), 0));
  $("#savings-total").textContent = formatCOP(savingsTransfers.reduce((sum, transaction) => sum + toCOP(transaction), 0));
  $("#own-transfers-total").textContent = formatCOP(otherTransfers.reduce((sum, transaction) => sum + toCOP(transaction), 0));
}

function renderTotalMovement(monthTransactions) {
  const incomes = monthTransactions.filter(isIncome);
  const outflows = monthTransactions.filter((transaction) => !isIncome(transaction));
  const incomeTotal = incomes.reduce((sum, transaction) => sum + toCOP(transaction), 0);
  const outflowTotal = outflows.reduce((sum, transaction) => sum + toCOP(transaction), 0);
  const maxAmount = Math.max(incomeTotal, outflowTotal, 1);
  const rows = [
    { label: "Todos los ingresos (+)", total: incomeTotal, count: incomes.length, tone: "income" },
    { label: "Todas las salidas (−)", total: outflowTotal, count: outflows.length, tone: "expense" },
  ];
  $("#total-movement-chart").innerHTML = rows.map((row) => `
    <div class="flow-row">
      <div class="flow-label"><span>${row.label}</span><strong>${formatCOP(row.total)}</strong></div>
      <div class="flow-track" role="img" aria-label="${row.label}: ${formatCOP(row.total)}">
        <div class="flow-fill flow-${row.tone}" style="width:${row.total ? Math.max(2, row.total / maxAmount * 100) : 0}%"></div>
      </div>
      <small>${row.count} ${row.count === 1 ? "movimiento" : "movimientos"}</small>
    </div>
  `).join("");
  const balance = incomeTotal - outflowTotal;
  $("#total-movement-balance").textContent = formatCOP(balance);
  $("#total-movement-balance").classList.toggle("negative", balance < 0);
}

function getPaymentMethod(expense) {
  return typeof expense.paymentMethod === "string" && expense.paymentMethod.trim()
    ? expense.paymentMethod.trim()
    : UNCLASSIFIED_PAYMENT_METHOD.name;
}

function renderPaymentSummary(monthTransactions) {
  const cardExpenses = monthTransactions.filter((transaction) =>
    getMovementType(transaction) === "Gasto" &&
    isCreditPaymentMethod(transaction.paymentMethod)
  );
  const methodsUsed = getCardPaymentMethods().filter((method) =>
    cardExpenses.some((expense) => expense.paymentMethod === method.name)
  );
  if (!methodsUsed.length) {
    $("#payment-totals").innerHTML = '<div class="chart-empty">Cuando registres compras a crédito, aquí verás el total por banco o tarjeta.</div>';
    return;
  }
  $("#payment-totals").innerHTML = methodsUsed.map((method) => {
    const methodExpenses = cardExpenses.filter((expense) => expense.paymentMethod === method.name);
    const total = methodExpenses.reduce((sum, expense) => sum + toCOP(expense), 0);
    return `<article class="payment-total-card payment-${method.tone}">
      <div class="payment-card-top"><span class="payment-dot"></span><span>${escapeHTML(method.name)}</span></div>
      <strong>${formatCOP(total)}</strong>
      <span class="payment-card-count">${methodExpenses.length} ${methodExpenses.length === 1 ? "gasto" : "gastos"}</span>
    </article>`;
  }).join("");
}

function renderCategoryChart(monthTransactions) {
  const chart = $("#category-chart");
  const categorizedTransactions = [
    ...monthTransactions.filter(isExpense),
    ...monthTransactions.filter(isSavingsTransfer),
  ];
  const sortedTotals = CATEGORIES.map((category) => ({
    name: category.name,
    total: categorizedTransactions.filter((transaction) => getMovementCategory(transaction) === category.name).reduce((sum, transaction) => sum + toCOP(transaction), 0),
  })).filter((category) => category.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const totals = [...sortedTotals];
  const savingsTotal = categorizedTransactions
    .filter(isSavingsTransfer)
    .reduce((sum, transaction) => sum + toCOP(transaction), 0);
  if (savingsTotal > 0 && !totals.some((category) => category.name === SAVINGS_CATEGORY)) {
    totals.push({ name: SAVINGS_CATEGORY, total: savingsTotal });
    totals.sort((a, b) => b.total - a.total);
  }
  if (!totals.length) {
    chart.innerHTML = '<div class="chart-empty">Cuando registres gastos o ahorros, aquí verás tus categorías principales.</div>';
    return;
  }
  const max = totals[0].total;
  chart.innerHTML = totals.map((category) => `
    <div class="bar-row">
      <span class="bar-label" title="${category.name}">${category.name}</span>
      <div class="bar-track" role="img" aria-label="${category.name}: ${formatCOP(category.total)}">
        <div class="bar-fill" style="width:${Math.max(3, (category.total / max) * 100)}%"></div>
      </div>
      <span class="bar-value">${formatCOP(category.total)}</span>
    </div>
  `).join("");
}

function renderTypeChart(monthTransactions) {
  const monthExpenses = monthTransactions.filter(isExpense);
  const amounts = TYPES.map((type) => ({
    ...type,
    total: monthExpenses.filter((expense) => getExpenseType(expense) === type.name).reduce((sum, expense) => sum + toCOP(expense), 0),
  }));
  const total = amounts.reduce((sum, type) => sum + type.total, 0);
  let current = 0;
  const stops = amounts.filter((type) => type.total > 0).map((type) => {
    const start = current;
    current += (type.total / total) * 100;
    return `${type.color} ${start}% ${current}%`;
  });
  $("#type-donut").style.background = total ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#eeeef1 0% 100%)";
  $("#type-count").textContent = monthExpenses.length;
  $("#type-legend").innerHTML = amounts.map((type) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${type.total ? type.color : "#e4e4e8"}"></span>
      <span>${type.name}</span><span class="legend-value">${total ? Math.round(type.total / total * 100) : 0}%</span>
    </div>
  `).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function filteredMonthTransactions(monthTransactions) {
  const movementType = $("#movement-filter").value;
  const type = $("#type-filter").value;
  const category = $("#category-filter").value;
  const paymentMethod = $("#payment-filter").value;
  return monthTransactions.filter((expense) =>
    (!movementType || getMovementType(expense) === movementType) &&
    (!type || getExpenseType(expense) === type) &&
    (!category || getMovementCategory(expense) === category) &&
    (!paymentMethod || getPaymentMethod(expense) === paymentMethod)
  ).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function renderTransactions(monthTransactions) {
  const filtered = filteredMonthTransactions(monthTransactions);
  const list = $("#expense-list");
  $("#empty-state").hidden = filtered.length > 0;
  $(".table-wrap").hidden = filtered.length === 0;
  $("#open-bulk-payment").disabled = filtered.length === 0;
  list.innerHTML = filtered.map((expense) => {
    const category = getMovementCategory(expense);
    const categoryInfo = CATEGORIES.find((item) => item.name === category) || CATEGORIES[CATEGORIES.length - 1];
    const movementType = getMovementType(expense);
    const movementTone = {
      "Gasto": "expense",
      "Ingreso": "income",
      "Pago a tarjeta": "card-payment",
      "Pago a entidad": "entity-payment",
      "Transferencia propia": "transfer",
      "Devolución / reembolso": "refund",
    }[movementType];
    const methodInfo = getPaymentMethods().find((item) => item.name === getPaymentMethod(expense)) || UNCLASSIFIED_PAYMENT_METHOD;
    const amount = expense.currency === "USD"
      ? `${formatUSD(expense.amount)} <small>(${formatCOP(toCOP(expense))})</small>`
      : formatCOP(expense.amount);
    return `<tr>
      <td><div class="expense-name-cell"><span class="expense-avatar ${categoryInfo.tone}" aria-hidden="true">${categoryInfo.icon}</span>${escapeHTML(expense.name)}</div></td>
      <td>${escapeHTML(category)}</td>
      <td><span class="movement-badge movement-${movementTone}">${escapeHTML(movementLabel(movementType))}</span></td>
      <td>${isExpense(expense) ? `<span class="type-badge type-${getExpenseType(expense).toLowerCase()}">${escapeHTML(getExpenseType(expense))}</span>` : "—"}</td>
      <td>
        <div class="payment-cell">
          <span class="payment-badge payment-badge-${methodInfo.tone}">${escapeHTML(methodInfo.name)}</span>
          <button class="payment-edit-button" type="button" data-edit-payment="${escapeHTML(expense.id)}" aria-label="Cambiar tarjeta o cuenta de ${escapeHTML(expense.name)}" title="Cambiar tarjeta o cuenta">✎</button>
        </div>
      </td>
      <td>${dateLabel(expense.date)}</td>
      <td class="currency-amount">${amount}</td>
      <td><button class="delete-button" type="button" data-delete="${escapeHTML(expense.id)}" aria-label="Eliminar ${escapeHTML(expense.name)}">×</button></td>
    </tr>`;
  }).join("");
}

function render() {
  const monthTransactions = selectedMonthTransactions();
  refreshPaymentSelectors();
  renderSummary(monthTransactions);
  renderCashflow(monthTransactions);
  renderTotalMovement(monthTransactions);
  renderPaymentSummary(monthTransactions);
  renderCategoryChart(monthTransactions);
  renderTypeChart(monthTransactions);
  renderTransactions(monthTransactions);
}

function openDialog() {
  if (!storageReady) {
    showToast("No se pueden registrar movimientos hasta resolver el problema con los datos guardados.");
    return;
  }
  form.reset();
  const paymentSelect = $("#expense-payment");
  fillPaymentSelect(paymentSelect, { includeCustom: true });
  paymentSelect.value = "No aplica";
  updateCustomPaymentField(paymentSelect, $("#expense-custom-payment-field"), $("#custom-payment-name"));
  updateMovementFields();
  $("#expense-date").value = localDateString();
  $("#exchange-rate").value = "4000";
  $("#exchange-rate-field").hidden = $("#expense-currency").value !== "USD";
  $("#form-error").hidden = true;
  dialog.showModal();
  $("#expense-name").focus();
}

$("#open-expense").addEventListener("click", openDialog);
$("#empty-add").addEventListener("click", openDialog);
$("#export-backup").addEventListener("click", exportBackup);
$("#import-backup").addEventListener("click", () => backupFileInput.click());
backupFileInput.addEventListener("change", async () => {
  const file = backupFileInput.files[0];
  if (!file) return;
  try {
    await importBackup(file);
  } finally {
    backupFileInput.value = "";
  }
});
$("#movement-type").addEventListener("change", updateMovementFields);
$("#expense-payment").addEventListener("change", () => {
  updateCustomPaymentField($("#expense-payment"), $("#expense-custom-payment-field"), $("#custom-payment-name"));
  if ($("#movement-type").value === "Transferencia propia") {
    $("#expense-category").value = $("#expense-payment").value === "Nu" ? SAVINGS_CATEGORY : "Transferencia entre cuentas";
  }
});
$("#close-dialog").addEventListener("click", () => dialog.close());
$("#cancel-dialog").addEventListener("click", () => dialog.close());
$("#expense-currency").addEventListener("change", (event) => {
  $("#exchange-rate-field").hidden = event.target.value !== "USD";
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
monthFilter.addEventListener("change", render);
$("#movement-filter").addEventListener("change", render);
$("#type-filter").addEventListener("change", render);
$("#category-filter").addEventListener("change", render);
$("#payment-filter").addEventListener("change", render);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const amount = Number(formData.get("amount"));
  const currency = String(formData.get("currency"));
  const exchangeRate = currency === "USD" ? Number(formData.get("exchangeRate")) : 1;
  const error = $("#form-error");
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    error.textContent = "Ingresa un valor y una tasa de cambio válidos.";
    error.hidden = false;
    return;
  }
  const movementType = String(formData.get("movementType"));
  const paymentMethod = selectedPaymentMethod($("#expense-payment"), $("#custom-payment-name"));
  const transaction = {
    id: crypto.randomUUID(),
    name: String(formData.get("name")).trim(),
    amount,
    currency,
    exchangeRate,
    category: String(formData.get("category")),
    movementType,
    paymentMethod,
    date: String(formData.get("date")),
    createdAt: new Date().toISOString(),
  };
  if (movementType === "Gasto") transaction.type = String(formData.get("type"));
  if (
    !transaction.name ||
    !transaction.category ||
    !MOVEMENT_TYPES.includes(movementType) ||
    (movementType === "Gasto" && !transaction.type) ||
    !transaction.paymentMethod ||
    transaction.paymentMethod === CUSTOM_PAYMENT_METHOD_VALUE ||
    !transaction.date ||
    (movementType === "Pago a tarjeta" && !isCreditPaymentMethod(transaction.paymentMethod))
  ) {
    error.textContent = $("#expense-payment").value === CUSTOM_PAYMENT_METHOD_VALUE && !transaction.paymentMethod
      ? "Escribe el nombre del banco o la tarjeta."
      : "Completa los campos requeridos para guardar el movimiento.";
    error.hidden = false;
    return;
  }
  transactions.push(transaction);
  if (!saveTransactions()) {
    transactions.pop();
    return;
  }
  monthFilter.value = transaction.date.slice(0, 7);
  dialog.close();
  render();
  showToast("Movimiento guardado correctamente.");
});

$("#expense-list").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-payment]");
  if (editButton) {
    const transaction = transactions.find((item) => item.id === editButton.dataset.editPayment);
    if (!transaction) return;
    editingPaymentExpenseId = transaction.id;
    $("#payment-expense-name").textContent = transaction.name;
    const movementType = getMovementType(transaction);
    const isCardPayment = movementType === "Pago a tarjeta";
    const isEntityPayment = movementType === "Pago a entidad";
    const editMethods = isCardPayment
      ? getCardPaymentMethods().map((method) => method.name)
      : [...getPaymentMethods().map((method) => method.name), UNCLASSIFIED_PAYMENT_METHOD.name];
    fillSelect($("#edit-payment-method"), editMethods, isCardPayment ? "Selecciona tarjeta" : "Selecciona un medio");
    if (!isCardPayment) $("#edit-payment-method option:last-child").disabled = true;
    $("#edit-payment-label").textContent = isCardPayment
      ? "Tarjeta a la que abonaste"
      : isEntityPayment
        ? "Cuenta desde donde pagaste"
        : "Tarjeta / cuenta asociada";
    const currentPaymentMethod = getPaymentMethod(transaction);
    $("#edit-payment-method").value = editMethods.includes(currentPaymentMethod) ? currentPaymentMethod : "";
    $("#payment-form-error").hidden = true;
    paymentDialog.showModal();
    $("#edit-payment-method").focus();
    return;
  }
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const index = transactions.findIndex((transaction) => transaction.id === button.dataset.delete);
  if (index < 0) return;
  const [removed] = transactions.splice(index, 1);
  if (!saveTransactions()) {
    transactions.splice(index, 0, removed);
    return;
  }
  render();
  showToast("Movimiento eliminado.");
});

function updateBulkSelectionCount() {
  const checkboxes = Array.from($("#bulk-expense-list").querySelectorAll('input[name="expenseIds"]'));
  const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  const selectAll = $("#bulk-select-all");
  selectAll.checked = checkboxes.length > 0 && selectedCount === checkboxes.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < checkboxes.length;
  $("#bulk-selection-count").textContent = `${selectedCount} movimiento${selectedCount === 1 ? "" : "s"} seleccionado${selectedCount === 1 ? "" : "s"}`;
}

function openBulkPaymentDialog() {
  if (!storageReady) {
    showToast("No se pueden editar movimientos hasta resolver el problema con los datos guardados.");
    return;
  }
  const visibleExpenses = filteredMonthTransactions(selectedMonthTransactions());
  if (!visibleExpenses.length) {
    showToast("No hay movimientos que coincidan con el mes y los filtros actuales.");
    return;
  }
  $("#bulk-payment-period").textContent = `${monthLabel(monthFilter.value)} · ${visibleExpenses.length} movimientos según los filtros actuales`;
  $("#bulk-select-all").checked = false;
  $("#bulk-select-all").indeterminate = false;
  $("#bulk-payment-method").value = "";
  $("#bulk-payment-error").hidden = true;
  $("#bulk-expense-list").innerHTML = visibleExpenses.map((expense) => {
    const methodInfo = getPaymentMethods().find((method) => method.name === getPaymentMethod(expense)) || UNCLASSIFIED_PAYMENT_METHOD;
    const amount = expense.currency === "USD"
      ? `${formatUSD(expense.amount)} (${formatCOP(toCOP(expense))})`
      : formatCOP(expense.amount);
    return `<label class="bulk-expense-option">
      <input type="checkbox" name="expenseIds" value="${escapeHTML(expense.id)}" />
      <span class="bulk-expense-details">
        <strong>${escapeHTML(expense.name)}</strong>
        <small>${dateLabel(expense.date)} · ${escapeHTML(getMovementCategory(expense))} · ${escapeHTML(movementLabel(getMovementType(expense)))}</small>
      </span>
      <span class="bulk-expense-amount">${amount}</span>
      <span class="payment-badge payment-badge-${methodInfo.tone}">${escapeHTML(methodInfo.name)}</span>
    </label>`;
  }).join("");
  updateBulkSelectionCount();
  bulkPaymentDialog.showModal();
  $("#bulk-select-all").focus();
}

function closeBulkPaymentDialog() {
  bulkPaymentDialog.close();
}

$("#open-bulk-payment").addEventListener("click", openBulkPaymentDialog);
$("#close-bulk-payment").addEventListener("click", closeBulkPaymentDialog);
$("#cancel-bulk-payment").addEventListener("click", closeBulkPaymentDialog);
bulkPaymentDialog.addEventListener("click", (event) => {
  if (event.target === bulkPaymentDialog) closeBulkPaymentDialog();
});
$("#bulk-select-all").addEventListener("change", (event) => {
  $("#bulk-expense-list").querySelectorAll('input[name="expenseIds"]').forEach((checkbox) => {
    checkbox.checked = event.target.checked;
  });
  updateBulkSelectionCount();
});
$("#bulk-expense-list").addEventListener("change", (event) => {
  if (event.target.matches('input[name="expenseIds"]')) updateBulkSelectionCount();
});
bulkPaymentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedIds = Array.from($("#bulk-expense-list").querySelectorAll('input[name="expenseIds"]:checked'))
    .map((checkbox) => checkbox.value);
  const paymentMethod = $("#bulk-payment-method").value;
  const error = $("#bulk-payment-error");
  if (!selectedIds.length) {
    error.textContent = "Selecciona al menos un movimiento.";
    error.hidden = false;
    return;
  }
  if (!getPaymentMethods().some((method) => method.name === paymentMethod)) {
    error.textContent = "Selecciona el medio de pago que quieres asignar.";
    error.hidden = false;
    return;
  }
  const selectedExpenses = transactions.filter((expense) => selectedIds.includes(expense.id));
  if (
    paymentMethod === "No aplica" &&
    selectedExpenses.some((transaction) => getMovementType(transaction) === "Pago a tarjeta")
  ) {
    error.textContent = "Los pagos a tarjeta deben asociarse con un banco o tarjeta de crédito.";
    error.hidden = false;
    return;
  }
  const changedExpenses = selectedExpenses.filter((expense) => getPaymentMethod(expense) !== paymentMethod);
  if (!changedExpenses.length) {
    closeBulkPaymentDialog();
    showToast("Los movimientos seleccionados ya tienen ese medio de pago.");
    return;
  }
  const previousMethods = changedExpenses.map((expense) => expense.paymentMethod);
  changedExpenses.forEach((expense) => { expense.paymentMethod = paymentMethod; });
  if (!saveTransactions()) {
    changedExpenses.forEach((expense, index) => {
      if (previousMethods[index] === undefined) delete expense.paymentMethod;
      else expense.paymentMethod = previousMethods[index];
    });
    return;
  }
  closeBulkPaymentDialog();
  render();
  showToast(`Medio de pago actualizado en ${changedExpenses.length} movimiento${changedExpenses.length === 1 ? "" : "s"}.`);
});

function closePaymentDialog() {
  paymentDialog.close();
  editingPaymentExpenseId = null;
}

$("#close-payment-dialog").addEventListener("click", closePaymentDialog);
$("#cancel-payment-dialog").addEventListener("click", closePaymentDialog);
paymentDialog.addEventListener("click", (event) => {
  if (event.target === paymentDialog) closePaymentDialog();
});
paymentDialog.addEventListener("close", () => {
  editingPaymentExpenseId = null;
});

paymentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const transaction = transactions.find((item) => item.id === editingPaymentExpenseId);
  const paymentMethod = $("#edit-payment-method").value;
  if (transaction && paymentMethod === UNCLASSIFIED_PAYMENT_METHOD.name && getPaymentMethod(transaction) === paymentMethod) {
    closePaymentDialog();
    return;
  }
  const validMethods = transaction && getMovementType(transaction) === "Pago a tarjeta"
    ? getCardPaymentMethods().map((method) => method.name)
    : getPaymentMethods().map((method) => method.name);
  if (!transaction || !validMethods.includes(paymentMethod)) {
    $("#payment-form-error").textContent = "Selecciona un medio de pago válido.";
    $("#payment-form-error").hidden = false;
    return;
  }
  const previousPaymentMethod = transaction.paymentMethod;
  transaction.paymentMethod = paymentMethod;
  if (!saveTransactions()) {
    if (previousPaymentMethod === undefined) delete transaction.paymentMethod;
    else transaction.paymentMethod = previousPaymentMethod;
    return;
  }
  closePaymentDialog();
  render();
  showToast("Medio de pago actualizado.");
});

initializeFormOptions();
updateMovementFields();
transactions = readTransactions();
monthFilter.value = localDateString().slice(0, 7);
render();
