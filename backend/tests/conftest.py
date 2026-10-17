import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


_TEST_DATABASE_DIRECTORY = tempfile.TemporaryDirectory(prefix="maatrucare-tests-")
TEST_DATABASE_PATH = Path(_TEST_DATABASE_DIRECTORY.name) / "test.db"
DEVELOPMENT_DATABASE_PATH = Path(__file__).resolve().parents[1] / "maatrucare.db"

# This runs while pytest loads conftest.py, before any test imports app.main.
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH}"


def _assert_isolated_database() -> None:
	database_url = os.environ.get("DATABASE_URL", "")
	assert database_url == f"sqlite:///{TEST_DATABASE_PATH}"
	assert TEST_DATABASE_PATH.resolve() != DEVELOPMENT_DATABASE_PATH.resolve()


@pytest.fixture(scope="session", autouse=True)
def isolated_database() -> None:
	_assert_isolated_database()
	from app.database import Base, engine
	from app.seed import seed_database

	Base.metadata.create_all(bind=engine)
	seed_database()
	_assert_isolated_database()
	assert TEST_DATABASE_PATH.exists()
	yield
	engine.dispose()
	_assert_isolated_database()


@pytest.fixture
def client(isolated_database) -> TestClient:
	from app.main import app

	with TestClient(app) as test_client:
		yield test_client


@pytest.fixture
def db_session(isolated_database):
	from app.database import SessionLocal

	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()