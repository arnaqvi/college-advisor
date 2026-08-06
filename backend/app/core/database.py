"""SQLAlchemy 2.0 async engine/session skeleton.

No tables are defined yet — this is scaffolding for a later phase. When the
data model is ready, add ORM classes under app/models/ (subclassing `Base`
from app/models/base.py) and create routers/repositories that depend on
`get_db` below.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
