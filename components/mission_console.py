"""Reusable mission console for displaying Aegis investigation activity."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from html import escape

import streamlit as st

from components.ui import divider, section_header, status_badge
from core.events import MissionEvent, to_ui_event


def render(events: Sequence[MissionEvent]) -> None:
    """Render the investigation console."""

    ordered_events = list(events)

    section_header(
        "MISSION CONSOLE",
        "Chronological investigation activity",
    )

    if ordered_events:
        status_badge(ordered_events[-1].status)

    st.markdown(
        _timeline_markup(ordered_events),
        unsafe_allow_html=True,
    )

    divider()


def _timeline_markup(events: Sequence[MissionEvent]) -> str:
    """Return HTML for the mission console."""

    if not events:
        return (
            '<section class="mission-console">'
            '<p class="mission-console__empty">No mission events yet.</p>'
            "</section>"
        )

    items = []

    newest_index = len(events) - 1

    for index, event in enumerate(events):

        ui = to_ui_event(event)

        newest = (
            " mission-console__event--newest"
            if index == newest_index
            else ""
        )

        timestamp = _format_timestamp(event.timestamp)

        timestamp_markup = (
            f'<time class="mission-console__timestamp">{escape(timestamp)}</time>'
            if timestamp
            else ""
        )

        items.append(
            f"""
<article class="mission-console__event{newest}">

    <span
        class="mission-console__marker {ui.color_class}"
        aria-hidden="true"
    >
        {escape(ui.icon)}
    </span>

    <div class="mission-console__event-content">

        {timestamp_markup}

        <p class="mission-console__department">
            {escape(ui.department)}
        </p>

        <h3 class="mission-console__title">
            {escape(ui.title)}
        </h3>

        <p class="mission-console__message">
            {escape(ui.message)}
        </p>

    </div>

</article>
"""
        )

    return (
        '<section class="mission-console">'
        '<div class="mission-console__events">'
        + "".join(items)
        + "</div></section>"
    )


def _format_timestamp(timestamp: float | None) -> str | None:
    """Format timestamps for display."""

    if timestamp is None:
        return None

    try:
        return datetime.fromtimestamp(timestamp).strftime("%H:%M:%S")

    except (OverflowError, OSError, ValueError):
        return None