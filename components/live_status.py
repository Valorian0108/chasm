import streamlit as st
from html import escape

from core.events import MissionEvent


def render(events: list[MissionEvent]):

    st.subheader("⚡ Live Investigation")

    html = '<div class="ops-card">'

    for event in events:

        html += f"""
        <div class="ops-row">
            <strong>{escape(event.department)}</strong><br>
            {escape(event.message)}
        </div>
        """

    html += "</div>"

    st.markdown(html, unsafe_allow_html=True)
