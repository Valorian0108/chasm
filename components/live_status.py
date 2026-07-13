import streamlit as st

from core.events import MissionEvent


def render(events: list[MissionEvent]):

    st.subheader("⚡ Live Investigation")

    html = '<div class="ops-card">'

    for event in events:

        html += f"""
        <div class="ops-row">
            <strong>{event.department}</strong><br>
            {event.message}
        </div>
        """

    html += "</div>"

    st.html(html)