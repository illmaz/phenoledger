import os
import boto3
from dotenv import load_dotenv
from supabase import create_client
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

# Service role client — for backend operations that need to bypass RLS
supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# Anon client — for verifying user JWTs
supabase_anon = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_ANON_KEY"],
)

s3 = boto3.client(
    "s3",
    region_name=os.environ["AWS_REGION"],
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
)

_bearer = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(_bearer)):
    token = credentials.credentials
    response = supabase_anon.auth.get_user(token)
    if not response or not response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_ANON_KEY"],
    )
    user_client.postgrest.auth(token)
    return {"user": response.user, "client": user_client}
