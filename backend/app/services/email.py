"""Courriels transactionnels (section 11). Envoyés en arrière-plan, après le commit."""

import logging
import smtplib
from dataclasses import dataclass
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import settings
from app.models import Booking

logger = logging.getLogger("app.email")

_env = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "emails"),
    autoescape=select_autoescape(["html"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

_WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
_MONTHS = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
]


def format_local_datetime(value: datetime) -> str:
    """Ex. « mardi 3 novembre 2026 à 9 h 15 », en heure du commerce."""
    local = value.astimezone(settings.tz)
    return (
        f"{_WEEKDAYS[local.weekday()]} {local.day} {_MONTHS[local.month - 1]} {local.year}"
        f" à {local.hour} h {local.minute:02d}"
    )


def format_price(cents: int) -> str:
    whole, rest = divmod(cents, 100)
    return f"{whole:,}".replace(",", " ") + f",{rest:02d} $"


def mask_email(address: str) -> str:
    """Les journaux ne contiennent jamais de courriel complet."""
    local, _, domain = address.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


@dataclass(frozen=True)
class BookingEmailData:
    """Copie des données utiles : la session SQL est fermée quand la tâche s'exécute."""

    client_email: str
    client_name: str
    service_name: str
    when: str
    price: str
    cancel_reason: str | None

    @classmethod
    def from_booking(cls, booking: Booking) -> "BookingEmailData":
        return cls(
            client_email=booking.user.email,
            client_name=f"{booking.user.first_name} {booking.user.last_name}",
            service_name=booking.service.name,
            when=format_local_datetime(booking.start_at),
            price=format_price(booking.service.price_cents),
            cancel_reason=booking.cancel_reason,
        )


def _render(template: str, **context: object) -> tuple[str, str]:
    context.setdefault("business_name", settings.business_name)
    context.setdefault("business_address", settings.business_address)
    context.setdefault("app_url", settings.public_frontend_url)
    html = _env.get_template(f"{template}.html").render(**context)
    text = _env.get_template(f"{template}.txt").render(**context)
    return html, text


def send_email(to: str, subject: str, html: str, text: str) -> None:
    """Envoie un courriel; journalise l'erreur sans jamais la propager."""
    try:
        if settings.resend_api_key:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.mail_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
                timeout=10,
            )
            response.raise_for_status()
        else:
            message = EmailMessage()
            message["From"] = formataddr(parseaddr(settings.mail_from))
            message["To"] = to
            message["Subject"] = subject
            message.set_content(text)
            message.add_alternative(html, subtype="html")
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                smtp.send_message(message)
        logger.info("Courriel « %s » envoyé à %s", subject, mask_email(to))
    except Exception:
        logger.exception("Échec de l'envoi du courriel « %s » à %s", subject, mask_email(to))


def send_booking_confirmed(data: BookingEmailData) -> None:
    html, text = _render("booking_confirmed", b=data)
    send_email(data.client_email, f"Rendez-vous confirmé : {data.service_name}", html, text)


def send_admin_new_booking(data: BookingEmailData) -> None:
    html, text = _render("admin_new_booking", b=data)
    send_email(settings.admin_email, f"Nouvelle réservation : {data.service_name}", html, text)


def send_booking_cancelled_by_client(data: BookingEmailData) -> None:
    html, text = _render("booking_cancelled_client", b=data)
    send_email(data.client_email, f"Annulation confirmée : {data.service_name}", html, text)


def send_booking_cancelled_by_admin(data: BookingEmailData) -> None:
    html, text = _render("booking_cancelled_admin", b=data)
    subject = f"Votre rendez-vous a été annulé : {data.service_name}"
    send_email(data.client_email, subject, html, text)


def send_password_reset(email: str, first_name: str, token: str) -> None:
    link = f"{settings.public_frontend_url}/reinitialiser?token={token}"
    html, text = _render("password_reset", first_name=first_name, link=link)
    send_email(email, "Réinitialisation de votre mot de passe", html, text)
