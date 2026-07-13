"""Experimental Streamlit screen for the event-driven Aegis investigation."""

from dataclasses import asdict

import streamlit as st

from core.coordinator import Coordinator
from core.mission import Mission


def render(token: str | None = None) -> None:
    """Render an isolated live feed backed by the new core architecture."""
    st.title("Aegis Investigation Lab")
    st.caption("Experimental event-driven investigation feed")

    if token is None:
        token = st.text_input(
            "Token symbol or contract address",
            placeholder="Enter a token to investigate...",
            key="analysis_v2_token",
        )

    token = token.strip()
    if not token:
        st.info("Enter a token symbol or contract address to begin.")
        return

    mission = Mission(token=token)
    coordinator = Coordinator(mission)
    progress_bar = st.progress(0)
    feed_placeholder = st.empty()
    emitted_events = []

    for event in coordinator.run(token):
        emitted_events.append(event)
        progress_bar.progress(event.progress)

        with feed_placeholder.container():
            st.subheader("Live investigation feed")
            for feed_event in emitted_events:
                st.markdown(f"**{feed_event.progress}% - {feed_event.title}**")
                st.caption(f"{feed_event.department} - {feed_event.level.title()}")
                st.write(feed_event.message)

    latest_event = mission.latest_event()

    st.success("Mission Complete")
    progress_bar.progress(mission.progress)

    progress_column, events_column = st.columns(2)
    progress_column.metric("Mission progress", f"{mission.progress}%")
    events_column.metric("Total events", len(mission.events))

    st.subheader("Latest event")
    if latest_event is not None:
        st.json(asdict(latest_event))
