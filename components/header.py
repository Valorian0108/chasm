import streamlit as st


def render(token, report):

    decision = report.get("decision", {})

    recommendation = decision.get("recommendation", "--")
    score = decision.get("score", "--")

    col1, col2, col3, col4, col5 = st.columns(5)

    with col1:
        st.metric(
            label="TOKEN",
            value=token.upper(),
        )

    with col2:
        st.metric(
            label="STATUS",
            value="COMPLETE",
        )

    with col3:
        st.metric(
            label="RECOMMENDATION",
            value=recommendation,
        )

    with col4:
        st.metric(
            label="SCORE",
            value=score,
        )

    with col5:
        st.metric(
            label="AGENTS",
            value="5 / 5",
        )