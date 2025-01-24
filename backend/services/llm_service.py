from services.llm_manager import LLMManager
import time

class LLMService:
    def __init__(self, llm_manager: LLMManager):
        self.llm_manager = llm_manager

    def ask_ai_help(self, user_input, chat_history):
        messages = chat_history + [{"role": "user", "content": user_input}]
        request_id = self.llm_manager.submit_request(messages, task_type="chat", model="gpt-4")

        # Stream response
        response = ""
        while True:
            result = self.llm_manager.get_request_result(request_id)
            if result:
                if "error" in result:
                    yield result["error"]
                for choice in result["choices"]:
                    for char in choice.message.content:
                        response += char
                        yield response
                break
            time.sleep(0.5)