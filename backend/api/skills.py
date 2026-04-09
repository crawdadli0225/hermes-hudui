"""Skills endpoints."""

from fastapi import APIRouter

from hermes_hud.collectors.skills import collect_skills
from .serialize import to_dict

router = APIRouter()


@router.get("/skills")
async def get_skills():
    return to_dict(collect_skills())
