"""File storage backend for onboarding uploads (docs/onboarding-flow-design.md §6).

Two backends, selected by whether `Settings.azure_storage_connection_string`
is set:

- **Azure Blob Storage** (production / any env with real credentials): a
  short-lived, write-only SAS URL is generated via `azure-storage-blob`, and
  the client `PUT`s bytes directly to Blob Storage — the FastAPI process
  never sees the file bytes.
- **Local dev fallback** (this workspace — no Azure credentials): the
  "presigned URL" instead points at a same-origin endpoint
  (`PUT /api/onboarding/files/{id}/blob`, see
  `app/routers/onboarding/files.py`) that writes the raw request body under
  the gitignored `backend/uploads/` directory.

Both paths use the same `storage_key` layout: `{user_id}/{owner_type}/{uuid}-{file_name}`.
"""

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import get_settings

_SAS_EXPIRY_MINUTES = 15


def build_storage_key(user_id: int, owner_type: str, file_name: str) -> str:
    """Build the blob path §4's `UploadedFile.storage_key` documents."""
    safe_name = Path(file_name).name  # strip any path components
    return f"{user_id}/{owner_type}/{uuid.uuid4()}-{safe_name}"


def uploads_root() -> Path:
    """Local dev fallback root directory (created on first use)."""
    settings = get_settings()
    root = Path(settings.uploads_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def local_blob_path(storage_key: str) -> Path:
    """Resolve a storage_key to its on-disk path under the dev uploads root."""
    return uploads_root() / storage_key


def generate_upload_url(file_id: int, storage_key: str, content_type: str) -> str:
    """Return the URL the client should PUT the file bytes to.

    Real Azure SAS URL if credentials are configured, otherwise the
    same-origin dev fallback endpoint.
    """
    settings = get_settings()
    if not settings.azure_storage_connection_string:
        return f"/api/onboarding/files/{file_id}/blob"

    # Imported lazily so the dependency only needs to import successfully —
    # this branch is untested against real Azure credentials in this
    # workspace, but the import + SAS-generation call are pure/local (no
    # network round-trip to Azure is needed to *sign* a SAS token).
    from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas

    blob_service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    account_name = blob_service.account_name
    account_key = blob_service.credential.account_key  # type: ignore[union-attr]

    expiry = datetime.now(timezone.utc) + timedelta(minutes=_SAS_EXPIRY_MINUTES)
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=settings.azure_storage_container,
        blob_name=storage_key,
        account_key=account_key,
        permission=BlobSasPermissions(write=True, create=True),
        expiry=expiry,
        content_type=content_type,
    )
    account_url = blob_service.url.rstrip("/")
    return f"{account_url}/{settings.azure_storage_container}/{storage_key}?{sas_token}"


def confirm_upload(storage_key: str) -> int | None:
    """Confirm the blob/file actually exists and return its size in bytes.

    Returns None if it doesn't exist. Never trusts the client's word alone
    (doc §6 step 4) — this is called from the PATCH .../files/{id} handler
    before flipping status to "complete".
    """
    settings = get_settings()
    if not settings.azure_storage_connection_string:
        path = local_blob_path(storage_key)
        if not path.is_file():
            return None
        return path.stat().st_size

    from azure.storage.blob import BlobServiceClient

    blob_service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    blob_client = blob_service.get_blob_client(
        container=settings.azure_storage_container, blob=storage_key
    )
    if not blob_client.exists():
        return None
    properties = blob_client.get_blob_properties()
    return int(properties.size)


def delete_blob(storage_key: str) -> None:
    """Delete a blob/file — a missing blob (already gone) is not an error.

    Doc §6 step 5: "if it 404s because it was already gone, proceed".
    """
    settings = get_settings()
    if not settings.azure_storage_connection_string:
        local_blob_path(storage_key).unlink(missing_ok=True)
        return

    from azure.storage.blob import BlobServiceClient
    from azure.core.exceptions import ResourceNotFoundError

    blob_service = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    blob_client = blob_service.get_blob_client(
        container=settings.azure_storage_container, blob=storage_key
    )
    try:
        blob_client.delete_blob()
    except ResourceNotFoundError:
        pass
