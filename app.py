import streamlit as st
from pathlib import Path

from screens.home import render as render_home
from screens.analysis import render as render_analysis

# ------------------------
# Page Config
# ------------------------

st.set_page_config(
    page_title="Aegis",
    page_icon="▲",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ------------------------
# Load CSS
# ------------------------

css = Path("styles/theme.css").read_text()

st.markdown(
    f"<style>{css}</style>",
    unsafe_allow_html=True,
)

# ------------------------
# Session State
# ------------------------

if "mission" not in st.session_state:

    st.session_state.mission = {

        "state": "HOME",

        "token": "",

        "progress": 0,

        "stage": 0,

        "report": None,

    }
# ------------------------
# Router
# ------------------------

mission = st.session_state.mission

if mission["state"] == "HOME":

    token, analyze = render_home()

    if analyze and token.strip():

        mission["token"] = token.upper()

        mission["state"] = "MISSION_CREATED"

        mission["progress"] = 0

        st.rerun()

else:

    render_analysis()