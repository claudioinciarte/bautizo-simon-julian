'use strict';

const $ = (id) => document.getElementById(id);
const MAX_GUESTS = 12;
let eventConfig;
let guestSequence = 0;
let responseId;
let submissionId;
let reviewedMenuTotal = 0;
let reviewedAttendance = false;
let submissionsEnabled = false;
let eventClosed = false;
let sendInProgress = false;
const form = $('rsvp-form');
const guestSection = $('guest-section');
const guests = $('guests');
const formatDate = (date) => new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid',
}).format(new Date(`${date}T12:00:00+01:00`));
const madridDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const formatMoney = (amount, currency = 'EUR') => new Intl.NumberFormat('es-ES', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(amount);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const menusReady = () => eventConfig.menusPending === false && eventConfig.menus.length > 0;
const uuid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

function showMap(id, address, venue) {
  if (!address) return;
  const link = $(id);
  link.href = link.dataset.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue}, ${address}`)}`;
  link.setAttribute('aria-label', `Ver ${venue}: ${address} en Google Maps (se abre en una pestaña nueva)`);
  link.hidden = false;
}

function renderEvent(config) {
  submissionsEnabled = config.submissionsEnabled === true;
  eventClosed = Boolean(config.responseDeadline && madridDateKey() >= config.responseDeadline);
  $('demo-notice').hidden = submissionsEnabled;
  const noticeTitle = 'Estamos preparando la invitación.';
  const noticeCopy = 'Puedes probar el formulario y revisar el resumen. Todavía no se envían ni se guardan respuestas.';
  $('demo-notice').replaceChildren(node('strong', noticeTitle), document.createTextNode(noticeCopy));
  $('demo-form-note').hidden = submissionsEnabled;
  $('review-demo-note').hidden = submissionsEnabled;
  $('send-response').disabled = !submissionsEnabled;
  $('send-response').textContent = submissionsEnabled ? 'Confirmar asistencia' : 'Envío disponible próximamente';
  $('demo-form-note').textContent = 'Esta prueba no confirma tu asistencia.';
  $('review-demo-note').textContent = 'Es un resumen de prueba. Tu respuesta no se ha enviado ni guardado.';
  const names = $('children');
  names.replaceChildren();
  config.children.forEach((name, index) => {
    if (index > 0) names.append(node('span', 'y', 'ampersand'));
    names.append(document.createTextNode(name));
  });
  document.title = `${config.title} · ${formatDate(config.date)}`;
  $('event-date').textContent = formatDate(config.date);
  $('event-date').dateTime = config.date;
  $('footer-names').textContent = config.children.map((name) => name.split(' ')[0]).join(' y ');
  $('footer-date').textContent = config.date.split('-').reverse().join(' · ');
  $('ceremony-venue').textContent = config.ceremony.venue;
  $('ceremony-time').textContent = config.ceremony.time ? `${config.ceremony.time} h` : 'Hora por confirmar';
  $('ceremony-note').textContent = config.ceremony.reviewPending
    ? 'Datos de la ceremonia pendientes de revisión.' : (config.ceremony.address || '');
  $('ceremony-note').hidden = !config.ceremony.reviewPending && !config.ceremony.address;
  if (config.ceremony.address) $('ceremony-note').textContent = config.ceremony.address;
  $('lunch-venue').textContent = config.lunch.venue;
  $('lunch-area').textContent = config.lunch.area;
  if (config.lunch.address) $('lunch-area').textContent = config.lunch.address;
  $('lunch-time').textContent = config.lunch.time ? `${config.lunch.time} h` : 'Hora por confirmar';
  $('ceremony-map').dataset.mapUrl = config.ceremony.mapUrl || '';
  $('lunch-map').dataset.mapUrl = config.lunch.mapUrl || '';
  showMap('ceremony-map', config.ceremony.address, config.ceremony.venue);
  showMap('lunch-map', config.lunch.address, config.lunch.venue);
  $('parents').textContent = config.parentsFromDraft?.length ? `Con cariño, ${config.parentsFromDraft.join(' y ')}` : '';
  if (config.responseDeadline) {
    const paymentDeadline = config.menuPaymentDeadline ? formatDate(config.menuPaymentDeadline) : '5 de diciembre de 2026';
    $('deadline').textContent = eventClosed
      ? `El formulario de asistencia se cerró el ${formatDate(config.responseDeadline)}. El pago del menú puede realizarse hasta el ${paymentDeadline}.`
      : `Confirma tu asistencia antes del ${formatDate(config.responseDeadline)}. El formulario se deshabilitará ese día y ya no se podrán enviar confirmaciones. El pago del menú podrá realizarse hasta el ${paymentDeadline}.`;
    $('deadline').hidden = false;
  }
  $('form-closed').textContent = eventClosed
    ? `El plazo para confirmar la asistencia ha terminado. Gracias por tu interés. El pago del menú puede realizarse hasta el ${formatDate(config.menuPaymentDeadline || '2026-12-05')}.`
    : '';
  $('form-closed').hidden = !eventClosed;
  $('review-deadline').textContent = config.responseDeadline
    ? `Recuerda: el formulario se deshabilitará el ${formatDate(config.responseDeadline)} y desde ese día ya no se podrán enviar confirmaciones. El pago del menú podrá realizarse hasta el ${formatDate(config.menuPaymentDeadline || '2026-12-05')}.`
    : '';
  $('closing-deadlines').textContent = `Confirma tu asistencia antes del ${formatDate(config.responseDeadline || '2026-12-01')}. El formulario se deshabilitará ese día. El pago del menú podrá realizarse hasta el ${formatDate(config.menuPaymentDeadline || '2026-12-05')}.`;
  if (!config.godparentsReviewPending && config.godparents?.length) {
    const section = $('godparents');
    section.append(node('h3', 'Acompañados por sus padrinos y madrinas'));
    config.godparents.forEach((entry) => {
      section.append(node('p', `${entry.child}: ${[...(entry.godfathers || []), ...(entry.godmothers || [])].join(', ')}`));
    });
    section.hidden = false;
  }
  renderMealMenu(config);
  $('menus-notice').textContent = menusReady()
    ? 'Los entrantes son para compartir. Elige solo el segundo plato de cada persona e indica sus necesidades alimentarias, si las hay.'
    : 'Las opciones de menú se añadirán cuando el restaurante las confirme.';
}

