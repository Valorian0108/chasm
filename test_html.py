import streamlit as st

st.set_page_config(layout="wide")

st.markdown(
    """
    <div style="
        background:#111827;
        padding:40px;
        border-radius:20px;
        color:white;
    ">
        <h1 style="color:#4F8CFF;">HELLO HTML</h1>
        <p>If this is rendered inside a dark box, HTML works.</p>
    </div>
    """,
    unsafe_allow_html=True,
)