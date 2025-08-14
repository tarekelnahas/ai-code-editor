# In server/memory.py
from typing import List, Dict, Any

class ConversationMemory:
    """A class to manage the agent's conversation history in a structured way."""

    def __init__(self, system_prompt: str = ""):
        self.messages: List[Dict[str, Any]] = []
        if system_prompt:
            self.messages.append({"role": "system", "content": system_prompt})

    def add_message(self, role: str, content: Any):
        """Adds a new message to the memory."""
        self.messages.append({"role": role, "content": content})

    def get_context(self, max_tokens: int = 4096) -> str:
        """
        Formats the conversation history into a single string for the LLM prompt.
        In a real implementation, this would be more sophisticated, potentially
        summarizing older messages to stay within the token limit.
        """
        context_str = ""
        for msg in reversed(self.messages):
            if msg['role'] == 'system': continue # System prompt is handled separately
            
            content_str = str(msg['content'])
            if isinstance(msg['content'], dict) or isinstance(msg['content'], list):
                content_str = f"json\n{json.dumps(msg['content'], indent=2)}"

            formatted_msg = f"\n\n[{msg['role']}]\n{content_str}"
            
            # A very basic token management strategy
            if len(context_str) + len(formatted_msg) > max_tokens:
                break
            
            context_str = formatted_msg + context_str
            
        return context_str

    def clear(self):
        """Clears the conversation history."""
        # Keep the system prompt if it exists
        system_prompt = self.messages[0] if self.messages and self.messages[0]['role'] == 'system' else None
        self.messages = []
        if system_prompt:
            self.messages.append(system_prompt)
