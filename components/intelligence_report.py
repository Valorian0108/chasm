import streamlit as st


def section(title, data):

    st.subheader(title)

    if not data:
        st.write("No data available.")
        return

    summary = data.get("summary", "")

    if summary:
        st.write(summary)

    reasoning = data.get("reasoning", [])

    for item in reasoning:
        st.markdown(f"• {item}")


def render(report):

    st.markdown("---")

    st.header("Intelligence Report")

    section("🛡 Risk Office", report.get("risk"))

    section("📢 Community Intelligence", report.get("social"))

    section("📄 Research Desk", report.get("docs"))

    section("💰 On-Chain Lab", report.get("wallet"))