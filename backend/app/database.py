import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./maatrucare.db")
if DATABASE_URL.startswith("postgres://"):
	DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
	DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

PRODUCTION = os.getenv("MAATRUCARE_ENV", "local").lower() == "production" or os.getenv("RENDER", "").lower() == "true"
if PRODUCTION and DATABASE_URL.startswith("sqlite"):
	if os.getenv("MAATRUCARE_SQLITE_PERSISTENT") != "true" or "/var/data/" not in DATABASE_URL:
		raise RuntimeError("Production requires a managed DATABASE_URL or explicitly configured SQLite storage on /var/data")


class Base(DeclarativeBase):
	pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
if engine.dialect.name == "sqlite":
	@event.listens_for(engine, "connect")
	def configure_sqlite(connection, _):
		connection.execute("PRAGMA foreign_keys=ON")
		connection.execute("PRAGMA busy_timeout=5000")
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
