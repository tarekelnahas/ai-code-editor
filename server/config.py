# In server/config.py
import torch
import numpy as np
import random
import os

# --- 1. Device-Agnostic Setup ---
# This single variable will be imported by all other modules.
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# --- 2. Reproducibility Setup ---
def set_seed(seed: int):
    """Sets the random seed for all relevant libraries for reproducibility."""
    torch.manual_seed(seed)
    np.random.seed(seed)
    random.seed(seed)
    if DEVICE.type == 'cuda':
        # Set seed for all available GPUs for consistency.
        torch.cuda.manual_seed_all(seed)

# Get seed from an environment variable for flexibility, or use a default.
APP_SEED = int(os.getenv("APP_SEED", 42))
set_seed(APP_SEED)

print(f"--- App Config Initialized ---")
print(f"Device set to: {DEVICE}")
print(f"Random seed set to: {APP_SEED}")
print(f"------------------------------")
