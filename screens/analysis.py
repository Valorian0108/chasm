"""The active event-driven Aegis investigation screen."""

from __future__ import annotations

import streamlit as st

from components.evidence_panel import render as evidence_panel
from components.intelligence_report import render as intelligence
from components.investment_committee import render as committee
from components.live_status import render as live_status
from components.mission_console import render as mission_console
from components.mission_launch import render as mission_launch
from components.mission_status import render as mission_status
from core.coordinator import Coordinator
from core.mission import Mission


_MISSION_KEY = "aegis_mission"
_DEPARTMENTS = (
    "Planner",
    "Risk Office",
    "Community Intelligence",
    "Research Desk",
    "On-Chain Lab",
    "Investment Committee",
)


def render() -> None:
    """Run and display the investigation for the token selected on the home screen."""
    mission = _mission_for_selected_token()

    if mission is None:
        st.error("Enter a token symbol or contract address before starting a mission.")
        return

    st.title(f"AEGIS TERMINAL • {mission.token}")
    content = st.empty()

    if not mission.completed:
        coordinator = Coordinator(mission)

        for _event in coordinator.run(mission.token):
            with content.container():
                _render_progress(mission)

        mission.completed = True

    with content.container():
        _render_report(mission)


def _mission_for_selected_token() -> Mission | None:
    """Return the persisted Mission, creating one when the selected token changes."""
    session_mission = st.session_state.get("mission")

    if isinstance(session_mission, Mission):
        return session_mission

    if not isinstance(session_mission, dict):
        return None

    token = str(session_mission.get("token", "")).strip().upper()
    if not token:
        return None

    mission = st.session_state.get(_MISSION_KEY)
    if not isinstance(mission, Mission) or mission.token != token:
        mission = Mission(token=token)
        st.session_state[_MISSION_KEY] = mission

    return mission


def _render_progress(mission: Mission) -> None:
    """Render the existing launch UI from real Mission state and events."""
    view = _mission_view(mission)

    mission_status(view)
    mission_launch(view)
    mission_console(mission.events)


def _render_report(mission: Mission) -> None:
    """Render the existing report components from the completed Mission."""
    mission_status(_mission_view(mission))

    left, right = st.columns([2, 1], gap="large")
    with left:
        live_status(mission.events)
    with right:
        committee(mission.report)

    st.divider()

    left, right = st.columns([2, 1], gap="large")
    with left:
        mission_console(mission.events)
    with right:
        intelligence(mission.report)
        evidence_panel(mission.evidence)


def _mission_view(mission: Mission) -> dict[str, object]:
    """Adapt Mission data for legacy presentation-only components.

    This contains no execution state: Coordinator.run() remains the sole source
    of progress and department activity.
    """
    try:
        stage = _DEPARTMENTS.index(mission.current_department or "Planner")
    except ValueError:
        stage = 0

    if mission.completed:
        stage = len(_DEPARTMENTS)

    return {
        "token": mission.token,
        "progress": mission.progress_percent,
        "stage": stage,
    }
