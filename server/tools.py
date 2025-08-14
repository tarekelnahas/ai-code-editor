import io
import contextlib
import os
import httpx
from pathlib import Path
from pydantic import BaseModel
from typing import List, Dict, Any
from bs4 import BeautifulSoup

# --- Tool Definition ---
class Tool(BaseModel):
    name: str
    description: str
    parameters: List[Dict[str, Any]]

# --- Tool Implementations ---

def python_code_interpreter(code: str) -> Dict[str, Any]:
    """Executes python code and returns the output, capturing stdout and stderr."""
    if not isinstance(code, str):
        return {"error": "Code must be a string."}
    output_stream = io.StringIO()
    try:
        with contextlib.redirect_stdout(output_stream):
            exec(code)
        output = output_stream.getvalue()
        return {"status": "success", "output": output}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

def read_file(path: str) -> Dict[str, Any]:
    """Reads the content of a file at the given path."""
    try:
        return {"status": "success", "content": Path(path).read_text(encoding="utf-8")}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

def write_file(path: str, content: str) -> Dict[str, Any]:
    """Writes content to a file at the given path."""
    try:
        Path(path).write_text(content, encoding="utf-8")
        return {"status": "success", "detail": f"File written to {path}"}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

def list_directory(path: str) -> Dict[str, Any]:
    """Lists the contents of a directory at the given path."""
    try:
        entries = os.listdir(path)
        return {"status": "success", "entries": entries}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

def web_search(query: str) -> Dict[str, Any]:
    """Performs a web search using DuckDuckGo and returns the top results."""
    try:
        with httpx.Client() as client:
            response = client.get(f"https://api.duckduckgo.com/?q={query}&format=json")
            response.raise_for_status()
            results = response.json().get("RelatedTopics", [])
            return {"status": "success", "results": results}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

def fetch_webpage_content(url: str) -> Dict[str, Any]:
    """Fetches and parses the text content of a webpage."""
    try:
        with httpx.Client() as client:
            response = client.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            # Remove script and style elements
            for script_or_style in soup(["script", "style"]):
                script_or_style.decompose()
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = "\n".join(chunk for chunk in chunks if chunk)
            return {"status": "success", "content": text[:8000]}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

