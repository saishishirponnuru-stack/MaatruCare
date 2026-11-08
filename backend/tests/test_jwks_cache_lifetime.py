import io,json
from fastapi import HTTPException
import pytest
from app.services import auth_service as auth

def test_jwks_cache_expires_without_accepting_retired_keys_forever(monkeypatch):
    monkeypatch.setattr(auth,"_jwks_cache",None);now=[0];calls=[]
    monkeypatch.setattr(auth,"monotonic",lambda:now[0])
    def response(*args,**kwargs):calls.append(True);return io.StringIO(json.dumps({"keys":[{"kid":"old" if len(calls)==1 else "new"}]}))
    monkeypatch.setattr(auth.urllib.request,"urlopen",response)
    first=auth._load_jwks("https://fictional.example/keys");assert first["keys"][0]["kid"]=="old"
    now[0]=299;assert auth._load_jwks("https://fictional.example/keys") is first and len(calls)==1
    now[0]=301;assert auth._load_jwks("https://fictional.example/keys")["keys"][0]["kid"]=="new" and len(calls)==2

def test_simultaneous_rotation_refreshes_share_the_latest_key_set_and_expired_failures_close(monkeypatch):
    monkeypatch.setattr(auth,"_jwks_cache",None);now=[0];calls=[]
    monkeypatch.setattr(auth,"monotonic",lambda:now[0])
    def response(*args,**kwargs):calls.append(True);return io.StringIO(json.dumps({"keys":[{"kid":str(len(calls))}]}))
    monkeypatch.setattr(auth.urllib.request,"urlopen",response)
    old=auth._load_jwks("https://fictional.example/keys")
    fresh=auth._load_jwks("https://fictional.example/keys",force=True,expected=old)
    assert auth._load_jwks("https://fictional.example/keys",force=True,expected=old) is fresh and len(calls)==2
    now[0]=301
    monkeypatch.setattr(auth.urllib.request,"urlopen",lambda *a,**k:(_ for _ in ()).throw(OSError("Synthetic offline key discovery")))
    with pytest.raises(HTTPException) as error:auth._load_jwks("https://fictional.example/keys")
    assert error.value.status_code==503
