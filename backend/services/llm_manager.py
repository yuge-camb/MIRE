import os
import time
import queue
import threading
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, Future
import uuid
import openai
import asyncio

from .api_config import APIConfig, ModelConfig
import logging

@dataclass
class LLMRequest:
    request_id: str
    messages: List[Dict[str, Any]]
    model: str
    timestamp: float
    task_type: str  # 'analysis', 'chat', 'intervention'
    kwargs: Dict[str, Any]


class LLMManager:
    def __init__(self):
        # Initialize configuration
        self.config = APIConfig()
        openai.api_key = self.config.openai_api_key

        # Initialize request queue with priority
        self.request_queue = queue.PriorityQueue()

        # ThreadPoolExecutor for handling concurrent requests
        self.thread_pool = ThreadPoolExecutor(
            max_workers=self.config.max_concurrent_requests
        )

        # Dictionary to hold active requests: request_id -> Future
        self.active_requests: Dict[str, Future] = {}

        # Initialize usage statistics
        self.completion_count = 0
        self.total_tokens_used = 0

        # Lock for thread-safe operations on active_requests
        self.lock = threading.Lock()

        # Start background thread to process the queue
        self.background_thread = threading.Thread(
            target=self._process_queue,
            daemon=True
        )
        self.background_thread.start()

    def submit_request(
        self,
        messages: List[Dict[str, Any]],
        task_type: str,
        model: str,
        **kwargs
    ) -> str:
        """
        Submit a new LLM request and return a unique request ID.
        The request is enqueued based on its priority.
        """
        request_id = f"{int(time.time() * 1000)}_{task_type}_{uuid.uuid4().hex}"
        request = LLMRequest(
            request_id=request_id,
            messages=messages,
            model=model,
            timestamp=time.time(),
            task_type=task_type,
            kwargs=kwargs
        )
        priority = self.config.priorities.get(task_type, 10)  # Default low priority
        # Add a unique counter to break timestamp ties
        self.request_queue.put((priority, request.timestamp, id(request), request))
        return request_id

    def get_request_result(self, request_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve the result of a completed request using its request_id.
        Returns None if the request is still pending.
        """
        with self.lock:
            future = self.active_requests.get(request_id)
            if future and future.done():
                try:
                    result = future.result()
                    # Remove the request from active_requests after retrieval
                    del self.active_requests[request_id]
                    return result
                except Exception as e:
                    print(f"Error retrieving result for {request_id}: {e}")
                    del self.active_requests[request_id]
                    return {"error": str(e)}
        return None

    def cancel_request(self, request_id: str) -> bool:
        """Cancel a pending request."""
        with self.lock:
            future = self.active_requests.get(request_id)
            if future and not future.done():
                cancelled = future.cancel()
                if cancelled:
                    del self.active_requests[request_id]
                return cancelled
        return False

    def _process_queue(self):
        """
        Continuously process requests from the queue and submit them to the thread pool.
        """
        while True:
            try:
                priority, _, _, request = self.request_queue.get(timeout=1)  # Updated to unpack 4 items
                future = self.thread_pool.submit(self._execute_request, request)
                with self.lock:
                    self.active_requests[request.request_id] = future
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Error in processing queue: {e}")

    def _execute_request(self, request: LLMRequest) -> Dict[str, Any]:
        """
        Execute an individual LLM request with retry logic.
        Returns the response from OpenAI or an error message.
        """
        model_config: ModelConfig = self.config.model_configs.get(
            request.model,
            ModelConfig(max_tokens=500, temperature=0.3, timeout=30)
        )
        
        # Create base params from model config
        api_params = {
            "model": request.model,
            "messages": request.messages,
            "temperature": model_config.temperature,
            "timeout": model_config.timeout,
            "max_tokens": model_config.max_tokens
        }

        # Update with any overrides from request kwargs
        api_params.update(request.kwargs)

        for attempt in range(1, self.config.max_retries + 1):
            try:
                response = openai.chat.completions.create(**api_params)

                result = {
                    "choices": response.choices,
                    "usage": response.usage
                }

                # Update usage statistics
                with self.lock:
                    self.completion_count += 1

                return result

            except openai.RateLimitError as e:
                print(f"Rate limit error on attempt {attempt} for request {request.request_id}: {e}")
            except openai.APIError as e:
                print(f"OpenAI error on attempt {attempt} for request {request.request_id}: {e}")
            except Exception as e:
                print(f"Unexpected error on attempt {attempt} for request {request.request_id}: {e}")

            # Exponential backoff before retrying
            sleep_time = self.config.retry_delay * (2 ** (attempt - 1))
            time.sleep(sleep_time)

        return {"error": f"Failed to process request {request.request_id} after {self.config.max_retries} attempts."}

    async def submit_request_async(self, *args, **kwargs) -> Dict:
        """Async wrapper around request submission and waiting"""
        request_id = self.submit_request(*args, **kwargs)
        return await self._wait_for_completion(request_id)
        
    async def _wait_for_completion(self, request_id: str, timeout: int = 30) -> Dict:
        """Async wait for request completion"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            result = self.get_request_result(request_id)
            if result:
                return result
            await asyncio.sleep(0.1)
        return {"error": "Timeout"}

    def shutdown(self):
        """
        Shutdown the thread pool and background thread gracefully.
        """
        self.thread_pool.shutdown(wait=True)
        # Background thread is daemonized; it will exit when the main program exits.