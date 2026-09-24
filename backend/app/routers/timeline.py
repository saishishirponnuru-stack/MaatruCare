from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TimelineEvent
from ..schemas import TimelineEventResponse

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=list[TimelineEventResponse])
def list_timeline_events(db: Session = Depends(get_db)) -> list[TimelineEvent]:
	return list(db.scalars(select(TimelineEvent).order_by(TimelineEvent.event_date, TimelineEvent.id)).all())
