from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.models.user import User
from app.schemas.jenkins_credentials import (
    JenkinsCredentialResponse,
    JenkinsCredentialUpdateRequest,
)
from app.utils.auth import get_current_user
from app.utils.jenkins_client import JenkinsClient

router = APIRouter(prefix="/api/jenkins/credentials", tags=["jenkins-credentials"])


@router.get("/", response_model=List[JenkinsCredentialResponse])
async def list_jenkins_credentials(
    current_user: User = Depends(get_current_user),
) -> List[JenkinsCredentialResponse]:
    client = JenkinsClient()
    try:
        return client.list_credentials()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc


@router.patch("/{credential_id}", response_model=JenkinsCredentialResponse)
async def update_jenkins_credential(
    credential_id: str,
    payload: JenkinsCredentialUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> JenkinsCredentialResponse:
    client = JenkinsClient()
    meta = client.get_credential_metadata(credential_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found"
        )
    if not meta.get("editable"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This credential type cannot be edited via API",
        )

    credential_type = meta.get("credential_type")
    description = meta.get("description") or meta.get("display_name") or credential_id

    if credential_type == "username_password":
        username = payload.username or meta.get("username")
        secret = payload.secret
        if not username:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="username is required for this credential",
            )
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A new secret/token is required when updating the credential",
            )
        client.update_credential(
            credential_id,
            credential_type,
            description=description,
            username=username,
            secret=secret,
        )
    elif credential_type == "secret_text":
        if not payload.secret:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A new secret/token is required when updating the credential",
            )
        client.update_credential(
            credential_id,
            credential_type,
            description=description,
            secret=payload.secret,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported credential type: {credential_type}",
        )

    updated = client.get_credential_metadata(credential_id)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Credential updated but verification failed",
        )
    return updated
