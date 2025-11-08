#!/bin/sh

cp restart.sh "$HOME/vps-infra/restart.sh"

HOST_IP="127.0.0.1"
cat > docker-compose.yml << EOF
services:
  dev:
    container_name: dev
    build:
      context: .
      target: dev
      args:
        - GITHUB_TOKEN=\${GITHUB_TOKEN}
    ports:
      - "8000:8000"
      - "8001:8001"
    restart: on-failure
    # depends_on:
    #   - alloy
    networks:
      - webnet
      - redis
    env_file: 
      - .env
      # - "$HOME/vps-infra/.env"
    environment: 
      GITHUB_TOKEN: \${GITHUB_TOKEN}
      DATABASE_URL: \${APP_DATABASE_URL}
  # alloy:
  #   image: grafana/alloy:latest
  #   container_name: alloy 
  #   volumes: 
  #     - ./config.alloy:/etc/alloy/config.alloy
  #     - /var/run/docker.sock:/var/run/docker.sock
  #   ports: 
  #     - "$HOST_IP:4317:4317"
  #     - "$HOST_IP:4318:4318"
  #     - "$HOST_IP:12345:12345"
  #   command: run --server.http.listen-addr=$HOST_IP:12345 --storage.path=/var/lib/alloy/data /etc/alloy/config.alloy
  #   networks:
  #     - webnet
networks:
  webnet:
    driver: bridge
  redis: 
    external: true
EOF

git pull && \
sudo docker compose build && \
sudo docker compose up -d --remove-orphans
