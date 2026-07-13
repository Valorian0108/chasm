import streamlit as st

from components import mission_status
from coordinator_v2 import analyze_token
from .mission import advance

from demo.demo_report import DEMO_REPORT

from components.live_status import render as live_status
from components.mission_launch import render as mission_launch
from components.mission_console import render as mission_console
from components.investment_committee import render as committee
from components.intelligence_report import render as intelligence
from . import core


DEMO_MODE = True
mission_status(screens.core.mission)

def render():

    mission = st.session_state.mission

    # -----------------------------
    # Mission Launch
    # -----------------------------

    if mission["state"] != "REPORT_READY":

        advance(mission)

        mission_launch(mission)

        st.rerun()

        return

    token = mission["token"]

    st.title(f"AEGIS TERMINAL • {token}")
    from components.mission_status import render as mission_status

    # -----------------------------
    # Load Report
    # -----------------------------

    if DEMO_MODE:

        st.warning("🔥 DEMO MODE ACTIVE")

        result = DEMO_REPORT

    else:

        if (
            mission["report"] is not None
            and mission["report"].get("token") == token
        ):

            result = mission["report"]

        else:

            with st.spinner("Investigating token..."):

                result = analyze_token(token)

            result["token"] = token

            mission["report"] = result

    events = result["events"]
    report = result["report"]

    # -----------------------------
    # Top Row
    # -----------------------------

    left, right = st.columns([2, 1], gap="large")

    with left:
        live_status(events)

    with right:
        committee(report)

    st.divider()

    # -----------------------------
    # Bottom Row
    # -----------------------------

    left, right = st.columns([2, 1], gap="large")

    with left:
        mission_console(events)

    with right:
        intelligence(report)