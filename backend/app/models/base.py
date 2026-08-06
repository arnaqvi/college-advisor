"""SQLAlchemy 2.0 declarative base — subclass this for every ORM model.

See app/models/college.py for the real `College`/`Program` models (the
university/major-level directory that backs `/api/colleges`). This module
used to carry only a *docstring example* of what a `College` model might
look like — that example was never a real table. It has been superseded by
the actual implementation; this file now only defines `Base` itself.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
