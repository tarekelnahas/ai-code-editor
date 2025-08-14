# In server/utils/tensor_utils.py
import torch
from config import DEVICE # Import the global device setting

def harmonize_tensors(*tensors: torch.Tensor, dtype: torch.dtype = torch.float32) -> list[torch.Tensor]:
    """
    Ensures all provided tensors are on the correct device and have the same dtype.
    """
    harmonized = []
    for t in tensors:
        t = t.to(DEVICE)
        if t.dtype != dtype:
            t = t.to(dtype)
        harmonized.append(t)
    return harmonized

def safe_matmul(tensor_a: torch.Tensor, tensor_b: torch.Tensor) -> torch.Tensor | None:
    """
    Performs matrix multiplication safely, attempting to fix shape errors by transposing.
    Returns None if the operation is impossible.
    """
    t_a, t_b = harmonize_tensors(tensor_a, tensor_b) # Ensure device/dtype are correct first

    if t_a.shape[-1] == t_b.shape[-2]:
        return torch.matmul(t_a, t_b)
    elif t_a.shape[-1] == t_b.T.shape[-2]:
        return torch.matmul(t_a, t_b.T)
    else:
        print(f"ERROR: Shape mismatch. Cannot multiply {t_a.shape} and {t_b.shape}")
        return None
