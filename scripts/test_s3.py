import os
import boto3
from dotenv import load_dotenv

load_dotenv()

s3 = boto3.client(
    "s3",
    region_name=os.environ["AWS_REGION"],
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
)

response = s3.list_objects_v2(Bucket=os.environ["AWS_S3_BUCKET"])
print(f"connected — {response['KeyCount']} objects in bucket")