function renderMealMenu(config) {
  if (!config.meal || !menusReady()) return;
  const meal = config.meal;
  $('menu-price').textContent = formatMoney(meal.pricePerPerson, meal.currency);
  $('menu-starters').replaceChildren(...meal.starters.map((dish) => node('li', dish)));
  $('menu-mains').replaceChildren(...config.menus.map((dish) => node('li', dish.label)));
  if (config.childMenu) {
    $('child-menu-label').textContent = config.childMenu.label;
    const childMenuPrice = formatMoney(config.childMenu.price, config.childMenu.currency || meal.currency);
    const regularMenuPrice = formatMoney(meal.pricePerPerson, meal.currency);
    $('child-menu-price').textContent = `${childMenuPrice} por niño/a`;
    $('child-menu-note').textContent = `Este precio corresponde únicamente al plato combinado infantil. Si el niño o la niña elige un segundo del menú normal, se aplica el precio normal de ${regularMenuPrice} por persona.`;
    $('child-menu-course').hidden = false;
  }
  $('menu-desserts').textContent = meal.desserts.join(' o ');
  $('menu-drinks').textContent = meal.drinks;
  $('menu').hidden = false;
}

function makeField(labelText, input, id, help) {
  const field = node('div', undefined, 'field');
  input.id = id;
  const label = node('label', labelText);
  label.htmlFor = id;
  field.append(label, input);
  if (help) {
    const hint = node('p', help, 'field-help');
    hint.id = `${id}-help`;
    input.setAttribute('aria-describedby', hint.id);
    field.append(hint);
  }
  return field;
}

function refreshGuests() {
  const cards = [...guests.children];
  cards.forEach((card, index) => {
    card.querySelector('.guest-title').textContent = `Comensal ${index + 1}`;
    const remove = card.querySelector('.remove-guest');
    remove.hidden = cards.length === 1;
    remove.setAttribute('aria-label', `Eliminar comensal ${index + 1}`);
  });
  $('add-guest').disabled = cards.length >= MAX_GUESTS;
  $('guest-status').textContent = cards.length >= MAX_GUESTS ? 'Esta propuesta permite hasta 12 personas por familia.' : '';
}

