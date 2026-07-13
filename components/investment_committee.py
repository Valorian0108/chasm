import streamlit as st


def render(report):

    decision = report.get("decision", {})

    if not decision:
        st.info("No investment decision available.")
        return

    score = decision.get("score", "--")
    recommendation = decision.get("recommendation", "UNKNOWN")
    confidence = decision.get("confidence", "--")

    html = f"""
<div class="committee-card">

    <div class="committee-title">
        INVESTMENT COMMITTEE
    </div>

    <div class="committee-rec">
        {recommendation}
    </div>

    <div class="committee-score">
        {score}
    </div>

    <div class="committee-label">
        Overall Mission Score
    </div>

    <div class="committee-confidence">
        Confidence • {confidence}
    </div>

</div>
"""

    st.html(html)

    strengths = decision.get("strengths", [])
    weaknesses = decision.get("weaknesses", [])

    if strengths:

        st.markdown("#### Strengths")

        for item in strengths:
            st.success(f"✓ {item}")

    if weaknesses:

        st.markdown("#### Risks")

        for item in weaknesses:
            st.warning(f"⚠ {item}")

    summary = decision.get("summary", "")

    if summary:

        st.markdown("#### Committee Assessment")

        st.info(summary)