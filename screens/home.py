import streamlit as st


def render():

    st.markdown(
    "<h1 style='color:white;'>AEGIS TEST</h1>",
    unsafe_allow_html=True
)

    token = st.text_input(
        "",
        placeholder="Enter token symbol or contract address..."
    )

    analyze = st.button(
        "Analyze",
        use_container_width=True
    )

    return token, analyze