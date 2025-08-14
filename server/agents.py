from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx

import torch
from utils.tensor_utils import harmonize_tensors, safe_matmul
from tools import AVAILABLE_TOOLS, run_tool # Import the new tool components

router = APIRouter()

# --- Agent Prompts ---

def get_planner_prompt():
    """Generates the master prompt for the planner agent, including the tool list."""
    tool_descriptions = "\n".join([f"- {tool.name}: {tool.description} Parameters: {tool.parameters}" for tool in AVAILABLE_TOOLS])
    return f"""You are a master planner AI. Your job is to take a high-level goal and break it down into a series of discrete, actionable steps for other agents to follow. Respond with ONLY a JSON object containing a 'steps' array.

Each object in the array can either be a standard step with a 'role' and an 'instruction', OR a 'tool_call' step with the 'name' of the tool and the 'args' for it.

IMPORTANT: If a tool_call fails, the next step should be to analyze the error and try to correct it. For standard machine learning tasks, prefer high-level tools like 'train_knn_classifier' over writing raw code with 'python_code_interpreter'.

Available Tools:
{tool_descriptions}

Example of a machine learning plan:
Goal: Train a KNN model on the iris dataset and report its accuracy.
Response:
{{
  "steps": [
    {{"tool_call": {{"name": "train_knn_classifier", "args": {{"dataset_path": "./data/iris.csv", "target_column": "species"}}}}}},
    {{"role": "writer", "instruction": "The tool_output contains the classification report for the KNN model. Analyze the report and summarize the model's performance, paying special attention to the overall accuracy and the F1-score for each class."}}
  ]
}}
"""

    return f"""You are a master planner AI. Your job is to take a high-level goal and break it down into a series of discrete, actionable steps for other agents to follow. Respond with ONLY a JSON object containing a 'steps' array.

Each object in the array can either be a standard step with a 'role' and an 'instruction', OR a 'tool_call' step with the 'name' of the tool and the 'args' for it.

IMPORTANT: If a tool_call fails, the next step should be to analyze the error and try to correct it. For example, if read_file fails with a 'file not found' error, the next step should be to use list_directory to find the correct file path.

Available Tools:
{tool_descriptions}

Example of a successful plan:
Goal: Calculate the square root of 256 and then explain what it is.
Response:
{{
  "steps": [
    {{"tool_call": {{"name": "python_code_interpreter", "args": {{"code": "import math; print(math.sqrt(256))"}}}}}},
    {{"role": "writer", "instruction": "The previous step calculated the square root of 256. Explain what a square root is and why the result is correct."}}
  ]
}}

Example of a self-correcting plan:
Goal: Read the main project file.
Response:
{{
  "steps": [
    {{"tool_call": {{"name": "read_file", "args": {{"path": "main.py"}}}}}},
    {{"role": "writer", "instruction": "The tool_output contains the content of main.py. Review it and summarize its purpose."}}
  ]
}}
"""

ROLE_PROMPTS = {
    "writer":  "You are a senior software engineer. Be concise, show code blocks when needed.",
    "reviewer":"You are a code reviewer. Point out issues and suggest diffs/patches.",
    "tester":  "You are a QA/tester. Provide reproducible steps and lightweight tests."
}

# --- Pydantic Models ---
class PlanReq(BaseModel):
    instructions: str

class FlowRes(BaseModel):
    model: str
    transcript: List[Dict[str,Any]]

# --- Core Functions ---
async def pick_model(role: str|None="general") -> str:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r=await c.get("http://127.0.0.1:8000/ai/meta"); j=r.json()
            avail=j.get("available",[]); roles=j.get("roles",{})
            pref=[ (roles.get(role.lower())) for role in [role, "planner", "general", "completion"] if role]
            pref=[m for m in pref if m]
            for m in pref:
                if m in avail: return m
            return avail[0] if avail else (pref[0] if pref else "dolphin-phi:latest")
    except: return "dolphin-phi:latest"

