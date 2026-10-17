"""Integration smoke test for a dedicated, empty PostgreSQL test database."""
import secrets
from fastapi.testclient import TestClient
from app.main import app
from app.database import engine, User, Project, LoginSession
from sqlalchemy.orm import Session
from sqlalchemy import delete

assert engine.dialect.name == 'postgresql', 'Use a dedicated PostgreSQL test database'
email = f'ci-{secrets.token_hex(8)}@example.com'
uid = pid = None
try:
    with TestClient(app, headers={'Origin':'http://localhost:5173'}) as c:
        r = c.post('/auth/register',json={'name':'CI User','email':email,'password':secrets.token_urlsafe(20)})
        assert r.status_code == 201, r.text
        uid = r.json()['user']['id']
        r = c.post('/projects',json={'name':'PostgreSQL smoke','description':'Disposable CI fixture'})
        assert r.status_code == 201, r.text
        pid = r.json()['id']
        r = c.post(f'/projects/{pid}/issues',json={'title':'Verify PostgreSQL storage','assigned_to':uid})
        assert r.status_code == 201, r.text
        iid = r.json()['id']
        assert c.post(f'/issues/{iid}/comments',json={'body':'Persisted in PostgreSQL'}).status_code == 201
        assert c.patch(f'/issues/{iid}',json={'status':'Done'}).status_code == 200
        assert c.get(f'/projects/{pid}/issues?q=storage').json()['total'] == 1
        assert c.delete(f'/projects/{pid}').status_code == 204
        pid = None
        assert c.get(f'/issues/{iid}').status_code == 404
        assert c.post('/auth/logout').status_code == 204
    print('PostgreSQL smoke test passed')
finally:
    with Session(engine) as db:
        if pid:
            db.execute(delete(Project).where(Project.id == pid))
        if uid:
            db.execute(delete(LoginSession).where(LoginSession.user_id == uid))
            db.execute(delete(User).where(User.id == uid))
        db.commit()