# --- Placeholder Implementations ---
def append_to_file(path: str, content: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Appending to file at {path}"}

def execute_shell_command(command: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Executing shell command: {command}"}

def make_api_request(method: str, url: str, params: dict = None, body: dict = None) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Making {method} request to {url}"}

def query_database(sql_query: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Querying database with: {sql_query}"}

def send_email(recipient: str, subject: str, body: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Sending email to {recipient}"}

def create_calendar_event(title: str, start_time: str, end_time: str, attendees: list = []) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Creating calendar event: {title}"}

def get_git_status() -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": "Getting git status"}

def create_git_commit(message: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Creating git commit with message: {message}"}

def ask_user_for_clarification(question: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Asking user: {question}"}

def finish_task(final_answer: str) -> Dict[str, Any]:
    return {"status": "success", "detail": f"Task finished with final answer: {final_answer}"}

def delegate_task_to_another_agent(agent_name: str, task_description: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Delegating task to agent: {agent_name}"}

def vector_search_documents(query: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Performing vector search for: {query}"}

def summarize_text(text: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": "Summarizing text."}

def extract_entities(text: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": "Extracting entities from text."}

def generate_image(prompt: str) -> Dict[str, Any]:
    return {"status": "not_implemented", "detail": f"Generating image with prompt: {prompt}"}


# --- Tool Registry ---
AVAILABLE_TOOLS: List[Tool] = [
    Tool(name="python_code_interpreter", description="Executes Python code in a restricted environment. Use for calculations, data manipulation, or precise logic.", parameters=[{"name": "code", "type": "string", "description": "The Python code to execute."}])
    Tool(name="calculate_classification_metrics", description="Calculates precision, recall, and f1-score for classification results.", parameters=[{"name": "y_true", "type": "list", "description": "The true labels."}, {"name": "y_pred", "type": "list", "description": "The predicted labels."}])
    Tool(name="read_file", description="Reads the entire content of a specified file.", parameters=[{"name": "path", "type": "string", "description": "The absolute or relative path to the file."}])
    Tool(name="write_file", description="Writes or overwrites content to a file.", parameters=[{"name": "path", "type": "string", "description": "The path to the file."}, {"name": "content", "type": "string", "description": "The content to write."}])
    Tool(name="list_directory", description="Lists files and subdirectories in a directory.", parameters=[{"name": "path", "type": "string", "description": "The path to the directory."}])
    Tool(name="append_to_file", description="Appends content to the end of a file.", parameters=[{"name": "path", "type": "string", "description": "The path to the file."}, {"name": "content", "type": "string", "description": "The content to append."}])
    Tool(name="web_search", description="Performs a web search and returns snippets.", parameters=[{"name": "query", "type": "string", "description": "The search query."}])
    Tool(name="fetch_webpage_content", description="Fetches text content from a URL.", parameters=[{"name": "url", "type": "string", "description": "The URL of the webpage."}])
    Tool(name="execute_shell_command", description="Executes a shell command. DANGEROUS - USE WITH CAUTION.", parameters=[{"name": "command", "type": "string", "description": "The shell command to execute."}])
    Tool(name="make_api_request", description="Makes an HTTP request to an API.", parameters=[{"name": "method", "type": "string", "description": "HTTP method"}, {"name": "url", "type": "string", "description": "API URL"}, {"name": "params", "type": "dict", "description": "Query parameters"}, {"name": "body", "type": "dict", "description": "JSON body"}])
    Tool(name="query_database", description="Executes a read-only SQL query.", parameters=[{"name": "sql_query", "type": "string", "description": "The SQL SELECT statement."}])
    Tool(name="send_email", description="Sends an email.", parameters=[{"name": "recipient", "type": "string"}, {"name": "subject", "type": "string"}, {"name": "body", "type": "string"}])
    Tool(name="create_calendar_event", description="Creates a calendar event.", parameters=[{"name": "title", "type": "string"}, {"name": "start_time", "type": "string"}, {"name": "end_time", "type": "string"}, {"name": "attendees", "type": "list"}])
    Tool(name="get_git_status", description="Runs `git status`.", parameters=[])
    Tool(name="create_git_commit", description="Creates a git commit.", parameters=[{"name": "message", "type": "string"}])
    Tool(name="ask_user_for_clarification", description="Asks the user a question.", parameters=[{"name": "question", "type": "string"}])
    Tool(name="finish_task", description="Signals the task is complete.", parameters=[{"name": "final_answer", "type": "string"}])
    Tool(name="delegate_task_to_another_agent", description="Delegates a task to a different agent.", parameters=[{"name": "agent_name", "type": "string"}, {"name": "task_description", "type": "string"}])
    Tool(name="vector_search_documents", description="Performs a semantic search on documents.", parameters=[{"name": "query", "type": "string"}])
    Tool(name="summarize_text", description="Summarizes a long piece of text.", parameters=[{"name": "text", "type": "string"}])
    Tool(name="extract_entities", description="Extracts named entities from text.", parameters=[{"name": "text", "type": "string"}])
    Tool(name="generate_image", description="Creates an image from a text prompt.", parameters=[{"name": "prompt", "type": "string"}])

]

TOOL_IMPLEMENTATIONS = {
    "python_code_interpreter": python_code_interpreter,
    "read_file": read_file,
    "write_file": write_file,
    "list_directory": list_directory,
    "append_to_file": append_to_file,
    "web_search": web_search,
    "fetch_webpage_content": fetch_webpage_content,
    "execute_shell_command": execute_shell_command,
    "make_api_request": make_api_request,
    "query_database": query_database,
    "send_email": send_email,
    "create_calendar_event": create_calendar_event,
    "get_git_status": get_git_status,
    "create_git_commit": create_git_commit,
    "ask_user_for_clarification": ask_user_for_clarification,
    "finish_task": finish_task,
    "delegate_task_to_another_agent": delegate_task_to_another_agent,
    "vector_search_documents": vector_search_documents,
    "summarize_text": summarize_text,
    "extract_entities": extract_entities,
    "generate_image": generate_image,
}

# --- Tool Dispatcher ---
def run_tool(name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    """Finds and executes a tool by its name with the given arguments."""
    if name not in TOOL_IMPLEMENTATIONS:
        return {"status": "error", "error_message": f"Tool '{name}' not found."} 
    
    tool_function = TOOL_IMPLEMENTATIONS[name]
    try:
        return tool_function(**args)
    except Exception as e:
        return {"status": "error", "error_message": f"Error running tool '{name}': {e}"}
