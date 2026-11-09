import pytest
from app.routers import ai
from app.services.ai_service import AIProviderError
from test_functional_repairs import patient_workspace


@pytest.mark.parametrize('category,phrase', [
    ('missing configuration', 'not configured'), ('invalid credentials', 'credentials'),
    ('unsupported model', 'model is unavailable'), ('quota exhausted', 'quota is exhausted'),
    ('rate limited', 'limiting requests'), ('timeout', 'timed out'),
    ('provider unavailable', 'temporarily unavailable'),
])
def test_provider_errors_have_safe_categories(client, patient_workspace, monkeypatch, caplog, category, phrase):
    auth, *_ = patient_workspace
    def failed(*args): raise AIProviderError(category)
    monkeypatch.setattr(ai, 'generate_workspace', failed)
    ai._request_times.clear()
    response = client.post('/api/ai/workspace', headers=auth, json={
        'note': 'Fictional logistics: Prepare the folder.', 'operation': 'summarize',
        'external_processing_consent': True,
    })
    assert response.status_code == 503
    assert phrase in response.json()['detail']
    assert f'category={category}' in caplog.text
    assert 'Fictional logistics' not in caplog.text


def test_get_workspace_is_not_a_generation_operation(client, patient_workspace, monkeypatch):
    auth, *_ = patient_workspace
    def forbidden(*args): raise AssertionError("GET must never generate")
    monkeypatch.setattr(ai, "generate_workspace", forbidden)
    assert client.get("/api/ai/workspace", headers=auth).status_code == 405
