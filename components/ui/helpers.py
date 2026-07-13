"""Small Streamlit rendering helpers backed by the Aegis CSS design system."""

from __future__ import annotations

from html import escape
import re

import streamlit as st


def section_header(title: str, subtitle: str | None = None) -> None:
    """Render a consistent title and optional subtitle for a UI section."""
    subtitle_markup = ""
    if subtitle:
        subtitle_markup = (
            f'<p class="aegis-ui-section-header__subtitle">{escape(subtitle)}</p>'
        )

    st.markdown(
        "<div class=\"aegis-ui-section-header\">"
        f"<h2 class=\"aegis-ui-section-header__title\">{escape(title)}</h2>"
        f"{subtitle_markup}"
        "</div>",
        unsafe_allow_html=True,
    )


def status_badge(status: str) -> None:
    """Render a status label using a semantic CSS modifier class."""
    normalized_status = re.sub(r"[^a-z0-9]+", "-", status.lower()).strip("-")
    modifier = normalized_status or "unknown"
    label = status.replace("_", " ").strip() or "Unknown"

    st.markdown(
        "<span class=\"aegis-ui-status-badge "
        f"aegis-ui-status-badge--{modifier}\">{escape(label)}</span>",
        unsafe_allow_html=True,
    )


def progress_bar(percent: int) -> None:
    """Render a CSS-driven progress bar with a clamped percentage."""
    value = max(0, min(percent, 100))
    st.markdown(
        "<div class=\"aegis-ui-progress\" "
        f"style=\"--aegis-ui-progress-value: {value}%;\" "
        f"aria-label=\"Progress: {value}%\" role=\"progressbar\" "
        f"aria-valuenow=\"{value}\" aria-valuemin=\"0\" aria-valuemax=\"100\">"
        "<div class=\"aegis-ui-progress__fill\"></div>"
        "</div>",
        unsafe_allow_html=True,
    )


def metric_card(label: str, value: str | int | float) -> None:
    """Render a compact, reusable metric card."""
    st.markdown(
        "<div class=\"aegis-ui-metric-card\">"
        f"<p class=\"aegis-ui-metric-card__label\">{escape(label)}</p>"
        f"<p class=\"aegis-ui-metric-card__value\">{escape(str(value))}</p>"
        "</div>",
        unsafe_allow_html=True,
    )


def divider() -> None:
    """Render a consistently styled visual divider."""
    st.markdown("<hr class=\"aegis-ui-divider\">", unsafe_allow_html=True)
