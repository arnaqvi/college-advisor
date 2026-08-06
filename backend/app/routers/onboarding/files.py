"""POST/PATCH/DELETE /api/onboarding/files + dev-only raw blob PUT — §6.

Presigned-URL upload flow:
1. POST here -> creates the `uploaded_files` row and returns an upload URL
   (real Azure SAS, or the local dev-fallback endpoint below).
2. Client PUTs the file bytes directly to that URL.
3. Client PATCHes here with `{status: "complete"}` — we verify the blob
   actually exists (never trust the client's word alone) before flipping
   status.
4. DELETE removes the blob (or file) and the DB row together.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.storage import (
    build_storage_key,
    confirm_upload,
    delete_blob,
    generate_upload_url,
    local_blob_path,
)
from app.models.onboarding import UploadedFile
from app.models.user import User
from app.routers.onboarding._common import get_owned_or_404
from app.schemas.onboarding import (
    MAX_UPLOAD_SIZE_BYTES,
    FileCompleteIn,
    FileCreateIn,
    FileCreateOut,
    FileOut,
)

router = APIRouter()


@router.post("", response_model=FileCreateOut, status_code=status.HTTP_201_CREATED)
async def create_file(
    payload: FileCreateIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FileCreateOut:
    storage_key = build_storage_key(current_user.id, payload.owner_type, payload.file_name)
    record = UploadedFile(
        user_id=current_user.id,
        owner_type=payload.owner_type,
        owner_id=payload.owner_id,
        file_name=payload.file_name,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        storage_key=storage_key,
        status="pending",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    upload_url = generate_upload_url(record.id, storage_key, payload.content_type)
    return FileCreateOut(id=record.id, storage_key=storage_key, upload_url=upload_url, status=record.status)


@router.patch("/{file_id}", response_model=FileOut)
async def complete_file_upload(
    file_id: int,
    payload: FileCompleteIn,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UploadedFile:
    record = await get_owned_or_404(db, UploadedFile, file_id, current_user.id, "File not found")

    actual_size = confirm_upload(record.storage_key)
    if actual_size is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Upload not found in storage yet — PUT the file bytes first",
        )

    record.status = payload.status
    record.size_bytes = actual_size
    await db.commit()
    await db.refresh(record)
    return record


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    record = await get_owned_or_404(db, UploadedFile, file_id, current_user.id, "File not found")

    delete_blob(record.storage_key)  # blob first; missing blob is not an error

    await db.delete(record)
    await db.commit()


@router.put("/{file_id}/blob", status_code=status.HTTP_204_NO_CONTENT)
async def upload_file_blob(
    file_id: int,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Dev-only fallback for the presigned PUT (§6) when Azure isn't configured.

    Real deployments never hit this route — the client PUTs straight to the
    Azure SAS URL `generate_upload_url` returns instead.
    """
    record = await get_owned_or_404(db, UploadedFile, file_id, current_user.id, "File not found")

    body = await request.body()
    if len(body) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 15MB upload cap",
        )

    path = local_blob_path(record.storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
