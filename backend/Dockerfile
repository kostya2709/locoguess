FROM python:3.12-slim

WORKDIR /app

# pyproject.toml declares packages = ["app"], so app/ has to be present for
# the build to resolve. photos/ and seed.py are copied afterwards so changing
# a photo doesn't force a dependency reinstall.
COPY pyproject.toml .
COPY app/ app/
RUN pip install --no-cache-dir .

COPY photos/ photos/
COPY seed.py .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
