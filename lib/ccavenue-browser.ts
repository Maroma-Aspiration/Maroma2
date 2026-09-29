export type CcavenueBrowserPayment = {
  action: string;
  accessCode: string;
  encRequest: string;
};

const HANDOFF_FORM_ID = "maroma-ccavenue-handoff";

export function postCcavenuePayment(payment: CcavenueBrowserPayment): boolean {
  if (typeof document === "undefined") return false;
  if (!payment.action || !payment.accessCode || !payment.encRequest) return false;

  document.getElementById(HANDOFF_FORM_ID)?.remove();

  const form = document.createElement("form");
  form.id = HANDOFF_FORM_ID;
  form.method = "POST";
  form.action = payment.action;
  form.acceptCharset = "UTF-8";
  form.target = "_top";
  form.setAttribute("referrerpolicy", "origin");
  form.setAttribute("autocomplete", "off");

  const enc = document.createElement("input");
  enc.type = "hidden";
  enc.name = "encRequest";
  enc.value = payment.encRequest;

  const code = document.createElement("input");
  code.type = "hidden";
  code.name = "access_code";
  code.value = payment.accessCode;

  form.appendChild(enc);
  form.appendChild(code);
  document.body.appendChild(form);
  HTMLFormElement.prototype.submit.call(form);
  return true;
}

export function ccavenueRedirectHref(orderNumber: string): string {
  const host = window.location.hostname;
  const origin =
    host === "localhost" || host === "127.0.0.1"
      ? window.location.origin
      : "https://maromashopping.com";
  return `${origin}/api/checkout/ccavenue/redirect?order=${encodeURIComponent(orderNumber)}`;
}
