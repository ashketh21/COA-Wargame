"""Axial hex grid utilities for spatial distance, neighbors, and coordinate conversion."""

from typing import List, Tuple
from .models import HexCoord

AXIAL_DIRECTIONS: List[Tuple[int, int]] = [
    (1, 0), (1, -1), (0, -1),
    (-1, 0), (-1, 1), (0, 1),
]


def hex_distance(a_q: int, a_r: int, b_q: int, b_r: int) -> int:
    """Compute Manhattan distance on an axial hex grid."""
    return (abs(a_q - b_q) + abs(a_q + a_r - b_q - b_r) + abs(a_r - b_r)) // 2


def hex_neighbors(q: int, r: int, max_q: int = 9, max_r: int = 7) -> List[HexCoord]:
    """Return valid in-bounds neighboring hexes."""
    result: List[HexCoord] = []
    for dq, dr in AXIAL_DIRECTIONS:
        nq, nr = q + dq, r + dr
        if 0 <= nq <= max_q and 0 <= nr <= max_r:
            result.append(HexCoord(q=nq, r=nr))
    return result
