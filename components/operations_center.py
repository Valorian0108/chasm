import streamlit as st


def render(events):

    html = """
<div style="
background:#111827;
padding:30px;
border-radius:20px;
border:1px solid #333;
color:white;
">

<h2>OPERATIONS CENTER</h2>

<div style="display:flex;justify-content:space-between;">
    <span>🛡 Risk Office</span>
    <span style="color:#41D18A;">COMPLETE</span>
</div>

<div style="display:flex;justify-content:space-between;margin-top:12px;">
    <span>📢 Community Intelligence</span>
    <span style="color:#41D18A;">COMPLETE</span>
</div>

</div>
"""

    st.code(html, language="html")      # Shows the exact HTML string
    st.markdown(html, unsafe_allow_html=True)