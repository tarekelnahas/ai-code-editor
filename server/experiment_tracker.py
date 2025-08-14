# In server/experiment_tracker.py
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import datetime

class Experiment(BaseModel):
    experiment_id: str = Field(default_factory=lambda: f"exp_{datetime.datetime.utcnow().isoformat()}")
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    model: str
    transcript: List[Dict[str, Any]]
    # New fields for evaluation
    ground_truth: Optional[List[Any]] = None
    predictions: Optional[List[Any]] = None
    evaluation_report: Optional[Dict[str, Any]] = None

