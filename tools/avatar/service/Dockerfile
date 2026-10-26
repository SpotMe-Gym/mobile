# SpotMe avatar service: Blender (as a Python module) + MPFB2, building one body per request.
#   docker build -f tools/avatar/service/Dockerfile -t spotme-avatar tools/avatar
#   docker run -p 8080:8080 spotme-avatar
FROM python:3.13-slim

# Libraries bpy links against even when headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git libx11-6 libxrender1 libxxf86vm1 libxfixes3 libxi6 libxkbcommon0 libgl1 libsm6 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir bpy==5.2.3 numpy

# Pin MPFB2 so every build produces the same bodies (update deliberately).
ARG MPFB_REF=6ff1eb358f6c1959ced77e79e6dd2406d9a71f49
RUN git clone https://github.com/makehumancommunity/mpfb2 /opt/mpfb2 \
    && git -C /opt/mpfb2 checkout "$MPFB_REF"

WORKDIR /app
COPY build_avatars.py /app/build_avatars.py
COPY service/server.py /app/service/server.py

ENV MPFB_DIR=/opt/mpfb2/src/mpfb AVATAR_CACHE=/var/cache/spotme-avatar PORT=8080
EXPOSE 8080
CMD ["python", "/app/service/server.py"]
