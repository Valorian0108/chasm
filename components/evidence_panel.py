import streamlit as st


def render(evidence):

    st.subheader("EVIDENCE")

    if not evidence:
        st.info("No evidence collected yet.")
        return

    for item in evidence:

        st.markdown(
            f"""
**{item.department}**

• **{item.title}:** {item.value}
"""
        )