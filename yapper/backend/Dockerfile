FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY yapper ./yapper
ENV YAPPER_DATA_DIR=/data PYTHONUNBUFFERED=1
VOLUME /data
EXPOSE 8000
CMD ["python", "-m", "yapper.main", "--host", "0.0.0.0", "--port", "8000"]
