import streamlit as st


STAGES = [
    ("◈", "Planner"),
    ("🛡", "Risk Office"),
    ("◎", "Community Intelligence"),
    ("▣", "Research Desk"),
    ("⬢", "On-Chain Lab"),
    ("▲", "Investment Committee"),
]


def render(mission):

    st.title("MISSION ACCEPTED")

    st.caption("Autonomous investigation deployed.")

    st.progress(mission["progress"] / 100)

    st.metric(
        "Mission Progress",
        f"{mission['progress']}%",
    )

    current = mission["stage"]

    st.markdown("---")

    for i, (icon, stage) in enumerate(STAGES):

        if i < current:
            state = "ONLINE"
            color = "#41D18A"

        elif i == current:
            state = "ACTIVE"
            color = "#4F8CFF"

        else:
            state = "QUEUED"
            color = "#7D8A9B"

        st.markdown(
            f"""
<div class="mission-launch-row">

    <div class="mission-launch-left">
        <span class="mission-launch-icon">{icon}</span>
        <span>{stage}</span>
    </div>

    <div
        class="mission-launch-state"
        style="color:{color};"
    >
        {state}
    </div>

</div>
"""
            ,
            unsafe_allow_html=True,
        )

    st.markdown("---")
