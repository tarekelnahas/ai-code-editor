# In server/routers/experiments_router.py
import json
from fastapi import APIRouter, HTTPException
from typing import List
from experiment_tracker import Experiment

router = APIRouter()

# Use a simple JSONL file for persistence.
# In a production system, you would use a database.
EXPERIMENTS_FILE = "experiments.jsonl"

@router.post("/experiments", status_code=201)
async def save_experiment(experiment: Experiment):
    """Saves a new experiment to the persistence layer."""
    try:
        with open(EXPERIMENTS_FILE, "a") as f:
            f.write(experiment.model_dump_json() + "\n")
        return {"status": "success", "experiment_id": experiment.experiment_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save experiment: {e}")

@router.get("/experiments", response_model=List[Experiment])
async def get_experiments() -> List[Experiment]:
    """Retrieves all saved experiments."""
    try:
        experiments = []
        with open(EXPERIMENTS_FILE, "r") as f:
            for line in f:
                if line.strip():
                    experiments.append(Experiment.model_validate_json(line))
        return experiments
    except FileNotFoundError:
        return [] # Return empty list if the file doesn't exist yet
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read experiments: {e}")
