from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import SessionLocal
from app.core.security import hash_password

from app.models.role import Role
from app.models.status import ProfileStatus
from app.models.user import User
from app.models.profile import Profile
from app.models.task_topic import TaskTopic
from app.models.task import Task
from app.models.vehicle import Vehicle
from app.models.directory import Directory
from app.models.document import Document
from app.models.document_version import DocumentVersion

def get_or(db: Session, model, **by):
    row = db.execute(select(model).filter_by(**by)).scalar_one_or_none()
    if row: return row
    obj = model(**by)
    db.add(obj); db.commit(); db.refresh(obj)
    return obj

def ensure_users(db: Session):
    # роли (если нет)
    for code, name in [("super_admin","Super Admin"),("manager","Manager"),("employee","Employee")]:
        get_or(db, Role, code=code, name=name)
    # статусы
    for code, label in [
        ("in_office","В офисе"), ("remote","Удалённо"), ("away","Отошёл"),
        ("meeting","Встреча"), ("dayoff","Выходной"), ("business_trip","Командировка"), ("vacation","Отпуск")
    ]:
        get_or(db, ProfileStatus, code=code, label=label)

    role_admin = db.execute(select(Role).where(Role.code=="super_admin")).scalar_one()
    role_mgr = db.execute(select(Role).where(Role.code=="manager")).scalar_one()
    role_emp = db.execute(select(Role).where(Role.code=="employee")).scalar_one()

    users = [
        ("admin@example.com", "Admin", role_admin.id, "admin123"),
        ("manager@example.com", "Manager Mike", role_mgr.id, "manager123"),
        ("user1@example.com", "Иван Петров", role_emp.id, "user123"),
        ("user2@example.com", "Мария Смирнова", role_emp.id, "user123"),
    ]

    for email, full_name, role_id, pwd in users:
        u = db.execute(select(User).where(User.email==email)).scalar_one_or_none()
        if not u:
            u = User(email=email, full_name=full_name, role_id=role_id, password_hash=hash_password(pwd), is_active=True)
            db.add(u); db.commit(); db.refresh(u)
        if not db.get(Profile, u.id):
            db.add(Profile(user_id=u.id, status_code="in_office")); db.commit()

def ensure_topics_tasks(db: Session):
    t_general = get_or(db, TaskTopic, name="Общее")
    t_it = get_or(db, TaskTopic, name="IT")
    now = datetime.now(tz=timezone.utc)

    if not db.execute(select(Task).where(Task.title=="Обновить ПО на ПК")).first():
        db.add(Task(
            title="Обновить ПО на ПК",
            content="Список ПК в офисе №3",
            due_date=now + timedelta(days=2),
            priority_code="high",
            status_code="new",
            is_private=False,
            type="common",
            topic_id=t_it.id,
            assignee_id=None,
            creator_id=1,
        ))
    if not db.execute(select(Task).where(Task.title=="Закупить бумагу")).first():
        db.add(Task(
            title="Закупить бумагу",
            content="5 пачек А4",
            due_date=now + timedelta(days=1),
            priority_code="medium",
            status_code="in_progress",
            is_private=False,
            type="regular",
            topic_id=t_general.id,
            assignee_id=3,  # user1
            creator_id=2,   # manager
        ))
    db.commit()

def ensure_vehicles(db: Session):
    if not db.execute(select(Vehicle).where(Vehicle.number=="A001AA")).first():
        db.add(Vehicle(number="A001AA", color="white", brand="VW", model="Caddy", status="available"))
    if not db.execute(select(Vehicle).where(Vehicle.number=="B777BB")).first():
        db.add(Vehicle(number="B777BB", color="black", brand="Toyota", model="Camry", status="available"))
    db.commit()

def ensure_docs(db: Session):
    root = get_or(db, Directory, name="Root", parent_id=None)
    hr = get_or(db, Directory, name="HR", parent_id=root.id)
    d = db.execute(select(Document).where(Document.title=="Шаблон договора")).scalar_one_or_none()
    if not d:
        d = Document(directory_id=hr.id, title="Шаблон договора", description="DOCX", created_by=1)
        db.add(d); db.commit(); db.refresh(d)
        dv = DocumentVersion(document_id=d.id, version=1, original_name="template.docx", mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document", size=0, storage_path="N/A", created_by=1)
        db.add(dv); db.commit()

def main():
    db = SessionLocal()
    try:
        ensure_users(db)
        ensure_topics_tasks(db)
        ensure_vehicles(db)
        ensure_docs(db)
        print("Sample data OK")
    finally:
        db.close()

if __name__ == "__main__":
    main()
