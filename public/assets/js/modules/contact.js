/**
 * The correspondence form and the copy-to-clipboard buttons.
 *
 * Nothing is posted anywhere: the form validates, then hands the composed
 * message to the reader's own mail client. No endpoint, no third party, no
 * data held by this site.
 */

const ADDRESS = 'ahmadandhikaharirie@gmail.com';
const WHATSAPP = '6282280693457';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COPY_FEEDBACK_MS = 1800;

const setFieldError = (input, message) => {
  const field = input.closest('.field');
  const error = field?.querySelector('.field__error');

  field?.setAttribute('data-invalid', String(Boolean(message)));
  input.setAttribute('aria-invalid', String(Boolean(message)));

  if (error) {
    error.hidden = !message;
    if (message) error.textContent = message;
  }
};

/** Returns the first invalid control, or null when the form is good to send. */
function findFirstProblem(form) {
  const checks = [
    [form.elements.name, (value) => value.length >= 2, 'Please tell me who you are.'],
    [form.elements.email, (value) => EMAIL_PATTERN.test(value), 'That does not look like an email address.'],
    [form.elements.message, (value) => value.length >= 10, 'A sentence or two is plenty, but I need something.'],
  ];

  let firstProblem = null;

  for (const [input, isValid, message] of checks) {
    const ok = isValid(input.value.trim());
    setFieldError(input, ok ? '' : message);
    if (!ok && !firstProblem) firstProblem = input;
  }

  return firstProblem;
}

function composeMailto(form) {
  const name = form.elements.name.value.trim();
  const email = form.elements.email.value.trim();
  const subject = form.elements.subject.value;
  const message = form.elements.message.value.trim();

  const body = `${message}\n\n—\n${name}\n${email}`;

  return `mailto:${ADDRESS}?subject=${encodeURIComponent(`${subject} — from ${name}`)}`
    + `&body=${encodeURIComponent(body)}`;
}

function wireForm(form) {
  const status = document.getElementById('form-status');
  const counter = document.getElementById('cf-count');
  const message = form.elements.message;

  const updateCount = () => {
    if (counter) counter.textContent = String(message.value.length);
  };

  message.addEventListener('input', updateCount);
  updateCount();

  /* Clear an error as soon as the reader starts fixing it. */
  for (const input of [form.elements.name, form.elements.email, message]) {
    input.addEventListener('input', () => setFieldError(input, ''));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const problem = findFirstProblem(form);
    if (problem) {
      if (status) status.textContent = 'Almost — one field still needs attention.';
      problem.focus();
      return;
    }

    if (status) status.textContent = 'Opening your mail application…';
    location.href = composeMailto(form);
  });

  form.addEventListener('reset', () => {
    for (const input of [form.elements.name, form.elements.email, message]) {
      setFieldError(input, '');
    }
    if (status) status.textContent = '';
    requestAnimationFrame(updateCount);
  });
}

/**
 * The same letter, carried to WhatsApp instead of a mail client. The link works
 * on its own if the form is empty, so it is never a dead end.
 */
function wireWhatsApp(form) {
  const link = document.getElementById('wa-send');
  if (!link) return;

  link.addEventListener('click', () => {
    const name = form?.elements.name.value.trim() ?? '';
    const message = form?.elements.message.value.trim() ?? '';
    if (message.length < 2) { link.href = `https://wa.me/${WHATSAPP}`; return; }

    const text = name ? `${message}

— ${name}` : message;
    link.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  });
}

function wireCopyButtons() {
  for (const button of document.querySelectorAll('button[data-copy]')) {
    button.addEventListener('click', async () => {
      const original = button.textContent;

      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select it';
      }

      button.dataset.copied = 'true';
      setTimeout(() => {
        button.textContent = original;
        delete button.dataset.copied;
      }, COPY_FEEDBACK_MS);
    });
  }
}

export function initContact() {
  const form = document.getElementById('contact-form');
  if (form) wireForm(form);
  wireWhatsApp(form);
  wireCopyButtons();
}
