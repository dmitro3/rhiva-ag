#!/bin/bash
set -e

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

NAMESPACE="rhiva-ag"

AWS_REFRESH_FILE="$HOME/vps-infra/aws-refresh.sh"
AWS_REFRESH_SCRIPT=". $HOME/rhiva-ag/scripts/aws-refresh.sh"
if [ -f "$AWS_REFRESH_FILE" ]; then
  if ! grep -qF -- "$AWS_REFRESH_SCRIPT" "$AWS_REFRESH_FILE"; then 
    echo "$AWS_REFRESH_SCRIPT" >> "$AWS_REFRESH_FILE"
  fi
fi 

if ! kubectl get namespace rhiva-ag >/dev/null 2>&1; then
  sudo kubectl create namespace $NAMESPACE
fi

sudo kubectl create secret generic rhiva-secrets \
  --from-env-file=.env \
  --namespace $NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

export TAG="dev"
export BUILD_TS=$(date +%s)
  
sudo docker build --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t rhiva-ag/servers:$TAG . -f servers/Dockerfile
sudo docker save rhiva-ag/servers:$TAG | sudo ctr -n k8s.io images import -

. ./scripts/k8s-codegen.sh 
sudo kubectl apply -f infra/k8s