from datetime import date, datetime, time

from sqlalchemy import delete

from .database import Base, SessionLocal, engine
from .models import Appointment, AuditLog, CareHandoff, Caregiver, ConsentRecord, Patient, Permission, Task, TimelineEvent

PERMISSIONS = ["Appointments", "Coordination tasks", "Care handoffs", "Approved care updates"]


def seed_database() -> None:
	Base.metadata.create_all(bind=engine)
	db = SessionLocal()
	try:
		db.execute(delete(AuditLog))
		db.execute(delete(ConsentRecord))
		db.execute(delete(CareHandoff))
		db.execute(delete(TimelineEvent))
		db.execute(delete(Appointment))
		db.execute(delete(Task))
		db.execute(delete(Permission))
		db.execute(delete(Caregiver))
		db.execute(delete(Patient))

		patient = Patient(name="Ananya Rao", current_phase="Pregnancy", email="ananya.rao@example.test", phone="+91 90000 00001", created_at=datetime(2026, 3, 12, 9, 0))
		db.add(patient)
		db.flush()

		caregivers = [
			Caregiver(patient_id=patient.id, name="Rahul Rao", relationship="Primary caregiver", email="rahul.rao@example.test", access_status="Active", created_at=datetime(2026, 3, 13, 9, 0)),
			Caregiver(patient_id=patient.id, name="Lakshmi Rao", relationship="Family caregiver", email="lakshmi.rao@example.test", access_status="Active", created_at=datetime(2026, 3, 13, 9, 5)),
			Caregiver(patient_id=patient.id, name="Priya Rao", relationship="Support caregiver", email="priya.rao@example.test", access_status="Active", created_at=datetime(2026, 3, 13, 9, 10)),
		]
		db.add_all(caregivers)
		db.flush()

		permission_values = [[True, True, True, True], [True, True, False, True], [False, True, False, True]]
		for caregiver, enabled_values in zip(caregivers, permission_values):
			db.add_all([Permission(caregiver_id=caregiver.id, permission_name=name, enabled=enabled, updated_at=datetime(2026, 9, 22, 10, 0)) for name, enabled in zip(PERMISSIONS, enabled_values)])

		db.add(Appointment(patient_id=patient.id, title="Next appointment", clinician_name="Dr. Meera Sharma", location="City Women's Clinic", appointment_date=date(2026, 9, 28), appointment_time=time(10, 30), status="Confirmed"))
		db.add_all([
			Task(patient_id=patient.id, title="Prepare appointment documents", owner_id=caregivers[0].id, due_date=date(2026, 9, 28), category="Appointment", status="Open"),
			Task(patient_id=patient.id, title="Confirm transport", owner_id=caregivers[1].id, due_date=date(2026, 9, 28), category="Transport", status="Open"),
			Task(patient_id=patient.id, title="Review appointment details", owner_patient_id=patient.id, due_date=date(2026, 9, 27), category="Patient", status="Open"),
			Task(patient_id=patient.id, title="Confirm caregiver availability", owner_id=caregivers[2].id, due_date=date(2026, 9, 30), category="Coordination", status="Open"),
		])
		db.add(CareHandoff(patient_id=patient.id, title="Appointment coordination", from_caregiver_id=caregivers[0].id, to_caregiver_id=caregivers[1].id, reason="Transport and appointment coordination responsibility", status="Awaiting acknowledgement", created_at=datetime(2026, 9, 26, 9, 0)))

		events = [
			("Coordination", "Care Circle started", "Trusted people were invited to help with appointments and shared responsibilities.", date(2026, 3, 12), None),
			("Appointment", "Introductory clinic visit", "Visit details were added to the shared coordination timeline.", date(2026, 3, 18), "City Women's Clinic"),
			("Care update", "Sharing preferences set", "Ananya chose what appointment and coordination information caregivers can see.", date(2026, 3, 20), "Patient-controlled access"),
			("Care update", "Care status verified", "Clinician-documented care status was reviewed and verified.", date(2026, 9, 22), "City Women's Clinic"),
			("Appointment", "Next appointment", "Maternal care visit coordinated with the Care Circle.", date(2026, 9, 28), "City Women's Clinic"),
			("Coordination", "Transport confirmed", "Transport for the 28 September appointment is assigned.", date(2026, 9, 28), None),
			("Task", "Appointment documents", "Keep approved documents ready for the upcoming visit.", date(2026, 9, 28), None),
			("Coordination", "Caregiver availability", "Confirm who can support around the scheduled visit.", date(2026, 9, 30), None),
			("Appointment", "Follow-up clinic visit", "Scheduled visit kept in the shared coordination calendar.", date(2026, 10, 14), "City Women's Clinic"),
			("Coordination", "Home support rota", "Family caregivers aligned around transport and household help.", date(2026, 10, 14), None),
			("Task", "Approved documents folder", "Keep visit notes and shared paperwork in one place.", date(2026, 10, 16), None),
			("Appointment", "Routine clinic appointment", "Appointment time shared with approved caregivers.", date(2026, 11, 4), "City Women's Clinic"),
			("Coordination", "Care Circle check-in", "Confirm who is available for errands and appointment support.", date(2026, 11, 5), None),
			("Care update", "Sharing settings reviewed", "Access to appointments and coordination updates can be changed at any time.", date(2026, 11, 6), "Patient-controlled access"),
		]
		db.add_all([TimelineEvent(patient_id=patient.id, event_type=event_type, title=title, description=description, event_date=event_date, source=source) for event_type, title, description, event_date, source in events])
		db.commit()
	finally:
		db.close()


if __name__ == "__main__":
	seed_database()
	print("Seeded synthetic MaatruCare demo data.")