function addGuest(name = '', focus = true) {
  if (guests.children.length >= MAX_GUESTS) return;
  const id = `guest-${++guestSequence}`;
  const card = node('fieldset', undefined, 'guest-card');
  card.dataset.guestId = uuid();
  const legend = node('legend');
  legend.append(node('span', '', 'guest-title'));
  const remove = node('button', 'Eliminar', 'remove-guest');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    submissionId = null;
    card.remove();
    refreshGuests();
    $('add-guest').focus();
    $('guest-status').textContent = 'Familiar eliminado.';
  });
  legend.append(remove);
  const nameInput = document.createElement('input');
  nameInput.name = `${id}-name`;
  nameInput.dataset.field = 'name';
  nameInput.maxLength = 120;
  nameInput.required = true;
  nameInput.value = name;
  nameInput.autocomplete = 'off';
  const menu = document.createElement('select');
  menu.name = `${id}-menu`;
  menu.dataset.field = 'menu';
  menu.required = menusReady();
  menu.disabled = !menusReady();
  const placeholder = node('option', menusReady() ? 'Elige una opción' : 'Menús pendientes de confirmar');
  placeholder.value = '';
  menu.append(placeholder);
  if (menusReady()) eventConfig.menus.forEach((item) => {
    const option = node('option', `${item.label} · Menú normal (${formatMoney(eventConfig.meal.pricePerPerson, eventConfig.meal.currency)} por persona)`);
    option.value = item.id;
    menu.append(option);
  });
  const childInput = document.createElement('input');
  childInput.type = 'checkbox';
  childInput.name = `${id}-child`;
  childInput.dataset.field = 'isChild';
  childInput.addEventListener('change', () => {
    submissionId = null;
    const childMenu = eventConfig.childMenu;
    const existing = [...menu.options].find((option) => option.value === childMenu?.id);
    if (childInput.checked && childMenu && !existing) {
      const option = node('option', `${childMenu.label} · Menú infantil (${formatMoney(childMenu.price, childMenu.currency || eventConfig.meal.currency)} por niño/a)`);
      option.value = childMenu.id;
      menu.append(option);
    } else if (!childInput.checked && existing) {
      if (menu.value === childMenu.id) menu.value = '';
      existing.remove();
    }
  });
  const notes = document.createElement('textarea');
  notes.name = `${id}-notes`;
  notes.dataset.field = 'dietaryNotes';
  notes.maxLength = 500;
  notes.rows = 2;
  const childMenuHelp = eventConfig.childMenu && eventConfig.meal?.pricePerPerson != null
    ? `Puede elegir el menú infantil (${formatMoney(eventConfig.childMenu.price, eventConfig.childMenu.currency || eventConfig.meal.currency)}) o un segundo del menú normal (${formatMoney(eventConfig.meal.pricePerPerson, eventConfig.meal.currency)} por persona).`
    : 'Marca esta opción si es niño o niña.';
  card.append(legend,
    makeField('Nombre y apellidos *', nameInput, `${id}-name`),
    makeField('¿Es niño o niña?', childInput, `${id}-child`, childMenuHelp),
    makeField(menusReady() ? 'Menú elegido *' : 'Menú elegido', menu, `${id}-menu`),
    makeField('Alergias o intolerancias (opcional)', notes, `${id}-notes`, 'Indica solo lo que debamos tener en cuenta para la comida.'),
  );
  guests.append(card);
  refreshGuests();
  if (focus) nameInput.focus();
}

function clearErrors() {
  $('form-errors').hidden = true;
  $('form-errors').replaceChildren();
  const errorIds = new Set([...form.querySelectorAll('.field-error')].map((error) => error.id));
  form.querySelectorAll('[aria-describedby]').forEach((field) => {
    const descriptions = field.getAttribute('aria-describedby').split(/\s+/).filter((id) => !errorIds.has(id));
    if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
    else field.removeAttribute('aria-describedby');
  });
  form.querySelectorAll('.field-error').forEach((error) => error.remove());
  form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
}

