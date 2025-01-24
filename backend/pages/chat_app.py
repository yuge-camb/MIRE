import streamlit as st
from services.llm_service import LLMService
from services.llm_manager import LLMManager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Hide sidebar and other default elements
st.set_page_config(
    initial_sidebar_state="collapsed",
    menu_items={},
    layout="wide"
)

# Hide sidebar and other elements with CSS
st.markdown("""
    <style>
        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        .css-h5rgaw {visibility: hidden;}
        section[data-testid="stSidebar"] {display: none;}
    </style>
""", unsafe_allow_html=True)

def chat_interface():
    # Initialize LLM manager and service
    llm_manager = LLMManager()
    llm_service = LLMService(llm_manager)
    
    question_idx = int(st.query_params.get("q", [0])[0])
    st.title(f"AI Help for Q{question_idx + 1} 💬")
    
    # Initialize chat history
    chat_key = f"chat_history_q{question_idx}"
    if chat_key not in st.session_state:
        st.session_state[chat_key] = []
    
    # Display chat history
    for message in st.session_state[chat_key]:
        if message["role"] == "user":
            st.markdown(f"**You:** {message['content']}")
        else:
            st.markdown(f"**AI:** {message['content']}")
    
    # Chat interface
    user_input = st.text_input("Ask a question:", key=f"user_input_q{question_idx}")
    if st.button("Send", key=f"send_btn_q{question_idx}"):
        if user_input:
            st.session_state[chat_key].append({"role": "user", "content": user_input})
            response_placeholder = st.empty()
            response = ""
            for partial_response in llm_service.ask_ai_help(user_input, st.session_state[chat_key]):
                response = partial_response
                response_placeholder.markdown(f"**AI:** {response}")
            st.session_state[chat_key].append({"role": "assistant", "content": response})
            st.rerun()
    
    # Add a button to navigate back to the main app
    st.markdown("""
        <div style="margin-top: 20px;">
            <button onclick="window.opener.focus(); window.close();">Back to Survey</button>
        </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    chat_interface()