from pydantic_settings import SettingsConfigDict, BaseSettings
from functools import lru_cache
import secrets


class Settings(BaseSettings):
    APP_NAME: str = "ConfEval - Conference Review System"
    DEBUG: bool = True
    
    # Database (use PostgreSQL in production, SQLite for local dev)
    DATABASE_URL: str = "postgresql://confeval_user:shadi@localhost:5432/confeval"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Google OAuth (set in .env file)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set = {"pdf", "doc", "docx", "ppt", "pptx", "png", "jpg", "jpeg"}
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
