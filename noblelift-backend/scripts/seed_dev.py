from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.role import Role
from app.models.status import ProfileStatus
from app.models.user import User
from app.models.profile import Profile
from app.core.security import hash_password

ROLES = [
    ("super_admin", "Super Admin"),
    ("manager", "Manager"),
    ("employee", "Employee"),
]

STATUSES = [
    ("in_office", "В офисе"),
    ("remote", "Удалённо"),
    ("away", "Отошёл"),
    ("meeting", "Встреча"),
    ("dayoff", "Выходной"),
    ("business_trip", "Командировка"),
    ("vacation", "Отпуск"),
]

def ensure_roles(db: Session) -> None:
    for code, name in ROLES:
        if not db.query(Role).filter_by(code=code).first():
            db.add(Role(code=code, name=name))
    db.commit()

def ensure_statuses(db: Session) -> None:
    for code, label in STATUSES:
        if not db.query(ProfileStatus).filter_by(code=code).first():
            db.add(ProfileStatus(code=code, label=label))
    db.commit()

def ensure_admin(db: Session) -> None:
    role = db.query(Role).filter_by(code="super_admin").first()
    assert role, "Role super_admin must exist"
    user = db.query(User).filter_by(email="admin@example.com").first()
    if not user:
        user = User(
            id=1,
            email="admin@example.com",
            password_hash=hash_password("admin123"),
            full_name="Admin",
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    # профиль
    prof = db.query(Profile).filter_by(user_id=user.id).first()
    if not prof:
        prof = Profile(user_id=user.id, status_code="in_office")
        db.add(prof)
        db.commit()

def main():
    db = SessionLocal()
    try:
        ensure_roles(db)
        ensure_statuses(db)
        ensure_admin(db)
        print("Seed OK: admin@example.com / admin123")
    finally:
        db.close()

if __name__ == "__main__":
    main()
