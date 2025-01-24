import streamlit as st

def create_notification_box():
    # Create a container for the notification
    notification_container = st.empty()
    
    # Custom CSS for the notification box
    notification_css = """
    <style>
    .notification-box {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 300px;
        padding: 20px;
        background-color: #f8f9fa;
        border-left: 6px solid #4CAF50;
        box-shadow: 0 5px 8px rgba(0,0,0,0.15);
        z-index: 9999;
    }
    .notification-text {
        color: #333;
        font-size: 16px;
        margin: 0;
    }
    .close-button {
        color: #aaa;
        float: right;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
    }
    .close-button:hover {
        color: #555;
    }
    .navigate-button {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 10px 0;
        cursor: pointer;
    }
    .navigate-button:hover {
        background-color: #45a049;
    }
    </style>
    """
    
    return notification_container, notification_css

def show_notification(container):
    notification_html = """
    <div class="notification-box">
        <span class="close-button" onclick="this.parentElement.style.display='none';">&times;</span>
        <p class="notification-text">This is a notification message! Click to navigate to the target section.</p>
        <a href="#target-section" target="_self" class="navigate-button">Go to Target Section</a>
    </div>
    """
    container.markdown(notification_html, unsafe_allow_html=True)

# Main Streamlit app
def main():
    st.title("Streamlit Notification Example")

    # Create the notification box
    notification_container, notification_css = create_notification_box()
    st.markdown(notification_css, unsafe_allow_html=True)

    # Button to trigger the notification
    if st.button("Show Notification"):
        show_notification(notification_container)

    # Rest of your Streamlit app content
    st.write("This is the main content of the Streamlit app.")
    
    # Add more sections to require scrolling
    for i in range(10):
        st.write(f"Section {i+1}")
        st.write("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.")

    # Target section with anchor
    st.markdown('<div id="target-section"></div>', unsafe_allow_html=True)
    st.header("Target Section")
    st.write("This is the target section. You will be navigated here when you click on the notification box.")

if __name__ == "__main__":
    main()