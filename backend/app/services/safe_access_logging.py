"""Do not retain bearer invitation capabilities in Uvicorn access lines."""
import logging
import re

class InvitationPathFilter(logging.Filter):
    def filter(self, record):
        if isinstance(record.args,tuple) and len(record.args)==5 and isinstance(record.args[2],str):
            args=list(record.args)
            args[2]=re.sub(r"(/api/auth/invitations/)[^/?]+(/(?:accept|decline|preview))(?:\?[^ ]*)?",r"\1[redacted]\2",args[2])
            record.args=tuple(args)
        return True

def install():
    logger=logging.getLogger("uvicorn.access")
    if not any(isinstance(f,InvitationPathFilter) for f in logger.filters):
        logger.addFilter(InvitationPathFilter())
