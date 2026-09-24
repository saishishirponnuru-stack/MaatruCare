from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CareHandoff
from ..schemas import CareHandoffResponse

router = APIRouter(prefix="/api/handoffs", tags=["handoffs"])


@router.get("", response_model=list[CareHandoffResponse])
def list_handoffs(db: Session = Depends(get_db)) -> list[CareHandoff]:
	return list(db.scalars(select(CareHandoff).order_by(CareHandoff.id)).all())
