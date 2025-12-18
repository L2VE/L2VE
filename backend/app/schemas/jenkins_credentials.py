from pydantic import BaseModel
from typing import Optional


class JenkinsCredentialResponse(BaseModel):
    id: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    type_name: Optional[str] = None
    credential_type: str
    username: Optional[str] = None
    editable: bool = False
    requires_username: bool = False
    requires_secret: bool = False


class JenkinsCredentialUpdateRequest(BaseModel):
    username: Optional[str] = None
    secret: Optional[str] = None