async def ask(model:str, prompt:str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as c:
        r=await c.post("http://127.0.0.1:11434/api/generate", json={"model":model,"prompt":prompt,"stream":False})
        r.raise_for_status(); return r.json().get("response","")

# --- API Endpoints ---
@router.post("/agents/run_flow", response_model=FlowRes)
async def run_flow(req: PlanReq):
    # 1. Planning Stage
    planner_model = await pick_model("planner")
    planner_prompt = f"{get_planner_prompt()}\n\nGoal: {req.instructions}"
    
    try:
        plan_response = await ask(planner_model, planner_prompt)
        cleaned_response = plan_response.strip().replace('\n', '').replace('```json', '').replace('```', '')
        plan_data = json.loads(cleaned_response)
        steps = plan_data.get("steps", [])
        if not steps: raise HTTPException(400, "Planner failed to generate steps.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Planner failed: {e}. Response was: {plan_response}")

    # 2. Execution Stage
    memory = ConversationMemory()
    memory.add_message(role="planner", content=plan_data)

    execution_model = await pick_model("general")

    for i,st in enumerate(steps,1):
        context = memory.get_context()

        if "tool_call" in st:
            tool_name = st["tool_call"].get("name")
            tool_args = st["tool_call"].get("args", {})
            result = run_tool(tool_name, tool_args)
            memory.add_message(role=f"tool_output:{tool_name}", content=result)
        else:
            role = st.get("role","writer")
            sys_prompt = ROLE_PROMPTS.get(role,"")
            prompt = f"{sys_prompt}\n\nOverall Goal:\n{req.instructions}\n\nConversation History:\n{context}\n\nYour current step ({role} #{i}):\n{st.get('instruction','')}\n"
            out = await ask(execution_model, prompt)
            memory.add_message(role=role, content=out)
        
    return FlowRes(model=execution_model, transcript=memory.messages)


ROLE_PROMPTS = {
    "writer":  "You are a senior software engineer. Be concise, show code blocks when needed.",
    "reviewer":"You are a code reviewer. Point out issues and suggest diffs/patches.",
    "tester":  "You are a QA/tester. Provide reproducible steps and lightweight tests."
}

# --- Pydantic Models ---
class PlanReq(BaseModel):
    instructions: str

class FlowRes(BaseModel):
    model: str
    transcript: List[Dict[str,str]]

# --- Core Functions ---
async def pick_model(role: str|None="general") -> str:
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r=await c.get("http://127.0.0.1:8000/ai/meta"); j=r.json()
            avail=j.get("available",[]); roles=j.get("roles",{})
            pref=[ (roles.get(role.lower())) for role in [role, "planner", "general", "completion"] if role]
            pref=[m for m in pref if m]
            for m in pref:
                if m in avail: return m
            return avail[0] if avail else (pref[0] if pref else "dolphin-phi:latest")
    except: return "dolphin-phi:latest"

async def ask(model:str, prompt:str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as c:
        r=await c.post("http://127.0.0.1:11434/api/generate", json={"model":model,"prompt":prompt,"stream":False})
        r.raise_for_status(); return r.json().get("response","")

# --- API Endpoints ---
@router.post("/agents/run_flow", response_model=FlowRes)
async def run_flow(req: PlanReq):
    # 1. Planning Stage
    planner_model = await pick_model("planner")
    planner_prompt = f"{get_planner_prompt()}\n\nGoal: {req.instructions}"
    
    try:
        plan_response = await ask(planner_model, planner_prompt)
        # Clean the response to ensure it's valid JSON
        cleaned_response = plan_response.strip().replace('\n', '').replace('```json', '').replace('```', '')
        plan_data = json.loads(cleaned_response)
        steps = plan_data.get("steps", [])
        if not steps: raise HTTPException(400, "Planner failed to generate steps.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Planner failed: {e}. Response was: {plan_response}")

    # 2. Execution Stage
    execution_model = await pick_model("general")
    transcript=[{"role": "planner", "content": json.dumps(plan_data, indent=2)}]
    context=transcript[0]["content"]

    for i,st in enumerate(steps,1):
        if "tool_call" in st:
            tool_name = st["tool_call"].get("name")
            tool_args = st["tool_call"].get("args", {})
            result = run_tool(tool_name, tool_args)
            transcript.append({"role": f"tool: {tool_name}", "content": json.dumps(result, indent=2)})
            context += f"\n\n[Tool Result: {tool_name}] {json.dumps(result)}"
        else:
            role = st.get("role","writer")
            sys = ROLE_PROMPTS.get(role,"")
            prompt = f"{sys}\n\nOverall Goal:\n{req.instructions}\n\nPrevious context:\n{context}\n\nYour current step ({role} #{i}):\n{st.get('instruction','')}\n"
            out = await ask(execution_model, prompt)
            transcript.append({"role":role, "content":out})
            context += f"\n\n[{role}#{i}] {out}"
        
    return FlowRes(model=execution_model, transcript=transcript)

