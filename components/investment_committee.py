from html import escape

import streamlit as st


def render(report):

    decision = report.get("decision", {})

    if not decision:
        st.info("No investment decision available.")
        return

    recommendation = decision.get("recommendation", "UNKNOWN")
    score = decision.get("score", "--")
    confidence = decision.get("confidence", "--")
    risk_level = decision.get("risk_level", "UNKNOWN")
    investment_thesis = decision.get("investment_thesis", "")
    strengths = _as_list(decision.get("strengths", []))
    weaknesses = _as_list(decision.get("weaknesses", []))
    red_flags = _as_list(decision.get("red_flags", []))
    next_steps = _as_list(decision.get("next_steps", []))
    summary = decision.get("summary", "")

    html = f"""
<div class="committee-card">

    <div class="committee-title">
        INVESTMENT COMMITTEE
    </div>

    <div class="committee-rec">
        {escape(str(recommendation))}
    </div>

    <div class="committee-label">
        Recommendation
    </div>

</div>
"""

    st.html(html)

    score_col, confidence_col, risk_col = st.columns(3)
    score_col.metric("Score", score)
    confidence_col.metric("Confidence", confidence)
    risk_col.metric("Risk Level", risk_level)

    st.markdown("#### Investment Thesis")
    if investment_thesis:
        st.info(investment_thesis)
    else:
        st.info("No investment thesis available.")

    st.markdown("#### Strengths")
    if strengths:
        for item in strengths:
            st.success(item)
    else:
        st.info("No strengths supplied.")

    st.markdown("#### Weaknesses")
    if weaknesses:
        for item in weaknesses:
            st.warning(item)
    else:
        st.info("No weaknesses supplied.")

    st.markdown("#### Red Flags")
    if red_flags:
        for item in red_flags:
            st.error(item)
    else:
        st.info("No red flags supplied.")

    st.markdown("#### Next Steps")
    if next_steps:
        for item in next_steps:
            st.markdown(f"- {item}")
    else:
        st.info("No next steps supplied.")

    st.markdown("#### Committee Conclusion")
    if summary:
        st.info(summary)
    else:
        st.info("No committee conclusion available.")


def _as_list(value):
    if isinstance(value, list):
        return value

    if value:
        return [value]

    return []
