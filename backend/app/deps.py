from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import decode_token
from app import models

bearer = HTTPBearer(auto_error=False)

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> models.User:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    data = decode_token(creds.credentials)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please login again.")
    u = db.query(models.User).filter(models.User.id == data.get("sub")).first()
    if not u or not u.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled or not found.")
    # backend is authority on role: overwrite any client claim with DB role
    return u

def require_roles(*roles: str):
    def check(u: models.User = Depends(current_user)):
        if u.role not in roles:
            raise HTTPException(status_code=403, detail=f"Forbidden for role '{u.role}'. Requires: {', '.join(roles)}")
        return u
    return check
