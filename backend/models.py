from sqlalchemy import Column, Integer, String, DateTime, Text, Float
from sqlalchemy.sql import func
from database import Base


class Employee(Base):
    __tablename__ = "employees"
    employee_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    department = Column(String)
    business_unit = Column(String)
    designation = Column(String)
    manager_id = Column(String)
    current_skills = Column(Text)
    role = Column(String, default="employee")


class Training(Base):
    __tablename__ = "trainings"
    training_id = Column(String, primary_key=True, index=True)
    course_name = Column(String, nullable=False)
    category = Column(String)
    mode = Column(String)
    duration = Column(String)
    trainer_name = Column(String)
    training_date = Column(String)
    seats_available = Column(Integer)
    skill_tags = Column(Text)
    status = Column(String, default="Active")
    batches = Column(Text)


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"
    request_id = Column(String, primary_key=True, index=True)
    request_type = Column(String, default="Self")
    employee_id = Column(String)
    employee_name = Column(String)
    email = Column(String)
    department = Column(String)
    business_unit = Column(String)
    designation = Column(String)
    reporting_manager = Column(String)
    training_id = Column(String)
    course_name = Column(String)
    training_mode = Column(String)
    preferred_batch = Column(String)
    reason = Column(Text)
    expected_outcome = Column(Text)
    status = Column(String, default="Pending L&D Validation")
    submitted_date = Column(DateTime, default=func.now())
    ld_validated_date = Column(DateTime)
    manager_approved_date = Column(DateTime)
    ld_remarks = Column(Text)
    manager_remarks = Column(Text)
    confirmation_sent = Column(Integer, default=0)


class NominationRequest(Base):
    __tablename__ = "nomination_requests"
    nomination_id = Column(String, primary_key=True, index=True)
    manager_id = Column(String)
    manager_name = Column(String)
    manager_email = Column(String)
    department = Column(String)
    business_unit = Column(String)
    training_id = Column(String)
    course_name = Column(String)
    business_need = Column(Text)
    skill_gap = Column(Text)
    priority = Column(String)
    target_completion_date = Column(String)
    status = Column(String, default="Pending L&D Validation")
    submitted_date = Column(DateTime, default=func.now())
    ld_validated_date = Column(DateTime)
    manager_approved_date = Column(DateTime)
    ld_remarks = Column(Text)
    manager_remarks = Column(Text)


class NominationParticipant(Base):
    __tablename__ = "nomination_participants"
    id = Column(Integer, primary_key=True, autoincrement=True)
    nomination_id = Column(String)
    employee_id = Column(String)
    employee_name = Column(String)
    email = Column(String)
    department = Column(String)
    current_skill_level = Column(String)
    required_skill_level = Column(String)
    nomination_reason = Column(Text)
    status = Column(String, default="Nominated")
    confirmation_sent = Column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String)
    performed_by = Column(String)
    role = Column(String)
    timestamp = Column(DateTime, default=func.now())
    remarks = Column(Text)
    entity_id = Column(String)
    entity_type = Column(String)
