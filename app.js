'use strict';

const $ = (id) => document.getElementById(id);
const MAX_GUESTS = 12;
let eventConfig;
let guestSequence = 0;
let responseId;
let submissionId;
let submissionsEnabled = false;
let sendInProgress = false;
let turnstileReady = false;
let turnstileToken = '';
let turnstileWidgetId;
let turnstileScriptPromise;
const form = $('rsvp-form');
const guestSection = $('guest-section');
const guests = $('guests');
const formatDate = (date) => new Intl.DateTimeFormat('es-ES', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid',
}).format(new Date(`${date}T12:00:00+01:00`));
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
  link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue}, ${address}`)}`;
  link.hidden = false;
}

function renderEvent(config) {
  submissionsEnabled = config.submissionsEnabled === true;
  const securityConfigured = typeof config.turnstileSiteKey === 'string' && config.turnstileSiteKey.length > 0;
  $('demo-notice').hidden = submissionsEnabled && securityConfigured;
  const noticeTitle = submissionsEnabled ? 'Estamos terminando la protección del formulario.' : 'Estamos preparando la invitación.';
  const noticeCopy = submissionsEnabled
    ? 'Puedes revisar tu respuesta, pero los envíos se abrirán cuando la verificación de seguridad esté configurada.'
    : 'Puedes probar el formulario y revisar el resumen. Todavía no se envían ni se guardan respuestas.';
  $('demo-notice').replaceChildren(node('strong', noticeTitle), document.createTextNode(noticeCopy));
  $('demo-form-note').hidden = submissionsEnabled && securityConfigured;
  $('review-demo-note').hidden = submissionsEnabled && securityConfigured;
  $('send-response').disabled = !submissionsEnabled || !securityConfigured;
  $('send-response').textContent = submissionsEnabled && securityConfigured ? 'Confirmar asistencia' : 'Envío disponible próximamente';
  $('demo-form-note').textContent = securityConfigured
    ? 'La protección anti-bots verifica cada envío.'
    : 'Esta prueba no confirma tu asistencia.';
  $('review-demo-note').textContent = securityConfigured
    ? 'La respuesta se guardará cuando completes la verificación de seguridad.'
    : 'Es un resumen de prueba. Tu respuesta no se ha enviado ni guardado.';
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
  $('lunch-venue').textContent = config.lunch.venue;
  $('lunch-area').textContent = config.lunch.area;
  $('lunch-time').textContent = config.lunch.time ? `${config.lunch.time} h` : 'Hora por confirmar';
  showMap('ceremony-map', config.ceremony.address, config.ceremony.venue);
  showMap('lunch-map', config.lunch.address, config.lunch.venue);
  $('parents').textContent = config.parentsFromDraft?.length ? `Con cariño, ${config.parentsFromDraft.join(' y ')}` : '';
  if (config.responseDeadline) {
    $('deadline').textContent = `Agradecemos tu respuesta antes del ${formatDate(config.responseDeadline)}.`;
    $('deadline').hidden = false;
  }
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
  $('menu-price').textContent = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: meal.currency, maximumFractionDigits: 0,
  }).format(meal.pricePerPerson);
  $('menu-starters').replaceChildren(...meal.starters.map((dish) => node('li', dish)));
  $('menu-mains').replaceChildren(...config.menus.map((dish) => node('li', dish.label)));
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
    const option = node('option', item.label);
    option.value = item.id;
    menu.append(option);
  });
  const notes = document.createElement('textarea');
  notes.name = `${id}-notes`;
  notes.dataset.field = 'dietaryNotes';
  notes.maxLength = 500;
  notes.rows = 2;
  card.append(legend,
    makeField('Nombre y apellidos *', nameInput, `${id}-name`),
    makeField(menusReady() ? 'Segundo plato *' : 'Segundo plato', menu, `${id}-menu`),
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
  clearErrors();
  const invalid = [];
  if (!$('contact-name').value.trim()) invalid.push([$('contact-name'), 'Escribe el nombre de quien responde.']);
  const attendance = form.querySelector('input[name=attendance]:checked');
  if (!attendance) invalid.push([form.querySelector('input[name=attendance]'), 'Indica si podréis asistir.']);
  if (attendance?.value === 'yes') [...guests.children].forEach((card, index) => {
    const name = card.querySelector('[data-field=name]');
    const menu = card.querySelector('[data-field=menu]');
    if (!name.value.trim()) invalid.push([name, `Escribe el nombre del comensal ${index + 1}.`]);
    if (menusReady() && !eventConfig.menus.some((item) => item.id === menu.value)) {
      invalid.push([menu, `Elige el segundo plato del comensal ${index + 1}.`]);
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
  if (attending) [...guests.children].forEach((card) => {
    const person = node('article', undefined, 'review-person');
    const menuId = card.querySelector('[data-field=menu]').value;
    const notes = card.querySelector('[data-field=dietaryNotes]').value.trim();
    person.append(node('h4', card.querySelector('[data-field=name]').value.trim()),
      node('p', eventConfig.menus.find((item) => item.id === menuId)?.label || 'Menú pendiente de confirmar'));
    if (notes) person.append(node('p', `Observaciones: ${notes}`));
    content.append(person);
  });
  if ($('message').value.trim()) content.append(node('p', $('message').value.trim()));
  form.hidden = true;
  $('review').hidden = false;
  $('send-response').disabled = !submissionsEnabled || !turnstileReady;
  if (submissionsEnabled && eventConfig.turnstileSiteKey) initializeTurnstile(eventConfig.turnstileSiteKey);
  $('review-title').focus();
}

function setSendStatus(message, isError = false) {
  const status = $('send-status');
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle('error', isError);
}

function updateSendAvailability() {
  const button = $('send-response');
  if (!button || sendInProgress) return;
  button.disabled = !submissionsEnabled || !turnstileReady;
}

function initializeTurnstile(siteKey) {
  const container = $('turnstile-widget');
  if (!container || turnstileWidgetId) return;
  $('security-status').textContent = 'Cargando la verificación de seguridad…';
  turnstileScriptPromise ||= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
  turnstileScriptPromise.then(() => {
    if (!window.turnstile || turnstileWidgetId) throw new Error('turnstile_unavailable');
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: siteKey,
      action: 'rsvp',
      language: 'es',
      theme: 'light',
      size: 'flexible',
      callback(token) {
        turnstileToken = token;
        turnstileReady = true;
        $('security-status').textContent = 'Verificación completada.';
        updateSendAvailability();
      },
      'expired-callback'() {
        turnstileToken = '';
        turnstileReady = false;
        $('security-status').textContent = 'La verificación ha caducado. Complétala de nuevo para enviar.';
        updateSendAvailability();
      },
      'error-callback'() {
        turnstileToken = '';
        turnstileReady = false;
        $('security-status').textContent = 'No se pudo cargar la verificación. Revisa tu conexión e inténtalo de nuevo.';
        updateSendAvailability();
      },
    });
  }).catch(() => {
    turnstileReady = false;
    $('security-status').textContent = 'No se pudo cargar la verificación. Revisa tu conexión e inténtalo de nuevo.';
    updateSendAvailability();
  });
}

function resetTurnstile() {
  turnstileToken = '';
  turnstileReady = false;
  try {
    if (turnstileWidgetId !== undefined) window.turnstile?.reset(turnstileWidgetId);
  } catch { /* The widget can be reloaded if Cloudflare removed it. */ }
  updateSendAvailability();
}

async function sendResponse() {
  if (!submissionsEnabled || sendInProgress) return;
  if (!turnstileReady || !turnstileToken) {
    setSendStatus('Completa la verificación de seguridad antes de confirmar.', true);
    return;
  }
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
      dietaryNotes: card.querySelector('[data-field=dietaryNotes]').value.trim(),
    })) : [],
    message: $('message').value.trim(),
    website: $('website').value,
    turnstileToken,
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
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.received !== true) throw new Error('not_received');
    $('review-title').textContent = '¡Respuesta recibida!';
    $('review').querySelector('.eyebrow').textContent = 'Gracias por confirmar';
    $('edit-response').hidden = true;
    button.textContent = 'Respuesta confirmada';
    setSendStatus('Hemos guardado tu respuesta. ¡Nos vemos en el bautizo!');
    responseId = result.responseId;
    resetTurnstile();
  } catch {
    button.disabled = false;
    button.textContent = 'Reintentar envío';
    setSendStatus('No hemos podido confirmar la recepción. Vuelve a intentarlo; el sistema reconocerá el mismo envío.', true);
    resetTurnstile();
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
  if (validate()) renderReview();
});
$('send-response').addEventListener('click', sendResponse);
$('edit-response').addEventListener('click', () => {
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
    form.hidden = false;
  } catch {
    $('config-status').textContent = 'No se ha podido cargar el formulario. Recarga la página para volver a intentarlo.';
  }
}
initialize();

