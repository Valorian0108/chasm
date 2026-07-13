import streamlit as st


def render(mission):

    token = mission.get("token", "-")
    progress = mission.get("progress", 0)

    stage = mission.get("stage", 0)

    stages = [
        "Planner",
        "Risk Office",
        "Community Intelligence",
        "Research Desk",
        "On-Chain Lab",
        "Investment Committee",
    ]

    current = stages[min(stage, len(stages)-1)]

    st.markdown(
        f"""
<div class="mission-status">

<div>

<b>MISSION</b><br>
{token}

</div>

<div>

<b>DEPARTMENT</b><br>
{current}

</div>

<div>

<b>PROGRESS</b><br>
{progress}%

</div>

</div>
""",
        unsafe_allow_html=True,
    )