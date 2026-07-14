import streamlit as st


def render():

    st.markdown(
    "<h1 style='color:white;'>AEGIS TERMINAL</h1>",
    unsafe_allow_html=True
)

    token = st.text_input(
        "Token symbol or contract address",
        placeholder="Enter token symbol or contract address..."
    )

    analyze = st.button(
        "Analyze",
        width="stretch"
    )

    return token, analyze
