"""Query-growth regression checks use isolated records and genuine JWT validation."""
from datetime import date
from sqlalchemy import event

from test_functional_repairs import patient_workspace
from app.database import engine
from app.models import Caregiver, Task, CareHandoff


def test_list_query_counts_do_not_grow_with_each_participant(client, patient_workspace, db_session):
    auth, account, *_ = patient_workspace
    members = []
    recipients = []
    for index in range(25):
        member = Caregiver(patient_id=account["patient_id"], name=f"Fictional member {index}", relationship="Friend", is_demo=True)
        db_session.add(member)
        db_session.flush()
        members.append(member.id)
        recipient = Caregiver(patient_id=account["patient_id"], name=f"Fictional recipient {index}", relationship="Friend", is_demo=True)
        db_session.add(recipient)
        db_session.flush()
        recipients.append(recipient.id)
    def add(index):
        db_session.add(Task(patient_id=account["patient_id"], title=f"Task {index}", owner_id=members[index], due_date=date.today(), category="Coordination"))
        db_session.add(CareHandoff(patient_id=account["patient_id"], title=f"Handoff {index}", from_caregiver_id=account["caregiver_id"], to_caregiver_id=recipients[index], reason="Fictional logistics", status="Prepared"))
    add(0)
    db_session.commit()
    def counts():
        result = {}
        for endpoint, path, extra in (
            ("tasks", "/api/tasks", {}), ("handoffs", "/api/handoffs", {}),
            ("analytics", "/api/analytics", {"patient_id": account["patient_id"], "start": date.today().isoformat(), "end": date.today().isoformat()}),
            ("facts", "/api/analytics/facts", {"patient_id": account["patient_id"]}),
        ):
            queries = []
            def capture(connection, cursor, statement, parameters, context, executemany):
                if statement.lstrip().upper().startswith("SELECT"):
                    queries.append(1)
            event.listen(engine, "before_cursor_execute", capture)
            try:
                response = client.get(path, headers=auth, params={"actor_caregiver_id": account["caregiver_id"], **extra})
                assert response.status_code == 200, response.text
            finally:
                event.remove(engine, "before_cursor_execute", capture)
            result[endpoint] = len(queries)
        return result
    small = counts()
    for index in range(1, 25):
        add(index)
    db_session.commit()
    large = counts()
    print("QUERY_GROWTH", {"one_participant": small, "25_participants": large})
    for endpoint in small:
        assert large[endpoint] <= small[endpoint] + 1, f"{endpoint} has participant-dependent lazy queries: {small} -> {large}"
