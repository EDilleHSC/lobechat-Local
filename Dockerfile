# === LM Studio
OPENAI_API_KEY=lm-studio
OPENAI_API_BASE_URL=http://host.docker.internal:1234/v1

# === Ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434

# === OpenAI Fallback (optional)
OPENAI_API_KEY_OPENAI=sk-...  # Your real key
OPENAI_API_BASE_URL_OPENAI=https://api.openai.com/v1

# === Postgres (Server DB mode)
DATABASE_URL=postgresql://lobe:lobe_pass@postgres:5432/lobechat

# === LobeChat
NEXT_PUBLIC_BASE_URL=http://localhost:3210

# === MinIO (Object Storage)
OBJECT_STORAGE_ENDPOINT=http://minio:9000
OBJECT_STORAGE_BUCKET=lobe-bucket
OBJECT_STORAGE_ACCESS_KEY=lobe
OBJECT_STORAGE_SECRET_KEY=lobe1234

# === Vector DB
VECTOR_DB=chroma
VECTOR_DB_URL=http://chroma:8000

# === Enable File Uploads
NEXT_PUBLIC_ENABLE_UPLOAD=true
