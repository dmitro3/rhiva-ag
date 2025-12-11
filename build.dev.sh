#!/bin/bash
set -e

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if ! kubectl get namespace rhiva-ag >/dev/null 2>&1; then
  kubectl create namespace rhiva-ag
fi

kubectl create secret generic rhiva-secrets \
  --from-env-file=.env.prod \
  --namespace rhiva-ag \
  --dry-run=client -o yaml | kubectl apply -f -
  
docker build --build-arg GITHUB_TOKEN=$GITHUB_TOKEN -t rhiva-ag:latest . -f servers/Dockerfile

./scripts/k8s-codegen.sh 
kubectl apply -f infra/k8s