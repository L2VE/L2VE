from sqlalchemy import Column, Integer, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class TeamMember(Base):
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_manager = Column(Boolean, default=False, nullable=False)
    joined_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    
    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])