function validate() {
  if (refreshDeadlineState()) return false;
  clearErrors();
  const invalid = [];
  if (!$('contact-name').value.trim()) invalid.push([$('contact-name'), 'Escribe el nombre de quien responde.']);
  const attendance = form.querySelector('input[name=attendance]:checked');
  if (!attendance) invalid.push([form.querySelector('input[name=attendance]'), 'Indica si podréis asistir.']);
  if (attendance?.value === 'yes') [...guests.children].forEach((card, index) => {
    const name = card.querySelector('[data-field=name]');
    const menu = card.querySelector('[data-field=menu]');
    if (!name.value.trim()) invalid.push([name, `Escribe el nombre del comensal ${index + 1}.`]);
    const selectedMenu = [...eventConfig.menus, ...(eventConfig.childMenu ? [eventConfig.childMenu] : [])].find((item) => item.id === menu.value);
    if (menusReady() && (!selectedMenu || (selectedMenu.id === eventConfig.childMenu?.id && !card.querySelector('[data-field=isChild]').checked))) {
      invalid.push([menu, `Elige un menú válido para el comensal ${index + 1}.`]);
    }
  });
  if (invalid.length) {
    const box = $('form-errors');
    const title = node('h3', 'Revisa los siguientes campos:');
    title.id = 'error-title';
    const list = node('ul');
    box.append(title, list);
    invalid.forEach(([field, message]) => {
      const error = node('p', message, 'field-error');
      error.id = `${field.id}-error`;
      const group = field.type === 'radio' ? field.closest('fieldset') : field.closest('.field');
      group.append(error);
      const controls = field.type === 'radio' ? group.querySelectorAll('input[type=radio]') : [field];
      controls.forEach((control) => {
        control.setAttribute('aria-invalid', 'true');
        control.setAttribute('aria-describedby', [control.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
      });
      const item = node('li');
      const link = node('a', message);
      link.href = `#${field.id}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        field.focus();
      });
      item.append(link);
      list.append(item);
    });
    box.hidden = false;
    box.focus();
    return false;
  }
  return true;
}

function renderReview() {
  const content = $('review-content');
  content.replaceChildren();
  const attending = form.querySelector('input[name=attendance]:checked').value === 'yes';
  const details = node('dl');
  details.append(node('dt', 'Responde'), node('dd', $('contact-name').value.trim()),
    node('dt', 'Asistencia'), node('dd', attending ? `Sí · ${guests.children.length} ${guests.children.length === 1 ? 'persona' : 'personas'}` : 'No podremos asistir'));
  content.append(details);
  let total = 0;
  if (attending) [...guests.children].forEach((card) => {
    const person = node('article', undefined, 'review-person');
    const menuId = card.querySelector('[data-field=menu]').value;
    const notes = card.querySelector('[data-field=dietaryNotes]').value.trim();
    const selectedMenu = [...eventConfig.menus, ...(eventConfig.childMenu ? [eventConfig.childMenu] : [])].find((item) => item.id === menuId);
    const isChildMenu = menuId === eventConfig.childMenu?.id;
    const unitPrice = isChildMenu ? eventConfig.childMenu.price : eventConfig.meal.pricePerPerson;
    const currency = isChildMenu ? (eventConfig.childMenu.currency || eventConfig.meal.currency) : eventConfig.meal.currency;
    total += unitPrice;
    person.append(node('h4', card.querySelector('[data-field=name]').value.trim()),
      node('p', selectedMenu?.label || 'Menú pendiente de confirmar'),
      node('p', `Precio por comensal: ${formatMoney(unitPrice, currency)}`, 'review-price'));
    if (notes) person.append(node('p', `Observaciones: ${notes}`));
    content.append(person);
  });
  if (attending) content.append(node('p', `Total a pagar por los menús: ${formatMoney(total, eventConfig.meal.currency)}`, 'review-total'));
  reviewedAttendance = attending;
  reviewedMenuTotal = attending ? total : 0;
  if ($('message').value.trim()) content.append(node('p', $('message').value.trim()));
  form.hidden = true;
  $('review').hidden = false;
  $('send-response').disabled = eventClosed || !submissionsEnabled;
  $('review-title').focus();
}

function setSendStatus(message, isError = false, detail = '') {
  const status = $('send-status');
  status.replaceChildren(document.createTextNode(message));
  if (detail) status.append(document.createElement('br'), document.createTextNode(detail));
  status.hidden = !message;
  status.classList.toggle('error', isError);
}

function refreshDeadlineState(forceClosed = false) {
  if (!eventConfig?.responseDeadline) return false;
  eventClosed = forceClosed || madridDateKey() >= eventConfig.responseDeadline;
  if (eventClosed) {
    form.hidden = true;
    $('review').hidden = true;
    $('form-closed').textContent = `El plazo para confirmar la asistencia ha terminado. Gracias por tu interés. El pago del menú puede realizarse hasta el ${formatDate(eventConfig.menuPaymentDeadline || '2026-12-05')}.`;
    $('form-closed').hidden = false;
    $('send-response').disabled = true;
  }
  return eventClosed;
}

function updateSendAvailability() {
  const button = $('send-response');
  if (!button || sendInProgress) return;
  button.disabled = refreshDeadlineState() || !submissionsEnabled;
}

async function sendResponse() {
  if (refreshDeadlineState() || !submissionsEnabled || sendInProgress) return;
  const attending = form.querySelector('input[name=attendance]:checked').value === 'yes';
  responseId ||= uuid();
  submissionId ||= uuid();
  const payload = {
    responseId,
    submissionId,
    contactName: $('contact-name').value.trim(),
    attending,
    guests: attending ? [...guests.children].map((card) => ({
      guestId: card.dataset.guestId,
      name: card.querySelector('[data-field=name]').value.trim(),
      mainCourseId: card.querySelector('[data-field=menu]').value,
      isChild: card.querySelector('[data-field=isChild]').checked,
      dietaryNotes: card.querySelector('[data-field=dietaryNotes]').value.trim(),
    })) : [],
    message: $('message').value.trim(),
    website: $('website').value,
  };

  sendInProgress = true;
  const button = $('send-response');
  button.disabled = true;
  button.textContent = 'Enviando…';
  setSendStatus('Guardando tu respuesta…');
  try {
    const response = await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.status === 410) {
      refreshDeadlineState(true);
      return;
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.received !== true) throw new Error('not_received');
    $('review-title').textContent = '¡Respuesta recibida!';
    $('review').querySelector('.eyebrow').textContent = 'Gracias por confirmar';
    $('edit-response').hidden = true;
    button.textContent = 'Respuesta confirmada';
    const confirmationMessage = reviewedAttendance
      ? 'Hemos guardado tu respuesta. ¡Nos vemos en el bautizo!'
      : 'Hemos guardado tu respuesta. Gracias por avisarnos.';
    const paymentMessage = reviewedAttendance && reviewedMenuTotal > 0
      ? `El total de los menús es ${formatMoney(reviewedMenuTotal, eventConfig.meal.currency)}. Puedes pagarlo por Bizum a Weraldine hasta el ${formatDate(eventConfig.menuPaymentDeadline || '2026-12-05')}.`
      : '';
    setSendStatus(confirmationMessage, false, paymentMessage);
    responseId = result.responseId;
  } catch {
    button.disabled = false;
    button.textContent = 'Reintentar envío';
    setSendStatus('No hemos podido confirmar la recepción. Vuelve a intentarlo; el sistema reconocerá el mismo envío.', true);
  } finally {
    sendInProgress = false;
    if (button.textContent === 'Respuesta confirmada') button.disabled = true;
    else updateSendAvailability();
  }
}

form.addEventListener('change', (event) => {
  submissionId = null;
  if (event.target.name !== 'attendance') return;
  const attending = event.target.value === 'yes';
  guestSection.hidden = !attending;
  guestSection.disabled = !attending;
  if (attending && !guests.children.length) addGuest($('contact-name').value.trim(), false);
  clearErrors();
});
$('add-guest').addEventListener('click', () => { submissionId = null; addGuest(); });
form.addEventListener('input', () => { submissionId = null; });
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (refreshDeadlineState()) return;
  if (validate()) renderReview();
});
$('send-response').addEventListener('click', sendResponse);
$('edit-response').addEventListener('click', () => {
  if (refreshDeadlineState()) return;
  submissionId = null;
  $('review').hidden = true;
  form.hidden = false;
  $('contact-name').focus();
});

async function initialize() {
  try {
    const response = await fetch('content/event.json');
    if (!response.ok) throw new Error('Configuration unavailable');
    const config = await response.json();
    if (!Array.isArray(config.children) || !config.children.length || !Array.isArray(config.menus)
      || !config.ceremony?.venue || !config.lunch?.venue || !config.date) throw new Error('Invalid configuration');
    eventConfig = config;
    renderEvent(config);
    $('config-status').hidden = true;
    form.hidden = eventClosed;
    if (config.responseDeadline) window.setInterval(refreshDeadlineState, 30_000);
  } catch {
    $('config-status').textContent = 'No se ha podido cargar el formulario. Recarga la página para volver a intentarlo.';
  }
}
initialize();

