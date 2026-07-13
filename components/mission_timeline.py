import streamlit as st


def render(events):

    st.markdown(
        """
        ## Mission Timeline
        """,
    )

    for event in events:

        with st.container(border=True):

            st.write(event["message"])